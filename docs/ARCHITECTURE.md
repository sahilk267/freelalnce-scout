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
- **Order Lifecycle & Dynamic Tier Pricing**:
  - Tiers are managed dynamically in SQLite via `PricingService` with audit logs and in-memory caching.
  - Baseline default seeded tiers: `basic` (₹300 / 30000 paise, 1 revision), `standard` (₹800 / 80000 paise, 2 revisions), and `premium` (₹1500 / 150000 paise, 3 revisions).
  - Configurable in the Admin UI under **Dynamic Pricing** without requiring code deployments.
  - Price snapshots (`priceAtOrderTime`, `priceMinorUnits`, `currency`) are permanently captured at order creation time, preventing retroactive price changes from affecting existing customer orders.
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
  - **Admin Endpoints**: `POST /api/screening/sessions`, `POST /api/screening/sessions/:id/evaluate`, and `POST /api/screening/sessions/:id/human-review` are secured via `requireRole` and `apiRateLimiter`.
- **Grounding & Prompt Injection Defense**:
  - Candidate inputs wrapped inside `<candidate_input>...</candidate_input>` XML tags. System instructions explicitly instruct the model to treat candidate text strictly as data and ignore embedded prompt overrides.
  - Evaluation scores candidates solely against explicit job requirements.
- **2-Pass Evaluation & Human Approval Gate**:
  - **Pass 1**: Evaluates transcript against job requirements, returning structured `ScreeningEvaluation` scores (0–100) and criteria breakdown.
  - **Pass 2 Audit**: Verifies candidate evidence claims and ensures no unstated requirement penalties were applied.
  - **Idempotency**: `POST /api/screening/sessions/:id/evaluate` rejects duplicate calls with `409 Conflict` to preserve audit trails.
  - **Human Sign-off Gate**: All evaluated candidates transition to `needs_human_review`. Rejection or approval recommendations require human recruiter sign-off via `POST /api/screening/sessions/:id/human-review`.

---

### 4. Self-Scheduling Agent & Calendar Sync (Feature 4)
- **Purpose**: Coordinates candidate interview booking, slot reservation holds, conflict locking, and recruiter confirmation workflows.
- **Domain Model**: `SchedulingSession` with 24-hour token validity, `InterviewSlot` with atomic locks, and `SchedulingAuditLog` recording state transitions.
- **Auto-Booking vs. Recruiter Confirmation**:
  - `autoBookEnabled: false` (default): Candidate selections place slots in `pending_confirmation` with a 48-hour hold expiration (`holdExpiresAt`). Recruiter manually confirms via `POST /api/scheduling/confirm`.
  - `autoBookEnabled: true`: Candidate slot selection atomically books and dispatches calendar synchronization immediately.
- **Concurrency & Compensation Rollback**:
  - Double-booking prevented by `atomicLockSlot` checks; concurrent attempts return `409 Conflict`.
  - Calendar sync failures trigger automatic compensation rollback to release the slot. If compensation fails, session status transitions to `needs_human_review` with audit logging.

---

### 5. Role-Based Access Control (RBAC) & Multi-User Management (Feature 5)
- **Purpose**: Multi-user governance with role hierarchy (`admin` and `recruiter`), invite tokens, and session denylist.
- **Domain Model**: `User` with bcrypt-hashed passwords (10 rounds), `UserInvite` single-use tokens with configurable TTL, and `revoked_tokens` denylist.
- **Bootstrap & Invite Flow**:
  - First-boot bootstrap: allows first user creation as master administrator without an invite token.
  - Subsequent user registration strictly requires an unconsumed, unexpired `inviteToken`.
- **Role Permissions Hierarchy**:
  - `admin`: Full administrative access (terminal execution, system persistence/backups, integrations, user management, and destructive actions).
  - `recruiter`: Operational workflow access (candidate CRM, screening interviews, scheduling sessions, ATS optimization). Destructive/administrative endpoints return `403 Forbidden`.
