import { Session, Observation, Handoff } from '../types/index.js';

export interface IMemoryProvider {
  // Session Management
  createSession(session: Session): Promise<void>;
  getSession(sessionId: string): Promise<Session | undefined>;
  getProjectSessions(project: string): Promise<Session[]>;
  updateSessionStatus(sessionId: string, status: Session['status'], reason?: string): Promise<void>;
  getAllProjects(): Promise<string[]>;

  // Observation Management
  saveObservation(obs: Observation): Promise<number>;
  getObservationsByProject(project: string): Promise<Observation[]>;
  searchObservations(query: string, project?: string): Promise<Observation[]>;

  // Handoff Management
  createHandoff(handoff: Handoff): Promise<number>;
  getPendingHandoff(project: string): Promise<Handoff | undefined>;
  markHandoffPickedUp(id: number, toSessionId: string, toCli: string): Promise<void>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}
