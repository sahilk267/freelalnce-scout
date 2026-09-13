/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IAIClientProvider, AITextOptions, AITextResponse } from "./IAIClientProvider";
import { cleanAndParseJSON } from "../utils/jsonHelper";

export class AnthropicClientProvider implements IAIClientProvider {
  public readonly id = "anthropic";
  public readonly name = "Anthropic Claude";
  private apiKey?: string;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  public isAvailable(): boolean {
    const key = this.apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  private getApiKey(): string {
    const key = this.apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!key || !key.trim()) {
      throw new Error("ANTHROPIC_API_KEY is not configured in environment variables.");
    }
    return key.trim();
  }

  public async generateText(
    promptOrOptions: string | AITextOptions,
    options?: Partial<AITextOptions>
  ): Promise<AITextResponse> {
    const opts: AITextOptions =
      typeof promptOrOptions === "string"
        ? { prompt: promptOrOptions, ...options }
        : { ...promptOrOptions, ...options };

    const apiKey = this.getApiKey();
    const model = opts.model || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

    const body: Record<string, any> = {
      model,
      max_tokens: opts.maxOutputTokens || 2048,
      messages: [
        {
          role: "user",
          content: opts.prompt
        }
      ]
    };

    if (opts.systemInstruction) {
      body.system = opts.systemInstruction;
    }
    if (opts.temperature !== undefined) {
      body.temperature = Math.max(0, Math.min(1, opts.temperature));
    }
    if (opts.stopSequences && opts.stopSequences.length > 0) {
      body.stop_sequences = opts.stopSequences;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API request failed with HTTP ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    const textBlocks =
      data.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text) || [];
    const text = textBlocks.join("\n");

    return {
      text,
      rawResponse: data,
      providerId: this.id,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
          }
        : undefined
    };
  }

  public async generateStructured<T = any>(
    promptOrOptions: string | AITextOptions,
    options?: Partial<AITextOptions>
  ): Promise<AITextResponse<T>> {
    const opts: AITextOptions =
      typeof promptOrOptions === "string"
        ? { prompt: promptOrOptions, ...options }
        : { ...promptOrOptions, ...options };

    const jsonInstruction =
      "\n\nCRITICAL OUTPUT REQUIREMENT: Respond ONLY with a valid JSON object matching the requested schema. Do not include introductory text, explanations, or conversational markdown outside the JSON.";

    const augmentedPrompt = opts.prompt.includes("JSON") || opts.prompt.includes("json")
      ? opts.prompt
      : `${opts.prompt}${jsonInstruction}`;

    const res = await this.generateText({
      ...opts,
      prompt: augmentedPrompt
    });

    const parsed = cleanAndParseJSON(res.text);
    return {
      ...res,
      data: parsed.data as T
    };
  }
}
