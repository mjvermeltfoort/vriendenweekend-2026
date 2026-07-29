import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { InstallBanner } from './InstallBanner';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('InstallBanner', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });
  });

  afterAll(() => {
    act(() => root.unmount());
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('shows an install button and opens the browser prompt', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    Object.defineProperties(installEvent, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: 'accepted', platform: 'web' }) }
    });

    act(() => root.render(<InstallBanner />));
    expect(container.querySelector('.install-banner')).toBeNull();

    act(() => window.dispatchEvent(installEvent));
    const button = container.querySelector<HTMLButtonElement>('.install-banner__button');
    expect(button?.textContent).toBe('Installeer');

    await act(async () => button?.click());
    expect(prompt).toHaveBeenCalledOnce();
    expect(container.querySelector('.install-banner')).toBeNull();
  });
});
