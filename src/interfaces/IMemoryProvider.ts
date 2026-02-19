import { Session, Observation, SessionSummary, Handoff, UserPrompt } from '../types/index.js';

export interface IMemoryProvider {
  // Session Management
  createSession(session: Session): Promise<void>;
  getSession(sessionId: string): Promise<Session | undefined>;
  getProjectSessions(project: string): Promise<Session[]>;
  getRecentSessions(project: string, limit?: number): Promise<Session[]>;
  getLastActiveSession(project: string): Promise<Session | undefined>;
  updateSessionStatus(sessionId: string, status: Session['status'], reason?: string): Promise<void>;
  getAllProjects(): Promise<string[]>;

  // Observation Management
  saveObservation(obs: Observation): Promise<number>;
  getObservationsByProject(project: string, limit?: number): Promise<Observation[]>;
  getObservationsBySession(sessionId: string): Promise<Observation[]>;
  searchObservations(query: string, project?: string, cliTool?: string, limit?: number): Promise<Observation[]>;
  getObservationCount(project?: string): Promise<number>;
  getTimeline(project: string, anchorId?: number, before?: number, after?: number): Promise<Observation[]>;

  // Session Summary Management
  saveSummary(summary: SessionSummary): Promise<number>;
  getSummary(sessionId: string): Promise<SessionSummary | undefined>;
  getRecentSummaries(project: string, limit?: number): Promise<SessionSummary[]>;

  // User Prompt Management
  saveUserPrompt(prompt: UserPrompt): Promise<number>;
  getSessionPrompts(sessionId: string): Promise<UserPrompt[]>;

  // Handoff Management
  createHandoff(handoff: Handoff): Promise<number>;
  getPendingHandoff(project: string): Promise<Handoff | undefined>;
  markHandoffPickedUp(id: number, toSessionId: string, toCli: string): Promise<void>;
  getHandoffHistory(project: string, limit?: number): Promise<Handoff[]>;

  // Auto-Detection
  detectRecentActivity(project: string, withinMinutes?: number): Promise<Session | undefined>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}
