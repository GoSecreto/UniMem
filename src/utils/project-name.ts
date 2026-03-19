import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

/**
 * Derive a meaningful project name from a directory path.
 * Priority: package.json name > git remote > directory basename
 */
export function deriveProjectName(cwd: string): string {
  // 1. Try package.json name
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name && pkg.name !== 'undefined') {
        return pkg.name.replace(/^@[^/]+\//, ''); // Strip npm scope
      }
    }
  } catch { /* ignore */ }

  // 2. Try git remote name
  try {
    const remote = execSync('git remote get-url origin', { cwd, timeout: 3000 })
      .toString().trim();
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch { /* ignore */ }

  // 3. Fallback to directory basename with parent disambiguation
  const base = path.basename(cwd);
  const parent = path.basename(path.dirname(cwd));
  // Avoid generic names — include parent to disambiguate
  const genericNames = ['src', 'app', 'project', 'code', 'workspace', 'my-app', 'my-project'];
  if (genericNames.includes(base.toLowerCase())) {
    return `${parent}/${base}`;
  }
  // For common names, add a short hash of the absolute path to avoid collisions
  // e.g., two different "my-app" directories won't merge
  const absPath = path.resolve(cwd);
  const commonNames = ['frontend', 'backend', 'api', 'web', 'server', 'client', 'service'];
  if (commonNames.includes(base.toLowerCase())) {
    const hash = simpleHash(absPath).toString(36).slice(0, 4);
    return `${parent}/${base}-${hash}`;
  }
  return base;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
