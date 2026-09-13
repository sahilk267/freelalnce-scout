/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IAIClientProvider } from "../providers/IAIClientProvider";
import { Candidate } from "../models/Candidate";
import { cleanAndParseJSON } from "../utils/jsonHelper";

export class ResumeParserService {
  private aiProvider?: IAIClientProvider;

  constructor(providerOrClient?: IAIClientProvider | any) {
    if (providerOrClient) {
      if (typeof providerOrClient.generateText === "function") {
        this.aiProvider = providerOrClient as IAIClientProvider;
      } else if (typeof providerOrClient.models?.generateContent === "function") {
        // Adapt legacy GoogleGenAI client
        this.aiProvider = {
          id: "legacy",
          name: "Legacy Gemini Client",
          generateText: async (opts) => {
            const prompt = typeof opts === "string" ? opts : opts.prompt;
            const res = await providerOrClient.models.generateContent({
              contents: prompt
            });
            return { text: res.text || "" };
          }
        };
      }
    }
  }

  public async parseResume(resumeText: string): Promise<Omit<Candidate, "id">> {
    if (!resumeText || !resumeText.trim()) {
      throw new Error("Resume content is empty.");
    }

    if (!this.aiProvider) {
      console.warn("[ResumeParserService] AI provider not configured, falling back to local heuristic parsing.");
      return this.fallbackParse(resumeText);
    }

    try {
      const prompt = `Analyze the following resume text and extract the structured candidate profile.
Return ONLY a valid JSON object matching the schema below. Do NOT include markdown code fences, comments, or any extra text.

JSON Schema:
{
  "name": "Full Name",
  "skills": ["Skill1", "Skill2", ...],
  "experienceYears": 5, // Integer representing years of experience. Extract carefully from the timeline.
  "locationPreference": "Remote" or a specific country/city
}

Resume Text:
${resumeText}`;

      let responseText = "";
      if (typeof this.aiProvider.generateStructured === "function") {
        const res = await this.aiProvider.generateStructured({ prompt });
        if (res.data && res.data.name) {
          return {
            name: res.data.name || "Parsed Candidate",
            skills: Array.isArray(res.data.skills) ? res.data.skills : [],
            experienceYears: typeof res.data.experienceYears === "number" ? res.data.experienceYears : 2,
            locationPreference: res.data.locationPreference || "Remote"
          };
        }
        responseText = res.text;
      } else {
        const res = await this.aiProvider.generateText({ prompt, responseMimeType: "application/json" });
        responseText = res.text;
      }

      const parsedResult = cleanAndParseJSON(responseText);
      const parsed = parsedResult.data || {};

      return {
        name: parsed.name || "Parsed Candidate",
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experienceYears: typeof parsed.experienceYears === "number" ? parsed.experienceYears : 2,
        locationPreference: parsed.locationPreference || "Remote"
      };
    } catch (e) {
      console.error("[ResumeParserService] Failed to parse CV with AI:", e);
      return this.fallbackParse(resumeText);
    }
  }

  private fallbackParse(text: string): Omit<Candidate, "id"> {
    // Basic heuristic regex extraction
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const name = lines[0] ? lines[0].substring(0, 50) : "Anonymous Developer";
    
    // Simple skills extraction from text matching common keywords
    const commonSkills = ["React", "TypeScript", "Node.js", "Express", "SQLite", "Firebase", "Firestore", "Google Cloud", "Python", "Docker", "Git", "Tailwind CSS"];
    const foundSkills: string[] = [];
    for (const skill of commonSkills) {
      const regex = new RegExp(`\\b${skill}\\b`, "i");
      if (regex.test(text)) {
        foundSkills.push(skill);
      }
    }

    // Heuristics for experience years
    let experienceYears = 3;
    const expRegex = /(\d+)\+?\s*(?:years|yrs)\s+of\s+experience/i;
    const match = text.match(expRegex);
    if (match && match[1]) {
      experienceYears = parseInt(match[1], 10);
    }

    return {
      name,
      skills: foundSkills.length > 0 ? foundSkills : ["JavaScript", "HTML", "CSS"],
      experienceYears,
      locationPreference: text.toLowerCase().includes("remote") ? "Remote" : "USA"
    };
  }
}
