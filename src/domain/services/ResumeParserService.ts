/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { Candidate } from "../models/Candidate";

export class ResumeParserService {
  constructor(private geminiClient?: GoogleGenAI) {}

  public async parseResume(resumeText: string): Promise<Omit<Candidate, "id">> {
    if (!resumeText || !resumeText.trim()) {
      throw new Error("Resume content is empty.");
    }

    if (!this.geminiClient) {
      console.warn("[ResumeParserService] Gemini client not configured, falling back to local heuristic parsing.");
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

      const response = await this.geminiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      const responseText = response.text || "";
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        name: parsed.name || "Parsed Candidate",
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experienceYears: typeof parsed.experienceYears === "number" ? parsed.experienceYears : 2,
        locationPreference: parsed.locationPreference || "Remote"
      };
    } catch (e) {
      console.error("[ResumeParserService] Failed to parse CV with Gemini:", e);
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
