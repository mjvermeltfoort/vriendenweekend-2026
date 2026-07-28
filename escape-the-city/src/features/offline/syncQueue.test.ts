import { describe, expect, it } from 'vitest';
import { dedupeActions } from './syncQueue';

describe('syncQueue', () => {
  it('deduplicates actions by id', () => {
    expect(dedupeActions([{ id: '1', type: 'a', createdAt: '', payload: {} }, { id: '1', type: 'b', createdAt: '', payload: {} }])).toHaveLength(1);
  });
});
