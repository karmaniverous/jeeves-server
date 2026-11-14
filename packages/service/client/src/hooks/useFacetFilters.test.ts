import { describe, expect, it } from 'vitest';

import type { SearchFacet } from '@/lib/apiTypes';
import { renderHook, settle } from '@/test/reactHarness';

import { type FacetFilters, useFacetFilters } from './useFacetFilters';

const facet = (field: string, uiHint: string): SearchFacet => ({
  field,
  type: 'string',
  uiHint,
  values: [],
  rules: [],
});

const render = () => renderHook(() => useFacetFilters(), undefined);

const current = (hook: { result: { current: FacetFilters | undefined } }) => {
  const value = hook.result.current;
  if (!value) throw new Error('hook not rendered');
  return value;
};

describe('useFacetFilters', () => {
  it('toggles values and types text into a filter, changing it only on change', async () => {
    const hook = await render();
    expect(current(hook).filter).toBeUndefined();

    await settle(() => {
      current(hook).toggleValue('kind', 'doc');
    });
    await settle(() => {
      current(hook).toggleValue('kind', 'note');
    });
    await settle(() => {
      current(hook).setText('title', ' plan ');
    });
    const filter = current(hook).filter;
    expect(filter).toEqual({
      must: [
        { key: 'kind', match: { any: ['doc', 'note'] } },
        { key: 'title', match: { text: 'plan' } },
      ],
    });

    // Activating a field alone leaves the filter object as it was.
    await settle(() => {
      current(hook).addField('kind');
    });
    expect(current(hook).filter).toBe(filter);
    expect(current(hook).activeFields).toEqual(new Set(['kind']));

    // Toggling a selected value off removes it.
    await settle(() => {
      current(hook).toggleValue('kind', 'doc');
    });
    expect(current(hook).selections.kind).toEqual(new Set(['note']));
    await hook.unmount();
  });

  it('removes a field with its selection and text', async () => {
    const hook = await render();
    await settle(() => {
      const f = current(hook);
      f.addField('kind');
      f.addField('title');
      f.toggleValue('kind', 'doc');
      f.setText('kind', 'x');
      f.setText('title', 'plan');
    });
    await settle(() => {
      current(hook).removeField('kind');
    });
    const f = current(hook);
    expect(f.activeFields).toEqual(new Set(['title']));
    expect(f.selections).toEqual({});
    expect(f.textInputs).toEqual({ title: 'plan' });
    await hook.unmount();
  });

  it('applies a value by facet kind: text for free text, else a selection', async () => {
    const hook = await render();
    await settle(() => {
      const f = current(hook);
      f.applyValue(facet('title', 'text'), 'title', 'Plan');
      f.applyValue(facet('kind', 'select'), 'kind', 'doc');
      f.applyValue(undefined, 'tag', 'x');
      f.applyValue(undefined, 'tag', 'x');
    });
    const f = current(hook);
    expect(f.activeFields).toEqual(new Set(['title', 'kind', 'tag']));
    expect(f.textInputs).toEqual({ title: 'Plan' });
    expect(f.selections).toEqual({
      kind: new Set(['doc']),
      tag: new Set(['x']),
    });

    await settle(() => {
      current(hook).reset();
    });
    expect(current(hook).activeFields.size).toBe(0);
    expect(current(hook).filter).toBeUndefined();
    await hook.unmount();
  });
});
