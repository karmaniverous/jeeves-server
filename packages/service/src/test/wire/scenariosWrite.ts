/**
 * Wire scenarios for file writes (`PUT /api/file/*`) and block mutations (`POST /api/file/*`): every action, its validation errors and the credentials that may and may not write. Pure data.
 *
 * @packageDocumentation
 */

import { D, P } from './scenariosContent.js';
import { CRED, post, put, shareCred, type WireScenario } from './wireTypes.js';

/** `PUT /api/file/*`. */
const WRITE: WireScenario[] = [
  put(
    'fileWrite',
    `/api/file/${P.doc}`,
    { content: '# New\n' },
    {
      cred: CRED.session,
    },
  ),
  put(
    'fileWrite percent name',
    `/api/file/${P.percent}`,
    { content: 'x' },
    {
      cred: CRED.session,
    },
  ),
  put(
    'fileWrite machine key',
    `/api/file/${P.doc}`,
    { content: 'x' },
    {
      cred: CRED.machine,
    },
  ),
  put('fileWrite none', `/api/file/${P.doc}`, { content: 'x' }),
  put(
    'fileWrite path share',
    `/api/file/${P.doc}`,
    { content: 'x' },
    {
      cred: shareCred('path', D.doc),
    },
  ),
  put(
    'fileWrite scoped session out of scope',
    `/api/file/${P.doc}`,
    {
      content: 'x',
    },
    { cred: CRED.scopedSession },
  ),
  put(
    'fileWrite scoped session in scope',
    `/api/file/${P.shared}`,
    {
      content: 'x',
    },
    { cred: CRED.scopedSession },
  ),
  put(
    'fileWrite no content',
    `/api/file/${P.doc}`,
    {},
    {
      cred: CRED.session,
    },
  ),
  put(
    'fileWrite non-string content',
    `/api/file/${P.doc}`,
    { content: 1 },
    {
      cred: CRED.session,
    },
  ),
  put(
    'fileWrite directory',
    `/api/file/${P.subDir}`,
    { content: 'x' },
    {
      cred: CRED.session,
    },
  ),
  put(
    'fileWrite missing',
    `/api/file/${P.missing}`,
    { content: 'x' },
    {
      cred: CRED.session,
    },
  ),
  put(
    'fileWrite no root',
    `/api/file/${P.noRoot}`,
    { content: 'x' },
    {
      cred: CRED.session,
    },
  ),
];

/**
 * A mutation of `doc.md` as the admin session.
 *
 * @param name - Name suffix.
 * @param body - Mutation body.
 * @param path - Target (default `doc.md`).
 * @returns The scenario.
 */
const mutate = (name: string, body: unknown, path: string = P.doc) =>
  post(`fileMutate ${name}`, `/api/file/${path}`, body, { cred: CRED.session });

/** `POST /api/file/*` block mutations. */
const MUTATE: WireScenario[] = [
  mutate('toggle-checkbox', {
    action: 'toggle-checkbox',
    index: 0,
    checked: true,
  }),
  mutate('toggle-checkbox out of range', {
    action: 'toggle-checkbox',
    index: 9,
    checked: true,
  }),
  mutate('toggle-checkbox bad body', { action: 'toggle-checkbox' }),
  mutate('edit-block', {
    action: 'edit-block',
    startLine: 8,
    endLine: 8,
    content: '# Edited',
  }),
  mutate('edit-block reversed', {
    action: 'edit-block',
    startLine: 9,
    endLine: 8,
    content: 'x',
  }),
  mutate('edit-block out of bounds', {
    action: 'edit-block',
    startLine: 1,
    endLine: 99,
    content: 'x',
  }),
  mutate('edit-block empty content', {
    action: 'edit-block',
    startLine: 8,
    endLine: 8,
    content: '',
  }),
  mutate('edit-block missing fields', { action: 'edit-block' }),
  mutate('delete-block', { action: 'delete-block', startLine: 8, endLine: 8 }),
  mutate('delete-block missing fields', { action: 'delete-block' }),
  mutate('insert-block', {
    action: 'insert-block',
    atLine: 8,
    position: 'after',
    content: 'Inserted.',
  }),
  mutate('insert-block bad position', {
    action: 'insert-block',
    atLine: 8,
    position: 'sideways',
    content: 'x',
  }),
  mutate('insert-block out of bounds', {
    action: 'insert-block',
    atLine: 99,
    position: 'after',
    content: 'x',
  }),
  mutate('edit-cell', { action: 'edit-cell', line: 17, col: 1, content: '3' }),
  mutate('edit-cell separator', {
    action: 'edit-cell',
    line: 16,
    col: 0,
    content: 'x',
  }),
  mutate('edit-cell bad column', {
    action: 'edit-cell',
    line: 17,
    col: 9,
    content: 'x',
  }),
  mutate('edit-cell missing fields', { action: 'edit-cell' }),
  mutate('no action', {}),
  mutate('unknown action', { action: 'explode' }),
  mutate('array body', [1, 2]),
  mutate(
    'not markdown',
    { action: 'delete-block', startLine: 1, endLine: 1 },
    P.json,
  ),
  mutate(
    'missing',
    { action: 'delete-block', startLine: 1, endLine: 1 },
    P.missing,
  ),
  post('fileMutate none', `/api/file/${P.doc}`, {
    action: 'delete-block',
    startLine: 8,
    endLine: 8,
  }),
  post(
    'fileMutate path share',
    `/api/file/${P.doc}`,
    {
      action: 'delete-block',
      startLine: 8,
      endLine: 8,
    },
    { cred: shareCred('path', D.doc) },
  ),
  post(
    'fileMutate scoped session out of scope',
    `/api/file/${P.doc}`,
    {
      action: 'delete-block',
      startLine: 8,
      endLine: 8,
    },
    { cred: CRED.scopedSession },
  ),
];

/** File write and mutation scenarios. */
export const SCENARIOS_WRITE: WireScenario[] = [...WRITE, ...MUTATE];
