/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from "dotenv";
dotenv.config();

import { InMemoryCandidateRepository } from "../repositories/InMemoryCandidateRepository";
import { FirestoreCandidateRepository } from "../repositories/FirestoreCandidateRepository";
import { SQLiteBackupRepository } from "../repositories/SQLiteBackupRepository";
import { SQLiteFreelancerRepository } from "../repositories/SQLiteFreelancerRepository";
import { SQLiteOrderRepository } from "../repositories/SQLiteOrderRepository";
import { MatchingService } from "../services/MatchingService";
import { AggregatedJobProvider } from "../providers/AggregatedJobProvider";
import { FreelanceScoutProvider } from "../providers/FreelanceScoutProvider";
import { GeminiClientProvider } from "../providers/GeminiClientProvider";
import { ModelRouter } from "../agent/ModelRouter";
import { BackupService } from "../services/BackupService";
import { MigrationService } from "../services/MigrationService";
import { ResumeServiceAgent } from "../services/ResumeServiceAgent";

import { InMemoryContactRepository } from "../repositories/InMemoryContactRepository";
import { SQLiteContactRepository } from "../repositories/SQLiteContactRepository";
import { SQLiteScreeningRepository } from "../repositories/SQLiteScreeningRepository";
import { InMemoryScreeningRepository } from "../repositories/InMemoryScreeningRepository";
import { ScreeningServiceAgent } from "../services/ScreeningServiceAgent";
import { PersistenceConfigService } from "../services/PersistenceConfigService";
import { StructuredLoggerService } from "../services/StructuredLoggerService";
import { GlobalOperationLockService } from "../services/GlobalOperationLockService";
import { ProgressTrackerService } from "../services/ProgressTrackerService";
import { RetryService } from "../services/RetryService";
import { BackupStorageService } from "../services/BackupStorageService";
import { SchedulerService } from "../services/SchedulerService";

import { InMemorySchedulingRepository } from "../repositories/InMemorySchedulingRepository";
import { InMemoryCalendarProvider } from "../providers/InMemoryCalendarProvider";
import { GoogleCalendarProvider } from "../providers/GoogleCalendarProvider";
import { ICalendarProvider } from "../models/Scheduling";
import { InMemoryInterviewerCalendarRepository } from "../repositories/InMemoryInterviewerCalendarRepository";
import { SQLiteInterviewerCalendarRepository } from "../repositories/SQLiteInterviewerCalendarRepository";
import { SchedulingServiceAgent } from "../services/SchedulingServiceAgent";
import { InMemoryUserRepository } from "../repositories/InMemoryUserRepository";
import { SQLiteUserRepository } from "../repositories/SQLiteUserRepository";
import { SQLitePricingRepository } from "../repositories/SQLitePricingRepository";
import { PricingService } from "../services/PricingService";

export class DIContainer {
  private static services: Map<string, any> = new Map();
  private static isFrozen = false;

  static register(name: string, service: any, force = false): void {
    if (this.isFrozen && !force) {
      throw new Error(`DIContainer is frozen. Attempted to register "${name}" but registry modifications are locked.`);
    }
    if (this.services.has(name) && !force) {
      throw new Error(`Dependency "${name}" is already registered. Duplicate registrations are prohibited in Zero-Trust DI.`);
    }
    this.services.set(name, service);
  }

