/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PersistenceConfigService } from "./PersistenceConfigService";

export class RetryService {
  constructor(private configService: PersistenceConfigService) {}

  public async executeWithRetry<T>(
    fn: () => Promise<T>,
    operationName = "operation",
    onRetry?: (attempt: number, error: any, delayMs: number) => void
  ): Promise<T> {
    const config = this.configService.getConfig();
    let attempt = 0;
    let delay = config.retryDelayMs;
    const startTime = Date.now();

    while (true) {
      try {
        return await fn();
      } catch (error: any) {
        attempt++;
        const totalElapsed = Date.now() - startTime;

        if (attempt > config.retryCount || totalElapsed >= config.retryAbortThresholdMs) {
          throw error;
        }

        if (onRetry) {
          onRetry(attempt, error, delay);
        } else {
          console.warn(
            `Retry attempt #${attempt} for "${operationName}" due to: ${
              error?.message || String(error)
            }. Retrying in ${delay}ms.`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, config.retryMaxDelayMs);
      }
    }
  }
}
