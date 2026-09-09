/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { 
  Contact, 
  createContact, 
  verifyContact,
  isDuplicateContact, 
  canQueueOutreach, 
  normalizeEmail, 
  normalizeLinkedInUrl 
} from "../models/Contact";
import { InMemoryContactRepository } from "./InMemoryContactRepository";
import { SQLiteContactRepository } from "./SQLiteContactRepository";

describe("Contact CRM & Duplicate Detection Subsystem", () => {
  let repository: InMemoryContactRepository;

  beforeEach(() => {
    repository = new InMemoryContactRepository();
  });

  describe("Contact Model Defaults and Normalization", () => {
    it("should default confidence to 'guessed' if not provided", () => {
      const contact = createContact({
        name: "Alice Smith",
        company: "Acme Corp",
        email: "alice@acme.com"
      });

      expect(contact.confidence).toBe("guessed");
      expect(contact.doNotContact).toBe(false);
      expect(contact.responseStatus).toBe("none");
      expect(contact.metadata.source).toBe("manual");
    });

    it("should force confidence to 'guessed' on creation even if client passes metadata.source: 'manual' and confidence: 'verified' (preventing spoofing)", () => {
      const spoofedContact = createContact({
        name: "Bob Jones",
        company: "Beta Inc",
        email: "bob@beta.com",
        confidence: "verified" as any,
        metadata: { source: "manual" }
      });

      // Generic createContact MUST always default to "guessed"
      expect(spoofedContact.confidence).toBe("guessed");
    });

    it("should force confidence to 'guessed' for sourced/scraped contacts when client passes 'verified'", () => {
      const scrapedContact = createContact({
        name: "Charlie Scraped",
        company: "Web Data LLC",
        email: "charlie@webdata.com",
        confidence: "verified" as any,
        metadata: { source: "sourcing_job_board" }
      });

      expect(scrapedContact.confidence).toBe("guessed");
    });

    it("should upgrade confidence to 'verified' via explicit verifyContact internal step", () => {
      const contact = createContact({
        name: "David Scraped",
        company: "Web Data LLC",
        email: "david@webdata.com",
        metadata: { source: "linkedin_profile_field" }
      });

      expect(contact.confidence).toBe("guessed");

      const verified = verifyContact(contact);
      expect(verified.confidence).toBe("verified");
    });

    it("should normalize email addresses by trimming and lowercasing", () => {
      expect(normalizeEmail("  JOHN.DOE@Example.COM  ")).toBe("john.doe@example.com");
      expect(normalizeEmail("")).toBe("");
      expect(normalizeEmail(undefined)).toBe("");
    });

    it("should normalize LinkedIn URLs by stripping scheme, www, query params, and trailing slashes", () => {
      const rawUrl = "  HTTPS://WWW.Linkedin.Com/in/Jane-Doe-123/?utm_source=feed&ref=share#top  ";
      expect(normalizeLinkedInUrl(rawUrl)).toBe("linkedin.com/in/jane-doe-123");
    });
  });

  describe("Duplicate Detection & Categorization Rules", () => {
    it("should detect duplicate contacts with mismatched email casing and whitespace", () => {
      const c1 = createContact({
        name: "John Doe",
        company: "Acme",
        email: "John.Doe@ACME.com"
      });

      const c2 = createContact({
        name: "John S. Doe",
        company: "Acme Corporation",
        email: "  john.doe@acme.com "
      });

      expect(isDuplicateContact(c1, c2)).toBe(true);
    });

    it("should detect duplicate contacts with LinkedIn query parameters and scheme differences", () => {
      const c1 = createContact({
        name: "Jane Smith",
        company: "Tech Corp",
        linkedinUrl: "https://www.linkedin.com/in/janesmith?src=rss&campaign=tech"
      });

      const c2 = createContact({
        name: "Jane Smith",
        company: "Tech Corp",
        linkedinUrl: "http://linkedin.com/in/janesmith/"
      });

      expect(isDuplicateContact(c1, c2)).toBe(true);
    });

    it("should detect duplicates based on exact normalized name and company match when emails differ/missing", () => {
      const c1 = createContact({
        name: "Marcus Vance",
        company: "Global Logistics"
      });

      const c2 = createContact({
        name: "  marcus vance ",
        company: " GLOBAL LOGISTICS  "
      });

      expect(isDuplicateContact(c1, c2)).toBe(true);
    });

    it("should not flag distinct contacts as duplicates", () => {
      const c1 = createContact({
        name: "David Miller",
        company: "Company A",
        email: "david@companya.com"
      });

      const c2 = createContact({
        name: "David Miller",
        company: "Company B",
        email: "david@companyb.com"
      });

      expect(isDuplicateContact(c1, c2)).toBe(false);
    });

    it("should categorize email / LinkedIn matches as exactDuplicates and Name+Company as possibleDuplicates", async () => {
      const c1 = createContact({
        name: "Alice Cooper",
        company: "Rock Inc",
        email: "alice@rock.com",
        linkedinUrl: "https://linkedin.com/in/alicecooper"
      });
      await repository.save(c1);

      // Email match -> exactDuplicate
      const dup1 = await repository.checkDuplicates({
        name: "Alice C.",
        company: "Rock Industries",
        email: "ALICE@ROCK.COM"
      });
      expect(dup1.hasExactDuplicates).toBe(true);
      expect(dup1.exactDuplicates.length).toBe(1);
      expect(dup1.exactDuplicates[0].id).toBe(c1.id);
      expect(dup1.hasPossibleDuplicates).toBe(false);

      // Name + Company match only -> possibleDuplicate
      const dup2 = await repository.checkDuplicates({
        name: "Alice Cooper",
        company: "Rock Inc",
        email: "alice.other@differentdomain.com"
      });
      expect(dup2.hasExactDuplicates).toBe(false);
      expect(dup2.hasPossibleDuplicates).toBe(true);
      expect(dup2.possibleDuplicates.length).toBe(1);
      expect(dup2.possibleDuplicates[0].id).toBe(c1.id);
    });
  });

  describe("doNotContact & Outreach Prevention", () => {
    it("should block outreach queueing when doNotContact is true", () => {
      const restrictedContact = createContact({
        name: "Sarah Conner",
        company: "Cyberdyne",
        email: "sarah@cyberdyne.com",
        doNotContact: true
      });

      expect(canQueueOutreach(restrictedContact)).toBe(false);
    });

    it("should allow outreach queueing when doNotContact is false", () => {
      const openContact = createContact({
        name: "Kyle Reese",
        company: "Resistance",
        email: "kyle@resistance.org",
        doNotContact: false
      });

      expect(canQueueOutreach(openContact)).toBe(true);
    });
  });

  describe("InMemoryContactRepository Integration", () => {
    it("should save, retrieve, find duplicates, and delete contacts in repository", async () => {
      const contact1 = createContact({
        name: "Evelyn Wright",
        company: "Apex Tech",
        email: "evelyn@apex.tech",
        linkedinUrl: "https://linkedin.com/in/evelyn-wright"
      });

      await repository.save(contact1);

      const foundById = await repository.getById(contact1.id);
      expect(foundById).not.toBeNull();
      expect(foundById?.name).toBe("Evelyn Wright");

      const foundByEmail = await repository.findByEmail("EVELYN@APEX.TECH");
      expect(foundByEmail?.id).toBe(contact1.id);

      const foundByLinkedIn = await repository.findByLinkedInUrl("http://www.linkedin.com/in/evelyn-wright?ref=1");
      expect(foundByLinkedIn?.id).toBe(contact1.id);

      const duplicates = await repository.findDuplicates({
        email: "evelyn@apex.tech",
        name: "Evelyn",
        company: "Apex"
      });
      expect(duplicates.length).toBe(1);
      expect(duplicates[0].id).toBe(contact1.id);

      await repository.delete(contact1.id);
      const afterDelete = await repository.getById(contact1.id);
      expect(afterDelete).toBeNull();
    });
  });

  describe("SQLiteContactRepository Persistence Across Re-instantiation", () => {
    const testDbPath = path.join(process.cwd(), "test_contacts_persistence.sqlitedb");

    afterEach(() => {
      if (fs.existsSync(testDbPath)) {
        try { fs.unlinkSync(testDbPath); } catch (e) {}
      }
      if (fs.existsSync(`${testDbPath}-wal`)) {
        try { fs.unlinkSync(`${testDbPath}-wal`); } catch (e) {}
      }
      if (fs.existsSync(`${testDbPath}-shm`)) {
        try { fs.unlinkSync(`${testDbPath}-shm`); } catch (e) {}
      }
    });

    it("should persist contact records across repository re-instantiation", async () => {
      // 1. First repository instance saves a contact
      const repo1 = new SQLiteContactRepository(testDbPath);
      const contact = createContact({
        name: "Persistent User",
        company: "Database Corp",
        email: "persistent@db.com",
        role: "Lead Architect",
        doNotContact: true,
        metadata: { source: "manual", notes: "Saved in run 1" }
      });

      await repo1.save(contact);
      const retrievedInRun1 = await repo1.getById(contact.id);
      expect(retrievedInRun1).not.toBeNull();
      expect(retrievedInRun1?.name).toBe("Persistent User");
      repo1.close();

      // 2. Second repository instance pointing to the same SQLite database file
      const repo2 = new SQLiteContactRepository(testDbPath);
      const retrievedInRun2 = await repo2.getById(contact.id);
      expect(retrievedInRun2).not.toBeNull();
      expect(retrievedInRun2?.id).toBe(contact.id);
      expect(retrievedInRun2?.name).toBe("Persistent User");
      expect(retrievedInRun2?.company).toBe("Database Corp");
      expect(retrievedInRun2?.email).toBe("persistent@db.com");
      expect(retrievedInRun2?.doNotContact).toBe(true);
      expect(retrievedInRun2?.metadata.notes).toBe("Saved in run 1");

      const all = await repo2.getAll();
      expect(all.length).toBe(1);

      repo2.close();
    });
  });
});
