/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResumeOrder } from "../models/ResumeOrder";
import { IOrderRepository } from "./IOrderRepository";

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: Map<string, ResumeOrder> = new Map();
  private processedEvents: Set<string> = new Set();

  async getAll(): Promise<ResumeOrder[]> {
    return Array.from(this.orders.values());
  }

  async getById(id: string): Promise<ResumeOrder | null> {
    return this.orders.get(id) || null;
  }

  async getByRazorpayOrderId(razorpayOrderId: string): Promise<ResumeOrder | null> {
    for (const order of this.orders.values()) {
      if (order.razorpayOrderId === razorpayOrderId) {
        return order;
      }
    }
    return null;
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

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  async recordProcessedEvent(eventId: string, _eventType: string): Promise<void> {
    this.processedEvents.add(eventId);
  }
}
