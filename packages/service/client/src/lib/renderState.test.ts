import { describe, expect, it } from 'vitest';

import {
  applyRenderState,
  computeRenderState,
  type RenderStateInput,
} from './renderState';

const base: RenderStateInput = {
  reqPath: 'j/docs/a.md',
  loading: false,
  error: null,
  hasDrives: false,
  hasDirectory: false,
  hasFileRaw: true,
  hasFileRendered: true,
  fileType: 'markdown',
  renderError: null,
  viewTab: 'rendered',
};

describe('computeRenderState (#295)', () => {
  it('is ready once rendered markdown has loaded', () => {
    expect(computeRenderState(base)).toBe('ready');
  });

  it('waits for rendered HTML before reporting markdown ready', () => {
    expect(computeRenderState({ ...base, hasFileRendered: false })).toBeNull();
  });

  it('is null while loading', () => {
    expect(computeRenderState({ ...base, loading: true })).toBeNull();
  });

  it('reports a load error even while still loading', () => {
    expect(
      computeRenderState({ ...base, loading: true, error: 'Unauthorized' }),
    ).toBe('auth-required');
  });

  it('waits for the drive list on the root path', () => {
    expect(
      computeRenderState({ ...base, reqPath: '', hasDrives: false }),
    ).toBeNull();
  });

  it('reports auth-required for a 401', () => {
    expect(computeRenderState({ ...base, error: 'Unauthorized' })).toBe(
      'auth-required',
    );
    expect(
      computeRenderState({
        ...base,
        hasFileRendered: false,
        renderError: 'Unauthorized',
      }),
    ).toBe('auth-required');
  });

  it('reports error for other load or render failures', () => {
    expect(computeRenderState({ ...base, error: 'API error 500: x' })).toBe(
      'error',
    );
    expect(
      computeRenderState({
        ...base,
        hasFileRendered: false,
        renderError: 'API error 500: x',
      }),
    ).toBe('error');
  });

  it('is ready for raw views, non-markdown files, directories and drives', () => {
    expect(
      computeRenderState({ ...base, viewTab: 'raw', hasFileRendered: false }),
    ).toBe('ready');
    expect(
      computeRenderState({
        ...base,
        fileType: 'text',
        hasFileRendered: false,
      }),
    ).toBe('ready');
    expect(
      computeRenderState({
        ...base,
        hasDirectory: true,
        hasFileRaw: false,
        hasFileRendered: false,
      }),
    ).toBe('ready');
    expect(
      computeRenderState({
        ...base,
        reqPath: '',
        hasDrives: true,
        hasFileRaw: false,
        hasFileRendered: false,
      }),
    ).toBe('ready');
  });
});

describe('applyRenderState', () => {
  it('sets and clears data-render-state on the root', () => {
    const root = document.createElement('html');
    applyRenderState('ready', root);
    expect(root.getAttribute('data-render-state')).toBe('ready');
    applyRenderState(null, root);
    expect(root.hasAttribute('data-render-state')).toBe(false);
  });
});
