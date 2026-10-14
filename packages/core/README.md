# @karmaniverous/jeeves-server-core

Shared workspace package providing cryptographic utilities and API types consumed by `@karmaniverous/jeeves-server` (service) and `@karmaniverous/jeeves-server-openclaw` (plugin).

## Exports

### Crypto Functions

| Function | Description |
| --- | --- |
| `computePathKey(seed, path)` | HMAC-SHA256 outsider key for a normalized path (32 hex chars) |
| `computeInsiderKey(seed)` | HMAC-SHA256 insider key derived from a seed (32 hex chars) |
| `computeOutsiderKeyWithExpiry(seed, path, expiry)` | HMAC-SHA256 outsider key with embedded expiration |
| `computeDeepShareKey(seed, path, params)` | HMAC-SHA256 key for deep directory shares with depth/dirs/stack/expiry |
| `timingSafeEqual(a, b)` | Constant-time string comparison to prevent timing attacks |

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

### Endpoint Catalog

| Export | Description |
| --- | --- |
| `EndpointEntry` | Interface describing a single API operation (method, path, description, auth flags) |
| `serverEndpoints` | Complete declarative catalog of all jeeves-server API endpoints (39 entries) |

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
  serverEndpoints,
  type EndpointEntry,
  type LoggingConfig,
  type ShareRequest,
} from '@karmaniverous/jeeves-server-core';
```

## How Packages Consume It

- **Service** (`packages/service`) — re-exports crypto functions from `src/util/crypto.ts` and uses API types for route handlers.
- **Plugin** (`packages/openclaw`) — imports crypto functions directly for key derivation and types for tool payloads.
