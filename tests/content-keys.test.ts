import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUKKAR_LINES, MAKAD_LINES, SIGNS } from '../src/content/script';

/** Every line key referenced from gameplay code must exist in the content tables (typos would fail silently at runtime). */
function sources(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => { for (const f of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
  walk('src/gameplay'); walk('src/scenes'); walk('src/levels');
  return files.map((f) => readFileSync(f, 'utf8'));
}

describe('content keys referenced by code exist', () => {
  const text = sources().join('\n');
  it('Dukkar lines', () => {
    const keys = new Set<string>();
    for (const m of text.matchAll(/(?:\.say\((?:this\.)?pig,|host\.say\((?:this\.)?pig,|pigSay\([a-zA-Z.]+,|bossSay\(|sayLine\(|ctx\.say\(|\.say\((?:[a-zA-Z.]+), )\s*'([a-z0-9-]+)'/g)) keys.add(m[1]);
    for (const m of text.matchAll(/line: '([a-z0-9-]+)'/g)) keys.add(m[1]);
    expect(keys.size).toBeGreaterThan(40);
    const missing = [...keys].filter((k) => !(k in DUKKAR_LINES));
    expect(missing).toEqual([]);
  });
  it('Makad lines', () => {
    const keys = new Set<string>();
    for (const m of text.matchAll(/makad(?:\.say)?\('([a-z0-9-]+)'\)/g)) keys.add(m[1]);
    expect(keys.size).toBeGreaterThan(4);
    expect([...keys].filter((k) => !(k in MAKAD_LINES))).toEqual([]);
  });
  it('sign keys used by levels and encounters', () => {
    const keys = new Set<string>();
    for (const m of text.matchAll(/text: '([a-z0-9-]+)'/g)) keys.add(m[1]);
    for (const m of text.matchAll(/SIGNS\['([a-z0-9-]+)'\]|SIGNS\.([a-z]+)/g)) keys.add(m[1] ?? m[2]);
    expect([...keys].filter((k) => !(k in SIGNS))).toEqual([]);
  });
});
