# Aziz OS System Architecture & Agent Specifications

This document defines the system architecture, component contracts, tool dependencies, and human-approval gates for all agents and modules in Aziz OS.

---

## Agent Specifications

### 1. Contact CRM & Repository (Feature 1)
- **Purpose**: Captures, normalizes, and manages HR/recruiter contacts captured during sourcing, preventing re-messaging duplicate or restricted leads.
- **Inputs**: `Contact` objects containing candidate/recruiter names, company, email, LinkedIn URL, role, and metadata.
- **Outputs**: Verified/deduplicated contact records, outreach eligibility status.
- **Tools Called**: `IContactRepository` (`InMemoryContactRepository` / `FirestoreContactRepository`), Express `/api/contacts` endpoints with `apiRateLimiter` and `apiKeyAuthMiddleware`.
- **Approval Gate Status**: Automatic duplicate filtering and do-not-contact checks; human review gate applies before any message dispatch.
  - The `POST /api/contacts/:id/verify` endpoint upgrades contact confidence from `"guessed"` to `"verified"`. It is secured behind `apiKeyAuthMiddleware` + `apiRateLimiter` and is **strictly intended for human/dashboard UI action only — automated agents must NEVER call this endpoint**.
- **Anti-Hallucination & Grounding**:
  - Email lowercasing and LinkedIn URL query parameter stripping in `isDuplicateContact`.
  - Default `confidence` strictly initialized to `"guessed"` on creation via generic `POST /api/contacts` route or `createContact()`, preventing spoofing of client-supplied `metadata.source`.
  - Mandatory `doNotContact` flag check in `canQueueOutreach` blocking automated outreach queuing.
  - Whitelisted `ContactMetadata` interface preventing unvalidated arbitrary data injection.

---

### 2. Resume Service Agent & Orders (Feature 2)
- **Purpose**: Provides AI-driven two-pass grounded resume rewrites with ATS score optimization, strict zero-hallucination verification, and tiered order revision lifecycle management.
- **PII Sensitivity & Storage**: `originalResumeText` and `rewrittenResumeText` contain sensitive Candidate PII at the same classification level as `Contact` records. SQLite/InMemory tables and API endpoints enforce strict token authentication and rate limiting for all PII access.
- **Order Lifecycle & Tier Pricing**:
  - `basic`: ₹300 INR, 1 revision limit.
  - `standard`: ₹800 INR, 2 revision limit.
  - `premium`: ₹1500 INR, 3 revision limit.
  - **Known Simplification**: The Premium tier pricing is intentionally set to a flat ₹1500 INR (within the ₹1500–3000 INR spec range) for simplified single-currency transactional consistency during this stage.
- **Payment Gate**: Rewrites and revisions require `paymentStatus === "paid"`. Payment simulation is provided via `POST /api/orders/:id/pay-simulate`.
- **Two-Pass Pipeline & Verification**:
  - Pass 1: Strict fact-grounded rewrite + traceability log mapping rewritten bullets back to original text.
  - Pass 2: Double-pass self-verification auditing 4 categories (Companies/Roles, Metrics, Skills/Certs, Seniority/Scope).
  - Unverified rewrites (`status: "HALLUCINATION_DETECTED"`) or unapproved auto-deliveries (`autoDeliverEnabled: false`) route automatically to `needs_human_review`.

---

### 3. Screening Agent & Sessions (Feature 3)
- **Purpose**: Conducts automated preliminary candidate text screening interviews grounded strictly in explicit job requirements, followed by two-pass evaluation and mandatory human sign-off.
- **Domain Model**: `ScreeningSession` linked to candidate via `candidateId` (referencing `ICandidateRepository`) and `jobId`. Uses a secret 24-hour TTL `sessionToken` for candidate access.
- **Auth & Rate Limiting Boundaries**:
  - **Candidate Endpoints**: `GET /api/screening/sessions/:id/candidate` and `POST /api/screening/sessions/:id/interact` use secret `sessionToken` auth. Includes a dedicated IP rate limiter (`checkFailedSessionTokenRateLimit`) blocking IP addresses after 10 failed authentication attempts (429 Too Many Requests).
  - **Admin Endpoints**: `POST /api/screening/sessions`, `POST /api/screening/sessions/:id/evaluate`, and `POST /api/screening/sessions/:id/human-review` are secured via `apiKeyAuthMiddleware` and `apiRateLimiter`.
- **Grounding & Prompt Injection Defense**:
  - Candidate inputs wrapped inside `<candidate_input>...</candidate_input>` XML tags. System instructions explicitly instruct the model to treat candidate text strictly as data and ignore embedded prompt overrides.
  - Evaluation scores candidates solely against explicit job requirements.
- **2-Pass Evaluation & Human Approval Gate**:
  - **Pass 1**: Evaluates transcript against job requirements, returning structured `ScreeningEvaluation` scores (0–100) and criteria breakdown.
  - **Pass 2 Audit**: Verifies candidate evidence claims and ensures no unstated requirement penalties were applied.
  - **Idempotency**: `POST /api/screening/sessions/:id/evaluate` rejects duplicate calls with `409 Conflict` to preserve audit trails.
  - **Human Sign-off Gate**: All evaluated candidates transition to `needs_human_review`. Rejection or approval recommendations require human recruiter sign-off via `POST /api/screening/sessions/:id/human-review`.


