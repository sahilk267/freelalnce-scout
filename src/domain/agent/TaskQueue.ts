/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, TaskStatus } from "./types";
import { EventBus } from "./EventBus";

export class TaskQueue {
  private static instance: TaskQueue;
  private tasks: Map<string, Task>;
  private isPaused: boolean;
  private maxConcurrency: number;
  private activeCount: number;

  private constructor() {
    this.tasks = new Map();
    this.isPaused = false;
    this.maxConcurrency = 3; // Default concurrency limit
    this.activeCount = 0;
  }

  public static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  public setMaxConcurrency(limit: number): void {
    this.maxConcurrency = limit;
  }

  public getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public incrementActive(): void {
    this.activeCount++;
  }

  public decrementActive(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public getPausedStatus(): boolean {
    return this.isPaused;
  }

  /**
   * Enqueue a new task
   */
  public enqueue(task: Task): void {
    // If priority is undefined, set to default 0
    if (task.priority === undefined) {
      task.priority = 0;
    }
    task.status = "Queued";
    this.tasks.set(task.id, task);

    // Emit event
    EventBus.getInstance().emit("TaskQueued", { taskId: task.id, priority: task.priority }, task.agentId, task.id);
  }

  /**
   * Dequeue the next task eligible for execution:
   * 1. Queue is not paused
   * 2. Under max concurrency limits
   * 3. Task status is "Queued"
   * 4. If task has a delay (delayedUntil), that timestamp must be in the past
   * 5. Sorted by Priority (descending), then CreatedTime (ascending - FIFO)
   */
  public dequeue(): Task | null {
    if (this.isPaused || this.activeCount >= this.maxConcurrency) {
      return null;
    }

    const eligible = Array.from(this.tasks.values()).filter((t) => {
      if (t.status !== "Queued") return false;

      // Check delayed tasks
      if (t.delayedUntil) {
        const executeTime = new Date(t.delayedUntil).getTime();
        const now = Date.now();
        if (now < executeTime) return false;
      }

      return true;
    });

    if (eligible.length === 0) {
      return null;
    }

    // Sort by priority (descending) first, then by createdTime (ascending, FIFO)
    eligible.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime();
    });

    const selected = eligible[0];
    selected.status = "Running";
    selected.startedTime = new Date().toISOString();
    this.incrementActive();

