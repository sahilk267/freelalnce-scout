# Project Codebase Index

Automated compact index map of all modules, interfaces, and exports in `src/`.

## Folder: `src`

### `App.tsx` (`src/App.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `./components/Sidebar`, `./components/Studio`, `./components/JobSearch`, `./components/Ats`, `./components/MemoryManager`, `./components/Diagnostics`, `./components/Terminal`, `./components/Integrations`, `./components/AgentDashboard`, `./components/FreelancerDashboard`, `./components/CompanyProfilesManager`, `./components/UserManager`, `./components/AuthScreen`, `./types`, `./domain/models/User`, `./utils/apiAuth`

### `main.tsx` (`src/main.tsx`)
- **Purpose**: Global window.fetch interceptor: Ensures credentials="include" and attaches CSRF token from readable cookie
- **Imports**: `react`, `react-dom/client`, `./App.tsx`, `./utils/apiAuth`

### `types.ts` (`src/types.ts`)
- **Purpose**: Exports ModuleId, SystemModule, SystemLog
- **Exports**: `type ModuleId`, `interface SystemModule`, `interface SystemLog`, `interface DiagnosticMetrics`, `interface JobRecord`, `interface FreelanceProject`, `interface MemoryEntry`, `type FreelanceCategory`, `interface CompanyProfile`, `interface TerminalLine`

## Folder: `src/components`

### `AgentDashboard.tsx` (`src/components/AgentDashboard.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `motion/react`

### `Ats.tsx` (`src/components/Ats.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `./SchedulingDashboard`

### `AuthScreen.tsx` (`src/components/AuthScreen.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `lucide-react`, `../utils/apiAuth`

### `CompanyProfilesManager.tsx` (`src/components/CompanyProfilesManager.tsx`)
- **Purpose**: Exports CATEGORY_METADATA
- **Exports**: `const CATEGORY_METADATA : Record<`
- **Imports**: `react`, `../types`

### `Diagnostics.tsx` (`src/components/Diagnostics.tsx`)
- **Purpose**: Exports BackupManifest, StructuredLog, OperationProgress
- **Exports**: `interface BackupManifest`, `interface StructuredLog`, `interface OperationProgress`, `interface RestorePreviewResult`
- **Imports**: `react`, `../types`, `../utils/apiAuth`

### `FreelancerDashboard.tsx` (`src/components/FreelancerDashboard.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `./CompanyProfilesManager`, `../domain/providers/RemotePlatformsCatalog`

### `Integrations.tsx` (`src/components/Integrations.tsx`)
- **Purpose**: Module file
- **Imports**: `react`

### `JobSearch.tsx` (`src/components/JobSearch.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `../types`

### `MemoryManager.tsx` (`src/components/MemoryManager.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `lucide-react`, `../types`

### `SchedulingDashboard.tsx` (`src/components/SchedulingDashboard.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `../domain/models/Scheduling`, `../utils/apiAuth`

### `Sidebar.tsx` (`src/components/Sidebar.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `../types`, `../domain/models/User`, `../utils/apiAuth`

### `Studio.tsx` (`src/components/Studio.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `lucide-react`

### `Terminal.tsx` (`src/components/Terminal.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `lucide-react`, `../types`, `../utils/apiAuth`

### `UserManager.tsx` (`src/components/UserManager.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `../domain/models/User`, `../utils/apiAuth`

## Folder: `src/domain/agent`

### `AgentConfig.ts` (`src/domain/agent/AgentConfig.ts`)
- **Purpose**: Exports AgentConfig
- **Exports**: `class AgentConfig`
- **Imports**: `./types`

### `AgentFramework.test.ts` (`src/domain/agent/AgentFramework.test.ts`)
- **Purpose**: Create a concrete MockAgent to test the abstract BaseAgent and scheduling
- **Imports**: `vitest`, `./BaseAgent`, `./EventBus`, `./TaskQueue`, `./AgentManager`, `./WorkflowEngine`, `./types`

### `AgentManager.ts` (`src/domain/agent/AgentManager.ts`)
- **Purpose**: Exports AgentManager
- **Exports**: `class AgentManager`
- **Imports**: `./BaseAgent`, `./types`, `./TaskQueue`, `./EventBus`

### `AgentMonitor.ts` (`src/domain/agent/AgentMonitor.ts`)
- **Purpose**: Exports AgentMonitor
- **Exports**: `class AgentMonitor`
- **Imports**: `./types`, `./AgentManager`, `./TaskQueue`

### `AgentStatePersistence.ts` (`src/domain/agent/AgentStatePersistence.ts`)
- **Purpose**: Exports AgentStatePersistence
- **Exports**: `class AgentStatePersistence`
- **Imports**: `fs`, `path`, `./TaskQueue`, `./AgentManager`, `./WorkflowEngine`, `./EventBus`, `./SystemOperationalAgent`, `./FreelancerAgent`

### `BaseAgent.ts` (`src/domain/agent/BaseAgent.ts`)
- **Purpose**: Module file
- **Imports**: `./types`

### `EventBus.ts` (`src/domain/agent/EventBus.ts`)
- **Purpose**: Highly reliable, concurrent-safe System Event Bus Tracks telemetry, status updates, audits, and UI triggers.
- **Exports**: `class EventBus`, `class MessageBus`
- **Imports**: `./types`

