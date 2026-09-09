/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventType, SystemEvent, EventCallback, MessageEnvelope, MessageCallback } from "./types";

/**
 * Highly reliable, concurrent-safe System Event Bus
 * Tracks telemetry, status updates, audits, and UI triggers.
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventCallback>>;
  private globalListeners: Set<EventCallback>;

  private constructor() {
    this.listeners = new Map();
    this.globalListeners = new Set();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to a specific type of event
   */
  public subscribe(type: EventType, callback: EventCallback): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  /**
   * Unsubscribe from a specific type of event
   */
  public unsubscribe(type: EventType, callback: EventCallback): void {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.delete(callback);
    }
  }

  /**
   * Subscribe to ALL events (useful for logging, monitors, and dashboards)
   */
  public subscribeAll(callback: EventCallback): void {
    this.globalListeners.add(callback);
  }

  /**
   * Unsubscribe from all events list
   */
  public unsubscribeAll(callback: EventCallback): void {
    this.globalListeners.delete(callback);
  }

  /**
   * Emit a typed event to all registered listeners (safely handled asynchronously)
   */
  public emit(type: EventType, payload: Record<string, any>, agentId?: string, taskId?: string): void {
    const event: SystemEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      agentId,
      taskId,
      payload
    };

    // Run callbacks in parallel or asynchronously so we don't block core execution
    const targets: EventCallback[] = [];

    // Global observers
    this.globalListeners.forEach((cb) => targets.push(cb));

    // Specific observers
    const specificSet = this.listeners.get(type);
    if (specificSet) {
      specificSet.forEach((cb) => targets.push(cb));
    }

    // Trigger all concurrently
    for (const cb of targets) {
      Promise.resolve()
        .then(() => cb(event))
        .catch((err) => {
          console.error(`[EventBus] Callback error for event type ${type}:`, err);
        });
    }
  }

  /**
   * Clear all active listeners (useful for cleaning tests)
   */
  public clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

/**
 * Message Broker Bus
 * Enables decoupled agent-to-agent and worker-to-agent communication via subscription topics.
 */
export class MessageBus {
  private static instance: MessageBus;
  private subscriptions: Map<string, Set<MessageCallback>>;

  private constructor() {
    this.subscriptions = new Map();
  }

  public static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  /**
   * Subscribe to a custom topic
   */
  public subscribe(topic: string, callback: MessageCallback): void {
    const cleanTopic = topic.trim().toLowerCase();
    if (!this.subscriptions.has(cleanTopic)) {
      this.subscriptions.set(cleanTopic, new Set());
    }
    this.subscriptions.get(cleanTopic)!.add(callback);
  }

  /**
   * Unsubscribe from a custom topic
   */
  public unsubscribe(topic: string, callback: MessageCallback): void {
    const cleanTopic = topic.trim().toLowerCase();
    if (this.subscriptions.has(cleanTopic)) {
      this.subscriptions.get(cleanTopic)!.delete(callback);
    }
  }

  /**
   * Publish a message to a topic
   */
  public publish(topic: string, senderId: string, payload: any): void {
    const cleanTopic = topic.trim().toLowerCase();
    const envelope: MessageEnvelope = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      topic: cleanTopic,
      senderId,
      timestamp: new Date().toISOString(),
      payload
    };

    const subscribers = this.subscriptions.get(cleanTopic);
    if (subscribers && subscribers.size > 0) {
      subscribers.forEach((cb) => {
        Promise.resolve()
          .then(() => cb(envelope))
          .catch((err) => {
            console.error(`[MessageBus] Subscriber failure on topic "${topic}":`, err);
          });
      });
    }
  }

  /**
   * Clear all message subscriptions (clean test fixtures)
   */
  public clear(): void {
    this.subscriptions.clear();
  }
}
