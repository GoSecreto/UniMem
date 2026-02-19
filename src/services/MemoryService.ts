import { IMemoryProvider } from '../interfaces/IMemoryProvider.js';
import { SQLiteProvider } from '../providers/SQLiteProvider.js';
import { Session, Observation, SessionSummary, Handoff, UserPrompt } from '../types/index.js';

export class MemoryService {
  private static instance: MemoryService;
  private provider: IMemoryProvider;

  private constructor() {
    this.provider = new SQLiteProvider();
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  // Session
  createSession(session: Session) { return this.provider.createSession(session); }
  getSession(sessionId: string) { return this.provider.getSession(sessionId); }
  getProjectSessions(project: string) { return this.provider.getProjectSessions(project); }
  getRecentSessions(project: string, limit?: number) { return this.provider.getRecentSessions(project, limit); }
  getLastActiveSession(project: string) { return this.provider.getLastActiveSession(project); }
  updateSessionStatus(sessionId: string, status: Session['status'], reason?: string) {
    return this.provider.updateSessionStatus(sessionId, status, reason);
  }
  getAllProjects() { return this.provider.getAllProjects(); }

  // Observations
  saveObservation(obs: Observation) { return this.provider.saveObservation(obs); }
  getObservationsByProject(project: string, limit?: number) { return this.provider.getObservationsByProject(project, limit); }
  getObservationsBySession(sessionId: string) { return this.provider.getObservationsBySession(sessionId); }
  searchObservations(query: string, project?: string, cliTool?: string, limit?: number) {
    return this.provider.searchObservations(query, project, cliTool, limit);
  }
  getObservationCount(project?: string) { return this.provider.getObservationCount(project); }
  getTimeline(project: string, anchorId?: number, before?: number, after?: number) {
    return this.provider.getTimeline(project, anchorId, before, after);
  }

  // Summaries
  saveSummary(summary: SessionSummary) { return this.provider.saveSummary(summary); }
  getSummary(sessionId: string) { return this.provider.getSummary(sessionId); }
  getRecentSummaries(project: string, limit?: number) { return this.provider.getRecentSummaries(project, limit); }

  // Prompts
  saveUserPrompt(prompt: UserPrompt) { return this.provider.saveUserPrompt(prompt); }
  getSessionPrompts(sessionId: string) { return this.provider.getSessionPrompts(sessionId); }

  // Handoffs
  createHandoff(handoff: Handoff) { return this.provider.createHandoff(handoff); }
  getPendingHandoff(project: string) { return this.provider.getPendingHandoff(project); }
  markHandoffPickedUp(id: number, toSessionId: string, toCli: string) {
    return this.provider.markHandoffPickedUp(id, toSessionId, toCli);
  }
  getHandoffHistory(project: string, limit?: number) { return this.provider.getHandoffHistory(project, limit); }

  // Auto-Detection
  detectRecentActivity(project: string, withinMinutes?: number) {
    return this.provider.detectRecentActivity(project, withinMinutes);
  }
}
