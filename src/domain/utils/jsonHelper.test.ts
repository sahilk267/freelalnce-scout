/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { cleanAndParseJSON } from "./jsonHelper";

describe("cleanAndParseJSON helper", () => {
  it("should successfully parse a valid object", () => {
    const text = '{"name": "Aziz", "role": "assistant"}';
    const result = cleanAndParseJSON(text);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Aziz", role: "assistant" });
    expect(result.error).toBeUndefined();
  });

  it("should successfully parse a valid array", () => {
    const text = '[1, 2, "three", {"four": true}]';
    const result = cleanAndParseJSON(text);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, "three", { four: true }]);
    expect(result.error).toBeUndefined();
  });

  it("should successfully parse markdown fenced JSON", () => {
    const text = "```json\n{\n  \"score\": 95,\n  \"approved\": true\n}\n```";
    const result = cleanAndParseJSON(text);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ score: 95, approved: true });
  });

  it("should extract and parse JSON with extra leading and trailing explanatory text", () => {
    const text = "Sure! Here is the response you requested: {\"id\": \"test-123\", \"ok\": true} Hope this is helpful!";
    const result = cleanAndParseJSON(text);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: "test-123", ok: true });
  });

  it("should return a descriptive error for an empty string", () => {
    const result = cleanAndParseJSON("   ");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Empty or blank response text provided for JSON parsing.");
    expect(result.data).toBeUndefined();
  });

  it("should return a descriptive error for invalid JSON", () => {
    const text = '{"broken": "missing quote, [1, 2]';
    const result = cleanAndParseJSON(text);
    expect(result.success).toBe(false);
    expect(result.error).toContain("JSON parsing failed");
    expect(result.data).toBeUndefined();
  });

  it("should parse arrays enclosed in markdown fences correctly", () => {
    const text = "```\n[\"react\", \"typescript\"]\n```";
    const result = cleanAndParseJSON(text);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(["react", "typescript"]);
  });

  it("should return false and error if no boundaries are located", () => {
    const text = "There is no json object or array here, just plain prose text.";
    const result = cleanAndParseJSON(text);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Could not locate any valid JSON boundaries (curly braces '{}' or square brackets '[]') in the provided text.");
  });
});
