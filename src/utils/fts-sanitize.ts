/**
 * Sanitize a user query string for safe use with SQLite FTS5 MATCH.
 * FTS5 has its own query syntax - special chars like *, (, ), ", : can crash it.
 * We escape them to produce a plain term search.
 */
export function sanitizeFtsQuery(query: string): string {
  if (!query || query.trim() === '') return '';

  // Remove FTS5 special operators and wrap each term in double quotes
  // This forces literal matching and prevents syntax errors
  const cleaned = query
    .replace(/[*()":^~{}[\]\\]/g, ' ')  // Remove FTS5 special chars
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, '') // Remove FTS5 operators
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => `"${term}"`)
    .join(' ');

  return cleaned || '';
}
