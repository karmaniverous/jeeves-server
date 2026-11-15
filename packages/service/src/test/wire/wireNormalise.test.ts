import { describe, expect, it } from 'vitest';

import {
  normaliseBody,
  type NormaliseContext,
  normaliseText,
} from './wireNormalise.js';

const win: NormaliseContext = {
  dir: 'C:\\Temp\\wire-x',
  rootUrl: '/c/Temp/wire-x/content',
  serviceDir: 'D:\\repos\\server\\packages\\service',
  serviceUrl: '/d/repos/server/packages/service',
  platform: 'win32',
};

const linux: NormaliseContext = {
  dir: '/tmp/wire-x',
  rootUrl: '/wireroot',
  serviceDir: '/home/ci/server/packages/service',
  serviceUrl: '/home/ci/server/packages/service',
  platform: 'linux',
};

describe('normaliseText', () => {
  it('maps temp paths in every form, with any separators after them', () => {
    const json = JSON.stringify({
      a: 'C:\\Temp\\wire-x\\content\\sub dir\\x.md',
      b: 'C:/Temp/wire-x/content/sub dir\\x.md',
      c: `?p=${encodeURIComponent('C:\\Temp\\wire-x')}`,
    });
    expect(JSON.parse(normaliseText(json, win))).toEqual({
      a: '{dir}/content/sub dir/x.md',
      b: '{dir}/content/sub dir/x.md',
      c: '?p={dir}',
    });
  });

  it('gives the content root and the package one form on both platforms', () => {
    const text = (ctx: NormaliseContext) =>
      normaliseText(
        `/browse${ctx.rootUrl}/a.md ${encodeURIComponent(ctx.rootUrl)} /browse${ctx.serviceUrl}/README.md wireroot`,
        ctx,
      );
    expect(text(win)).toBe(text(linux));
    expect(text(linux)).toBe(
      '/browse/{root}/a.md %2F{root} /browse/{pkg}/README.md {root}',
    );
  });

  it('replaces keys, stacks, OTP blobs, OAuth state, timestamps, uptime, versions and UUIDs', () => {
    const key = 'ab'.repeat(16);
    const state = 'cd'.repeat(32);
    const text = [
      `?k=${key}&d=1&dirs=0&s=N4Ig+x$`,
      `%3Fk%3D${key}%26s%3DN4I%2Bx`,
      `?enc=abc.def&state=${state}&code_challenge=Ab_c-9`,
      `"state":"${state}"`,
      '"ts":"2026-11-14T08:44:00.123Z","uptime":12.5,"version":"3.15.0"',
      '0f8fad5b-d9cb-469f-a165-70867728950e',
      'a'.repeat(64),
    ].join(' ');
    expect(normaliseText(text, linux)).toBe(
      [
        '?k={key}&d=1&dirs=0&s={stack}',
        '%3Fk%3D{key}%26s%3D{stack}',
        '?enc={enc}&state={state}&code_challenge={challenge}',
        '"state":"{state}"',
        '"ts":"{ts}","uptime":0,"version":"{version}"',
        '{uuid}',
        'a'.repeat(64),
      ].join(' '),
    );
  });
});

describe('normaliseBody', () => {
  it('keeps JSON bytes when nothing structural changes', () => {
    const body = '{"a": 1}';
    expect(normaliseBody(body, linux)).toBe(body);
  });

  it('maps a Windows drive listing onto the Linux root listing', () => {
    const windows = JSON.stringify([
      { letter: 'c', label: 'C:' },
      { letter: 'd', label: 'D:' },
    ]);
    const posix = JSON.stringify([
      { letter: 'wireroot', label: '/tmp/wire-x/content' },
    ]);
    expect(normaliseBody(windows, win)).toBe(normaliseBody(posix, linux));
  });

  it('starts breadcrumbs at the content root on both platforms', () => {
    const windows = JSON.stringify({
      breadcrumbs: [
        { label: 'c', path: 'c' },
        { label: 'Temp', path: 'c/Temp' },
        { label: 'wire-x', path: 'c/Temp/wire-x' },
        { label: 'content', path: 'c/Temp/wire-x/content' },
        { label: 'a.md', path: 'c/Temp/wire-x/content/a.md' },
      ],
    });
    const posix = JSON.stringify({
      breadcrumbs: [
        { label: 'wireroot', path: 'wireroot' },
        { label: 'a.md', path: 'wireroot/a.md' },
      ],
    });
    expect(normaliseBody(windows, win)).toBe(normaliseBody(posix, linux));
    expect(JSON.parse(normaliseBody(posix, linux))).toEqual({
      breadcrumbs: [
        { label: '{root}', path: '{root}' },
        { label: 'a.md', path: '{root}/a.md' },
      ],
    });
  });

  it('redacts named top-level fields and leaves non-JSON alone', () => {
    expect(
      normaliseBody('{"content":"x","fileName":"a.md"}', linux, ['content']),
    ).toBe('{"content":"{redacted}","fileName":"a.md"}');
    expect(normaliseBody('<p>/tmp/wire-x</p>', linux, ['content'])).toBe(
      '<p>{dir}</p>',
    );
  });
});
