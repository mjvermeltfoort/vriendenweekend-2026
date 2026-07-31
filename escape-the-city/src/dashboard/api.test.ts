import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn()
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return {
    rpc: vi.fn(),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://example.test/${path}` } })),
    upload: vi.fn(),
    removeChannel: vi.fn().mockResolvedValue(undefined),
    channelFactory: vi.fn(() => channel),
    channel
  };
});

vi.mock('../lib/supabase/client', () => ({
  ensureAnonymousSession: vi.fn().mockResolvedValue({ user: { id: 'anonymous' } }),
  supabase: {
    rpc: mocks.rpc,
    storage: { from: vi.fn(() => ({ getPublicUrl: mocks.getPublicUrl, upload: mocks.upload })) },
    channel: mocks.channelFactory,
    removeChannel: mocks.removeChannel
  }
}));

import { DashboardApiError, dashboardActions, getDashboardTeamRadioMessages, subscribeToDashboard, subscribeToDashboardRadioNotifications } from './api';

describe('dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.channel.on.mockReturnValue(mocks.channel);
    mocks.channel.subscribe.mockReturnValue(mocks.channel);
  });

  it('maps RPC failures to a dashboard error', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'TEAM_NOT_FOUND', code: 'P0001' } });
    await expect(dashboardActions.renameTeam('missing', 'Naam')).rejects.toEqual(
      expect.objectContaining<Partial<DashboardApiError>>({ message: 'TEAM_NOT_FOUND', code: 'P0001' })
    );
  });

  it('sends a mandatory dashboard release reason with the stable client id', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Team Draak',
        code: 'ABC234',
        status: 'active',
        stopProgress: [],
        participants: []
      },
      error: null
    });
    await dashboardActions.releaseCurrentStop('team-1', 'GPS en detail onbruikbaar');
    expect(mocks.rpc).toHaveBeenCalledWith('dashboard_release_current_stop', expect.objectContaining({
      p_team_id: 'team-1',
      p_reason: 'GPS en detail onbruikbaar',
      p_client_id: expect.any(String)
    }));
  });

  it('opens one channel, reports reconnect state and cleans it up once', () => {
    const onStatus = vi.fn();
    const cleanup = subscribeToDashboard(vi.fn(), onStatus);
    expect(mocks.channelFactory).toHaveBeenCalledOnce();
    const statusCallback = mocks.channel.subscribe.mock.calls[0][0] as (status: string) => void;
    statusCallback('CHANNEL_ERROR');
    statusCallback('SUBSCRIBED');
    expect(onStatus.mock.calls).toEqual([['disconnected'], ['connected']]);
    cleanup();
    cleanup();
    expect(mocks.removeChannel).toHaveBeenCalledOnce();
  });

  it('loads team radio messages with public audio URLs', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        messages: [{
          id: 'message-1', teamId: 'team-1', sessionId: null, senderAlias: 'Meldkamer',
          senderKind: 'dashboard', storagePath: 'team-1/dashboard/message.webm', mimeType: 'audio/webm',
          durationMs: 1_000, transcript: null, createdAt: '2026-08-01T12:00:00.000Z', expiresAt: null
        }]
      },
      error: null
    });

    const messages = await getDashboardTeamRadioMessages('team-1');

    expect(mocks.rpc).toHaveBeenCalledWith('dashboard_get_team_radio_messages', {
      p_team_id: 'team-1', p_limit: 50
    });
    expect(messages[0].audioUrl).toBe('https://example.test/team-1/dashboard/message.webm');
  });

  it('notifies the dashboard from the public team-radio notification projection', () => {
    const onMessage = vi.fn();
    subscribeToDashboardRadioNotifications(onMessage);
    const callback = mocks.channel.on.mock.calls[0][2] as (event: { new: unknown }) => void;

    callback({ new: { team_id: 'team-1' } });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ teamId: 'team-1' });
  });
});
