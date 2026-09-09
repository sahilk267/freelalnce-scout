/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IWorkingMemory,
  ILongTermMemory,
  ISemanticMemory,
  IEpisodicMemory,
  IVectorMemory
} from "./types";

/**
 * Standard working memory implementation (Fast, short-term in-memory storage)
 */
export class WorkingMemory implements IWorkingMemory {
  private store: Map<string, any> = new Map();

  public get(key: string): any {
    return this.store.get(key);
  }

  public set(key: string, value: any): void {
    this.store.set(key, value);
  }

  public clear(): void {
    this.store.clear();
  }

  public getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    this.store.forEach((val, key) => {
      result[key] = val;
    });
    return result;
  }
}

/**
 * Interface class for Long Term Memory
 * Ready for Firestore or persistent SQLite DB backends
 */
export class LongTermMemory implements ILongTermMemory {
  private records: Map<string, { value: any; tags: string[] }> = new Map();

  public async store(key: string, value: any, tags: string[] = []): Promise<void> {
    this.records.set(key, { value, tags });
  }

  public async retrieve(key: string): Promise<any> {
    return this.records.get(key)?.value || null;
  }

  public async searchByTags(tags: string[]): Promise<any[]> {
    const result: any[] = [];
    this.records.forEach((record) => {
      const match = tags.some((t) => record.tags.includes(t));
      if (match) {
        result.push(record.value);
      }
    });
    return result;
  }

  public async delete(key: string): Promise<void> {
    this.records.delete(key);
  }
}

/**
 * Semantic knowledge memory graph mapping
 */
export class SemanticMemory implements ISemanticMemory {
  private concepts: Map<string, Record<string, string>> = new Map();

  public async storeConcept(concept: string, relations: Record<string, string>): Promise<void> {
    this.concepts.set(concept.toLowerCase(), relations);
  }

  public async queryConcept(concept: string): Promise<any> {
    return this.concepts.get(concept.toLowerCase()) || null;
  }
}

/**
 * Episodic memory detailing experienced event outcomes and history tracking
 */
export class EpisodicMemory implements IEpisodicMemory {
  private episodes: { id: string; timestamp: string; description: string; outcome: string; metadata?: any }[] = [];

  public async recordEpisode(episode: { description: string; outcome: string; metadata?: any }): Promise<string> {
    const id = `episode-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.episodes.push({
      id,
      timestamp: new Date().toISOString(),
      ...episode
    });
    return id;
  }

  public async recallSimilarEpisodes(query: string, limit: number = 3): Promise<any[]> {
    // Standard keyword match ranking simulator as the AI model is not attached yet
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = this.episodes.map((ep) => {
      let score = 0;
      const text = `${ep.description} ${ep.outcome}`.toLowerCase();
      for (const word of queryWords) {
        if (text.includes(word)) {
          score++;
        }
      }
      return { ep, score };
    });

    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.ep);
  }
}

/**
 * Mock Vector Database index
 */
export class VectorMemory implements IVectorMemory {
  private vectors: Map<string, { vector: number[]; payload?: any }> = new Map();

  public async upsertVector(id: string, vector: number[], payload?: any): Promise<void> {
    this.vectors.set(id, { vector, payload });
  }

  public async searchVector(queryVector: number[], topK: number = 3): Promise<any[]> {
    const scored: { id: string; score: number; payload?: any }[] = [];

    this.vectors.forEach((val, id) => {
      const score = this.cosineSimilarity(queryVector, val.vector);
      scored.push({ id, score, payload: val.payload });
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