### `FreelancerAgent.ts` (`src/domain/agent/FreelancerAgent.ts`)
- **Purpose**: Exports FreelancerAgent
- **Exports**: `class FreelancerAgent extends BaseAgent`
- **Imports**: `./BaseAgent`, `./types`, `./EventBus`, `@google/genai`, `../di/DIContainer`, `../repositories/SQLiteFreelancerRepository`, `../repositories/ICandidateRepository`, `../services/NotificationService`, `../providers/freelance/FreelancerProvider`, `../providers/freelance/UpworkProvider`, `../providers/freelance/PeoplePerHourProvider`, `../providers/freelance/GuruProvider`, `../providers/freelance/FiverrProProvider`, `../providers/InitialPlatformSeed`, `../services/CompanyProfileService`

### `freelancerTypes.ts` (`src/domain/agent/freelancerTypes.ts`)
- **Purpose**: Exports NormalizedFreelanceProject, ProposalTone, ProposalStatus
- **Exports**: `interface NormalizedFreelanceProject`, `type ProposalTone`, `type ProposalStatus`, `interface FreelanceProposal`, `interface FreelancerExecutionRecord`, `interface FreelancerLog`, `interface FreelancerAgentState`, `interface FreelancerNotification`, `interface FreelancerConfig`, `interface FreelancerDashboardData`

### `MemoryInterface.ts` (`src/domain/agent/MemoryInterface.ts`)
- **Purpose**: Exports WorkingMemory, LongTermMemory, SemanticMemory
- **Exports**: `class WorkingMemory implements IWorkingMemory`, `class LongTermMemory implements ILongTermMemory`, `class SemanticMemory implements ISemanticMemory`, `class EpisodicMemory implements IEpisodicMemory`, `class VectorMemory implements IVectorMemory`

### `ModelRouter.ts` (`src/domain/agent/ModelRouter.ts`)
- **Purpose**: Real Server-Side Gemini API Model Provider
- **Exports**: `class GeminiModelProvider implements IModelProvider`, `class GenericModelProvider implements IModelProvider`, `class ModelRouter`
- **Imports**: `./types`, `@google/genai`

### `SystemOperationalAgent.ts` (`src/domain/agent/SystemOperationalAgent.ts`)
- **Purpose**: Exports SystemOperationalAgent
- **Exports**: `class SystemOperationalAgent extends BaseAgent`
- **Imports**: `./BaseAgent`, `./types`, `./ToolFramework`

### `TaskQueue.ts` (`src/domain/agent/TaskQueue.ts`)
- **Purpose**: Exports TaskQueue
- **Exports**: `class TaskQueue`
- **Imports**: `./types`, `./EventBus`

### `ToolFramework.ts` (`src/domain/agent/ToolFramework.ts`)
- **Purpose**: 1. Filesystem Access Tool
- **Exports**: `class FilesystemTool implements Tool`, `class BrowserTool implements Tool`, `class TerminalTool implements Tool`, `class MemoryTool implements Tool`, `class EmailTool implements Tool`, `class CalendarTool implements Tool`, `class HttpTool implements Tool`, `class GitTool implements Tool`, `class DatabaseTool implements Tool`, `class ToolRegistry`
- **Imports**: `./types`, `./EventBus`

### `types.ts` (`src/domain/agent/types.ts`)
- **Purpose**: ========================================== AGENT LIFECYCLE & CORE TYPES
- **Exports**: `type AgentStatus`, `interface AgentProgress`, `interface AgentState`, `type TaskStatus`, `interface Task`, `type EventType`, `interface SystemEvent`, `type EventCallback`, `interface MessageEnvelope`, `type MessageCallback`, `type WorkflowNodeType`, `interface WorkflowNode`, `interface Workflow`, `interface ToolParameter`, `interface ToolDefinition`, `interface ToolContext`, `interface Tool`, `interface IWorkingMemory`, `interface ILongTermMemory`, `interface ISemanticMemory`, `interface IEpisodicMemory`, `interface IVectorMemory`, `interface ModelRequest`, `interface ModelResponse`, `interface IModelProvider`, `interface AgentSystemConfig`, `interface AgentMetrics`

### `WorkflowEngine.ts` (`src/domain/agent/WorkflowEngine.ts`)
- **Purpose**: Exports WorkflowEngine
- **Exports**: `class WorkflowEngine`
- **Imports**: `./types`, `./AgentManager`, `./EventBus`

## Folder: `src/domain/di`

### `DIContainer.ts` (`src/domain/di/DIContainer.ts`)
- **Purpose**: Exports DIContainer
- **Exports**: `class DIContainer`
- **Imports**: `dotenv`, `../repositories/InMemoryCandidateRepository`, `../repositories/FirestoreCandidateRepository`, `../repositories/SQLiteBackupRepository`, `../repositories/SQLiteFreelancerRepository`, `../repositories/SQLiteOrderRepository`, `../services/MatchingService`, `../providers/AggregatedJobProvider`, `../providers/FreelanceScoutProvider`, `../providers/GeminiClientProvider`, `../services/BackupService`, `../services/MigrationService`, `../services/ResumeServiceAgent`, `../repositories/InMemoryContactRepository`, `../repositories/SQLiteContactRepository`, `../repositories/SQLiteScreeningRepository`, `../repositories/InMemoryScreeningRepository`, `../services/ScreeningServiceAgent`, `../services/PersistenceConfigService`, `../services/StructuredLoggerService`, `../services/GlobalOperationLockService`, `../services/ProgressTrackerService`, `../services/RetryService`, `../services/BackupStorageService`, `../services/SchedulerService`, `../repositories/InMemorySchedulingRepository`, `../providers/InMemoryCalendarProvider`, `../providers/GoogleCalendarProvider`, `../models/Scheduling`, `../repositories/InMemoryInterviewerCalendarRepository`, `../repositories/SQLiteInterviewerCalendarRepository`, `../services/SchedulingServiceAgent`, `../repositories/InMemoryUserRepository`, `../repositories/SQLiteUserRepository`

