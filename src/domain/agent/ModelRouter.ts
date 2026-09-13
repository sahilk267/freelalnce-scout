/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IAIClientProvider, AITextOptions, AITextResponse } from "../providers/IAIClientProvider";
import { GeminiClientProvider } from "../providers/GeminiClientProvider";
import { AnthropicClientProvider } from "../providers/AnthropicClientProvider";
import { PersistenceConfigService } from "../services/PersistenceConfigService";
import { cleanAndParseJSON } from "../utils/jsonHelper";
import { IModelProvider, ModelRequest, ModelResponse } from "./types";

export interface AIProviderDiagnostics {
  activeProvider: string;
  primaryProvider: string;
  fallbackProvider: string | null;
  isInCooldown: boolean;
  cooldownRemainingSeconds: number;
  consecutiveFailures: Record<string, number>;
  totalRequests: number;
  failoverCount: number;
  providers: {
    id: string;
    name: string;
    isAvailable: boolean;
    consecutiveFailures: number;
  }[];
}

/**
 * Generic Simulated Provider (OpenAI, Claude simulation, etc.)
 */
export class GenericModelProvider implements IAIClientProvider, IModelProvider {
  constructor(public readonly id: string, public readonly name: string) {}

  public isAvailable(): boolean {
    return true;
  }

  public async generateText(
    promptOrOptions: string | AITextOptions | ModelRequest,
    options?: Partial<AITextOptions>
  ): Promise<AITextResponse & ModelResponse> {
    const prompt =
      typeof promptOrOptions === "string"
        ? promptOrOptions
        : "prompt" in promptOrOptions
        ? promptOrOptions.prompt
        : "";
    const temperature =
      typeof promptOrOptions === "object" && "temperature" in promptOrOptions
        ? promptOrOptions.temperature
        : options?.temperature ?? 0.7;

    const wordCount = prompt.split(/\s+/).filter(Boolean).length;
    const mockOutput = `Simulated response from ${this.name}. Prompt length: ${wordCount} words (temp: ${temperature}). Operating under Aziz OS Autonomous Framework.`;

    return {
      text: mockOutput,
      providerId: this.id,
      usage: {
        promptTokens: Math.floor(wordCount * 1.3) + 10,
        completionTokens: 35,
        totalTokens: Math.floor(wordCount * 1.3) + 45
      }
    };
  }

  public async generateStructured<T = any>(
    promptOrOptions: string | AITextOptions,
    options?: Partial<AITextOptions>
  ): Promise<AITextResponse<T>> {
    const res = await this.generateText(promptOrOptions, options);
    const parsed = cleanAndParseJSON(res.text);
    return {
      ...res,
      data: parsed.data as T
    };
  }
}

export interface ModelRouterOptions {
  primaryProvider?: string;
  fallbackProvider?: string | null;
  failoverThreshold?: number;
  cooldownPeriodMs?: number;
}

/**
 * Central Resilient AI Model Router with Automatic Provider Failover & Cooldown
 */
export class ModelRouter implements IAIClientProvider {
  public readonly id = "model-router";
  public readonly name = "Model Router Gateway";

  private static instance: ModelRouter;
  private clientProviders: Map<string, IAIClientProvider> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private providerTotalRequests: Map<string, number> = new Map();
  private providerTotalFailures: Map<string, number> = new Map();
  private cooldownUntil: number = 0;
  private failoverCount: number = 0;
  private totalRequests: number = 0;
  private customPrimaryId?: string;
  private customFallbackId?: string | null;
  private customThreshold?: number;
  private customCooldownMs?: number;

  public constructor(options?: ModelRouterOptions) {
    if (options?.primaryProvider) this.customPrimaryId = options.primaryProvider;
    if (options?.fallbackProvider !== undefined) this.customFallbackId = options.fallbackProvider;
    if (options?.failoverThreshold !== undefined) this.customThreshold = options.failoverThreshold;
    if (options?.cooldownPeriodMs !== undefined) this.customCooldownMs = options.cooldownPeriodMs;

    // Register standard production & simulated providers
    this.registerProvider(new GeminiClientProvider());
    this.registerProvider(new AnthropicClientProvider());
    this.registerProvider(new GenericModelProvider("openai", "OpenAI GPT-4o"));
    this.registerProvider(new GenericModelProvider("deepseek", "DeepSeek-V3"));
    this.registerProvider(new GenericModelProvider("qwen", "Alibaba Qwen-2.5"));
    this.registerProvider(new GenericModelProvider("ollama", "Ollama (Local)"));
    this.registerProvider(new GenericModelProvider("lmstudio", "LM Studio (Local)"));
    this.registerProvider(new GenericModelProvider("openrouter", "OpenRouter Gateway"));

    this.checkFallbackConfigurationOnBoot();
  }

