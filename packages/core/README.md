# @karmaniverous/jeeves-server-core

Shared workspace package consumed by `@karmaniverous/jeeves-server` (service) and `@karmaniverous/jeeves-server-openclaw` (plugin): the endpoint catalog with its schemas and error codes, the OpenAPI document, the config schema and the key utilities.

## Entry points

| Import | Contents |
| --- | --- |
| `@karmaniverous/jeeves-server-core` | Everything below, including the Node-only key functions |
| `@karmaniverous/jeeves-server-core/catalog` | Browser-safe: `SERVER_CATALOG`, its schemas and types, `shareQuerySchema` and the error codes. Imports only `zod` and `@karmaniverous/jeeves/catalog` (a test walks its import graph), so the SDK and the web client can bundle it |
| `@karmaniverous/jeeves-server-core/openapi.json` | The OpenAPI 3.1 document generated from the catalog |

## Exports

### Endpoint Catalog

`SERVER_CATALOG` is built with `defineCatalog` from `@karmaniverous/jeeves/catalog`: jeeves' standard `status`, `config` and `configApply` entries, then one entry per machine-API route (39 in all), grouped in `src/catalog/*Entries.ts`. Each entry names its method, path, description, request schemas (`params`, `query`, `body`), response schema, `auth` and `kind`; binary entries (`raw`, `export`, `exportMermaid`, `exportPlantUml`, `diagram`) declare a `contentType`. The entry name is the SDK method, the OpenAPI `operationId` and the plugin tool's base name (`server_` + snake_case: `browse` is `server_browse`, `linkInfo` is `server_link_info`). Browser routes (the SPA, sign-in, `/oauth/callback`, `/go/:slug`) are not in the catalog.

| Export | Description |
| --- | --- |
| `SERVER_CATALOG` | The catalog |
| `ServerEntryName`, `ServerEntry<N>`, `ServerInput<N>`, `ServerResponse<N>` | Entry names, an entry, its request input and its success response |
| `ServerHealth` / `serverHealthSchema` | The `health` block of `GET /status` (`cmd` and `chrome.path` optional: callers that aren't admin don't get them) |
| `shareQuerySchema` | The share-link parameters (`exp`, `d`, `dirs`, `s`, legacy `key`), in the query of every content and navigation entry |
| `*Schema` | Every request and response schema, e.g. `fileContentResponseSchema`, `fileMutateBodySchema`, `shareResponseSchema` |

`auth` is descriptive; the service enforces access itself. Content and navigation entries list the `k` query parameter and the `jeeves_session` cookie; insider and admin entries add `insiderOnly`; public entries are `'none'`; `pathKey` and `insiderKey` take the raw machine seed in `X-API-Key`; `receiveEvent` takes an event key as `k`.

### Error Codes

| Export | Description |
| --- | --- |
| `SERVER_ERROR_CODES` | Every `SERVER_*` code an error body (`{ statusCode, code?, error, message }`) can carry |
| `SERVER_ERROR_STATUS` | The HTTP status each code is sent with |

### OpenAPI Document

`openapi.json` is generated from `SERVER_CATALOG` with `buildOpenApiDocument` from `@karmaniverous/jeeves/openapi` and committed. After changing the catalog, run `npm run openapi` in `packages/core`: a test fails while the committed document differs (and checks it is valid OpenAPI 3.1). The document is also exported as `SERVER_OPENAPI_DOCUMENT`.

### Crypto Functions

| Function | Description |
| --- | --- |
| `computePathKey(seed, path)` | HMAC-SHA256 outsider key for a normalized path (32 hex chars) |
| `computeInsiderKey(seed)` | HMAC-SHA256 insider key derived from a seed (32 hex chars) |
| `computeOutsiderKeyWithExpiry(seed, path, expiry)` | HMAC-SHA256 outsider key with embedded expiration |
| `computeDeepShareKey(seed, path, params)` | HMAC-SHA256 key for deep directory shares with depth/dirs/stack/expiry |
| `timingSafeEqual(a, b)` | Constant-time string comparison to prevent timing attacks |

`computePathKey`, `computeInsiderKey` and `computeOutsiderKeyWithExpiry` are re-exported from `@karmaniverous/jeeves`, which holds the one implementation; known-vector tests (`src/crypto.test.ts`) pin their output to what this package computed before. `computeDeepShareKey` and `timingSafeEqual` are this package's own.

### URL Key Parameter

| Export | Description |
| --- | --- |
| `URL_KEY_PARAM` | `'k'`: the query parameter every generated URL carries its auth key in |
| `LEGACY_URL_KEY_PARAM` | `'key'`: the old name, still accepted everywhere |
| `getUrlKey(query)` | Read the auth key from a parsed query object or `URLSearchParams`: `k` wins when both names are present; empty values count as absent; the first of repeated values is used |

### Config Schema

| Export | Description |
| --- | --- |
| `loggingConfigSchema` | Zod schema for `logging` config block (`level`, `file`, both optional) |
| `LoggingConfig` | Inferred TypeScript type from `loggingConfigSchema` |
| `jeevesConfigSchema` | Full server config Zod schema (includes `logging`, `oauth`, `publicUrl`, `trustProxyHeaders` and all other fields; requires `publicUrl` or `trustProxyHeaders: true` when email, Google or OAuth login is configured) |

### API Types

| Type | Description |
| --- | --- |
| `ShareRequest` / `ShareResponse` | `POST /api/share` payloads (`ShareResponse.isDirectory`, optional: whether the shared path is an existing directory; sent by servers from 3.15.0) |
| `ShareForRequest` / `ShareForResponse` | `POST /api/util/share-for` payloads (audience-based sharing) |
| `AuthStatusResponse` | `GET /api/auth/status` response |
| `RotateKeyResponse` | `POST /api/rotate-key` response |
| `OAuthStartRequest` / `OAuthStartResponse` | `POST /api/oauth/start` payloads |
| `ExportCacheClearResponse` | `DELETE /api/export-cache` response |
| `FileMutationAction` | Union type for structured file mutation actions |
| `LinkInfoResponse` | `GET /api/link-info` response |
| `ExportLink` | Export link descriptor |
| `DriveEntry` | Drive/root listing entry |
| `DeepShareParams` | Parameters for deep share key derivation |

## Usage

```typescript
import {
  computeInsiderKey,
  computePathKey,
  type LoggingConfig,
  type ShareRequest,
} from '@karmaniverous/jeeves-server-core';

// Browser bundles: the catalog only.
import {
  SERVER_CATALOG,
  type ServerResponse,
} from '@karmaniverous/jeeves-server-core/catalog';
```

## How Packages Consume It

- **Service** (`packages/service`) — re-exports crypto functions from `src/util/crypto.ts` and uses API types for route handlers.
- **Plugin** (`packages/openclaw`) — imports crypto functions directly for key derivation and types for tool payloads.
