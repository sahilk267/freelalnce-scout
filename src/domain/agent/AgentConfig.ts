/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentSystemConfig } from "./types";

export class AgentConfig {
  private static instance: AgentConfig;
  private config: AgentSystemConfig;

  private constructor() {
    this.config = {
      maxAgents: 10,
      maxQueueSize: 100,
      defaultRetries: 3,
      defaultTimeoutSeconds: 300,
      maxConcurrency: 3,
      heartbeatIntervalMs: 5000,
      schedulerTickMs: 1000,
      persistenceDirectory: "./data"
    };
  }

  public static getInstance(): AgentConfig {
    if (!AgentConfig.instance) {
      AgentConfig.instance = new AgentConfig();
    }
    return AgentConfig.instance;
  }

  public getConfig(): AgentSystemConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<AgentSystemConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
}
