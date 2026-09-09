/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParseResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * A highly robust, production-grade helper to clean and parse JSON text.
 * Handles markdown code fences, leading/trailing conversational texts,
 * and empty or invalid JSON securely without throwing uncaught exceptions.
 */
export function cleanAndParseJSON(text: string | null | undefined): ParseResult {
  if (text === null || text === undefined) {
    return {
      success: false,
      error: "Null or undefined response text provided for JSON parsing."
    };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      success: false,
      error: "Empty or blank response text provided for JSON parsing."
    };
  }

  // 1. Direct parsing check (fast path)
  try {
    const parsed = JSON.parse(trimmed);
    return { success: true, data: parsed };
  } catch (e) {
    // Direct parsing failed, proceed to extraction and cleaning
  }

  let cleaned = trimmed;

  // 2. Handle Markdown code fences: ```json ... ```
  // Regex matches any backtick block, optional language identifier, and grabs the core contents.
  const codeBlockRegex = /```(?:json|JSON|javascript|js)?\s*([\s\S]*?)\s*```/;
  const match = codeBlockRegex.exec(cleaned);
  if (match) {
    cleaned = match[1].trim();
    // Try parsing the code block content directly
    try {
      const parsed = JSON.parse(cleaned);
      return { success: true, data: parsed };
    } catch (e) {
      // Proceed to envelope boundary parsing if direct parse fails
    }
  }

  // 3. Envelope boundary extraction to isolate JSON from leading/trailing narrative
  const firstCurly = cleaned.indexOf("{");
  const lastCurly = cleaned.lastIndexOf("}");
  const firstSquare = cleaned.indexOf("[");
  const lastSquare = cleaned.lastIndexOf("]");

  let startIdx = -1;
  let endIdx = -1;

  if (firstCurly !== -1 && firstSquare !== -1) {
    if (firstSquare < firstCurly && lastSquare > lastCurly) {
      // Square brackets are on the outside (e.g. array of objects: [{"id": 1}])
      startIdx = firstSquare;
      endIdx = lastSquare;
    } else if (firstCurly < firstSquare && lastCurly > lastSquare) {
      // Curly braces are on the outside (e.g. object containing array: {"data": [1]})
      startIdx = firstCurly;
      endIdx = lastCurly;
    } else {
      // Disjoint or complex; default to the widest outer range
      startIdx = Math.min(firstCurly, firstSquare);
      endIdx = Math.max(lastCurly, lastSquare);
    }
  } else if (firstCurly !== -1) {
    startIdx = firstCurly;
    endIdx = lastCurly;
  } else if (firstSquare !== -1) {
    startIdx = firstSquare;
    endIdx = lastSquare;
  }

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return {
      success: false,
      error: "Could not locate any valid JSON boundaries (curly braces '{}' or square brackets '[]') in the provided text."
    };
  }

  const extracted = cleaned.substring(startIdx, endIdx + 1).trim();

  try {
    const parsed = JSON.parse(extracted);
    return { success: true, data: parsed };
  } catch (err: any) {
    const snippet = extracted.length > 80 ? `${extracted.slice(0, 80)}...` : extracted;
    return {
      success: false,
      error: `JSON parsing failed: ${err.message || String(err)}. Extract attempted: "${snippet}"`
    };
  }
}
