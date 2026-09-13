/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AITextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  model?: string;
}

export interface AITextResponse<T = any> {
  text: string;
  data?: T;
  rawResponse?: any;
  providerId?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface IAIClientProvider {
  readonly id?: string;
  readonly name?: string;
  isAvailable?(): boolean;
  generateText?(promptOrOptions: string | AITextOptions, options?: Partial<AITextOptions>): Promise<AITextResponse>;
  generateStructured?<T = any>(promptOrOptions: string | AITextOptions, options?: Partial<AITextOptions>): Promise<AITextResponse<T>>;
  getClient?(): any;
}