## Folder: `src/domain`

### `freelancer_extensions.test.ts` (`src/domain/freelancer_extensions.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./repositories/SQLiteFreelancerRepository`, `./services/ResumeParserService`, `./services/NotificationService`, `./agent/freelancerTypes`

### `freelancer.test.ts` (`src/domain/freelancer.test.ts`)
- **Purpose**: Mock providers
- **Imports**: `vitest`, `./di/DIContainer`, `./repositories/SQLiteFreelancerRepository`, `./repositories/SQLiteBackupRepository`, `./agent/FreelancerAgent`, `./agent/types`, `./agent/freelancerTypes`, `./repositories/ICandidateRepository`, `./models/Candidate`, `./providers/freelance/FreelancerProvider`, `./providers/freelance/UpworkProvider`, `./providers/freelance/PeoplePerHourProvider`, `./providers/freelance/GuruProvider`, `./providers/freelance/FiverrProProvider`

### `index.ts` (`src/domain/index.ts`)
- **Purpose**: Export Models Export Interfaces / Providers

### `providers.test.ts` (`src/domain/providers.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./providers/FreelanceScoutProvider`, `./providers/GeminiClientProvider`

### `sprint1.test.ts` (`src/domain/sprint1.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`

### `test-script-runner.ts` (`src/domain/test-script-runner.ts`)
- **Purpose**: Module file
- **Imports**: `dotenv`, `./di/DIContainer`, `./repositories/ICandidateRepository`, `./services/IBackupService`

## Folder: `src/domain/models`

### `Candidate.ts` (`src/domain/models/Candidate.ts`)
- **Purpose**: Candidate entity model for recruitment sourcing and ATS match workflows.
- **Exports**: `interface Candidate`

### `Contact.ts` (`src/domain/models/Contact.ts`)
- **Purpose**: Exports ContactMetadata, ResponseStatus, Contact
- **Exports**: `interface ContactMetadata`, `type ResponseStatus`, `interface Contact`, `function normalizeEmail (email?: string): string`, `function normalizeLinkedInUrl (url?: string): string`, `function isDuplicateContact (c1: Partial<Contact>, c2: Partial<Contact>): boolean`, `interface DuplicateCheckResult`, `function categorizeDuplicates (`, `function canQueueOutreach (contact: Contact): boolean`, `function createContact (`, `function verifyContact (contact: Contact): Contact`

### `FreelanceProject.ts` (`src/domain/models/FreelanceProject.ts`)
- **Purpose**: Exports FreelanceProject
- **Exports**: `interface FreelanceProject`

### `InterviewerCalendarAccount.ts` (`src/domain/models/InterviewerCalendarAccount.ts`)
- **Purpose**: Exports CalendarConnectionStatus, WorkingHoursConfig, InterviewerCalendarAccount
- **Exports**: `type CalendarConnectionStatus`, `interface WorkingHoursConfig`, `interface InterviewerCalendarAccount`

### `Job.ts` (`src/domain/models/Job.ts`)
- **Purpose**: Exports Job
- **Exports**: `interface Job`

### `MatchResult.ts` (`src/domain/models/MatchResult.ts`)
- **Purpose**: Exports MatchResult
- **Exports**: `interface MatchResult`

### `ResumeOrder.ts` (`src/domain/models/ResumeOrder.ts`)
- **Purpose**: Exports ServiceTier, PaymentStatus, DeliveryStatus
- **Exports**: `type ServiceTier`, `type PaymentStatus`, `type DeliveryStatus`, `interface FactTraceabilityItem`, `interface VerificationCheckResults`, `interface VerificationResult`, `interface ResumeOrder`, `function getTierPricing (tier: ServiceTier):`, `function createResumeOrder (data:`

### `Scheduling.ts` (`src/domain/models/Scheduling.ts`)
- **Purpose**: Exports SlotStatus, SchedulingSessionStatus, InterviewerSlot
- **Exports**: `type SlotStatus`, `type SchedulingSessionStatus`, `interface InterviewerSlot`, `interface SchedulingSession`, `type SchedulingAuditAction`, `interface SchedulingAuditLog`, `interface ICalendarProvider`, `function hashToken (token: string): string`, `function generateSchedulingToken (): string`
- **Imports**: `crypto`

### `ScreeningSession.ts` (`src/domain/models/ScreeningSession.ts`)
- **Purpose**: Exports generateSessionToken, SessionStatus, Recommendation
- **Exports**: `function generateSessionToken (): string`, `type SessionStatus`, `type Recommendation`, `interface ChatMessage`, `interface EvaluationCriterion`, `interface ScreeningEvaluation`, `interface HumanReview`, `interface ScreeningSession`, `function createScreeningSession (params:`, `function isSessionExpired (session: ScreeningSession): boolean`
- **Imports**: `crypto`

