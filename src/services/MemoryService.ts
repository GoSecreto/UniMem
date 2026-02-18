import { IMemoryProvider } from '../interfaces/IMemoryProvider.js';
import { SQLiteProvider } from '../providers/SQLiteProvider.js';
import { Session, Observation, Handoff } from '../types/index.js';

export class MemoryService {
  private static instance: MemoryService;
  private provider: IMemoryProvider;

  private constructor() {
    // Determine provider from environment or default to SQLite
    const providerType = process.env.MEMORY_PROVIDER || 'sqlite';
    
    if (providerType === 'sqlite') {
      this.provider = new SQLiteProvider();
    } else {
      // Fallback or other providers like Cognee can be added here
      this.provider = new SQLiteProvider();
      console.error(`Unknown provider type: ${providerType}, defaulting to sqlite`);
    }
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  // Delegate all calls to the active provider
  async createSession(session: Session) { return this.provider.createSession(session); }
  async getSession(sessionId: string) { return this.provider.getSession(sessionId); }
  async getProjectSessions(project: string) { return this.provider.getProjectSessions(project); }
  async updateSessionStatus(sessionId: string, status: Session['status'], reason?: string) { 
    return this.provider.updateSessionStatus(sessionId, status, reason); 
  }
  async getAllProjects() { return this.provider.getAllProjects(); }

  async saveObservation(obs: Observation) { return this.provider.saveObservation(obs); }
  async getObservationsByProject(project: string) { return this.provider.getObservationsByProject(project); }
  async searchObservations(query: string, project?: string) { return this.provider.searchObservations(query, project); }

  async createHandoff(handoff: Handoff) { return this.provider.createHandoff(handoff); }
  async getPendingHandoff(project: string) { return this.provider.getPendingHandoff(project); }
  async markHandoffPickedUp(id: number, toSessionId: string, toCli: string) { 
    return this.provider.markHandoffPickedUp(id, toSessionId, toCli); 
  }
}
