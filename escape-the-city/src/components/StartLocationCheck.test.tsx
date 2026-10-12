import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/gameContext', () => ({
  useGame: () => ({ deviceLocation: null })
}));

import { StartLocationCheck } from './StartLocationCheck';

const VISITED_KEY = 'moerasdraak-gps-dialog-visited-v1';

describe('StartLocationCheck modal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const permissionDescriptor = Object.getOwnPropertyDescriptor(navigator, 'permissions');
  const geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
  const userAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent');

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    sessionStorage.removeItem(VISITED_KEY);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 15) Chrome/139.0 Mobile Safari/537.36'
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    sessionStorage.removeItem(VISITED_KEY);
    for (const [key, descriptor] of [
      ['permissions', permissionDescriptor],
      ['geolocation', geolocationDescriptor],
      ['userAgent', userAgentDescriptor]
    ] as const) {
      if (descriptor) Object.defineProperty(navigator, key, descriptor);
      else Reflect.deleteProperty(navigator, key);
    }
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  function dialog(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('.start-location-check[role="dialog"]');
  }

  function setupPermission(state: PermissionState) {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state }) }
    });
  }

  function setupGeolocation(accuracy = 18) {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 51.69, longitude: 5.3, accuracy },
        timestamp: Date.now()
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition }
    });
    return getCurrentPosition;
  }

  it('toont automatisch de overlay en controleert GPS met reeds verleende toestemming', async () => {
    setupPermission('granted');
    const getCurrentPosition = setupGeolocation();
    await act(async () => root.render(<StartLocationCheck />));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(dialog()?.textContent).toContain('GPS gereed');
    expect(dialog()?.textContent).toContain('18 meter');
    expect(container.querySelector('.start-location-check__guide')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('GPS-controle sluiten');
  });

  it('geeft Android-hulp in een scrollbare overlay als locatie is geweigerd', async () => {
    setupPermission('denied');
    setupGeolocation();
    await act(async () => root.render(<StartLocationCheck />));
    expect(dialog()?.textContent).toContain('geblokkeerd');
    expect(dialog()?.textContent).toContain('Android · Chrome');
    expect(dialog()?.querySelectorAll('.start-location-check__guide li')).toHaveLength(4);
    expect(dialog()?.querySelector('a[href*="support.google.com"]')).not.toBeNull();
    expect(container.querySelector('.start-location-check__guide')).toBeNull();
  });

  it('vraagt na expliciete klik om locatie en toont onnauwkeurige GPS', async () => {
    setupPermission('prompt');
    const getCurrentPosition = setupGeolocation(65);
    await act(async () => root.render(<StartLocationCheck />));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain('toestemming');
    await act(async () => {
      const button = [...(dialog()?.querySelectorAll('button') ?? [])].find((item) => item.textContent?.includes('Locatie toestaan'));
      button?.click();
    });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(dialog()?.textContent).toContain('onnauwkeurig');
    expect(dialog()?.textContent).toContain('40 m');
  });

  it('wacht met het automatisch openen tot Hint Henk gesloten is', async () => {
    setupPermission('prompt');
    setupGeolocation();
    await act(async () => root.render(<StartLocationCheck blockedByIntro />));
    expect(dialog()).toBeNull();
    await act(async () => root.render(<StartLocationCheck blockedByIntro={false} />));
    expect(dialog()).not.toBeNull();
  });

  it('laat een speler de overlay sluiten en later handmatig opnieuw openen', async () => {
    setupPermission('denied');
    setupGeolocation();
    await act(async () => root.render(<StartLocationCheck />));
    await act(async () => {
      dialog()?.querySelector<HTMLButtonElement>('.start-location-check__close')?.click();
    });
    expect(dialog()).toBeNull();
    expect(sessionStorage.getItem(VISITED_KEY)).toBe('1');
    const trigger = container.querySelector<HTMLButtonElement>('.start-location-check__trigger');
    expect(document.activeElement).toBe(trigger);
    await act(async () => trigger?.click());
    expect(dialog()).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(dialog()).toBeNull();
  });

  it('opent niet opnieuw automatisch bij terugkomst in dezelfde browsersessie', async () => {
    setupPermission('granted');
    setupGeolocation();
    sessionStorage.setItem(VISITED_KEY, '1');
    await act(async () => root.render(<StartLocationCheck />));
    expect(dialog()).toBeNull();
    expect(container.querySelector('.start-location-check__trigger')).not.toBeNull();
  });
});
