/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contact, DuplicateCheckResult } from "../models/Contact";

export interface IContactRepository {
  getAll(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  findByEmail(email: string): Promise<Contact | null>;
  findByLinkedInUrl(linkedinUrl: string): Promise<Contact | null>;
  findDuplicates(contact: Partial<Contact>): Promise<Contact[]>;
  checkDuplicates(contact: Partial<Contact>): Promise<DuplicateCheckResult>;
  save(contact: Contact): Promise<Contact>;
  delete(id: string): Promise<void>;
}