### `User.ts` (`src/domain/models/User.ts`)
- **Purpose**: Exports UserRole, User, UserPublicProfile
- **Exports**: `type UserRole`, `interface User`, `interface UserPublicProfile`, `interface UserInvite`, `interface TokenDenylistEntry`, `interface AuthTokenPayload`, `function normalizeEmail (email: string): string`, `function isValidEmail (email: string): boolean`, `function toPublicProfile (user: User): UserPublicProfile`

## Folder: `src/domain/providers`

### `AggregatedJobProvider.test.ts` (`src/domain/providers/AggregatedJobProvider.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./RemoteOkJobProvider`, `./HimalayasJobProvider`, `./ArbeitnowJobProvider`, `./AggregatedJobProvider`

### `AggregatedJobProvider.ts` (`src/domain/providers/AggregatedJobProvider.ts`)
- **Purpose**: Exports AggregatedJobProvider
- **Exports**: `class AggregatedJobProvider implements IJobProvider`
- **Imports**: `../models/Job`, `./IJobProvider`, `./RemotiveJobProvider`, `./RemoteOkJobProvider`, `./HimalayasJobProvider`, `./ArbeitnowJobProvider`, `./InitialPlatformSeed`

### `ArbeitnowJobProvider.ts` (`src/domain/providers/ArbeitnowJobProvider.ts`)
- **Purpose**: Exports ArbeitnowJobProvider
- **Exports**: `class ArbeitnowJobProvider implements IJobProvider`
- **Imports**: `../models/Job`, `./IJobProvider`

### `FreelanceScoutProvider.ts` (`src/domain/providers/FreelanceScoutProvider.ts`)
- **Purpose**: Exports FreelanceScoutProvider
- **Exports**: `class FreelanceScoutProvider implements IFreelanceProvider`
- **Imports**: `../models/FreelanceProject`, `./IFreelanceProvider`, `./InitialPlatformSeed`, `../utils/projectUrlHelper`

### `GeminiClientProvider.ts` (`src/domain/providers/GeminiClientProvider.ts`)
- **Purpose**: Exports GeminiClientProvider
- **Exports**: `class GeminiClientProvider implements IAIClientProvider`
- **Imports**: `@google/genai`, `./IAIClientProvider`

### `GoogleCalendarProvider.test.ts` (`src/domain/providers/GoogleCalendarProvider.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./GoogleCalendarProvider`, `../repositories/InMemoryInterviewerCalendarRepository`, `../repositories/SQLiteInterviewerCalendarRepository`, `../utils/calendarEncryption`, `../services/RetryService`, `../services/PersistenceConfigService`, `../repositories/InMemorySchedulingRepository`, `../services/SchedulingServiceAgent`

### `GoogleCalendarProvider.ts` (`src/domain/providers/GoogleCalendarProvider.ts`)
- **Purpose**: Exports isGoogleTokenRevocationError, GoogleCalendarProviderOptions, GoogleCalendarProvider
- **Exports**: `function isGoogleTokenRevocationError (err: any): boolean`, `interface GoogleCalendarProviderOptions`, `class GoogleCalendarProvider implements ICalendarProvider`
- **Imports**: `googleapis`, `google-auth-library`, `../models/Scheduling`, `../repositories/IInterviewerCalendarRepository`, `../utils/calendarEncryption`, `../services/RetryService`, `../services/PersistenceConfigService`

### `HimalayasJobProvider.ts` (`src/domain/providers/HimalayasJobProvider.ts`)
- **Purpose**: Exports HimalayasJobProvider
- **Exports**: `class HimalayasJobProvider implements IJobProvider`
- **Imports**: `../models/Job`, `./IJobProvider`

### `IAIClientProvider.ts` (`src/domain/providers/IAIClientProvider.ts`)
- **Purpose**: Exports IAIClientProvider
- **Exports**: `interface IAIClientProvider`
- **Imports**: `@google/genai`

### `IFreelanceProvider.ts` (`src/domain/providers/IFreelanceProvider.ts`)
- **Purpose**: Exports IFreelanceProvider
- **Exports**: `interface IFreelanceProvider`
- **Imports**: `../models/FreelanceProject`

### `IJobProvider.ts` (`src/domain/providers/IJobProvider.ts`)
- **Purpose**: Exports IJobProvider
- **Exports**: `interface IJobProvider`
- **Imports**: `../models/Job`

### `InitialPlatformSeed.ts` (`src/domain/providers/InitialPlatformSeed.ts`)
- **Purpose**: Exports getInitialSeedProjectsForAll40Platforms
- **Exports**: `function getInitialSeedProjectsForAll40Platforms (): NormalizedFreelanceProject[]`
- **Imports**: `../agent/freelancerTypes`, `./RemotePlatformsCatalog`, `../utils/projectUrlHelper`

### `InMemoryCalendarProvider.ts` (`src/domain/providers/InMemoryCalendarProvider.ts`)
- **Purpose**: Exports InMemoryCalendarProvider
- **Exports**: `class InMemoryCalendarProvider implements ICalendarProvider`
- **Imports**: `../models/Scheduling`

### `RemoteOkJobProvider.ts` (`src/domain/providers/RemoteOkJobProvider.ts`)
- **Purpose**: Exports RemoteOkJobProvider
- **Exports**: `class RemoteOkJobProvider implements IJobProvider`
- **Imports**: `../models/Job`, `./IJobProvider`