  static get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service [${name}] is not registered in the DI Container.`);
    }
    return service as T;
  }

  static reset(): void {
    this.services.clear();
    this.isFrozen = false;
  }

  static freeze(): void {
    this.isFrozen = true;
  }

  static validate(): void {
    const required = [
      "ICandidateRepository",
      "IContactRepository",
      "IOrderRepository",
      "IScreeningRepository",
      "SQLiteBackupRepository",
      "SQLiteFreelancerRepository",
      "IBackupService",
      "IMigrationService",
      "IMatchingService",
      "IJobProvider",
      "IFreelanceProvider",
      "IAIClientProvider",
      "PersistenceConfigService",
      "StructuredLoggerService",
      "GlobalOperationLockService",
      "ProgressTrackerService",
      "RetryService",
      "BackupStorageService",
      "SchedulerService",
      "ResumeServiceAgent",
      "ScreeningServiceAgent",
      "ISchedulingRepository",
      "ICalendarProvider",
      "SchedulingServiceAgent",
      "IUserRepository",
      "IPricingRepository",
      "PricingService"
    ];
    for (const key of required) {
      if (!this.services.has(key)) {
        throw new Error(`DIContainer Integrity Check Failed: Missing required registered service "${key}".`);
      }
    }
  }
}

// Bootstrap dependencies
if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  const inMemoryRepo = new InMemoryCandidateRepository();
  const configService = new PersistenceConfigService();
  const loggerService = new StructuredLoggerService("./test_backups");
  const lockService = new GlobalOperationLockService();
  const progressService = new ProgressTrackerService();
  const retryService = new RetryService(configService);
  const storageService = new BackupStorageService(configService);
  const backupService = new BackupService(inMemoryRepo as any, inMemoryRepo as any, configService, loggerService, lockService, progressService, retryService, storageService);
  const migrationService = new MigrationService(inMemoryRepo as any, inMemoryRepo as any, configService, lockService, progressService, retryService, loggerService);
  const schedulerService = new SchedulerService(configService, lockService, loggerService, backupService, retryService);

  DIContainer.register("ICandidateRepository", inMemoryRepo);
  DIContainer.register("IContactRepository", new SQLiteContactRepository(":memory:"));
  DIContainer.register("IOrderRepository", new SQLiteOrderRepository(":memory:"));
  DIContainer.register("IScreeningRepository", new SQLiteScreeningRepository(":memory:"));
  DIContainer.register("SQLiteBackupRepository", inMemoryRepo as any);
  DIContainer.register("SQLiteFreelancerRepository", new SQLiteFreelancerRepository(":memory:"));
  DIContainer.register("IUserRepository", new InMemoryUserRepository());
  const testPricingRepo = new SQLitePricingRepository(":memory:");
  DIContainer.register("IPricingRepository", testPricingRepo);
  DIContainer.register("PricingService", new PricingService(testPricingRepo));
  DIContainer.register("PersistenceConfigService", configService);
  DIContainer.register("StructuredLoggerService", loggerService);
  DIContainer.register("GlobalOperationLockService", lockService);
  DIContainer.register("ProgressTrackerService", progressService);
  DIContainer.register("RetryService", retryService);
  DIContainer.register("BackupStorageService", storageService);
  DIContainer.register("IBackupService", backupService);
  DIContainer.register("IMigrationService", migrationService);
  DIContainer.register("SchedulerService", schedulerService);

  const calendarAccountRepo = new InMemoryInterviewerCalendarRepository();
  DIContainer.register("IInterviewerCalendarRepository", calendarAccountRepo);

  const schedRepo = new InMemorySchedulingRepository();
  const calendarProviderType = (process.env.CALENDAR_PROVIDER || "inmemory").toLowerCase();
  let calProvider: ICalendarProvider;
  if (calendarProviderType === "google") {
    calProvider = new GoogleCalendarProvider(calendarAccountRepo, retryService, configService);
  } else {
    calProvider = new InMemoryCalendarProvider();
  }
  DIContainer.register("ISchedulingRepository", schedRepo);
  DIContainer.register("ICalendarProvider", calProvider);
  DIContainer.register("SchedulingServiceAgent", new SchedulingServiceAgent(schedRepo, calProvider));
} else {
  const primaryRepo = new FirestoreCandidateRepository();
  const secondaryRepo = new SQLiteBackupRepository();
  const configService = new PersistenceConfigService();
  const loggerService = new StructuredLoggerService(configService.getConfig().backupDirectory);
  const lockService = new GlobalOperationLockService();
  const progressService = new ProgressTrackerService();
  const retryService = new RetryService(configService);
  const storageService = new BackupStorageService(configService);
  const backupService = new BackupService(primaryRepo, secondaryRepo, configService, loggerService, lockService, progressService, retryService, storageService);
  const migrationService = new MigrationService(primaryRepo, secondaryRepo, configService, lockService, progressService, retryService, loggerService);
  const schedulerService = new SchedulerService(configService, lockService, loggerService, backupService, retryService);
  
  DIContainer.register("ICandidateRepository", primaryRepo);
  DIContainer.register("IContactRepository", new SQLiteContactRepository());
  DIContainer.register("IOrderRepository", new SQLiteOrderRepository());
  DIContainer.register("IScreeningRepository", new SQLiteScreeningRepository());
  DIContainer.register("SQLiteBackupRepository", secondaryRepo);
  DIContainer.register("SQLiteFreelancerRepository", new SQLiteFreelancerRepository());
  DIContainer.register("IUserRepository", new SQLiteUserRepository());
  const prodPricingRepo = new SQLitePricingRepository();
  DIContainer.register("IPricingRepository", prodPricingRepo);
  DIContainer.register("PricingService", new PricingService(prodPricingRepo));
  DIContainer.register("PersistenceConfigService", configService);
  DIContainer.register("StructuredLoggerService", loggerService);
  DIContainer.register("GlobalOperationLockService", lockService);
  DIContainer.register("ProgressTrackerService", progressService);
  DIContainer.register("RetryService", retryService);
  DIContainer.register("BackupStorageService", storageService);
  DIContainer.register("IBackupService", backupService);
  DIContainer.register("IMigrationService", migrationService);
  DIContainer.register("SchedulerService", schedulerService);

  const calendarAccountRepoProd = new SQLiteInterviewerCalendarRepository();
  DIContainer.register("IInterviewerCalendarRepository", calendarAccountRepoProd);

  const schedRepoProd = new InMemorySchedulingRepository();
  const calendarProviderTypeProd = (process.env.CALENDAR_PROVIDER || "inmemory").toLowerCase();
  let calProviderProd: ICalendarProvider;
  if (calendarProviderTypeProd === "google") {
    calProviderProd = new GoogleCalendarProvider(calendarAccountRepoProd, retryService, configService);
  } else {
    calProviderProd = new InMemoryCalendarProvider();
  }
  DIContainer.register("ISchedulingRepository", schedRepoProd);
  DIContainer.register("ICalendarProvider", calProviderProd);
  DIContainer.register("SchedulingServiceAgent", new SchedulingServiceAgent(schedRepoProd, calProviderProd));

  // Auto-run Scheduler Daemon
  schedulerService.start();
}

DIContainer.register("IMatchingService", new MatchingService());
DIContainer.register("IJobProvider", new AggregatedJobProvider({ includeSeedData: true }));
DIContainer.register("IFreelanceProvider", new FreelanceScoutProvider({ includeSeedData: true }));
const aiClientProvider = ModelRouter.getInstance();
DIContainer.register("IAIClientProvider", aiClientProvider);
DIContainer.register("ResumeServiceAgent", new ResumeServiceAgent(aiClientProvider));
DIContainer.register("ScreeningServiceAgent", new ScreeningServiceAgent(aiClientProvider));

// Validate and lock the container to ensure immutable lifecycle integrity
DIContainer.validate();
DIContainer.freeze();
