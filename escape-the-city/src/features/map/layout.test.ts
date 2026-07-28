import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('route map responsive layout', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

  it('keeps the map bounded, safe-area aware and usable at 320px', () => {
    expect(css).toContain('height: clamp(360px, 55dvh, 620px)');
    expect(css).toContain('min-width: 320px');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (max-width: 350px)');
  });

  it('keeps touch targets and keyboard focus visible', () => {
    expect(css).toContain('.map-stop-marker:focus-visible');
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
  });
});
