# @karmaniverous/jeeves-server-sdk

Typed TypeScript client for the [jeeves-server](https://github.com/karmaniverous/jeeves-server) HTTP API: one method per route of the server's endpoint catalog (`SERVER_CATALOG` in `@karmaniverous/jeeves-server-core`), with requests and responses checked against the catalog's schemas and every failure a `ServerError`.

The SDK is browser-safe: it imports only `@karmaniverous/jeeves/catalog` and `@karmaniverous/jeeves-server-core/catalog` (no Node built-ins, `fetch` only), so it bundles in a web app as well as running in Node 24.22.2 or later.

```bash
npm install @karmaniverous/jeeves-server-sdk
```

## Usage

```ts
import {
  createServerClient,
  isServerError,
  toExportUrl,
  toRawUrl,
} from '@karmaniverous/jeeves-server-sdk';

const server = createServerClient({
  baseUrl: 'http://127.0.0.1:1934',
  auth: { key: insiderKey },
});

// One method per catalog entry; `*` is the browse path.
const listing = await server.browse({ '*': 'j/docs' });
const { url } = await server.share({ path: '/j/docs/report.md' });
const pdf = await server.export({ '*': 'j/docs/report.md', format: 'pdf' });

// Links derived from a share's page URL.
const rawUrl = toRawUrl(`https://jeeves.example.com${url}`);
const docxUrl = toExportUrl(`https://jeeves.example.com${url}`, 'docx');

try {
  await server.fileContent({ '*': 'j/private/notes.md' });
} catch (error) {
  if (isServerError(error) && error.code === 'SERVER_OUT_OF_SCOPE') {
    console.log(`${error.message} (HTTP ${String(error.status)})`);
  } else throw error;
}
```

## Client

`createServerClient({ baseUrl, auth?, timeoutMs?, fetch? })` returns a `ServerClient` with one method per catalog entry, named by the entry (`status`, `drives`, `browse`, `fileContent`, `fileWrite`, `fileMutate`, `raw`, `export`, `share`, `shareFor`, `linkInfo`, `search`, `receiveEvent`, `oauthToken`, `runnerGet`, ...). Each method takes the entry's input as one flat object (path parameters, query and body fields; the `*` wildcard is the browse path) and resolves to the parsed response. The input is optional when no field is required. The SDK never retries.

| Option | Description |
| --- | --- |
| `baseUrl` | The server's base URL, e.g. `http://127.0.0.1:1934` (no query string or fragment) |
| `auth` | Credential, below. Default: none (public entries only) |
| `timeoutMs` | Per-call timeout in ms. Default 120000 (`DEFAULT_TIMEOUT_MS`); `export` defaults to 600000 (`EXPORT_TIMEOUT_MS`), the server's render budget |
| `fetch` | `fetch` implementation (tests, custom agents). Default: the global `fetch` |

Every method also takes per-call options as its second argument: `{ timeoutMs }`.

**Binary entries** (`raw`, `export`, `exportMermaid`, `exportPlantUml`, `diagram`) resolve to a `Uint8Array`. Response headers are not exposed: name a downloaded file from the request (`<base name>.<format>`). For large exports in a browser, prefer a download link built with `toExportUrl`.

## Credentials

| `auth` | Sent as | Use |
| --- | --- | --- |
| `{ key }` | the `k` query parameter, on every entry whose `auth` lists it (never on public entries) | An insider or machine key. Derive it yourself, e.g. `computeInsiderKey(seed)` from `@karmaniverous/jeeves-server-core`: the SDK takes no seeds, which would need `node:crypto` |
| `{ share: { k, exp?, d?, dirs?, s? } }` | added to every request's query (parameters a request already carries are kept) | A share-link credential, e.g. a web page opened from a share link |
| `{ session: true }` | the browser's `jeeves_session` cookie, with `credentials: 'same-origin'` | A web app served by the server, after sign-in |

## Errors

Every failure is a `ServerError` (`isServerError(value)` narrows to it). Branch on `code`, never on `message`.

| Field | Description |
| --- | --- |
| `status` | The HTTP status; 0 when no usable response arrived |
| `code` | The response body's `code` (a `SERVER_*` code from `SERVER_ERROR_CODES`, a jeeves `JEEVES_*` code or a Fastify `FST_ERR_*` code), else `http_<status>`; or a client code: `invalid_options`, `invalid_request` (input failed the entry's schema; nothing sent), `invalid_response` (a 2xx that isn't JSON or fails the response schema), `timeout`, `network_error` |
| `message` | The response body's `message`, or the SDK's description |
| `retryAfterMs` | From a `Retry-After` header (429, 503), when present |
| `body` | The parsed error body `{ statusCode, code?, error, message }` |

`SERVER_ERROR_CODES` and `SERVER_ERROR_STATUS` (each code's HTTP status) are re-exported from core.

## Link helpers

Pure functions, no I/O; they keep the URL's query exactly as written.

| Function | Description |
| --- | --- |
| `withShareCredential(url, share)` | Adds a share credential's parameters to any URL, keeping the parameters it already carries (e.g. `download=1`) |
| `toRawUrl(pageUrl)` | `/browse/<path>` → `/api/raw/<path>`, keeping the query (a share credential verifies on both) |
| `toExportUrl(pageUrl, format)` | `pdf`/`docx` (Markdown) and `zip`/`tar` (directories) → `/api/export/<path>?format=…`; `svg`/`png` of a `.mmd` → `/api/mermaid-export/…`, of a `.puml`/`.plantuml` → `/api/plantuml-export/…`. Any other combination throws `invalid_options` naming the valid formats |

Both page-URL helpers accept absolute or root-relative URLs and drop the fragment.

## Types

`ServerInput<N>`, `ServerResponse<N>`, `ServerEntryName` and `ServerHealth` (the `health` block of `status`) are re-exported from core's catalog.

## License

MIT
