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

  // 3. Fallback to directory basename
  const base = path.basename(cwd);
  // Avoid generic names
  if (['src', 'app', 'project', 'code', 'workspace'].includes(base.toLowerCase())) {
    return path.basename(path.dirname(cwd)) + '/' + base;
  }
  return base;
}