  public static getInstance(): ModelRouter {
    if (!ModelRouter.instance) {
      ModelRouter.instance = new ModelRouter();
    }
    return ModelRouter.instance;
  }

  private checkFallbackConfigurationOnBoot(): void {
    const fallbackId = this.getFallbackProviderId();
    if (fallbackId) {
      const fallbackProvider = this.clientProviders.get(fallbackId);
      if (!fallbackProvider) {
        console.warn(`[ModelRouter] Configured fallback provider "${fallbackId}" is not registered.`);
      } else if (fallbackProvider.isAvailable && !fallbackProvider.isAvailable()) {
        console.warn(
          `[ModelRouter] Fallback provider "${fallbackId}" API credentials are not configured in environment. Failover will be disabled until credentials are provided.`
        );
      }
    }
  }

  public registerProvider(provider: IAIClientProvider | IModelProvider): void {
    if ("generateStructured" in provider && typeof provider.generateStructured === "function") {
      this.clientProviders.set(provider.id, provider as IAIClientProvider);
    } else {
      // Adapt legacy IModelProvider
      const adapted: IAIClientProvider = {
        id: provider.id,
        name: provider.name,
        generateText: async (opts) => {
          const prompt = typeof opts === "string" ? opts : opts.prompt;
          const sys = typeof opts === "object" ? opts.systemInstruction : undefined;
          const temp = typeof opts === "object" ? opts.temperature : undefined;
          const res = await (provider as IModelProvider).generateText({
            prompt,
            systemInstruction: sys,
            temperature: temp
          });
          return {
            text: res.text,
            providerId: provider.id,
            usage: res.usage
          };
        },
        generateStructured: async (opts) => {
          const prompt = typeof opts === "string" ? opts : opts.prompt;
          const res = await (provider as IModelProvider).generateText({ prompt });
          const parsed = cleanAndParseJSON(res.text);
          return {
            text: res.text,
            data: parsed.data,
            providerId: provider.id,
            usage: res.usage
          };
        }
      };
      this.clientProviders.set(provider.id, adapted);
    }
  }

  public setPrimaryProvider(providerId: string): void {
    this.customPrimaryId = providerId;
  }

  public setFallbackProvider(providerId: string | null): void {
    this.customFallbackId = providerId;
  }

  public setDefaultProvider(providerId: string): void {
    this.setPrimaryProvider(providerId);
  }

  public getPrimaryProviderId(): string {
    return this.customPrimaryId || process.env.AI_PROVIDER_PRIMARY || "gemini";
  }

  public getFallbackProviderId(): string | null {
    if (this.customFallbackId !== undefined) {
      return this.customFallbackId;
    }
    const envFallback = process.env.AI_PROVIDER_FALLBACK;
    return envFallback && envFallback.trim().length > 0 ? envFallback.trim() : null;
  }

