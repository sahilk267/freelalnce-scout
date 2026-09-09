/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentMetrics } from "./types";
import { AgentManager } from "./AgentManager";
import { TaskQueue } from "./TaskQueue";

export class AgentMonitor {
  private static instance: AgentMonitor;

  private constructor() {}

  public static getInstance(): AgentMonitor {
    if (!AgentMonitor.instance) {
      AgentMonitor.instance = new AgentMonitor();
    }
    return AgentMonitor.instance;
  }

  /**
   * Compiles and retrieves full framework and server system metrics
   */
  public getMetrics(): AgentMetrics {
    const manager = AgentManager.getInstance();
    const queue = TaskQueue.getInstance();

    const agents = manager.getAgents();
    const tasks = queue.getTasks();

    const runningAgents = agents.filter((a) => a.getStatus() === "Running" || a.getStatus() === "Planning").length;
    const queuedAgents = tasks.filter((t) => t.status === "Queued").length;

    const completedTasks = tasks.filter((t) => t.status === "Completed");
    const failedTasks = tasks.filter((t) => t.status === "Failed").length;

    // Calculate average completed task runtime (in seconds)
    let totalRuntimeMs = 0;
    completedTasks.forEach((t) => {
      if (t.startedTime && t.finishedTime) {
        const start = new Date(t.startedTime).getTime();
        const end = new Date(t.finishedTime).getTime();
        totalRuntimeMs += Math.max(0, end - start);
      }
    });

    const averageRuntimeSeconds = completedTasks.length > 0
      ? Number((totalRuntimeMs / completedTasks.length / 1000).toFixed(1))
      : 0.0;

    // Sum up retries
    let totalRetriesCount = 0;
    tasks.forEach((t) => {
      totalRetriesCount += t.retries;
    });

    // Capture real host memory footprint (MB)
    const memUsageBytes = process.memoryUsage().heapUsed;
    const memoryUsageMB = Number((memUsageBytes / 1024 / 1024).toFixed(1));

    // Simulated CPU load proportional to active agent concurrency
    const cpuBase = 5; // Standard system overhead
    const cpuMultiplier = 15; // +15% per active agent
    const cpuUsagePercentage = Math.min(99, cpuBase + runningAgents * cpuMultiplier);

    return {
      runningAgents,
      queuedAgents,
      completedTasks: completedTasks.length,
      failedTasks,
      averageRuntimeSeconds,
      totalRetriesCount,
      cpuUsagePercentage,
      memoryUsageMB
    };
  }
}