    return selected;
  }

  /**
   * Retrieve a specific task by ID
   */
  public getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Retrieve all tasks
   */
  public getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Remove a task from the queue entirely
   */
  public removeTask(id: string): boolean {
    const task = this.getTask(id);
    if (task && task.status === "Running") {
      this.decrementActive();
    }
    return this.tasks.delete(id);
  }

  /**
   * Cancel an active or queued task
   */
  public cancelTask(id: string): boolean {
    const task = this.getTask(id);
    if (!task) return false;

    if (task.status === "Running") {
      this.decrementActive();
    }

    task.status = "Cancelled";
    task.finishedTime = new Date().toISOString();
    task.logs.push(`[${new Date().toISOString()}] Task manually cancelled.`);

    EventBus.getInstance().emit("TaskCancelled", { taskId: id }, task.agentId, id);
    return true;
  }

  /**
   * Pause a running task
   */
  public pauseTask(id: string): boolean {
    const task = this.getTask(id);
    if (!task) return false;

    if (task.status === "Running") {
      this.decrementActive();
      task.status = "Paused";
      task.logs.push(`[${new Date().toISOString()}] Task paused.`);
      return true;
    }
    return false;
  }

  /**
   * Resume a paused task
   */
  public resumeTask(id: string): boolean {
    const task = this.getTask(id);
    if (!task) return false;

    if (task.status === "Paused") {
      task.status = "Queued";
      task.logs.push(`[${new Date().toISOString()}] Task resumed and returned to queue.`);
      return true;
    }
    return false;
  }

  /**
   * Append an execution log to a task
   */
  public addLog(taskId: string, log: string): void {
    const task = this.getTask(taskId);
    if (task) {
      const timestamp = new Date().toISOString();
      task.logs.push(`[${timestamp}] ${log}`);
    }
  }

  /**
   * Update task execution progress
   */
  public updateTaskProgress(taskId: string, progress: number, step: string): void {
    const task = this.getTask(taskId);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      task.currentStep = step;
    }
  }

  /**
   * Mark task as completed. Handle rescheduling if it's a recurring task.
   */
  public completeTask(taskId: string): void {
    const task = this.getTask(taskId);
    if (!task) return;

    if (task.status === "Running") {
      this.decrementActive();
    }

    task.status = "Completed";
    task.progress = 100;
    task.finishedTime = new Date().toISOString();
    task.logs.push(`[${task.finishedTime}] Task completed successfully.`);

    EventBus.getInstance().emit("TaskCompleted", { taskId }, task.agentId, taskId);

    // Check if the completed task has recurring schedule configuration
    if (task.cronExpression) {
      const nextTime = this.calculateNextCronOccurrence(task.cronExpression);
      this.rescheduleRecurringTask(task, nextTime);
    }
  }

  /**
   * Mark task as failed. Evaluate retry policy or set to "Failed" status.
   */
  public failTask(taskId: string, errorMsg: string): void {
    const task = this.getTask(taskId);
    if (!task) return;

    if (task.status === "Running") {
      this.decrementActive();
    }

    task.logs.push(`[${new Date().toISOString()}] Error encountered: ${errorMsg}`);

    if (task.retries < task.maxRetries) {
      task.retries++;
      task.status = "Queued";
      // Exponential backoff for retry delay (e.g. 2s, 4s, 8s...)
      const delayMs = Math.pow(2, task.retries) * 1000;
      task.delayedUntil = new Date(Date.now() + delayMs).toISOString();
      task.logs.push(`[${new Date().toISOString()}] Task scheduled for retry #${task.retries} in ${delayMs / 1000}s.`);

      EventBus.getInstance().emit("RetryStarted", { taskId, attempt: task.retries, nextRun: task.delayedUntil }, task.agentId, taskId);
    } else {
      task.status = "Failed";
      task.finishedTime = new Date().toISOString();
      task.logs.push(`[${task.finishedTime}] Task failed after reaching maximum retries (${task.maxRetries}).`);

      EventBus.getInstance().emit("AgentFailed", { taskId, error: errorMsg }, task.agentId, taskId);
    }
  }

  /**
   * Re-inserts all in-memory tasks (for state restoration)
   */
  public loadPersistedTasks(loadedTasks: Task[]): void {
    this.tasks.clear();
    this.activeCount = 0;
    for (const t of loadedTasks) {
      this.tasks.set(t.id, t);
      if (t.status === "Running") {
        this.activeCount++;
      }
    }
  }

  // ==========================================
  // RECURRING TASK SCHEDULING INTERNALS
  // ==========================================

  private rescheduleRecurringTask(originalTask: Task, nextRun: Date): void {
    const nextTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      agentId: originalTask.agentId,
      priority: originalTask.priority,
      createdTime: new Date().toISOString(),
      retries: 0,
      maxRetries: originalTask.maxRetries,
      currentStep: "Scheduled recurring run",
      progress: 0,
      status: "Queued",
      logs: [`[${new Date().toISOString()}] Spawned recurring run from parent ${originalTask.id}.`],
      metadata: { ...originalTask.metadata, parentTaskId: originalTask.id },
      delayedUntil: nextRun.toISOString(),
      cronExpression: originalTask.cronExpression
    };

    this.enqueue(nextTask);
    this.addLog(originalTask.id, `Rescheduled next recurring task execution (${nextTask.id}) at ${nextRun.toISOString()}.`);
  }

  /**
   * Lightweight cron execution calculator.
   * Resolves common micro-cron offsets safely in pure JS/TS.
   */
  public calculateNextCronOccurrence(cron: string): Date {
    const now = new Date();
    const cleanCron = cron.trim().replace(/\s+/g, " ");

    // Custom offset translations:
    // "*/1 * * * *" or "* * * * *" -> every 1 minute
    // "*/5 * * * *" -> every 5 minutes
    // "0 * * * *" -> every 1 hour (on the hour)
    // "0 0 * * *" -> every 1 day (at midnight)
    if (cleanCron === "*/1 * * * *" || cleanCron === "* * * * *") {
      return new Date(now.getTime() + 60 * 1000);
    } else if (cleanCron === "*/5 * * * *") {
      return new Date(now.getTime() + 5 * 60 * 1000);
    } else if (cleanCron === "0 * * * *") {
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      return nextHour;
    } else if (cleanCron === "0 0 * * *") {
      const nextDay = new Date(now);
      nextDay.setDate(now.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      return nextDay;
    }

    // Default fallback to 10 minutes from now if custom or unmatched cron structure is specified
    return new Date(now.getTime() + 10 * 60 * 1000);
  }

  /**
   * Clear all failed tasks
   */
  public clearFailed(): number {
    let count = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === "Failed") {
        this.tasks.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Retry all failed tasks
   */
  public retryFailed(): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.status === "Failed") {
        task.status = "Queued";
        task.retries = 0;
        task.progress = 0;
        task.logs.push(`[${new Date().toISOString()}] Task manually re-queued for retry.`);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all tasks
   */
  public clear(): void {
    this.tasks.clear();
    this.activeCount = 0;
    this.isPaused = false;
  }
}
