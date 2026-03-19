/**
 * Token Sync Service
 *
 * Periodically syncs token usage data from CLI tools into the UniMem database.
 * Idempotent: re-syncing same data is safe via UNIQUE constraint + upsert.
 */
import { MemoryService } from '../services/MemoryService.js';
import { parseClaudeTokens, parseGeminiTokens, parseCodexTokens } from './token-parser.js';
import { TOKEN_SYNC_INTERVAL_MS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

export class TokenSyncService {
  private memoryService: MemoryService;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  /**
   * Sync all token data from all parsers.
   * Returns count of records upserted.
   */
  async syncAll(): Promise<number> {
    let count = 0;

    const parsers = [
      { name: 'claude-code', fn: parseClaudeTokens },
      { name: 'gemini', fn: parseGeminiTokens },
      { name: 'codex', fn: parseCodexTokens },
    ];

    for (const parser of parsers) {
      try {
        const records = parser.fn();
        for (const record of records) {
          await this.memoryService.upsertTokenUsage(record);
          count++;
        }
      } catch (err) {
        logger.warn(`Token sync failed for ${parser.name}`, { error: String(err) });
      }
    }

    if (count > 0) {
      logger.info(`Token sync complete: ${count} records upserted`);
    }
    return count;
  }

  /**
   * Start periodic sync at the configured interval.
   */
  startPeriodicSync(intervalMs: number = TOKEN_SYNC_INTERVAL_MS): void {
    if (this.intervalHandle) return; // Already running

    // Initial sync
    this.syncAll().catch(err => {
      logger.warn('Initial token sync failed', { error: String(err) });
    });

    this.intervalHandle = setInterval(() => {
      this.syncAll().catch(err => {
        logger.warn('Periodic token sync failed', { error: String(err) });
      });
    }, intervalMs);

    logger.info(`Token sync started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic sync.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}