### `RemotePlatformsCatalog.ts` (`src/domain/providers/RemotePlatformsCatalog.ts`)
- **Purpose**: Exports RemotePlatformInfo, REMOTE_PLATFORMS_40
- **Exports**: `interface RemotePlatformInfo`, `const REMOTE_PLATFORMS_40 : RemotePlatformInfo[]`

### `RemotiveJobProvider.ts` (`src/domain/providers/RemotiveJobProvider.ts`)
- **Purpose**: Exports RemotiveJobProvider
- **Exports**: `class RemotiveJobProvider implements IJobProvider`
- **Imports**: `../models/Job`, `./IJobProvider`

## Folder: `src/domain/providers/freelance`

### `FiverrProProvider.ts` (`src/domain/providers/freelance/FiverrProProvider.ts`)
- **Purpose**: Exports FiverrProProvider
- **Exports**: `class FiverrProProvider`
- **Imports**: `../../agent/freelancerTypes`, `../../utils/resilientFetch`, `../../di/DIContainer`

### `FreelancerProvider.ts` (`src/domain/providers/freelance/FreelancerProvider.ts`)
- **Purpose**: Exports FreelancerProvider
- **Exports**: `class FreelancerProvider`
- **Imports**: `../../agent/freelancerTypes`, `../../utils/resilientFetch`, `../../di/DIContainer`

### `GuruProvider.ts` (`src/domain/providers/freelance/GuruProvider.ts`)
- **Purpose**: Exports GuruProvider
- **Exports**: `class GuruProvider`
- **Imports**: `../../agent/freelancerTypes`, `../../utils/resilientFetch`, `../../di/DIContainer`

### `PeoplePerHourProvider.ts` (`src/domain/providers/freelance/PeoplePerHourProvider.ts`)
- **Purpose**: Exports PeoplePerHourProvider
- **Exports**: `class PeoplePerHourProvider`
- **Imports**: `../../agent/freelancerTypes`, `../../utils/resilientFetch`, `../../di/DIContainer`

### `UpworkProvider.ts` (`src/domain/providers/freelance/UpworkProvider.ts`)
- **Purpose**: Exports UpworkProvider
- **Exports**: `class UpworkProvider`
- **Imports**: `../../agent/freelancerTypes`, `../../utils/resilientFetch`, `../../di/DIContainer`

## Folder: `src/domain/repositories`

### `Contact.test.ts` (`src/domain/repositories/Contact.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `fs`, `path`, `./InMemoryContactRepository`, `./SQLiteContactRepository`

### `FirestoreCandidateRepository.ts` (`src/domain/repositories/FirestoreCandidateRepository.ts`)
- **Purpose**: Exports FirestoreCandidateRepository
- **Exports**: `class FirestoreCandidateRepository implements ICandidateRepository`
- **Imports**: `firebase-admin/app`, `firebase-admin/firestore`, `fs`, `path`, `../models/Candidate`, `./ICandidateRepository`, `./SQLiteBackupRepository`

### `ICandidateRepository.ts` (`src/domain/repositories/ICandidateRepository.ts`)
- **Purpose**: Exports ICandidateRepository
- **Exports**: `interface ICandidateRepository`
- **Imports**: `../models/Candidate`

### `IContactRepository.ts` (`src/domain/repositories/IContactRepository.ts`)
- **Purpose**: Exports IContactRepository
- **Exports**: `interface IContactRepository`
- **Imports**: `../models/Contact`

### `IInterviewerCalendarRepository.ts` (`src/domain/repositories/IInterviewerCalendarRepository.ts`)
- **Purpose**: Exports IInterviewerCalendarRepository
- **Exports**: `interface IInterviewerCalendarRepository`
- **Imports**: `../models/InterviewerCalendarAccount`

### `InMemoryCandidateRepository.ts` (`src/domain/repositories/InMemoryCandidateRepository.ts`)
- **Purpose**: Exports InMemoryCandidateRepository
- **Exports**: `class InMemoryCandidateRepository implements ICandidateRepository`
- **Imports**: `../models/Candidate`, `./ICandidateRepository`

### `InMemoryContactRepository.ts` (`src/domain/repositories/InMemoryContactRepository.ts`)
- **Purpose**: Exports InMemoryContactRepository
- **Exports**: `class InMemoryContactRepository implements IContactRepository`
- **Imports**: `./IContactRepository`

### `InMemoryInterviewerCalendarRepository.ts` (`src/domain/repositories/InMemoryInterviewerCalendarRepository.ts`)
- **Purpose**: Exports InMemoryInterviewerCalendarRepository
- **Exports**: `class InMemoryInterviewerCalendarRepository implements IInterviewerCalendarRepository`
- **Imports**: `./IInterviewerCalendarRepository`

### `InMemoryOrderRepository.ts` (`src/domain/repositories/InMemoryOrderRepository.ts`)
- **Purpose**: Exports InMemoryOrderRepository
- **Exports**: `class InMemoryOrderRepository implements IOrderRepository`
- **Imports**: `../models/ResumeOrder`, `./IOrderRepository`

### `InMemorySchedulingRepository.ts` (`src/domain/repositories/InMemorySchedulingRepository.ts`)
- **Purpose**: Exports InMemorySchedulingRepository
- **Exports**: `class InMemorySchedulingRepository implements ISchedulingRepository`
- **Imports**: `../models/Scheduling`, `./ISchedulingRepository`

