/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentStatus, AgentProgress, AgentState, Task } from "./types";

export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected status: AgentStatus;
  protected progress: AgentProgress;
  protected assignedTasks: string[];
  protected metadata: Record<string, any>;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.status = "Idle";
    this.progress = { percentage: 0, currentStep: "Uninitialized" };
    this.assignedTasks = [];
    this.metadata = {};
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public getProgress(): AgentProgress {
    return this.progress;
  }

  public updateStatus(status: AgentStatus): void {
    this.status = status;
  }

  public updateProgress(percentage: number, currentStep: string, etaSeconds?: number): void {
    this.progress = { percentage, currentStep, etaSeconds };
  }

  public getAssignedTasks(): string[] {
    return this.assignedTasks;
  }

  public assignTask(taskId: string): void {
    if (!this.assignedTasks.includes(taskId)) {
      this.assignedTasks.push(taskId);
    }
  }

  public getMetadata(): Record<string, any> {
    return this.metadata;
  }

  public setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  // ==========================================
  // LIFECYCLE METHODS (ABSTRACT/OVERRIDABLE)
  // ==========================================

  public async initialize(): Promise<void> {
    this.status = "Idle";
    this.progress = { percentage: 0, currentStep: "Ready" };
  }

  public abstract execute(task: Task): Promise<any>;

  public async pause(): Promise<void> {
    if (this.status === "Running" || this.status === "Planning") {
      this.status = "Paused";
      this.progress.currentStep = "Paused";
    }
  }

  public async resume(): Promise<void> {
    if (this.status === "Paused") {
      this.status = "Running";
      this.progress.currentStep = "Resumed";
    }
  }

  public async stop(): Promise<void> {
    this.status = "Idle";
    this.progress = { percentage: 100, currentStep: "Stopped" };
  }

  public async cancel(): Promise<void> {
    this.status = "Cancelled";
    this.progress.currentStep = "Cancelled";
  }

  // ==========================================
  // STATE PERSISTENCE
  // ==========================================

  public saveState(): AgentState {
    return {
      agentId: this.id,
      status: this.status,
      progress: { ...this.progress },
      tasks: [...this.assignedTasks],
      metadata: { ...this.metadata },
      lastUpdated: new Date().toISOString()
    };
  }

  public restoreState(state: AgentState): void {
    if (state.agentId !== this.id) {
      throw new Error(`State mismatch: Cannot restore state of ${state.agentId} to agent ${this.id}`);
    }
    this.status = state.status;
    this.progress = { ...state.progress };
    this.assignedTasks = [...state.tasks];
    this.metadata = { ...state.metadata };
  }
}
