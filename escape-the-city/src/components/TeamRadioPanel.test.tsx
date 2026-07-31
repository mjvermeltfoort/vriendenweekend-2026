import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendRadioMessage = vi.fn().mockResolvedValue(undefined);
const mockUseGame = vi.fn();
const mockNarration = { source: null as string | null, playing: false, currentTime: 0, duration: 0, error: '' };

vi.mock('../app/gameContext', () => ({
  useGame: () => mockUseGame()
}));

vi.mock('../features/audio/audioContext', () => ({
  useAudio: () => ({
    narration: mockNarration,
    toggleNarration: vi.fn(),
    seekNarration: vi.fn()
  })
}));

import { TeamRadioPanel } from './TeamRadioPanel';

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

describe('TeamRadioPanel', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const stopTrack = vi.fn();

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container.innerHTML = '';
    vi.clearAllMocks();
    Object.assign(mockNarration, { source: null, playing: false, currentTime: 0, duration: 0, error: '' });
    mockSendRadioMessage.mockResolvedValue(undefined);
    mockUseGame.mockReturnValue({
      activeTeam: { id: 'team-1' },
      sendRadioMessage: mockSendRadioMessage,
      teamRadioMessages: [{
        id: 'message-1',
        audioUrl: 'https://example.test/radio.webm',
        senderAlias: 'Pionier TEST',
        createdAt: '2026-07-31T12:00:00.000Z',
        isMine: false,
        durationMs: 4_200,
        transcript: 'Deze tekst mag niet zichtbaar zijn.'
      }]
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) }
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: TestMediaRecorder
    });
  });

  afterEach(() => {
    act(() => root.render(null));
    container.innerHTML = '';
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('starts and stops recording with separate clicks without showing names or transcripts', async () => {
    act(() => root.render(<TeamRadioPanel />));

    expect(container.textContent).toContain('Wacht even tot de timer loopt voordat je spreekt');
    expect(container.textContent).toContain('Spraakbericht');
    expect(container.textContent).toContain('0:00 / 0:04');
    expect(container.textContent).not.toContain('Pionier TEST');
    expect(container.textContent).not.toContain('Tekstversie');
    expect(container.textContent).not.toContain('Deze tekst mag niet zichtbaar zijn.');

    const button = container.querySelector<HTMLButtonElement>('button.button');
    await act(async () => button?.click());
    expect(button?.textContent).toContain('Klik om te stoppen');

    await act(async () => button?.click());
    expect(mockSendRadioMessage).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it('uses the recorded duration when the browser reports an invalid duration', () => {
    Object.assign(mockNarration, {
      source: 'https://example.test/radio.webm',
      playing: true,
      currentTime: 2.8,
      duration: Number.POSITIVE_INFINITY
    });

    act(() => root.render(<TeamRadioPanel />));

    expect(container.textContent).toContain('0:02 / 0:04');
  });
});
