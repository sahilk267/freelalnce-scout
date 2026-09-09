/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Contact, 
  isDuplicateContact, 
  categorizeDuplicates, 
  DuplicateCheckResult, 
  normalizeEmail, 
  normalizeLinkedInUrl 
} from "../models/Contact";
import { IContactRepository } from "./IContactRepository";

export class InMemoryContactRepository implements IContactRepository {
  private contacts: Map<string, Contact> = new Map();

  constructor(initialSeed: Contact[] = []) {
    for (const c of initialSeed) {
      this.contacts.set(c.id, c);
    }
  }

  async getAll(): Promise<Contact[]> {
    return Array.from(this.contacts.values());
  }

  async getById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) || null;
  }

  async findByEmail(email: string): Promise<Contact | null> {
    const target = normalizeEmail(email);
    if (!target) return null;
    for (const contact of this.contacts.values()) {
      if (normalizeEmail(contact.email) === target) {
        return contact;
      }
    }
    return null;
  }

  async findByLinkedInUrl(linkedinUrl: string): Promise<Contact | null> {
    const target = normalizeLinkedInUrl(linkedinUrl);
    if (!target) return null;
    for (const contact of this.contacts.values()) {
      if (normalizeLinkedInUrl(contact.linkedinUrl) === target) {
        return contact;
      }
    }
    return null;
  }

  async findDuplicates(contact: Partial<Contact>): Promise<Contact[]> {
    const matches: Contact[] = [];
    for (const existing of this.contacts.values()) {
      if (existing.id === contact.id) continue;
      if (isDuplicateContact(existing, contact)) {
        matches.push(existing);
      }
    }
    return matches;
  }

  async checkDuplicates(contact: Partial<Contact>): Promise<DuplicateCheckResult> {
    const existing = Array.from(this.contacts.values());
    return categorizeDuplicates(contact, existing);
  }

  async save(contact: Contact): Promise<Contact> {
    const saved = { ...contact };
    this.contacts.set(saved.id, saved);
    return saved;
  }

  async delete(id: string): Promise<void> {
    this.contacts.delete(id);
  }
}
