import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BottomGameNavigation } from './GameUi';

vi.mock('../app/gameContext', () => ({ useGame: () => ({ progress: { currentStopId: 'drakenfontein' } }) }));

describe('bottom route navigation', () => {
  beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => {
    act(() => root.unmount());
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  const container = document.createElement('div');
  const root = createRoot(container);
  afterEach(() => act(() => root.render(null)));

  it('has adjacent Route and Lijst tabs and marks only the selected view as current', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/route']}><BottomGameNavigation /></MemoryRouter>));
    const links = container.querySelectorAll<HTMLAnchorElement>('a');
    expect([...links].map((link) => link.textContent)).toEqual(['Route', 'Lijst', 'Team', 'Spel', 'Info']);
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Route');
    expect(links[1].getAttribute('href')).toBe('/route?weergave=lijst');
    await act(async () => links[1].click());
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Lijst');
    await act(async () => links[0].click());
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Route');
  });

  it('supports opening the list directly', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/route?weergave=lijst']}><BottomGameNavigation /></MemoryRouter>));
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Lijst');
  });
});
