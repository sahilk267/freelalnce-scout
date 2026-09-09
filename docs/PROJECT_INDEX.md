# Project Codebase Index

Automated compact index map of all modules, interfaces, and exports in `src/`.

## Folder: `src`

### `App.tsx` (`src/App.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `./components/Sidebar`, `./components/Studio`, `./components/JobSearch`, `./components/Ats`, `./components/MemoryManager`, `./components/Diagnostics`, `./components/Terminal`, `./components/Integrations`, `./components/AgentDashboard`, `./components/FreelancerDashboard`, `./types`

### `main.tsx` (`src/main.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `react-dom/client`, `./App.tsx`

### `types.ts` (`src/types.ts`)
- **Purpose**: Exports ModuleId, SystemModule, SystemLog
- **Exports**: `type ModuleId`, `interface SystemModule`, `interface SystemLog`, `interface DiagnosticMetrics`, `interface JobRecord`, `interface FreelanceProject`, `interface MemoryEntry`, `interface TerminalLine`

## Folder: `src/components`

### `AgentDashboard.tsx` (`src/components/AgentDashboard.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `motion/react`

### `Ats.tsx` (`src/components/Ats.tsx`)
- **Purpose**: Module file
- **Imports**: `react`

### `Diagnostics.tsx` (`src/components/Diagnostics.tsx`)
- **Purpose**: Exports BackupManifest, StructuredLog, OperationProgress
- **Exports**: `interface BackupManifest`, `interface StructuredLog`, `interface OperationProgress`, `interface RestorePreviewResult`
- **Imports**: `react`, `../types`

### `FreelancerDashboard.tsx` (`src/components/FreelancerDashboard.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `../domain/providers/RemotePlatformsCatalog`

### `Integrations.tsx` (`src/components/Integrations.tsx`)
- **Purpose**: Module file
- **Imports**: `react`

### `JobSearch.tsx` (`src/components/JobSearch.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `../types`

### `MemoryManager.tsx` (`src/components/MemoryManager.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `lucide-react`, `../types`

### `Sidebar.tsx` (`src/components/Sidebar.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `../types`

### `Studio.tsx` (`src/components/Studio.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `lucide-react`

### `Terminal.tsx` (`src/components/Terminal.tsx`)
- **Purpose**: Module file
- **Imports**: `react`, `lucide-react`, `../types`

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
- **Imports**: `./BaseAgent`, `./types`, `./EventBus`, `@google/genai`, `../di/DIContainer`, `../repositories/SQLiteFreelancerRepository`, `../repositories/ICandidateRepository`, `../services/NotificationService`, `../providers/freelance/FreelancerProvider`, `../providers/freelance/UpworkProvider`, `../providers/freelance/PeoplePerHourProvider`, `../providers/freelance/GuruProvider`, `../providers/freelance/FiverrProProvider`, `../providers/InitialPlatformSeed`

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
- **Imports**: `dotenv`, `../repositories/InMemoryCandidateRepository`, `../repositories/FirestoreCandidateRepository`, `../repositories/SQLiteBackupRepository`, `../repositories/SQLiteFreelancerRepository`, `../services/MatchingService`, `../providers/AggregatedJobProvider`, `../providers/FreelanceScoutProvider`, `../providers/GeminiClientProvider`, `../services/BackupService`, `../services/MigrationService`, `../repositories/InMemoryContactRepository`, `../services/PersistenceConfigService`, `../services/StructuredLoggerService`, `../services/GlobalOperationLockService`, `../services/ProgressTrackerService`, `../services/RetryService`, `../services/BackupStorageService`, `../services/SchedulerService`

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
- **Exports**: `interface ContactMetadata`, `type ResponseStatus`, `interface Contact`, `function normalizeEmail (email?: string): string`, `function normalizeLinkedInUrl (url?: string): string`, `function isDuplicateContact (c1: Partial<Contact>, c2: Partial<Contact>): boolean`, `function canQueueOutreach (contact: Contact): boolean`, `function createContact (data: Partial<Contact> &`

### `FreelanceProject.ts` (`src/domain/models/FreelanceProject.ts`)
- **Purpose**: Exports FreelanceProject
- **Exports**: `interface FreelanceProject`

### `Job.ts` (`src/domain/models/Job.ts`)
- **Purpose**: Exports Job
- **Exports**: `interface Job`

### `MatchResult.ts` (`src/domain/models/MatchResult.ts`)
- **Purpose**: Exports MatchResult
- **Exports**: `interface MatchResult`

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
- **Imports**: `../models/FreelanceProject`, `./IFreelanceProvider`, `./InitialPlatformSeed`

