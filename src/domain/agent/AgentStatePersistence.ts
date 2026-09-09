/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { TaskQueue } from "./TaskQueue";
import { AgentManager } from "./AgentManager";
import { WorkflowEngine } from "./WorkflowEngine";
import { EventBus } from "./EventBus";
import { SystemOperationalAgent } from "./SystemOperationalAgent";
import { FreelancerAgent } from "./FreelancerAgent";

export class AgentStatePersistence {
  private static instance: AgentStatePersistence;
  private filePath: string;

  private constructor() {
    this.filePath = path.join(process.cwd(), "data", "agent_state.json");
  }

  public static getInstance(): AgentStatePersistence {
    if (!AgentStatePersistence.instance) {
      AgentStatePersistence.instance = new AgentStatePersistence();
    }
    return AgentStatePersistence.instance;
  }

  /**
   * Save the complete framework state: Queue, Tasks, Agent Progresses, and Workflows
   */
  public async saveSystemState(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const queue = TaskQueue.getInstance();
      const manager = AgentManager.getInstance();
      const workflowEngine = WorkflowEngine.getInstance();

      const tasks = queue.getTasks();
      const isQueuePaused = queue.getPausedStatus();

      // Gather Agent States
      const agentStates = manager.getAgents().map((a) => a.saveState());

      // Gather Workflows
      const workflows = workflowEngine.getWorkflows();

      const snapshot = {
        timestamp: new Date().toISOString(),
        isQueuePaused,
        tasks,
        agentStates,
        workflows
      };

      fs.writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), "utf-8");
      EventBus.getInstance().emit("MemoryUpdated", { message: `Autonomous state persisted to storage.` });
    } catch (err: any) {
      console.error("[AgentStatePersistence] Save state failed:", err.message || err);
    }
  }

  /**
   * Restore the complete framework state from disk
   */
  public async loadSystemState(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return false;
      }

      const raw = fs.readFileSync(this.filePath, "utf-8");
      if (!raw || raw.trim() === "") return false;

      const snapshot = JSON.parse(raw);
      if (!snapshot) return false;

      const queue = TaskQueue.getInstance();
      const manager = AgentManager.getInstance();
      const workflowEngine = WorkflowEngine.getInstance();

      // Restore Queue paused status
      if (snapshot.isQueuePaused) {
        queue.pause();
      } else {
        queue.resume();
      }

      // Restore Tasks
      if (Array.isArray(snapshot.tasks)) {
        queue.loadPersistedTasks(snapshot.tasks);
      }

      // Restore individual Agent States
      if (Array.isArray(snapshot.agentStates)) {
        for (const state of snapshot.agentStates) {
          let agent = manager.getAgent(state.agentId);
          if (!agent) {
            if (state.agentId === "agent-scout") {
              agent = new FreelancerAgent(state.agentId, state.name || "Freelance Automation Scout");
            } else {
              agent = new SystemOperationalAgent(state.agentId, state.name || state.agentId, state.capabilities || []);
            }
            manager.registerAgent(agent);
          }
          agent.restoreState(state);
        }
      }

      // Restore Workflows
      if (Array.isArray(snapshot.workflows)) {
        for (const wf of snapshot.workflows) {
          workflowEngine.registerWorkflow(wf);
        }
      }

      EventBus.getInstance().emit("MemoryUpdated", { message: `Framework state restored from persistent storage.` });
      return true;
    } catch (err: any) {
      console.error("[AgentStatePersistence] Load state failed, starting clean:", err.message || err);
      return false;
    }
  }
}
