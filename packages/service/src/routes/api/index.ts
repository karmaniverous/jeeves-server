/**
 * Every catalog handler, composed from the route modules: one per `SERVER_CATALOG` entry (the type checks there are no more and no fewer).
 *
 * @packageDocumentation
 */

import type { ServerHandlers } from '../../api/handlerTypes.js';
import { eventHandlers } from '../event.js';
import { keysHandlers } from '../keys.js';
import { standardServerHandlers } from '../standard.js';
import { healthHandlers } from '../status.js';
import { authStatusHandlers } from './auth-status.js';
import { diagramExportHandlers } from './diagramExport.js';
import { diagramsHandlers } from './diagrams.js';
import { directoryHandlers } from './directory.js';
import { drivesHandlers } from './drives.js';
import { eventsHandlers } from './events.js';
import { exportHandlers } from './export.js';
import { fileContentHandlers } from './fileContent.js';
import { fileMutationHandlers } from './fileMutations.js';
import { fileWriteHandlers } from './fileWrite.js';
import { linkInfoHandlers } from './linkInfo.js';
import { magicLinkHandlers } from './magicLink.js';
import { oauthApiHandlers } from './oauth.js';
import { publicContentHandlers } from './publicContent.js';
import { rawHandlers } from './raw.js';
import { resolvePathHandlers } from './resolvePath.js';
import { runnerHandlers } from './runner.js';
import { createSearchHandlers } from './search.js';
import { shareForHandlers } from './shareFor.js';
import { sharingHandlers } from './sharing.js';

/**
 * The server's catalog handlers.
 *
 * @returns One handler per catalog entry (stateful ones, such as the search
 *   facets cache, fresh per call).
 */
export function createServerHandlers(): ServerHandlers {
  return {
    ...standardServerHandlers(),
    ...healthHandlers,
    ...keysHandlers,
    ...eventHandlers,
    ...authStatusHandlers,
    ...diagramExportHandlers,
    ...diagramsHandlers,
    ...directoryHandlers,
    ...drivesHandlers,
    ...eventsHandlers,
    ...exportHandlers,
    ...fileContentHandlers,
    ...fileMutationHandlers,
    ...fileWriteHandlers,
    ...linkInfoHandlers,
    ...magicLinkHandlers,
    ...oauthApiHandlers,
    ...publicContentHandlers,
    ...rawHandlers,
    ...resolvePathHandlers,
    ...runnerHandlers,
    ...createSearchHandlers(),
    ...shareForHandlers,
    ...sharingHandlers,
  };
}
