import express from 'express';
import { MemoryService } from './MemoryService.js';
import { Session, Observation } from '../types/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WorkerService {
  private app = express();
  private port = 37888;
  private memoryService = MemoryService.getInstance();

  constructor() {
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Session endpoints
    this.app.post('/api/sessions', async (req, res) => {
      try {
        const session: Session = req.body;
        await this.memoryService.createSession(session);
        res.status(201).json({ success: true });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Observation endpoints
    this.app.post('/api/observations', async (req, res) => {
      try {
        const observation: Observation = req.body;
        const id = await this.memoryService.saveObservation(observation);
        res.status(201).json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Search endpoint
    this.app.get('/api/search', async (req, res) => {
      try {
        const { query, project } = req.query;
        
        const results = await this.memoryService.searchObservations(
          (query as string) || '',
          (project as string) || undefined
        );
        res.json(results);
      } catch (error) {
        console.error('SEARCH API ERROR:', error);
        res.status(500).json({ error: String(error) });
      }
    });

    // Projects endpoint
    this.app.get('/api/projects', async (req, res) => {
      try {
        const projects = await this.memoryService.getAllProjects();
        res.json(projects);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // UI - Serve static files (to be built)
    const uiPath = path.join(__dirname, '../../ui/dist');
    this.app.use(express.static(uiPath));
    
    // Fallback for SPA routing
    this.app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(uiPath, 'index.html'));
    });
  }

  public start() {
    this.app.listen(this.port, () => {
      console.error(`UniMem Worker Service running at http://localhost:${this.port}`);
    });
  }
}