### `InMemoryScreeningRepository.ts` (`src/domain/repositories/InMemoryScreeningRepository.ts`)
- **Purpose**: Exports InMemoryScreeningRepository
- **Exports**: `class InMemoryScreeningRepository implements IScreeningRepository`
- **Imports**: `./IScreeningRepository`, `../models/ScreeningSession`

### `InMemoryUserRepository.ts` (`src/domain/repositories/InMemoryUserRepository.ts`)
- **Purpose**: Exports InMemoryUserRepository
- **Exports**: `class InMemoryUserRepository implements IUserRepository`
- **Imports**: `../models/User`

### `IOrderRepository.ts` (`src/domain/repositories/IOrderRepository.ts`)
- **Purpose**: Exports IOrderRepository
- **Exports**: `interface IOrderRepository`
- **Imports**: `../models/ResumeOrder`

### `ISchedulingRepository.ts` (`src/domain/repositories/ISchedulingRepository.ts`)
- **Purpose**: Exports ISchedulingRepository
- **Exports**: `interface ISchedulingRepository`
- **Imports**: `../models/Scheduling`

### `IScreeningRepository.ts` (`src/domain/repositories/IScreeningRepository.ts`)
- **Purpose**: Exports IScreeningRepository
- **Exports**: `interface IScreeningRepository`
- **Imports**: `../models/ScreeningSession`

### `IUserRepository.ts` (`src/domain/repositories/IUserRepository.ts`)
- **Purpose**: Exports CreateUserData, UpdateUserData, CreateInviteData
- **Exports**: `interface CreateUserData`, `interface UpdateUserData`, `interface CreateInviteData`, `interface IUserRepository`
- **Imports**: `../models/User`

### `SQLiteBackupRepository.ts` (`src/domain/repositories/SQLiteBackupRepository.ts`)
- **Purpose**: Exports SQLiteBackupRepository
- **Exports**: `class SQLiteBackupRepository implements ICandidateRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `../models/Candidate`, `./ICandidateRepository`

### `SQLiteContactRepository.ts` (`src/domain/repositories/SQLiteContactRepository.ts`)
- **Purpose**: Exports SQLiteContactRepository
- **Exports**: `class SQLiteContactRepository implements IContactRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `./IContactRepository`

### `SQLiteFreelancerRepository.ts` (`src/domain/repositories/SQLiteFreelancerRepository.ts`)
- **Purpose**: Exports SQLiteFreelancerRepository
- **Exports**: `class SQLiteFreelancerRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `../providers/InitialPlatformSeed`, `../utils/projectUrlHelper`

### `SQLiteInterviewerCalendarRepository.ts` (`src/domain/repositories/SQLiteInterviewerCalendarRepository.ts`)
- **Purpose**: Exports SQLiteInterviewerCalendarRepository
- **Exports**: `class SQLiteInterviewerCalendarRepository implements IInterviewerCalendarRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `./IInterviewerCalendarRepository`

### `SQLiteOrderRepository.ts` (`src/domain/repositories/SQLiteOrderRepository.ts`)
- **Purpose**: Exports SQLiteOrderRepository
- **Exports**: `class SQLiteOrderRepository implements IOrderRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `../models/ResumeOrder`, `./IOrderRepository`

### `SQLiteScreeningRepository.ts` (`src/domain/repositories/SQLiteScreeningRepository.ts`)
- **Purpose**: Exports SQLiteScreeningRepository
- **Exports**: `class SQLiteScreeningRepository implements IScreeningRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `../models/ScreeningSession`, `./IScreeningRepository`

### `SQLiteUserRepository.ts` (`src/domain/repositories/SQLiteUserRepository.ts`)
- **Purpose**: Exports SQLiteUserRepository
- **Exports**: `class SQLiteUserRepository implements IUserRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `../models/User`

## Folder: `src/domain/services`

### `AuditRunnerService.ts` (`src/domain/services/AuditRunnerService.ts`)
- **Purpose**: Exports AuditIssue, AuditIndexSummary, IndexedFileEntry
- **Exports**: `interface AuditIssue`, `interface AuditIndexSummary`, `interface IndexedFileEntry`, `interface AuditIndex`, `class AuditRunnerService`
- **Imports**: `fs`, `path`

### `AuthService.ts` (`src/domain/services/AuthService.ts`)
- **Purpose**: Exports RegisterParams, LoginParams, AuthResult
- **Exports**: `interface RegisterParams`, `interface LoginParams`, `interface AuthResult`, `class AuthService`
- **Imports**: `bcryptjs`, `jsonwebtoken`, `crypto`, `../repositories/IUserRepository`

### `BackupService.test.ts` (`src/domain/services/BackupService.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./BackupService`, `../models/Candidate`

### `BackupService.ts` (`src/domain/services/BackupService.ts`)
- **Purpose**: Exports BackupService
- **Exports**: `class BackupService implements IBackupService`
- **Imports**: `./IBackupService`, `../repositories/FirestoreCandidateRepository`, `../repositories/SQLiteBackupRepository`, `./PersistenceConfigService`, `./StructuredLoggerService`, `./GlobalOperationLockService`, `./ProgressTrackerService`, `./RetryService`, `./BackupStorageService`, `../models/Candidate`, `crypto`, `fs`, `path`

### `BackupStorageService.ts` (`src/domain/services/BackupStorageService.ts`)
- **Purpose**: Exports BackupManifest, BackupStorageService
- **Exports**: `interface BackupManifest`, `class BackupStorageService`
- **Imports**: `fs`, `path`, `zlib`, `crypto`, `../repositories/SQLiteBackupRepository`, `./PersistenceConfigService`, `../models/Candidate`

### `CompanyDeliveryApi.test.ts` (`src/domain/services/CompanyDeliveryApi.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `supertest`, `../../../server`, `./CompanyProfileService`

