import { describe, expect, it } from 'vitest';
import { createSimulatorProvider } from './simulator';

describe('location provider', () => {
  it('simulates permission denied', async () => {
    const provider = createSimulatorProvider(() => ({ latitude: 0, longitude: 0, accuracy: 10, mode: 'denied' }));
    const result = await provider.getCurrentPosition();
    expect('kind' in result && result.kind).toBe('permission-denied');
  });
});
