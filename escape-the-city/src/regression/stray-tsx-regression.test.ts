import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '..');
const distDir = path.resolve(srcDir, '..', 'dist');

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function stripForScan(code: string): string {
  return code
    // block comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // line comments
    .replace(/\/\/[^\n]*$/gm, '')
    // strings and template literals
    .replace(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`/g, '')
    // regex literals (best-effort)
    .replace(/\/(?!\/|\*)(?:\\.|[^\/\n])+\/[gimsuy]*/g, '');
}

const isSourceFile = (f: string) =>
  /\.(tsx?|jsx?)$/.test(f) &&
  f.includes(path.sep + 'src' + path.sep) &&
  !f.includes(path.sep + 'regression' + path.sep);

describe('Regressie: geen losse tsx-identifier in de codebasis', () => {
  it('bronbestanden bevatten geen "void tsx", "declare const tsx", of een los "tsx;"', () => {
    const files = walk(srcDir).filter(isSourceFile);
    const offenders: { file: string; hit: string }[] = [];
    const rxVoidTsx = /\bvoid\s+tsx\b/;
    const rxDeclareTsx = /\bdeclare\s+const\s+tsx\b/;
    const rxStrayTsxStmt = /(^|[^\w$])tsx\s*;/;

    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8');
      const code = stripForScan(raw);
      if (rxVoidTsx.test(code)) offenders.push({ file, hit: 'void tsx' });
      if (rxDeclareTsx.test(code)) offenders.push({ file, hit: 'declare const tsx' });
      if (rxStrayTsxStmt.test(code)) offenders.push({ file, hit: 'tsx;' });
    }

    const msg = offenders
      .map(o => `- ${path.relative(srcDir, o.file)} → ${o.hit}`)
      .join('\n');
    expect(offenders.length, `Gevonden stray tsx-fragmenten:\n${msg || '(geen)'}`).toBe(0);
  });

  const hasDist = fs.existsSync(distDir);
  (hasDist ? it : it.skip)('productiebundle(s) in dist bevatten geen "tsx;" token', () => {
    const distFiles = walk(distDir).filter(f => /\.js$/i.test(f));
    const offenders = distFiles
      .map(f => ({ f, hit: /(^|[^\w$])tsx\s*;/.test(fs.readFileSync(f, 'utf8')) }))
      .filter(x => x.hit)
      .map(x => path.relative(distDir, x.f));
    expect(offenders.length, `Gevonden "tsx;" in dist:\n${offenders.join('\n') || '(geen)'}`).toBe(0);
  });
});
