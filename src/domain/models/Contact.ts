/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ContactMetadata {
  source: string; // e.g., "resume_line_12", "linkedin_profile_field:headline", "sourcing_job_board", "manual"
  sourceUrl?: string;
  department?: string;
  companySize?: string;
  notes?: string;
  tags?: string[];
}

export type ResponseStatus = "none" | "contacted" | "replied" | "interested" | "declined" | "bounced";

export interface Contact {
  id: string;
  name: string;
  company: string;
  email?: string;
  linkedinUrl?: string;
  role?: string;
  confidence: "verified" | "guessed";
  doNotContact: boolean;
  lastContactedAt?: string;
  responseStatus: ResponseStatus;
  metadata: ContactMetadata;
}

/**
 * Normalizes email address by trimming whitespace and lowercasing.
 */
export function normalizeEmail(email?: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Normalizes LinkedIn URL by lowercasing, stripping scheme, www, query parameters and trailing slashes.
 */
export function normalizeLinkedInUrl(url?: string): string {
  if (!url) return "";
  let cleaned = url.trim().toLowerCase();
  // Strip query string and fragment
  cleaned = cleaned.split("?")[0].split("#")[0];
  // Strip scheme
  cleaned = cleaned.replace(/^https?:\/\//, "");
  // Strip leading www.
  cleaned = cleaned.replace(/^www\./, "");
  // Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, "");
  return cleaned;
}

/**
 * Checks if two contacts are duplicates by matching normalized email, LinkedIn URL, or Name+Company.
 */
export function isDuplicateContact(c1: Partial<Contact>, c2: Partial<Contact>): boolean {
  // 1. Email match (if both emails are non-empty)
  const e1 = normalizeEmail(c1.email);
  const e2 = normalizeEmail(c2.email);
  if (e1 && e2 && e1 === e2) {
    return true;
  }

  // 2. LinkedIn URL match (if both URLs are non-empty)
  const l1 = normalizeLinkedInUrl(c1.linkedinUrl);
  const l2 = normalizeLinkedInUrl(c2.linkedinUrl);
  if (l1 && l2 && l1 === l2) {
    return true;
  }

  // 3. Name & Company match (if both have name and company)
  if (c1.name && c2.name && c1.company && c2.company) {
    const n1 = c1.name.trim().toLowerCase();
    const n2 = c2.name.trim().toLowerCase();
    const comp1 = c1.company.trim().toLowerCase();
    const comp2 = c2.company.trim().toLowerCase();
    if (n1 === n2 && comp1 === comp2) {
      return true;
    }
  }

  return false;
}

export interface DuplicateCheckResult {
  hasExactDuplicates: boolean;
  hasPossibleDuplicates: boolean;
  exactDuplicates: Contact[];
  possibleDuplicates: Contact[];
}

/**
 * Categorizes duplicate matches into exactDuplicates (email/LinkedIn) vs possibleDuplicates (Name+Company).
 */
export function categorizeDuplicates(
  target: Partial<Contact>,
  existingContacts: Contact[]
): DuplicateCheckResult {
  const exactDuplicates: Contact[] = [];
  const possibleDuplicates: Contact[] = [];

  const targetEmail = normalizeEmail(target.email);
  const targetLinkedIn = normalizeLinkedInUrl(target.linkedinUrl);
  const targetName = target.name?.trim().toLowerCase();
  const targetCompany = target.company?.trim().toLowerCase();

  for (const existing of existingContacts) {
    if (target.id && existing.id === target.id) continue;

    const existingEmail = normalizeEmail(existing.email);
    const existingLinkedIn = normalizeLinkedInUrl(existing.linkedinUrl);
    const existingName = existing.name.trim().toLowerCase();
    const existingCompany = existing.company.trim().toLowerCase();

    // 1. Exact email match
    const emailMatch = Boolean(targetEmail && existingEmail && targetEmail === existingEmail);
    // 2. Exact LinkedIn match
    const linkedinMatch = Boolean(targetLinkedIn && existingLinkedIn && targetLinkedIn === existingLinkedIn);

    if (emailMatch || linkedinMatch) {
      exactDuplicates.push(existing);
      continue;
    }

    // 3. Name & Company match (when neither email nor LinkedIn matches)
    if (targetName && targetCompany && targetName === existingName && targetCompany === existingCompany) {
      possibleDuplicates.push(existing);
    }
  }

  return {
    hasExactDuplicates: exactDuplicates.length > 0,
    hasPossibleDuplicates: possibleDuplicates.length > 0,
    exactDuplicates,
    possibleDuplicates,
  };
}

/**
 * Safety check before queuing outreach to a contact.
 * Returns false if contact has doNotContact set to true.
 */
export function canQueueOutreach(contact: Contact): boolean {
  if (contact.doNotContact) {
    return false;
  }
  return true;
}

/**
 * Helper to construct a validated Contact object.
 * Confidence is ALWAYS initialized to "guessed" upon creation.
 * The only way a contact can become "verified" is via the dedicated verifyContact() step (e.g. POST /api/contacts/:id/verify).
 */
export function createContact(
  data: Partial<Contact> & { name: string; company: string }
): Contact {
  const source = data.metadata?.source || "manual";

  return {
    id: data.id || `cnt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: data.name.trim(),
    company: data.company.trim(),
    email: data.email ? normalizeEmail(data.email) : undefined,
    linkedinUrl: data.linkedinUrl ? normalizeLinkedInUrl(data.linkedinUrl) : undefined,
    role: data.role ? data.role.trim() : undefined,
    confidence: "guessed", // ALWAYS "guessed" on initial creation, preventing spoofed confidence values
    doNotContact: Boolean(data.doNotContact),
    lastContactedAt: data.lastContactedAt,
    responseStatus: data.responseStatus || "none",
    metadata: {
      source,
      sourceUrl: data.metadata?.sourceUrl,
      department: data.metadata?.department,
      companySize: data.metadata?.companySize,
      notes: data.metadata?.notes,
      tags: data.metadata?.tags ? [...data.metadata.tags] : [],
    },
  };
}

/**
 * Explicit internal verification step to upgrade a contact's confidence to "verified".
 */
export function verifyContact(contact: Contact): Contact {
  return {
    ...contact,
    confidence: "verified",
  };
}

