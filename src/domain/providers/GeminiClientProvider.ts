/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { IAIClientProvider, AITextOptions, AITextResponse } from "./IAIClientProvider";
import { cleanAndParseJSON } from "../utils/jsonHelper";

export class GeminiClientProvider implements IAIClientProvider {
  public readonly id = "gemini";
  public readonly name = "Google Gemini";
  private client: GoogleGenAI | null = null;

  public isAvailable(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key && key !== "MY_GEMINI_API_KEY");
  }

  getClient(): GoogleGenAI {
    if (!this.client) {
      const key = process.env.GEMINI_API_KEY;
      if (!key || key === "MY_GEMINI_API_KEY") {
        throw new Error("GEMINI_API_KEY is not configured in secrets/environment variables.");
      }
      this.client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
    return this.client;
  }

  public async generateText(
    promptOrOptions: string | AITextOptions,
    options?: Partial<AITextOptions>
  ): Promise<AITextResponse> {
    const opts: AITextOptions =
      typeof promptOrOptions === "string"
        ? { prompt: promptOrOptions, ...options }
        : { ...promptOrOptions, ...options };

    const client = this.getClient();
    const config: Record<string, any> = {};
    if (opts.systemInstruction) config.systemInstruction = opts.systemInstruction;
    if (opts.temperature !== undefined) config.temperature = opts.temperature;
    if (opts.maxOutputTokens !== undefined) config.maxOutputTokens = opts.maxOutputTokens;
    if (opts.stopSequences) config.stopSequences = opts.stopSequences;
    if (opts.responseMimeType) config.responseMimeType = opts.responseMimeType;

    const response = await client.models.generateContent({
      model: opts.model || "gemini-3.8-flash",
      contents: opts.prompt,
      config: Object.keys(config).length > 0 ? config : undefined
    });

    return {
      text: response.text || "",
      rawResponse: response,
      providerId: this.id,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount
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

    const res = await this.generateText({
      ...opts,
      responseMimeType: "application/json"
    });

    const parsed = cleanAndParseJSON(res.text);
    return {
      ...res,
      data: parsed.data as T
    };
  }
}

