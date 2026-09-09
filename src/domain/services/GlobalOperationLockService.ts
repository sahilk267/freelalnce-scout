/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class GlobalOperationLockService {
  private activeOperation: string | null = null;
  private lockedAt: Date | null = null;

  public acquire(operation: string): boolean {
    if (this.activeOperation) {
      // Check if lock is stale (e.g., held for more than 5 minutes, auto-release for resilience)
      const now = new Date();
      const heldMs = now.getTime() - (this.lockedAt?.getTime() || 0);
      if (heldMs > 5 * 60 * 1000) {
        console.warn(`Releasing stale lock held by "${this.activeOperation}" for ${heldMs}ms`);
        this.activeOperation = operation;
        this.lockedAt = now;
        return true;
      }
      return false;
    }
    this.activeOperation = operation;
    this.lockedAt = new Date();
    return true;
  }

  public release(operation: string): boolean {
    if (this.activeOperation === operation) {
      this.activeOperation = null;
      this.lockedAt = null;
      return true;
    }
    return false;
  }

  public getActiveOperation(): string | null {
    return this.activeOperation;
  }

  public getLockedAt(): Date | null {
    return this.lockedAt;
  }

  public isLocked(): boolean {
    return this.activeOperation !== null;
  }
}