### `CompanyProfileService.ts` (`src/domain/services/CompanyProfileService.ts`)
- **Purpose**: Exports SUPPORTED_FREELANCE_CATEGORIES, CompanyProfileService
- **Exports**: `const SUPPORTED_FREELANCE_CATEGORIES :`, `class CompanyProfileService`
- **Imports**: `fs`, `path`, `../../types`

### `GlobalOperationLockService.ts` (`src/domain/services/GlobalOperationLockService.ts`)
- **Purpose**: Exports GlobalOperationLockService
- **Exports**: `class GlobalOperationLockService`

### `IBackupService.ts` (`src/domain/services/IBackupService.ts`)
- **Purpose**: Exports BackupResult, RestoreResult, RestorePreviewResult
- **Exports**: `interface BackupResult`, `interface RestoreResult`, `interface RestorePreviewResult`, `interface DetailedHealthReport`, `interface IBackupService`

### `IMatchingService.ts` (`src/domain/services/IMatchingService.ts`)
- **Purpose**: Exports IMatchingService
- **Exports**: `interface IMatchingService`
- **Imports**: `../models/Candidate`, `../models/Job`, `../models/MatchResult`

### `IMigrationService.ts` (`src/domain/services/IMigrationService.ts`)
- **Purpose**: Exports MigrationStepProgress, ProgressCallback, MigrationResult
- **Exports**: `interface MigrationStepProgress`, `type ProgressCallback`, `interface MigrationResult`, `interface IMigrationService`

### `MatchingService.ts` (`src/domain/services/MatchingService.ts`)
- **Purpose**: Exports MatchingService
- **Exports**: `class MatchingService implements IMatchingService`
- **Imports**: `../models/Candidate`, `../models/Job`, `../models/MatchResult`, `./IMatchingService`

### `MigrationService.test.ts` (`src/domain/services/MigrationService.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./MigrationService`, `../models/Candidate`, `./IMigrationService`

### `MigrationService.ts` (`src/domain/services/MigrationService.ts`)
- **Purpose**: Exports MigrationService
- **Exports**: `class MigrationService implements IMigrationService`
- **Imports**: `./IMigrationService`, `../repositories/FirestoreCandidateRepository`, `../repositories/SQLiteBackupRepository`, `./PersistenceConfigService`, `./GlobalOperationLockService`, `./ProgressTrackerService`, `./RetryService`, `./StructuredLoggerService`, `../models/Candidate`

### `NotificationService.ts` (`src/domain/services/NotificationService.ts`)
- **Purpose**: Exports NotificationService
- **Exports**: `class NotificationService`
- **Imports**: `fs`, `path`, `../repositories/SQLiteFreelancerRepository`, `../agent/freelancerTypes`, `../utils/projectUrlHelper`, `./CompanyProfileService`

### `PersistenceConfigService.ts` (`src/domain/services/PersistenceConfigService.ts`)
- **Purpose**: Exports PersistenceConfig, PersistenceConfigService
- **Exports**: `interface PersistenceConfig`, `class PersistenceConfigService`

### `ProgressTrackerService.ts` (`src/domain/services/ProgressTrackerService.ts`)
- **Purpose**: Exports OperationProgress, ProgressTrackerService
- **Exports**: `interface OperationProgress`, `class ProgressTrackerService`

### `RbacAuth.test.ts` (`src/domain/services/RbacAuth.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `supertest`, `jsonwebtoken`, `bcryptjs`, `../../../server`, `../index`

### `ResumeOrderApi.test.ts` (`src/domain/services/ResumeOrderApi.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `supertest`, `../../../server`, `../index`, `../models/ResumeOrder`, `../repositories/InMemoryOrderRepository`, `../repositories/InMemoryCandidateRepository`, `./ResumeServiceAgent`, `../providers/IAIClientProvider`

### `ResumeParserService.ts` (`src/domain/services/ResumeParserService.ts`)
- **Purpose**: Exports ResumeParserService
- **Exports**: `class ResumeParserService`
- **Imports**: `@google/genai`, `../models/Candidate`

### `ResumeServiceAgent.test.ts` (`src/domain/services/ResumeServiceAgent.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `../repositories/InMemoryOrderRepository`, `../repositories/SQLiteOrderRepository`, `./ResumeServiceAgent`, `../providers/IAIClientProvider`

### `ResumeServiceAgent.ts` (`src/domain/services/ResumeServiceAgent.ts`)
- **Purpose**: Exports ResumeServiceAgentResult, ResumeServiceAgent
- **Exports**: `interface ResumeServiceAgentResult`, `class ResumeServiceAgent`
- **Imports**: `../providers/IAIClientProvider`, `../utils/jsonHelper`

### `RetryService.ts` (`src/domain/services/RetryService.ts`)
- **Purpose**: Exports RetryService
- **Exports**: `class RetryService`
- **Imports**: `./PersistenceConfigService`

