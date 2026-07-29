import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DocumentContrast } from './App';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('DocumentContrast', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    act(() => root.unmount());
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  afterEach(() => {
    delete document.documentElement.dataset.contrast;
  });

  it('sets high contrast on the document when enabled', () => {
    act(() => root.render(<DocumentContrast enabled />));
    expect(document.documentElement.dataset.contrast).toBe('high');
  });

  it('removes high contrast when disabled', () => {
    act(() => root.render(<DocumentContrast enabled />));
    act(() => root.render(<DocumentContrast enabled={false} />));
    expect(document.documentElement.dataset.contrast).toBeUndefined();
  });
});
