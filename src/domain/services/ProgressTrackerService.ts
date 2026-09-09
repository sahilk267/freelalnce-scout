/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OperationProgress {
  operationId: string;
  operation: "backup" | "restore" | "migration" | "validation";
  stage: string;
  percentage: number;
  elapsedTimeMs: number;
  estimatedRemainingTimeMs: number;
  currentRecordName: string;
  errors: string[];
  warnings: string[];
  timestamp: string;
}

export class ProgressTrackerService {
  private activeProgress: OperationProgress | null = null;
  private listeners: Set<(progress: OperationProgress) => void> = new Set();

  public registerListener(listener: (progress: OperationProgress) => void): () => void {
    this.listeners.add(listener);
    // Send current active progress if any
    if (this.activeProgress) {
      listener(this.activeProgress);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public updateProgress(progress: OperationProgress): void {
    this.activeProgress = progress;
    for (const listener of this.listeners) {
      try {
        listener(progress);
      } catch (err) {
        // Safe catch for closed/broken connections
      }
    }
  }

  public getActiveProgress(): OperationProgress | null {
    return this.activeProgress ? { ...this.activeProgress } : null;
  }

  public clearProgress(): void {
    this.activeProgress = null;
  }
}
