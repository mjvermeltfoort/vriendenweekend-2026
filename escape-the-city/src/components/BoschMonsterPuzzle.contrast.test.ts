import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The puzzle appears inside a light parchment-card, but its controls have
// dark backgrounds. Always check the foreground and background together:
// dark parchment text was previously unreadable on dark-green controls.
const css = readFileSync(resolve(process.cwd(), 'src/components/BoschMonsterPuzzle.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].map((match) => ({
  selectors: match[1].split(',').map((selector) => selector.trim()),
  declarations: match[2]
}));

function colorPair(selector: string) {
  const rule = rules.find((entry) => entry.selectors.includes(selector));
  expect(rule, `Missing explicit colors for ${selector}`).toBeDefined();
  const foreground = rule!.declarations.match(/(?:^|;)\s*color:\s*(#[\da-f]{6})/i)?.[1];
  const background = rule!.declarations.match(/(?:^|;)\s*background:\s*(#[\da-f]{6})/i)?.[1];
  expect(foreground, `Missing explicit text color for ${selector}`).toBeDefined();
  expect(background, `Missing explicit background color for ${selector}`).toBeDefined();
  return [foreground!, background!] as const;
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

describe('Bosch sketchbook contrast on parchment', () => {
  it.each([
    ['standbeeldobservatie: antwoordrij', '.parchment-card .bosch-puzzle__radio'],
    ['standbeeldobservatie: jaartal', '.parchment-card .bosch-puzzle__year span'],
    ['geselecteerd antwoord', '.parchment-card .bosch-puzzle__radio:has(input:checked)'],
    ['geselecteerd jaartal', '.parchment-card .bosch-puzzle__year input:checked + span'],
    ['geopend schetsboek', '.parchment-card .bosch-puzzle__unlocked'],
    ['uitgeschakelde open-knop', '.parchment-card .bosch-puzzle > .button.primary:disabled'],
    ['actieve open-knop', '.parchment-card .bosch-puzzle > .button.primary:not(:disabled)']
  ])('%s has at least 4.5:1 contrast', (_name, selector) => {
    const [text, surface] = colorPair(selector);
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the standbeeld controls readable on parchment', () => {
    expect(css).toContain('.parchment-card .bosch-puzzle__radio span,');
    expect(css).toContain('.parchment-card .bosch-puzzle__year span {');
    expect(css).toContain('.parchment-card .bosch-puzzle__year input:focus-visible + span');
    expect(css).toContain('.bosch-puzzle__zone:focus-visible');
    expect(css).toContain('touch-action: pan-y');
    expect(css).not.toContain('.bosch-puzzle__selector');
  });
});