- **Brute Force Protection**:
  - Rate limiting on `/api/auth/login` blocking IP + email pairs after 5 consecutive failures for 15 minutes.

---

### 6. Cookie-Based Authentication, Session Hardening & CSRF Protection (Feature 6)
- **Purpose**: Enterprise session storage hardening eliminating XSS-vulnerable localStorage/sessionStorage JWT persistence and enforcing double-submit CSRF protection on state-changing API operations.
- **Session Transport**:
  - `aziz_session`: Transported in an `HttpOnly`, `SameSite=Strict`, `Secure` (production) cookie with 12-hour expiration matching JWT lifecycle. Not accessible via client-side JavaScript.
  - Service accounts: Dedicated `grantType: "service_account"` flow returns JWT in the JSON body without browser cookies for automation scripts.
- **Double-Submit CSRF Defense**:
  - `csrf_token`: Transported in a non-HttpOnly, `SameSite=Strict` cookie readable by the frontend application.
  - State-changing HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`) validate the client-provided `X-CSRF-Token` against the `csrf_token` cookie, rejecting mismatched/missing tokens with `403 Forbidden`. Safe `GET` requests and Bearer-authenticated service account calls are exempt.
- **Logout & Token Revocation**:
  - `/api/auth/logout` revokes the token's JTI in the server-side denylist and clears both `aziz_session` and `csrf_token` cookies with `Max-Age=0`.

---

### 7. Dynamic, Configurable Pricing System & Order Snapshotting (Feature 7)
- **Purpose**: Eliminates hardcoded service tier costs and revision quotas, replacing static literals with a database-backed, administrator-configurable source of truth supporting currency extensibility, instant promotions, and complete audit tracking.
- **Domain Models & Tables**:
  - `pricing_tiers`: Stores `tierId` (`basic`, `standard`, `premium`), `displayName`, `priceMinorUnits` (stored in paise to eliminate floating-point rounding bugs), `currency`, `revisionLimit`, `isActive`, `updatedAt`, and `updatedBy`.
  - `pricing_audit_logs`: Append-only historical ledger capturing `tierId`, `oldValues`, `newValues`, `changedBy`, `changedAt`, and human-entered `reason`.
- **First-Boot Automatic Seeding**:
  - Initializes with baseline operational tiers on first boot:
    - Basic: ₹300 (30,000 paise), 1 revision
    - Standard: ₹800 (80,000 paise), 2 revisions
    - Premium: ₹1500 (150,000 paise), 3 revisions
- **Caching & Validation Architecture**:
  - `PricingService`: Features an in-memory cache with write-through updates and immediate cache invalidation on edits to guarantee sub-millisecond public tier queries while remaining strictly synchronized with SQLite persistence.
  - Enforces positive integer prices (`priceMinorUnits > 0`), non-negative revision quotas (`revisionLimit >= 0`), and ISO 3-character uppercase currency codes (`currency.length === 3`).
- **Immutable Order Snapshotting**:
  - Order creation endpoints (`POST /api/orders` and payment intents) permanently snapshot `priceAtOrderTime`, `priceINR`, `priceMinorUnits`, and `currency` directly onto each customer `ResumeOrder`.
  - Existing customer orders are immune to subsequent admin price changes, preventing unauthorized billing drift or retroactively invalidated payment intents.
  - Deactivated tiers are excluded from public catalog endpoints (`GET /api/pricing`) and barred from new order creation, while existing orders under deactivated tiers remain valid and serviceable.
- **Administrative & User Experience**:
  - `PricingManager.tsx`: Dedicated admin panel for modifying prices, revising limits, switching currencies, toggling tier activation, and auditing historical adjustments.
  - `ResumeOrderPlacement.tsx`: Real-time order placement interface in the ATS Hub dynamically querying active tiers, calculating prices, and provisioning checkout intents.




