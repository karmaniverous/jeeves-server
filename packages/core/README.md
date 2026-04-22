# @karmaniverous/jeeves-server-core

Shared workspace package providing cryptographic utilities and API types consumed by `@karmaniverous/jeeves-server` (service) and `@karmaniverous/jeeves-server-openclaw` (plugin).

## Exports

### Crypto Functions

| Function | Description |
|----------|-------------|
| `computePathKey(seed, path)` | HMAC-SHA256 outsider key for a normalized path (32 hex chars) |
| `computeInsiderKey(seed)` | HMAC-SHA256 insider key derived from a seed (32 hex chars) |
| `computeOutsiderKeyWithExpiry(seed, path, expiry)` | HMAC-SHA256 outsider key with embedded expiration |
| `computeDeepShareKey(seed, path, params)` | HMAC-SHA256 key for deep directory shares with depth/dirs/stack/expiry |
| `timingSafeEqual(a, b)` | Constant-time string comparison to prevent timing attacks |

### API Types

| Type | Description |
|------|-------------|
| `ShareRequest` / `ShareResponse` | `POST /api/share` payloads |
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
  type ShareRequest,
} from '@karmaniverous/jeeves-server-core';
```

## How Packages Consume It

- **Service** (`packages/service`) — re-exports crypto functions from `src/util/crypto.ts` and uses API types for route handlers.
- **Plugin** (`packages/openclaw`) — imports crypto functions directly for key derivation and types for tool payloads.
