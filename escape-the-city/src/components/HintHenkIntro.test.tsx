import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HenkFlame } from './HintHenkIntro';

describe('Hint Henk flame', () => {
  it('reuses the flame character elements from the main game', () => {
    const html = renderToStaticMarkup(<HenkFlame />);

    expect(html).toContain('class="asst-character"');
    expect(html).toContain('class="asst-body"');
    expect(html).toContain('class="asst-eye asst-eye-l"');
    expect(html).toContain('class="asst-eye asst-eye-r"');
    expect(html).toContain('class="asst-mouth"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Hint Henk, het oranje vlammetje uit het hoofdspel"');
    expect(html).not.toContain('hint-henk__mascot--speaking');
  });

  it('adds the talking animation only when the narration is playing', () => {
    const html = renderToStaticMarkup(<HenkFlame speaking />);

    expect(html).toContain('hint-henk__mascot--speaking');
    expect(html).toContain('class="asst-mouth"');
  });
});