  public getFailureThreshold(): number {
    if (this.customThreshold !== undefined) return this.customThreshold;
    if (process.env.AI_PROVIDER_FAILOVER_THRESHOLD) {
      const parsed = Number(process.env.AI_PROVIDER_FAILOVER_THRESHOLD);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    try {
      const cfg = new PersistenceConfigService().getConfig();
      return cfg.retryCount || 3;
    } catch {
      return 3;
    }
  }

  public getCooldownDurationMs(): number {
    if (this.customCooldownMs !== undefined) return this.customCooldownMs;
    if (process.env.AI_PROVIDER_COOLDOWN_MS) {
      const ms = Number(process.env.AI_PROVIDER_COOLDOWN_MS);
      if (!isNaN(ms) && ms > 0) return ms;
    }
    try {
      const cfg = new PersistenceConfigService().getConfig();
      return cfg.retryAbortThresholdMs || 30000;
    } catch {
      return 30000;
    }
  }

  public isInCooldown(): boolean {
    return this.cooldownUntil > Date.now();
  }

  public getActiveProviderId(): string {
    const primaryId = this.getPrimaryProviderId();
    const fallbackId = this.getFallbackProviderId();

    if (this.isInCooldown() && fallbackId) {
      const fallback = this.clientProviders.get(fallbackId);
      if (fallback && (!fallback.isAvailable || fallback.isAvailable())) {
        return fallbackId;
      }
    }

    // Cooldown expired
    if (this.cooldownUntil > 0 && this.cooldownUntil <= Date.now()) {
      this.cooldownUntil = 0;
      this.consecutiveFailures.set(primaryId, 0);
      console.log(`[ModelRouter] Cooldown period elapsed. Active AI provider restored to primary "${primaryId}".`);
    }

    return primaryId;
  }

  public getActiveProvider(): IAIClientProvider {
    const activeId = this.getActiveProviderId();
    const provider = this.clientProviders.get(activeId);
    if (!provider) {
      throw new Error(`AI Provider "${activeId}" is not registered in ModelRouter.`);
    }
    return provider;
  }

  public getClient(): any {
    const active = this.getActiveProvider();
    if (typeof active.getClient === "function") {
      return active.getClient();
    }
    const gemini = this.clientProviders.get("gemini");
    if (gemini && typeof gemini.getClient === "function") {
      return gemini.getClient();
    }
    return null;
  }

  public getProviders(): { id: string; name: string }[] {
    return Array.from(this.clientProviders.values()).map((p) => ({ id: p.id, name: p.name }));
  }

  public getDiagnosticsState(): any {
    const activeId = this.getActiveProviderId();
    const primaryId = this.getPrimaryProviderId();
    const fallbackId = this.getFallbackProviderId();
    const inCooldown = this.isInCooldown();
    const remainingMs = inCooldown ? Math.max(0, this.cooldownUntil - Date.now()) : 0;
    const remainingSec = Math.ceil(remainingMs / 1000);

    const failuresObj: Record<string, number> = {};
    const providersObj: Record<string, any> = {};

    for (const [id, p] of this.clientProviders) {
      const fails = this.consecutiveFailures.get(id) || 0;
      failuresObj[id] = fails;
      providersObj[id] = {
        id: p.id,
        name: p.name,
        consecutiveFailures: fails,
        totalRequests: this.providerTotalRequests.get(id) || 0,
        totalFailures: this.providerTotalFailures.get(id) || 0,
        isCoolingDown: id === primaryId && inCooldown,
        cooldownRemainingMs: id === primaryId && inCooldown ? remainingMs : 0
      };
    }

    return {
      activeProvider: activeId,
      primaryProvider: primaryId,
      fallbackProvider: fallbackId,
      failoverThreshold: this.getFailureThreshold(),
      cooldownPeriodMs: this.getCooldownDurationMs(),
      isInCooldown: inCooldown,
      isFailoverActive: activeId !== primaryId,
      cooldownRemainingSeconds: remainingSec,
      consecutiveFailures: failuresObj,
      totalRequests: this.totalRequests,
      failoverCount: this.failoverCount,
      providers: providersObj
    };
  }

  public resetFailures(providerId?: string): void {
    if (providerId) {
      this.consecutiveFailures.set(providerId, 0);
    } else {
      this.consecutiveFailures.clear();
      this.cooldownUntil = 0;
    }
  }

  public forceCooldown(durationMs?: number): void {
    const ms = durationMs ?? this.getCooldownDurationMs();
    this.cooldownUntil = Date.now() + ms;
  }

  /**
   * Resilient execution with automatic in-flight failover and cooldown tracking
   */
  private async executeWithFailover<T>(
    operationName: string,
    execute: (provider: IAIClientProvider) => Promise<T>
  ): Promise<T> {
    this.totalRequests++;
    const primaryId = this.getPrimaryProviderId();
    const fallbackId = this.getFallbackProviderId();
    const activeId = this.getActiveProviderId();

    const targetProvider = this.clientProviders.get(activeId);
    if (!targetProvider) {
      throw new Error(`AI Provider "${activeId}" is not registered.`);
    }

    this.providerTotalRequests.set(activeId, (this.providerTotalRequests.get(activeId) || 0) + 1);

    try {
      const result = await execute(targetProvider);
      // Success: reset consecutive failures for this provider
      this.consecutiveFailures.set(activeId, 0);
      return result;
    } catch (primaryError: any) {
      this.providerTotalFailures.set(activeId, (this.providerTotalFailures.get(activeId) || 0) + 1);
      const currentFailures = (this.consecutiveFailures.get(activeId) || 0) + 1;
      this.consecutiveFailures.set(activeId, currentFailures);

      const threshold = this.getFailureThreshold();
      if (currentFailures >= threshold && activeId === primaryId && fallbackId) {
        const cooldownMs = this.getCooldownDurationMs();
        this.cooldownUntil = Date.now() + cooldownMs;
        this.failoverCount++;
        console.warn(
          `[ModelRouter] Primary provider "${primaryId}" reached ${currentFailures}/${threshold} consecutive failures. Engaging failover cooldown for ${cooldownMs}ms.`
        );
      }

      // Check if fallback provider is configured, available, and different from activeId
      const candidateFallbackId = activeId === primaryId ? fallbackId : null;
      if (candidateFallbackId) {
        const fallbackProvider = this.clientProviders.get(candidateFallbackId);
        if (fallbackProvider && (!fallbackProvider.isAvailable || fallbackProvider.isAvailable())) {
          this.failoverCount++;
          console.warn(
            `[ModelRouter] In-flight failover for "${operationName}": Primary "${primaryId}" failed (${primaryError.message || primaryError}). Routing in-flight request to fallback "${candidateFallbackId}"...`
          );

          this.providerTotalRequests.set(candidateFallbackId, (this.providerTotalRequests.get(candidateFallbackId) || 0) + 1);

          try {
            const fallbackResult = await execute(fallbackProvider);
            this.consecutiveFailures.set(candidateFallbackId, 0);
            return fallbackResult;
          } catch (fallbackError: any) {
            this.providerTotalFailures.set(candidateFallbackId, (this.providerTotalFailures.get(candidateFallbackId) || 0) + 1);
            const fbFailures = (this.consecutiveFailures.get(candidateFallbackId) || 0) + 1;
            this.consecutiveFailures.set(candidateFallbackId, fbFailures);
            console.error(
              `[ModelRouter] Fallback provider "${candidateFallbackId}" ALSO failed: ${fallbackError.message || fallbackError}. Both providers exhausted.`
            );
            throw new Error(
              `Both AI providers unavailable. Primary ("${primaryId}") error: ${primaryError.message || primaryError}. Fallback ("${candidateFallbackId}") error: ${fallbackError.message || fallbackError}.`
            );
          }
        } else {
          console.warn(
            `[ModelRouter] Fallback provider "${candidateFallbackId}" is configured but unavailable/missing API key. Cannot execute failover.`
          );
        }
      }

      // No fallback available or both failed -> rethrow so deterministic fallback catches it
      throw primaryError;
    }
  }

  /**
   * Main text generation method
   */
  public async generateText(
    promptOrOptions: string | AITextOptions,
    optionsOrProviderId?: Partial<AITextOptions> | string,
    systemInstruction?: string
  ): Promise<AITextResponse> {
    // Handle backwards-compatible signature: generateText(prompt: string, providerId?: string, systemInstruction?: string)
    if (typeof optionsOrProviderId === "string") {
      const explicitProvider = this.clientProviders.get(optionsOrProviderId);
      if (!explicitProvider) {
        throw new Error(`Model Provider with ID "${optionsOrProviderId}" is not registered in ModelRouter.`);
      }
      return explicitProvider.generateText(promptOrOptions as string, { systemInstruction });
    }

    const opts: AITextOptions =
      typeof promptOrOptions === "string"
        ? { prompt: promptOrOptions, ...optionsOrProviderId }
        : { ...promptOrOptions, ...optionsOrProviderId };

    return this.executeWithFailover("generateText", (provider) => provider.generateText(opts));
  }

  /**
   * Structured JSON generation method
   */
  public async generateStructured<T = any>(
    promptOrOptions: string | AITextOptions,
    options?: Partial<AITextOptions>
  ): Promise<AITextResponse<T>> {
    const opts: AITextOptions =
      typeof promptOrOptions === "string"
        ? { prompt: promptOrOptions, ...options }
        : { ...promptOrOptions, ...options };

    return this.executeWithFailover("generateStructured", async (provider) => {
      if (typeof provider.generateStructured === "function") {
        return provider.generateStructured<T>(opts);
      }
      // Fallback structured generation
      const res = await provider.generateText({
        ...opts,
        responseMimeType: "application/json"
      });
      const parsed = cleanAndParseJSON(res.text);
      return {
        ...res,
        data: parsed.data as T
      };
    });
  }
}
