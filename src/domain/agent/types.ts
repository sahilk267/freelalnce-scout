/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ==========================================
// AGENT LIFECYCLE & CORE TYPES
// ==========================================

export type AgentStatus =
  | "Idle"
  | "Queued"
  | "Planning"
  | "Running"
  | "Waiting"
  | "Retrying"
  | "Paused"
  | "Completed"
  | "Cancelled"
  | "Failed";

export interface AgentProgress {
  percentage: number; // 0 to 100
  currentStep: string;
  etaSeconds?: number;
}

export interface AgentState {
  agentId: string;
  status: AgentStatus;
  progress: AgentProgress;
  tasks: string[]; // List of task IDs assigned/run by this agent
  metadata: Record<string, any>;
  lastUpdated: string;
}

// ==========================================
// TASK TYPES
// ==========================================

export type TaskStatus =
  | "Idle"
  | "Queued"
  | "Planning"
  | "Running"
  | "Waiting"
  | "Retrying"
  | "Paused"
  | "Completed"
  | "Cancelled"
  | "Failed";

export interface Task {
  id: string;
  agentId: string;
  priority: number; // Higher number = higher priority
  createdTime: string;
  startedTime?: string;
  finishedTime?: string;
  retries: number;
  maxRetries: number;
  currentStep: string;
  progress: number; // 0 to 100
  status: TaskStatus;
  logs: string[];
  metadata: Record<string, any>;
  delayedUntil?: string; // Delayed tasks ISO string
  cronExpression?: string; // Recurring task cron string (e.g. "*/5 * * * *")
}

// ==========================================
// EVENT BUS & MESSAGE BUS TYPES
// ==========================================

export type EventType =
  | "AgentStarted"
  | "AgentFinished"
  | "AgentFailed"
  | "TaskQueued"
  | "TaskCompleted"
  | "TaskCancelled"
  | "RetryStarted"
  | "MemoryUpdated"
  | "BrowserOpened"
  | "ToolExecuted"
  | "LogEmitted";

export interface SystemEvent {
  id: string;
  type: EventType;
  timestamp: string;
  agentId?: string;
  taskId?: string;
  payload: Record<string, any>;
}

export type EventCallback = (event: SystemEvent) => void | Promise<void>;

export interface MessageEnvelope {
  id: string;
  topic: string;
  senderId: string;
  timestamp: string;
  payload: any;
}

export type MessageCallback = (envelope: MessageEnvelope) => void | Promise<void>;

// ==========================================
// WORKFLOW ENGINE TYPES
// ==========================================

export type WorkflowNodeType = "Sequential" | "Parallel" | "Conditional" | "Loop";

export interface WorkflowNode {
  id: string;
  name: string;
  type: WorkflowNodeType;
  agentId: string; // The agent responsible for this node
  dependencies: string[]; // Pre-requisite node IDs
  status: TaskStatus;
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
  retryPolicy?: {
    maxRetries: number;
    delaySeconds: number;
  };
  condition?: (context: Record<string, any>) => boolean; // For conditional nodes
  loopConfig?: {
    itemsPath: string; // JSON path in context to loop over
    iteratorVar: string;
  };
}

export interface Workflow {
  id: string;
  name: string;
  nodes: Record<string, WorkflowNode>;
  status: TaskStatus;
  context: Record<string, any>;
  createdTime: string;
  startedTime?: string;
  finishedTime?: string;
}

// ==========================================
// TOOL FRAMEWORK TYPES
// ==========================================

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolContext {
  agentId: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  getDefinition(): ToolDefinition;
  execute(args: Record<string, any>, context: ToolContext): Promise<any>;
}

// ==========================================
// MEMORY INTERFACES
// ==========================================

export interface IWorkingMemory {
  get(key: string): any;
  set(key: string, value: any): void;
  clear(): void;
  getAll(): Record<string, any>;
}

export interface ILongTermMemory {
  store(key: string, value: any, tags?: string[]): Promise<void>;
  retrieve(key: string): Promise<any>;
  searchByTags(tags: string[]): Promise<any[]>;
  delete(key: string): Promise<void>;
}

export interface ISemanticMemory {
  storeConcept(concept: string, relations: Record<string, string>): Promise<void>;
  queryConcept(concept: string): Promise<any>;
}

export interface IEpisodicMemory {
  recordEpisode(episode: { description: string; outcome: string; metadata?: any }): Promise<string>;
  recallSimilarEpisodes(query: string, limit?: number): Promise<any[]>;
}

export interface IVectorMemory {
  upsertVector(id: string, vector: number[], payload?: any): Promise<void>;
  searchVector(vector: number[], topK?: number): Promise<any[]>;
}

// ==========================================
// MODEL ROUTER TYPES
// ==========================================

export interface ModelRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

export interface ModelResponse {
  text: string;
  rawResponse?: any;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface IModelProvider {
  id: string;
  name: string;
  generateText(request: ModelRequest): Promise<ModelResponse>;
}

// ==========================================
// CONFIGURATION TYPES
// ==========================================

export interface AgentSystemConfig {
  maxAgents: number;
  maxQueueSize: number;
  defaultRetries: number;
  defaultTimeoutSeconds: number;
  maxConcurrency: number;
  heartbeatIntervalMs: number;
  schedulerTickMs: number;
  persistenceDirectory: string;
}

// ==========================================
// MONITORING TYPES
// ==========================================

export interface AgentMetrics {
  runningAgents: number;
  queuedAgents: number;
  completedTasks: number;
  failedTasks: number;
  averageRuntimeSeconds: number;
  totalRetriesCount: number;
  cpuUsagePercentage: number;
  memoryUsageMB: number;
}
