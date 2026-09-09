/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResumeOrder } from "../models/ResumeOrder";
import { IOrderRepository } from "./IOrderRepository";

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: Map<string, ResumeOrder> = new Map();

  async getAll(): Promise<ResumeOrder[]> {
    return Array.from(this.orders.values());
  }

  async getById(id: string): Promise<ResumeOrder | null> {
    return this.orders.get(id) || null;
  }

  async getByCandidateId(candidateId: string): Promise<ResumeOrder[]> {
    return Array.from(this.orders.values()).filter((o) => o.candidateId === candidateId);
  }

  async getReviewQueue(): Promise<ResumeOrder[]> {
    return Array.from(this.orders.values()).filter(
      (o) => o.deliveryStatus === "needs_human_review" || o.deliveryStatus === "verified"
    );
  }

  async save(order: ResumeOrder): Promise<ResumeOrder> {
    const saved = { ...order };
    this.orders.set(saved.id, saved);
    return saved;
  }

  async delete(id: string): Promise<void> {
    this.orders.delete(id);
  }
}
