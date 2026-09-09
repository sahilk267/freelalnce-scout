/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Export Models
export type { Job } from "./models/Job";
export type { Candidate } from "./models/Candidate";
export type { MatchResult } from "./models/MatchResult";
export type { FreelanceProject } from "./models/FreelanceProject";
export type { Contact, ContactMetadata, ResponseStatus, DuplicateCheckResult } from "./models/Contact";
export { createContact, verifyContact, isDuplicateContact, categorizeDuplicates, canQueueOutreach, normalizeEmail, normalizeLinkedInUrl } from "./models/Contact";
export type { ResumeOrder, ServiceTier, PaymentStatus, DeliveryStatus, FactTraceabilityItem, VerificationResult, VerificationCheckResults } from "./models/ResumeOrder";
export { createResumeOrder, getTierPricing } from "./models/ResumeOrder";
export type { ScreeningSession, SessionStatus, Recommendation, ChatMessage, EvaluationCriterion, ScreeningEvaluation, HumanReview } from "./models/ScreeningSession";
export { createScreeningSession, isSessionExpired } from "./models/ScreeningSession";

// Export Interfaces / Providers
export type { IJobProvider } from "./providers/IJobProvider";
export { RemotiveJobProvider } from "./providers/RemotiveJobProvider";
export type { IFreelanceProvider } from "./providers/IFreelanceProvider";
export { FreelanceScoutProvider } from "./providers/FreelanceScoutProvider";
export type { IAIClientProvider } from "./providers/IAIClientProvider";
export { GeminiClientProvider } from "./providers/GeminiClientProvider";
export { REMOTE_PLATFORMS_40 } from "./providers/RemotePlatformsCatalog";
export { getInitialSeedProjectsForAll40Platforms } from "./providers/InitialPlatformSeed";

// Export Repositories
export type { ICandidateRepository } from "./repositories/ICandidateRepository";
export type { IContactRepository } from "./repositories/IContactRepository";
export type { IOrderRepository } from "./repositories/IOrderRepository";
export type { IScreeningRepository } from "./repositories/IScreeningRepository";
export { InMemoryCandidateRepository } from "./repositories/InMemoryCandidateRepository";
export { InMemoryContactRepository } from "./repositories/InMemoryContactRepository";
export { InMemoryOrderRepository } from "./repositories/InMemoryOrderRepository";
export { InMemoryScreeningRepository } from "./repositories/InMemoryScreeningRepository";
export { SQLiteContactRepository } from "./repositories/SQLiteContactRepository";
export { SQLiteOrderRepository } from "./repositories/SQLiteOrderRepository";
export { SQLiteScreeningRepository } from "./repositories/SQLiteScreeningRepository";
export { FirestoreCandidateRepository } from "./repositories/FirestoreCandidateRepository";
export { SQLiteBackupRepository } from "./repositories/SQLiteBackupRepository";

// Export Services
export type { IMatchingService } from "./services/IMatchingService";
export { MatchingService } from "./services/MatchingService";
export type { IBackupService, BackupResult, RestoreResult } from "./services/IBackupService";
export { BackupService } from "./services/BackupService";
export type { IMigrationService, MigrationStepProgress, MigrationResult, ProgressCallback } from "./services/IMigrationService";
export { MigrationService } from "./services/MigrationService";
export { ResumeServiceAgent } from "./services/ResumeServiceAgent";
export type { ResumeServiceAgentResult } from "./services/ResumeServiceAgent";
export { ScreeningServiceAgent } from "./services/ScreeningServiceAgent";
export { SchedulingServiceAgent } from "./services/SchedulingServiceAgent";
export type { SchedulingSession, InterviewerSlot, SchedulingAuditLog } from "./models/Scheduling";
export { generateSchedulingToken, hashToken } from "./models/Scheduling";
export type { ISchedulingRepository } from "./repositories/ISchedulingRepository";
export { InMemorySchedulingRepository } from "./repositories/InMemorySchedulingRepository";

// Export Dependency Injection (DI) Container
export { DIContainer } from "./di/DIContainer";

// Export Utilities
export type { ParseResult } from "./utils/jsonHelper";
export { cleanAndParseJSON } from "./utils/jsonHelper";
