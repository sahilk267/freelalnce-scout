/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

export interface IAIClientProvider {
  getClient(): GoogleGenAI;
}