### `GeminiClientProvider.ts` (`src/domain/providers/GeminiClientProvider.ts`)
- **Purpose**: Exports GeminiClientProvider
- **Exports**: `class GeminiClientProvider implements IAIClientProvider`
- **Imports**: `@google/genai`, `./IAIClientProvider`

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
- **Imports**: `../agent/freelancerTypes`, `./RemotePlatformsCatalog`

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
- **Imports**: `vitest`, `./InMemoryContactRepository`

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

### `InMemoryCandidateRepository.ts` (`src/domain/repositories/InMemoryCandidateRepository.ts`)
- **Purpose**: Exports InMemoryCandidateRepository
- **Exports**: `class InMemoryCandidateRepository implements ICandidateRepository`
- **Imports**: `../models/Candidate`, `./ICandidateRepository`

### `InMemoryContactRepository.ts` (`src/domain/repositories/InMemoryContactRepository.ts`)
- **Purpose**: Exports InMemoryContactRepository
- **Exports**: `class InMemoryContactRepository implements IContactRepository`
- **Imports**: `../models/Contact`, `./IContactRepository`

### `SQLiteBackupRepository.ts` (`src/domain/repositories/SQLiteBackupRepository.ts`)
- **Purpose**: Exports SQLiteBackupRepository
- **Exports**: `class SQLiteBackupRepository implements ICandidateRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `../models/Candidate`, `./ICandidateRepository`

### `SQLiteFreelancerRepository.ts` (`src/domain/repositories/SQLiteFreelancerRepository.ts`)
- **Purpose**: Exports SQLiteFreelancerRepository
- **Exports**: `class SQLiteFreelancerRepository`
- **Imports**: `better-sqlite3`, `fs`, `path`, `../providers/InitialPlatformSeed`

## Folder: `src/domain/services`

### `AuditRunnerService.ts` (`src/domain/services/AuditRunnerService.ts`)
- **Purpose**: Exports AuditIssue, AuditIndexSummary, IndexedFileEntry
- **Exports**: `interface AuditIssue`, `interface AuditIndexSummary`, `interface IndexedFileEntry`, `interface AuditIndex`, `class AuditRunnerService`
- **Imports**: `fs`, `path`

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
- **Imports**: `../repositories/SQLiteFreelancerRepository`, `../agent/freelancerTypes`

### `PersistenceConfigService.ts` (`src/domain/services/PersistenceConfigService.ts`)
- **Purpose**: Exports PersistenceConfig, PersistenceConfigService
- **Exports**: `interface PersistenceConfig`, `class PersistenceConfigService`

### `ProgressTrackerService.ts` (`src/domain/services/ProgressTrackerService.ts`)
- **Purpose**: Exports OperationProgress, ProgressTrackerService
- **Exports**: `interface OperationProgress`, `class ProgressTrackerService`

### `ResumeParserService.ts` (`src/domain/services/ResumeParserService.ts`)
- **Purpose**: Exports ResumeParserService
- **Exports**: `class ResumeParserService`
- **Imports**: `@google/genai`, `../models/Candidate`

### `RetryService.ts` (`src/domain/services/RetryService.ts`)
- **Purpose**: Exports RetryService
- **Exports**: `class RetryService`
- **Imports**: `./PersistenceConfigService`

### `SchedulerService.ts` (`src/domain/services/SchedulerService.ts`)
- **Purpose**: Exports SchedulerService
- **Exports**: `class SchedulerService`
- **Imports**: `./PersistenceConfigService`, `./GlobalOperationLockService`, `./StructuredLoggerService`, `./IBackupService`, `./RetryService`

### `StructuredLoggerService.ts` (`src/domain/services/StructuredLoggerService.ts`)
- **Purpose**: Exports StructuredLog, StructuredLoggerService
- **Exports**: `interface StructuredLog`, `class StructuredLoggerService`
- **Imports**: `fs`, `path`

## Folder: `src/domain/utils`

### `jsonHelper.test.ts` (`src/domain/utils/jsonHelper.test.ts`)
- **Purpose**: Module file
- **Imports**: `vitest`, `./jsonHelper`

### `jsonHelper.ts` (`src/domain/utils/jsonHelper.ts`)
- **Purpose**: Exports ParseResult, cleanAndParseJSON
- **Exports**: `interface ParseResult`, `function cleanAndParseJSON (text: string | null | undefined): ParseResult`

### `resilientFetch.ts` (`src/domain/utils/resilientFetch.ts`)
- **Purpose**: Exports ResilientFetchOptions, clearFetchCache
- **Exports**: `interface ResilientFetchOptions`, `function clearFetchCache (): void`

