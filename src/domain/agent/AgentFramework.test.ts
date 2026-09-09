/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseAgent } from "./BaseAgent";
import { EventBus, MessageBus } from "./EventBus";
import { TaskQueue } from "./TaskQueue";
import { AgentManager } from "./AgentManager";
import { WorkflowEngine } from "./WorkflowEngine";
import { Task, Workflow, WorkflowNode } from "./types";

// Create a concrete MockAgent to test the abstract BaseAgent and scheduling
class MockTestAgent extends BaseAgent {
  public executeCallCount = 0;
  public lastTaskExecuted: Task | null = null;
  public shouldFail = false;
  public executionDelayMs = 0;

  constructor(id: string, name: string) {
    super(id, name);
  }

  public async execute(task: Task): Promise<any> {
    this.executeCallCount++;
    this.lastTaskExecuted = task;

    if (this.executionDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.executionDelayMs));
    }

    if (this.shouldFail) {
      throw new Error("Simulated task execution failure.");
    }

    return { success: true, processedBy: this.id };
  }
}

describe("Autonomous Agent Core Framework", () => {
  beforeEach(() => {
    EventBus.getInstance().clear();
    MessageBus.getInstance().clear();
    TaskQueue.getInstance().clear();
    AgentManager.getInstance().clear();
    WorkflowEngine.getInstance().clear();
    // Re-subscribe WorkflowEngine since EventBus.clear() removed all listeners
    (WorkflowEngine.getInstance() as any).setupEventSubscriptions();
  });

  // ==========================================
  // 1. EVENT & MESSAGE BUS TESTS
  // ==========================================
  describe("Event Bus & Message Bus", () => {
    it("should successfully route events to subscribers", async () => {
      const bus = EventBus.getInstance();
      let triggeredEvent: any = null;

      bus.subscribe("AgentStarted", (e) => {
        triggeredEvent = e;
      });

      bus.emit("AgentStarted", { action: "boot" }, "agent-123", "task-456");

      // Give event bus callbacks a microtask tick to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(triggeredEvent).not.toBeNull();
      expect(triggeredEvent.type).toBe("AgentStarted");
      expect(triggeredEvent.agentId).toBe("agent-123");
      expect(triggeredEvent.taskId).toBe("task-456");
      expect(triggeredEvent.payload.action).toBe("boot");
    });

    it("should allow decoupled agents to speak via Message Bus", async () => {
      const msgBus = MessageBus.getInstance();
      let receivedMsg: any = null;

      msgBus.subscribe("sync_topic", (envelope) => {
        receivedMsg = envelope;
      });

      msgBus.publish("sync_topic", "agent-sender", { text: "Hello Agent!" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedMsg).not.toBeNull();
      expect(receivedMsg.topic).toBe("sync_topic");
      expect(receivedMsg.senderId).toBe("agent-sender");
      expect(receivedMsg.payload.text).toBe("Hello Agent!");
    });
  });

  // ==========================================
  // 2. TASK QUEUE TESTS
  // ==========================================
  describe("Task Queue", () => {
    it("should sort tasks by Priority and falling back to FIFO", () => {
      const queue = TaskQueue.getInstance();

      const taskA: Task = {
        id: "task-A",
        agentId: "agent-1",
        priority: 5,
        createdTime: "2026-07-12T10:00:00Z",
        retries: 0,
        maxRetries: 3,
        currentStep: "Pending",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: {}
      };

      const taskB: Task = {
        id: "task-B",
        agentId: "agent-2",
        priority: 10, // Higher priority
        createdTime: "2026-07-12T10:05:00Z",
        retries: 0,
        maxRetries: 3,
        currentStep: "Pending",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: {}
      };

      const taskC: Task = {
        id: "task-C",
        agentId: "agent-1",
        priority: 5, // Equal priority to A, but older time
        createdTime: "2026-07-12T09:00:00Z",
        retries: 0,
        maxRetries: 3,
        currentStep: "Pending",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: {}
      };

      queue.enqueue(taskA);
      queue.enqueue(taskB);
      queue.enqueue(taskC);

      // Dequeue order should be:
      // 1. taskB (Priority 10)
      // 2. taskC (Priority 5, created 09:00)
      // 3. taskA (Priority 5, created 10:00)
      const first = queue.dequeue();
      expect(first?.id).toBe("task-B");

      const second = queue.dequeue();
      expect(second?.id).toBe("task-C");

      const third = queue.dequeue();
      expect(third?.id).toBe("task-A");
    });

    it("should prevent dequeuing delayed tasks until execution time is reached", () => {
      const queue = TaskQueue.getInstance();

      const futureTime = new Date(Date.now() + 5000).toISOString();
      const delayedTask: Task = {
        id: "task-delayed",
        agentId: "agent-1",
        priority: 10,
        createdTime: new Date().toISOString(),
        retries: 0,
        maxRetries: 1,
        currentStep: "Delayed",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: {},
        delayedUntil: futureTime
      };

      queue.enqueue(delayedTask);

      // Attempt to dequeue
      const item = queue.dequeue();
      expect(item).toBeNull(); // Blocked due to delay
    });
  });

  // ==========================================
  // 3. AGENT MANAGER SCHEDULER TESTS
  // ==========================================
  describe("Agent Manager Scheduler", () => {
    it("should dispatch and execute tasks on registered agents", async () => {
      const manager = AgentManager.getInstance();
      const agent = new MockTestAgent("agent-calc", "Calculator Agent");
      manager.registerAgent(agent);

      const task: Task = {
        id: "task-1",
        agentId: "agent-calc",
        priority: 1,
        createdTime: new Date().toISOString(),
        retries: 0,
        maxRetries: 1,
        currentStep: "Queueing",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: {}
      };

      manager.queueTask(task);

      // Trigger Immediate tick processing
      manager.tick();

      // Wait a micro-second for the task promise to complete execution
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(agent.executeCallCount).toBe(1);
      expect(agent.lastTaskExecuted?.id).toBe("task-1");

      const finishedTask = TaskQueue.getInstance().getTask("task-1");
      expect(finishedTask?.status).toBe("Completed");
    });
  });

  // ==========================================
  // 4. WORKFLOW ENGINE TESTS
  // ==========================================
  describe("Workflow Engine", () => {
    it("should resolve topological nodes by dependencies", async () => {
      const wfEngine = WorkflowEngine.getInstance();
      const manager = AgentManager.getInstance();

      const agent = new MockTestAgent("agent-flow", "Workflow Execution Agent");
      agent.executionDelayMs = 40; // Introduce delay to split ticks
      manager.registerAgent(agent);

      // Formulate simple 2-node workflow: Node B depends on Node A
      const nodeA: WorkflowNode = {
        id: "node-A",
        name: "Download Data",
        type: "Sequential",
        agentId: "agent-flow",
        dependencies: [],
        status: "Idle",
        inputData: {}
      };

      const nodeB: WorkflowNode = {
        id: "node-B",
        name: "Analyze Data",
        type: "Sequential",
        agentId: "agent-flow",
        dependencies: ["node-A"],
        status: "Idle",
        inputData: {}
      };

      const workflow: Workflow = {
        id: "wf-123",
        name: "Data Scraper workflow",
        nodes: {
          "node-A": nodeA,
          "node-B": nodeB
        },
        status: "Idle",
        context: {},
        createdTime: new Date().toISOString()
      };

      wfEngine.registerWorkflow(workflow);
      wfEngine.startWorkflow("wf-123");

      expect(workflow.status).toBe("Running");
      expect(nodeA.status).toBe("Running");
      expect(nodeB.status).toBe("Idle"); // Blocked by Node A

      // Trigger scheduler to run node-A's generated task
      manager.tick();
      
      // Node A is executing with a 40ms delay, so at 10ms it must still be Running
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(nodeA.status).toBe("Running");

      // Wait another 50ms for Node A to complete and trigger Node B
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(nodeA.status).toBe("Completed");
      expect(nodeB.status).toBe("Running");

      // Trigger next task tick to start executing Node B
      manager.tick();
      
      // Node B is executing with a 40ms delay, so at 10ms it should be Running or Completed
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(["Running", "Completed"]).toContain(nodeB.status);

      // Wait another 50ms for Node B to complete and finish the entire workflow
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(nodeB.status).toBe("Completed");
      expect(workflow.status).toBe("Completed");
    });
  });
});
