/**
 * Health check utility — checks if the UniMem worker is running.
 */
import http from 'http';
import { HTTP_PORT } from '../shared/constants.js';

const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

export async function checkWorkerHealth(port: number = HTTP_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: '/api/status',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

export async function warnIfWorkerDown(port: number = HTTP_PORT): Promise<void> {
  const healthy = await checkWorkerHealth(port);
  if (!healthy) {
    console.log(`
${YELLOW}${BOLD}  ⚠  UniMem worker is not running!${RESET}

  ${YELLOW}The worker is required for:${RESET}
  • Hook-based context capture (tool use, session start/end)
  • Auto-switch between CLIs
  • Dashboard at http://localhost:${port}

  ${GREEN}Start it with:${RESET}
  ${BOLD}$ unimem start${RESET}

  ${YELLOW}Without the worker, hooks will queue events offline
  and replay them when the worker starts.${RESET}
`);
  }
}