### `SchedulerService.ts` (`src/domain/services/SchedulerService.ts`)
- **Purpose**: Exports SchedulerService
- **Exports**: `class SchedulerService`
- **Imports**: `./PersistenceConfigService`, `./GlobalOperationLockService`, `./StructuredLoggerService`, `./IBackupService`, `./RetryService`

### `SchedulingCancelApi.test.ts` (`src/domain/services/SchedulingCancelApi.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `supertest`, `../../../server`, `../index`, `./SchedulingServiceAgent`

### `SchedulingDashboardAuth.test.ts` (`src/domain/services/SchedulingDashboardAuth.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `supertest`, `../../../server`, `../index`, `./SchedulingServiceAgent`

### `SchedulingServiceAgent.test.ts` (`src/domain/services/SchedulingServiceAgent.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./SchedulingServiceAgent`, `../repositories/InMemorySchedulingRepository`, `../providers/InMemoryCalendarProvider`

### `SchedulingServiceAgent.ts` (`src/domain/services/SchedulingServiceAgent.ts`)
- **Purpose**: Exports SchedulingServiceAgent
- **Exports**: `class SchedulingServiceAgent`
- **Imports**: `crypto`, `../repositories/ISchedulingRepository`

### `ScreeningApi.test.ts` (`src/domain/services/ScreeningApi.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `supertest`, `../../../server`, `../index`, `../models/ScreeningSession`, `./ScreeningServiceAgent`, `../providers/IAIClientProvider`

### `ScreeningServiceAgent.test.ts` (`src/domain/services/ScreeningServiceAgent.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./ScreeningServiceAgent`, `../models/ScreeningSession`, `../providers/IAIClientProvider`

### `ScreeningServiceAgent.ts` (`src/domain/services/ScreeningServiceAgent.ts`)
- **Purpose**: Exports ScreeningServiceAgent
- **Exports**: `class ScreeningServiceAgent`
- **Imports**: `../providers/IAIClientProvider`, `../utils/jsonHelper`

### `SessionTokenRateLimit.test.ts` (`src/domain/services/SessionTokenRateLimit.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `supertest`

### `StructuredLoggerService.ts` (`src/domain/services/StructuredLoggerService.ts`)
- **Purpose**: Exports StructuredLog, StructuredLoggerService
- **Exports**: `interface StructuredLog`, `class StructuredLoggerService`
- **Imports**: `fs`, `path`

### `TelegramBotService.ts` (`src/domain/services/TelegramBotService.ts`)
- **Purpose**: Exports TelegramBotService
- **Exports**: `class TelegramBotService`
- **Imports**: `fs`, `path`, `../di/DIContainer`, `../repositories/SQLiteFreelancerRepository`, `../repositories/ICandidateRepository`, `../agent/AgentManager`, `../agent/TaskQueue`, `../agent/types`, `./ResumeParserService`, `../agent/FreelancerAgent`, `./CompanyProfileService`, `../../types`, `../utils/projectUrlHelper`

## Folder: `src/domain/utils`

### `calendarEncryption.ts` (`src/domain/utils/calendarEncryption.ts`)
- **Purpose**: Exports encryptRefreshToken, decryptRefreshToken
- **Exports**: `function encryptRefreshToken (plainToken: string): string`, `function decryptRefreshToken (encryptedPayload: string): string`
- **Imports**: `crypto`

### `jsonHelper.test.ts` (`src/domain/utils/jsonHelper.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./jsonHelper`

### `jsonHelper.ts` (`src/domain/utils/jsonHelper.ts`)
- **Purpose**: Exports ParseResult, cleanAndParseJSON
- **Exports**: `interface ParseResult`, `function cleanAndParseJSON (text: string | null | undefined): ParseResult`

### `projectUrlHelper.ts` (`src/domain/utils/projectUrlHelper.ts`)
- **Purpose**: Checks if a project URL is merely a generic homepage or landing page rather than a deep link or specific search URL.
- **Exports**: `function isGenericOrHomepageUrl (url?: string): boolean`, `function resolveDirectJobUrl (params:`

### `resilientFetch.ts` (`src/domain/utils/resilientFetch.ts`)
- **Purpose**: Exports ResilientFetchOptions, clearFetchCache
- **Exports**: `interface ResilientFetchOptions`, `function clearFetchCache (): void`

## Folder: `src/utils`

### `apiAuth.ts` (`src/utils/apiAuth.ts`)
- **Purpose**: In-memory user profile cache (No sensitive JWT token stored in JS-accessible memory or Web Storage)
- **Exports**: `const ADMIN_API_KEY_STORAGE_KEY`, `function getAuthToken (): string`, `function getCsrfToken (): string`, `function getAuthUser (): UserPublicProfile | null`, `function setAuthSession (userOrToken: UserPublicProfile | string | null, user?: User`, `function clearAuthSession (): void`, `function hasRole (...allowedRoles: UserRole[]): boolean`, `function isAdmin (): boolean`, `function getAdminApiKey (): string`, `function setAdminApiKey (key: string): void`, `function clearAdminApiKey (): void`, `function getAdminAuthHeaders (existingHeaders?: HeadersInit): Headers`, `function getDangerousActionHeaders (existingHeaders?: HeadersInit): Headers`
- **Imports**: `../domain/models/User`

