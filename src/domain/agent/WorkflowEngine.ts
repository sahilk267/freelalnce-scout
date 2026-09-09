/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Workflow, WorkflowNode, Task, TaskStatus } from "./types";
import { AgentManager } from "./AgentManager";
import { EventBus } from "./EventBus";

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private workflows: Map<string, Workflow>;

  private constructor() {
    this.workflows = new Map();
    this.setupEventSubscriptions();
  }

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Registers a workflow in the engine
   */
  public registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Retrieves a workflow by ID
   */
  public getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Retrieves all workflows
   */
  public getWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Starts a workflow's execution
   */
  public startWorkflow(id: string): void {
    const workflow = this.getWorkflow(id);
    if (!workflow) {
      throw new Error(`Workflow with ID "${id}" not found.`);
    }

    workflow.status = "Running";
    workflow.startedTime = new Date().toISOString();

    EventBus.getInstance().emit("TaskQueued", { message: `Workflow "${workflow.name}" started.` }, undefined, id);
    this.processWorkflowNodes(workflow);
  }

  /**
   * Cancels a running workflow
   */
  public cancelWorkflow(id: string): void {
    const workflow = this.getWorkflow(id);
    if (!workflow) return;

    workflow.status = "Cancelled";
    workflow.finishedTime = new Date().toISOString();

    // Cancel all running node tasks
    const manager = AgentManager.getInstance();
    for (const nodeId in workflow.nodes) {
      const node = workflow.nodes[nodeId];
      if (node.status === "Running" || node.status === "Queued") {
        node.status = "Cancelled";
        const taskId = `task-wf-${workflow.id}-${node.id}`;
        // Terminate from queue
        const task = manager.getAgent(node.agentId)?.getAssignedTasks();
        manager.cancelAgent(node.agentId);
      }
    }

    EventBus.getInstance().emit("TaskCancelled", { message: `Workflow "${workflow.name}" cancelled.` }, undefined, id);
  }

  /**
   * Evaluates dependencies and dispatches eligible nodes in parallel or sequence
   */
  private processWorkflowNodes(workflow: Workflow): void {
    if (workflow.status !== "Running") return;

    let hasRunningOrQueuedNodes = false;
    let hasFailedNodes = false;
    const eligibleNodes: WorkflowNode[] = [];

    for (const nodeId in workflow.nodes) {
      const node = workflow.nodes[nodeId];

      if (node.status === "Running" || node.status === "Queued") {
        hasRunningOrQueuedNodes = true;
        continue;
      }

      if (node.status === "Failed") {
        hasFailedNodes = true;
        continue;
      }

      if (node.status === "Completed") {
        continue;
      }

      // Check dependencies
      const dependenciesMet = node.dependencies.every(
        (depId) => workflow.nodes[depId]?.status === "Completed"
      );

      if (dependenciesMet) {
        eligibleNodes.push(node);
      }
    }

    // If a node failed and there are no currently executing tasks, fail the entire workflow
    if (hasFailedNodes && !hasRunningOrQueuedNodes) {
      workflow.status = "Failed";
      workflow.finishedTime = new Date().toISOString();
      EventBus.getInstance().emit("AgentFailed", { message: `Workflow "${workflow.name}" failed.` }, undefined, workflow.id);
      return;
    }

    // If all nodes are completed successfully, complete the workflow
    const allCompleted = Object.values(workflow.nodes).every((n) => n.status === "Completed");
    if (allCompleted) {
      workflow.status = "Completed";
      workflow.finishedTime = new Date().toISOString();
      EventBus.getInstance().emit("TaskCompleted", { message: `Workflow "${workflow.name}" completed successfully.` }, undefined, workflow.id);
      return;
    }

    // Dispatch all currently eligible nodes in parallel
    for (const node of eligibleNodes) {
      this.executeNode(workflow, node);
    }
  }

  /**
   * Executes a single workflow node logic based on its node type
   */
  private executeNode(workflow: Workflow, node: WorkflowNode): void {
    node.status = "Running";

    // 1. CONDITIONAL NODE EXECUTION
    if (node.type === "Conditional") {
      let result = false;
      if (node.condition) {
        try {
          result = node.condition(workflow.context);
        } catch (e) {
          console.error(`Error executing condition in node "${node.id}":`, e);
        }
      } else if (node.inputData && typeof node.inputData.conditionKey === "string") {
        // Fallback rule evaluation
        const val = workflow.context[node.inputData.conditionKey];
        const target = node.inputData.conditionValue;
        result = val === target;
      }

      node.status = "Completed";
      node.outputData = { conditionPassed: result };
      workflow.context[`node_${node.id}_result`] = node.outputData;

      // Reschedule next nodes
      this.processWorkflowNodes(workflow);
      return;
    }

    // 2. LOOP / REPEAT NODE EXECUTION
    if (node.type === "Loop" && node.loopConfig) {
      const items = workflow.context[node.loopConfig.itemsPath];

      if (!Array.isArray(items) || items.length === 0) {
        // Empty array loop completes instantly
        node.status = "Completed";
        this.processWorkflowNodes(workflow);
        return;
      }

      // We simulate loop completions. In a production AI OS, we'd spawn multiple sub-nodes.
      // Here, we spawn a sequential simulation task to perform the work.
      const task: Task = {
        id: `task-wf__${workflow.id}__${node.id}`,
        agentId: node.agentId,
        priority: 5,
        createdTime: new Date().toISOString(),
        retries: 0,
        maxRetries: node.retryPolicy?.maxRetries || 1,
        currentStep: `Processing loop over ${items.length} items`,
        progress: 0,
        status: "Queued",
        logs: [`[${new Date().toISOString()}] Loop task initiated for ${items.length} entries.`],
        metadata: { workflowId: workflow.id, nodeId: node.id, loopItems: items }
      };

      AgentManager.getInstance().queueTask(task);
      return;
    }

    // 3. SEQUENTIAL / PARALLEL EXECUTION Task dispatching
    const task: Task = {
      id: `task-wf__${workflow.id}__${node.id}`,
      agentId: node.agentId,
      priority: 5,
      createdTime: new Date().toISOString(),
      retries: 0,
      maxRetries: node.retryPolicy?.maxRetries || 2,
      currentStep: `Running workflow step: ${node.name}`,
      progress: 0,
      status: "Queued",
      logs: [`[${new Date().toISOString()}] Node task queued for agent ${node.agentId}.`],
      metadata: { workflowId: workflow.id, nodeId: node.id, ...node.inputData }
    };

    AgentManager.getInstance().queueTask(task);
  }

  /**
   * Subscribe to global event bus. When tasks complete, check if they belong to a workflow node
   */
  private setupEventSubscriptions(): void {
    const bus = EventBus.getInstance();

    // Node successfully finished
    bus.subscribe("TaskCompleted", (event) => {
      if (event.taskId && event.taskId.startsWith("task-wf__")) {
        const payloadStr = event.taskId.substring("task-wf__".length);
        const splitIdx = payloadStr.indexOf("__");
        if (splitIdx !== -1) {
          const workflowId = payloadStr.substring(0, splitIdx);
          const nodeId = payloadStr.substring(splitIdx + 2);

          const workflow = this.getWorkflow(workflowId);
          if (workflow) {
            const node = workflow.nodes[nodeId];
            if (node) {
              node.status = "Completed";
              // Capture output data if provided
              node.outputData = event.payload?.result || { status: "success" };
              workflow.context[`node_${nodeId}_result`] = node.outputData;

              // Check for next eligible nodes
              this.processWorkflowNodes(workflow);
            }
          }
        }
      }
    });

    // Node failed
    bus.subscribe("AgentFailed", (event) => {
      if (event.taskId && event.taskId.startsWith("task-wf__")) {
        const payloadStr = event.taskId.substring("task-wf__".length);
        const splitIdx = payloadStr.indexOf("__");
        if (splitIdx !== -1) {
          const workflowId = payloadStr.substring(0, splitIdx);
          const nodeId = payloadStr.substring(splitIdx + 2);

          const workflow = this.getWorkflow(workflowId);
          if (workflow) {
            const node = workflow.nodes[nodeId];
            if (node) {
              node.status = "Failed";
              this.processWorkflowNodes(workflow);
            }
          }
        }
      }
    });
  }

  /**
   * Clear all active workflows
   */
  public clear(): void {
    this.workflows.clear();
  }
}
