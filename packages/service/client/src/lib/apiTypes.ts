/**
 * The response shapes the SPA works with, named for its components: aliases
 * of the SDK's catalog response types, plus the search facets manifest (the
 * catalog passes it through from jeeves-watcher undescribed). Types only.
 */

import type { ServerResponse } from '@karmaniverous/jeeves-server-sdk';

/** A configured root (`drives`). */
export type DriveEntry = ServerResponse<'drives'>[number];

/** A directory listing (`browse` of a directory). */
export type DirectoryListing = Extract<
  ServerResponse<'browse'>,
  { entries: unknown }
>;

/** One entry of a directory listing. */
export type DirectoryEntry = DirectoryListing['entries'][number];

/** One breadcrumb of a file or directory view. */
export type BreadcrumbItem = DirectoryListing['breadcrumbs'][number];

/** A file's content (`fileContent`, `publicContent`). */
export type FileContent = ServerResponse<'fileContent'>;

/** One file of the search results. */
export type SearchResult = ServerResponse<'search'>['results'][number];

/** One search facet of jeeves-watcher's facets manifest. */
export interface SearchFacet {
  field: string;
  type: string;
  uiHint: string;
  values: string[];
  rules: string[];
}

/** The facets manifest (`searchFacets`). */
export interface FacetsResponse {
  facets: SearchFacet[];
}
