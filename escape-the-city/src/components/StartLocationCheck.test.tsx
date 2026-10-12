import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/gameContext', () => ({
  useGame: () => ({ deviceLocation: null })
}));

import { StartLocationCheck } from './StartLocationCheck';

describe('StartLocationCheck', () => {
  let container: HTMLDivElement;
  let root: Root;
  const permissionDescriptor = Object.getOwnPropertyDescriptor(navigator, 'permissions');
  const geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
  const userAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent');

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('test automatisch met een bestaande toestemming en toont nauwkeurigheid', async () => {
    setupPermission('granted');
    const getCurrentPosition = setupGeolocation();
    await act(async () => root.render(<StartLocationCheck />));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('GPS gereed');
    expect(container.textContent).toContain('18 meter');
  });

  it('toont de juiste Android-uitleg als de browser toestemming heeft geweigerd', async () => {
    setupPermission('denied');
    const getCurrentPosition = setupGeolocation();
    await act(async () => root.render(<StartLocationCheck />));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(container.textContent).toContain('geblokkeerd');
    expect(container.textContent).toContain('Android · Chrome');
    expect(container.querySelectorAll('.start-location-check__guide li')).toHaveLength(4);
    expect(container.querySelector('a[href*="support.google.com"]')).not.toBeNull();
  });

  it('vraagt na een expliciete klik locatietoegang en controleert de positie', async () => {
    setupPermission('prompt');
    const getCurrentPosition = setupGeolocation(65);
    await act(async () => root.render(<StartLocationCheck />));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(container.textContent).toContain('toestemming');
    await act(async () => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Locatie toestaan'));
      button?.click();
    });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('onnauwkeurig');
    expect(container.textContent).toContain('40 m');
  });
});
