import express from 'express';
import { SessionStore } from '../storage/SessionStore.js';
import { ObservationStore } from '../storage/ObservationStore.js';
import { Session, Observation } from '../types/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WorkerService {
  private app = express();
  private port = 37888;
  private sessionStore = new SessionStore();
  private observationStore = new ObservationStore();

  constructor() {
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Session endpoints
    this.app.post('/api/sessions', (req, res) => {
      try {
        const session: Session = req.body;
        this.sessionStore.createSession(session);
        res.status(201).json({ success: true });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Observation endpoints
    this.app.post('/api/observations', (req, res) => {
      try {
        const observation: Observation = req.body;
        const id = this.observationStore.saveObservation(observation);
        res.status(201).json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Search endpoint
    this.app.get('/api/search', (req, res) => {
      const { query, project } = req.query;
      
      const results = this.observationStore.searchObservations(
        (query as string) || '',
        (project as string) || undefined
      );
      res.json(results);
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
      console.log(`UniMem Worker Service running at http://localhost:${this.port}`);
    });
  }
}
