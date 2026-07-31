import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  subscribe: vi.fn()
}));

vi.mock('./api', () => ({
  getDashboardTeamRadioMessages: mocks.getMessages,
  sendDashboardTeamRadioMessage: mocks.sendMessage,
  subscribeToDashboardRadio: mocks.subscribe
}));

import { DashboardRadioPanel } from './DashboardRadioPanel';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

class TestMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  state: RecordingState = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;

  constructor(_stream: MediaStream, _options: MediaRecorderOptions) {}

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['radio'], { type: 'audio/webm' }) } as BlobEvent);
    this.onstop?.(new Event('stop'));
  }
}

describe('DashboardRadioPanel', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.getMessages.mockResolvedValue([{
      id: 'message-1', teamId: 'team-1', sessionId: null, senderAlias: 'Meldkamer', senderKind: 'dashboard',
      storagePath: 'team-1/dashboard/message.webm', mimeType: 'audio/webm', durationMs: 2_000,
      transcript: null, createdAt: '2026-08-01T12:00:00.000Z', expiresAt: null, audioUrl: 'https://example.test/message.webm'
    }]);
    mocks.sendMessage.mockResolvedValue(undefined);
    mocks.subscribe.mockReturnValue(vi.fn());
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) }
    });
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: TestMediaRecorder });
  });

  afterEach(() => {
    act(() => root.render(null));
    container.innerHTML = '';
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('lists recordings and sends a new recording to the selected team', async () => {
    await act(async () => root.render(<DashboardRadioPanel teamId="team-1" teamName="Drakenteam" />));

    expect(container.textContent).toContain('Meldkamer');
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('https://example.test/message.webm');

    const button = container.querySelector<HTMLButtonElement>('button');
    await act(async () => button?.click());
    expect(button?.textContent).toContain('Klik om te stoppen');
    await act(async () => button?.click());

    expect(mocks.sendMessage).toHaveBeenCalledWith('team-1', expect.any(Blob), expect.any(Number));
  });
});
