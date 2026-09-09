/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent } from "./BaseAgent";
import { Task, AgentStatus } from "./types";
import { TaskQueue } from "./TaskQueue";
import { EventBus } from "./EventBus";

export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<string, BaseAgent>;
  private queue: TaskQueue;
  private schedulerInterval: NodeJS.Timeout | null;

  private constructor() {
    this.agents = new Map();
    this.queue = TaskQueue.getInstance();
    this.schedulerInterval = null;
  }

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * Register a new agent in the OS
   */
  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getId(), agent);
    EventBus.getInstance().emit("MemoryUpdated", { message: `Agent registered: ${agent.getName()}` }, agent.getId());
  }

  /**
   * Remove an agent from the OS
   */
  public removeAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    this.agents.delete(id);
    EventBus.getInstance().emit("MemoryUpdated", { message: `Agent removed: ${agent.getName()}` }, id);
    return true;
  }

  /**
   * Retrieve a registered agent
   */
  public getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Retrieve all registered agents
   */
  public getAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Add a task to the task queue
   */
  public queueTask(task: Task): void {
    const agent = this.getAgent(task.agentId);
    if (agent) {
      agent.assignTask(task.id);
      agent.updateStatus("Queued");
    }
    this.queue.enqueue(task);
    this.triggerTick();
  }

  /**
   * Pause an agent's activities
   */
  public async pauseAgent(id: string): Promise<void> {
    const agent = this.getAgent(id);
    if (agent) {
      await agent.pause();
      // Pause any active tasks for this agent
      const tasks = this.queue.getTasks().filter((t) => t.agentId === id && t.status === "Running");
      for (const t of tasks) {
        t.status = "Paused";
        this.queue.decrementActive();
        this.queue.addLog(t.id, "Execution paused by agent command.");
      }
    }
  }

  /**
   * Resume an agent's activities
   */
  public async resumeAgent(id: string): Promise<void> {
    const agent = this.getAgent(id);
    if (agent) {
      await agent.resume();
      // Re-queue any paused tasks for this agent
      const tasks = this.queue.getTasks().filter((t) => t.agentId === id && t.status === "Paused");
      for (const t of tasks) {
        t.status = "Queued";
        this.queue.addLog(t.id, "Execution resumed.");
      }
      this.triggerTick();
    }
  }

  /**
   * Cancel an agent's execution
   */
  public async cancelAgent(id: string): Promise<void> {
    const agent = this.getAgent(id);
    if (agent) {
      await agent.cancel();
      // Cancel active/queued tasks for this agent
      const tasks = this.queue.getTasks().filter((t) => t.agentId === id && (t.status === "Running" || t.status === "Queued" || t.status === "Paused"));
      for (const t of tasks) {
        this.queue.cancelTask(t.id);
      }
    }
  }

  /**
   * Restart an agent
   */
  public async restartAgent(id: string): Promise<void> {
    const agent = this.getAgent(id);
    if (agent) {
      await agent.stop();
      await agent.initialize();
      // Set any running tasks to Queued to retry them
      const tasks = this.queue.getTasks().filter((t) => t.agentId === id && t.status === "Running");
      for (const t of tasks) {
        t.status = "Queued";
        this.queue.decrementActive();
        this.queue.addLog(t.id, "Agent restarted. Task returned to queue.");
      }
      this.triggerTick();
    }
  }

  /**
   * Start the scheduler tick interval (e.g. runs every 1000ms)
   */
  public startScheduler(tickIntervalMs: number = 1000): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    this.schedulerInterval = setInterval(() => {
      this.tick();
    }, tickIntervalMs);
  }

  /**
   * Stop the scheduler tick interval
   */
  public stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Execute immediate tick trigger (asynchronous, non-blocking)
   */
  public triggerTick(): void {
    setTimeout(() => this.tick(), 0);
  }

  /**
   * Core scheduler tick:
   * Finds eligible queued tasks and executes them on the registered agents.
   */
  public tick(): void {
    let nextTask = this.queue.dequeue();
    while (nextTask) {
      const task = nextTask;
      const agent = this.getAgent(task.agentId);

      if (!agent) {
        // Safe protection: Agent not in registry
        this.queue.failTask(task.id, `Agent with ID "${task.agentId}" is not registered in the framework.`);
        nextTask = this.queue.dequeue();
        continue;
      }

      // Update states
      agent.updateStatus("Running");
      agent.updateProgress(0, "Starting Execution");
      this.queue.addLog(task.id, `Dispatching task execution to agent: ${agent.getName()}`);

      EventBus.getInstance().emit("AgentStarted", { taskId: task.id }, agent.getId(), task.id);

      // Execute in non-blocking background thread/promise
      agent
        .execute(task)
        .then((result) => {
          agent.updateStatus("Idle");
          agent.updateProgress(100, "Completed Task Successfully");
          this.queue.addLog(task.id, `Task completed successfully: ${JSON.stringify(result || {})}`);
          this.queue.completeTask(task.id);
          EventBus.getInstance().emit("AgentFinished", { taskId: task.id, result }, agent.getId(), task.id);
          this.triggerTick(); // Check for more tasks immediately
        })
        .catch((err) => {
          const errorMsg = err.message || String(err);
          agent.updateStatus(task.retries < task.maxRetries ? "Retrying" : "Failed");
          agent.updateProgress(0, `Execution Failed: ${errorMsg}`);
          this.queue.failTask(task.id, errorMsg);
          this.triggerTick(); // Run next tick immediately
        });

      // Attempt to pull next task (loop continues if concurrency allows)
      nextTask = this.queue.dequeue();
    }
  }

  /**
   * Clear all agents and queue
   */
  public clear(): void {
    this.stopScheduler();
    this.agents.clear();
    this.queue.clear();
  }
}
