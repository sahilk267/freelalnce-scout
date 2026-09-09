/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { IAIClientProvider } from "./IAIClientProvider";

export class GeminiClientProvider implements IAIClientProvider {
  private client: GoogleGenAI | null = null;

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
}
