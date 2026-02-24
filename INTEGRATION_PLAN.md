# Integration Plan: Intervals.icu CLI

## Current State
- **Phase 6 COMPLETE**: Entry Point & Commands (index.ts, commands/config.ts)
- **Phase 5b COMPLETE**: Command Registration (mapping.ts)
- **Phase 5a COMPLETE**: Core Utilities (mapping.ts)
- **Phase 4 COMPLETE**: Schema Sync (OpenAPI 3.0.1)
- **Phase 3 COMPLETE**: API Client
- **Phase 2 COMPLETE**: Configuration module
- **Phase 1 COMPLETE**: Project infrastructure setup
- package.json, tsconfig.json, bin wrapper created
- Directory structure: src/, src/api/, src/commands/, src/data/, tests/, tests/fixtures/
- README.md and AGENTS.md exist
- .specify directory with constitution
- .env file configured
- Bundled fallback schema: src/data/default-schema.json (~218KB)

---

## Architecture Overview

Replicate wordpress-bridge pattern adapted for intervals.icu API:

### Key Differences from wordpress-bridge
1. **API Spec**: OpenAPI 3.0.1 (not WP custom routes)
2. **Auth**: Basic auth with `API_KEY` as username, API key as password
3. **Base URL**: `https://intervals.icu`
4. **Resources**: athlete, activities, events, workouts, gear, wellness, routes, chats

---

## Phase 1: Foundation (Infrastructure)

### 1.1 Project Setup
- [x] Create `package.json` (commander, dotenv, typescript, @types/bun)
- [x] Create `tsconfig.json` (ESNext, strict mode)
- [x] Update `.gitignore` for node_modules, dist
- [x] Create `bin/intervals-icu` binary wrapper

### 1.2 Directory Structure
```
intervals-icu-cli/
├── package.json
├── tsconfig.json
├── bin/
│   └── intervals-icu
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── api/
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── mapping.ts
│   └── commands/
│       └── config.ts
└── tests/
    ├── fixtures/
    └── *.test.ts
```

---

## Phase 2: Configuration Module

### 2.1 `src/config.ts` - [x] COMPLETE

- [x] Create Config interface (apiKey, baseUrl, timeout)
- [x] Implement `loadConfig(flagConfigPath?, fileSystem?)`
- [x] Implement `getAuthHeader(config)` with Basic auth
- [x] WSL/Windows path handling for global config
- [x] Priority order: Flag > Env > Global > Local
- [x] Exit code 4 on missing apiKey, exit code 1 on config file errors
- [x] Default baseUrl: https://intervals.icu, timeout: 30000

**Config interface**:
```typescript
interface Config {
  apiKey: string;        // INTERVALS_ICU_API_KEY
  baseUrl: string;       // https://intervals.icu
  timeout: number;       // INTERVALS_ICU_TIMEOUT (default 30000)
}
```

**Priority order**:
1. Flag config (--config)
2. Environment variables (`INTERVALS_ICU_API_KEY`, `INTERVALS_ICU_TIMEOUT`)
3. Global config (`~/.config/intervals-icu-cli/config.json`)
4. Local `.env` file

**Functions**:
- [x] `loadConfig(flagConfigPath?, fileSystem?)` - Load config with priority
- [x] `getAuthHeader(config)` - Return Basic auth header (`API_KEY:actualKey`)
- [x] WSL/Windows path handling (from wordpress-bridge)

### 2.2 `tests/config.test.ts` - [x] COMPLETE

- [x] Load from environment variables
- [x] Load from global config file
- [x] Load from local .env file
- [x] Priority chain tests: flag > env > global > local
- [x] WSL/Windows path resolution test
- [x] Exit code 4 on missing apiKey
- [x] Exit code 1 on flag config file not found
- [x] Exit code 1 on flag config invalid JSON
- [x] Silent ignore of global config invalid JSON
- [x] Whitespace trimming on apiKey
- [x] Trailing slash removal on baseUrl
- [x] Default values for baseUrl and timeout
- [x] Auth header encoding tests
- [x] 17 tests, 100% pass rate

---

## Phase 3: API Client

### 3.1 `src/api/client.ts` - [x] COMPLETE

**ApiClient class**:
- Basic auth: `Authorization: Basic base64(API_KEY:API_KEY)`
- `request(method, path, data?, retries?, customHeaders?)` → `ApiResponse<T>`
- Dry-run mode support
- Force flag enforcement for write operations
- `Connection: close` header to prevent hangs
- Retry logic for 429 (rate limit)
- Timeout handling

**ApiResponse interface**:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta: { status: number; duration: string; total?: number; pages?: number };
}
```

**Exit codes implemented**:
- `0`: Success
- `1`: API error / generic failure
- `3`: Timeout / network error
- `10`: `--force` required for write operation

**Test coverage**: 33 tests, 100% pass rate

### 3.2 `tests/client.test.ts` - [x] COMPLETE

**Test coverage**:
- Auth header format (Basic auth with API_KEY prefix)
- Successful GET requests
- Dry-run mode interception
- Force flag enforcement (POST/PUT/PATCH/DELETE) - parameterized
- 429 retry logic with exponential backoff
- Timeout handling with exit code 3
- Error response preservation
- HTML error response handling
- Network error handling
- Connection: close header
- Query parameter serialization
- Array parameter handling
- Body handling for POST/PUT/PATCH
- Custom headers passthrough
- Response meta fields (total, pages)

**Total tests**: 33 pass, 0 fail
**Code coverage**: 100% lines, 100% functions

---

## Phase 4: Schema Sync (OpenAPI 3.0.1) - [x] COMPLETE

### 4.1 `src/api/schema.ts` - [x] COMPLETE

**Functions**:
- [x] `getConfigPaths()` - Return config paths with WSL support
- [x] `getConfigDir()` - Get first existing config dir
- [x] `ensureConfigDir()` - Create config dir if needed
- [x] `getSchemaMeta()` - Load schema metadata
- [x] `isSchemaStale()` - Check if cache > 24h old
- [x] `schemaIndexExists()` - Check if index file exists
- [x] `needsSync()` - Check if sync needed
- [x] `saveSchemaMeta(source)` - Save metadata
- [x] `loadSchemaIndex()` - Load cached index
- [x] `saveSchemaIndex(index)` - Save index to cache
- [x] `saveSchema(spec)` - Save full spec to cache
- [x] `generateIndex(openApiSpec)` - Generate index from OpenAPI paths
- [x] `loadFallbackSchema()` - Load bundled default-schema.json

**Types**:
```typescript
interface SchemaMeta {
  lastSynced: string;  // ISO timestamp
  source: "remote" | "fallback";
}

type SchemaIndex = Record<string, string[]>;  // path -> [methods]

interface OpenAPISpec {
  openapi: string;
  paths: Record<string, Record<string, any>>;
}
```

**Cached files** (in `~/.config/intervals-icu-cli/`):
- `schema.json` - Full OpenAPI spec (~218KB)
- `schema-index.json` - Lightweight index (path → methods)
- `schema-meta.json` - Sync metadata (timestamp, source)

**Bundled fallback**:
- `src/data/default-schema.json` - Shipped with CLI, used if remote fetch fails

**Test coverage**: 33 tests, 100% pass rate. Overall coverage: 99.38% lines.

---

## Phase 5: Dynamic Command Mapping

**Philosophy**: 1:1 mapping with API. No convenience layers, no include flags, no defaults beyond what API provides.

### 5a: Core Utilities (`src/api/mapping.ts`) - [x] COMPLETE

Pure functions with no Commander dependency.

| Function | Purpose |
|----------|---------|
| `parsePath(path)` | Extract `{namespace, resources, params}` from OpenAPI path |
| `detectAction(method, params, resources?)` | HTTP method + params + resources → `get/list/create/update/delete` |
| `buildPath(template, args)` | Replace `{param}` placeholders with values |
| `pickFields(obj, fields[])` | Filter output fields (supports dot notation) |

**Path parsing examples**:
```
/api/v1/athlete/{id}                    → {namespace: "athlete", resources: [], params: ["id"]}
/api/v1/athlete/{id}/activities         → {namespace: "athlete", resources: ["activities"], params: ["id"]}
/api/v1/athlete/{id}/workouts/{workoutId} → {namespace: "athlete", resources: ["workouts"], params: ["id", "workoutId"]}
```

**HTTP → Action mapping**:
| HTTP | Params | Resources | Action |
|------|--------|-----------|--------|
| GET | 0 | N/A | `list` |
| GET | >0 | None | `get` |
| GET | >0 | Present | `list` (if params == resources) or `get` (if params > resources) |
| POST | Any | Any | `create` |
| PUT/PATCH | Any | Any | `update` |
| DELETE | Any | Any | `delete` |

**Examples**:
- `/api/v1/athlete/{id}` GET → params: ["id"], resources: [] → `get`
- `/api/v1/athlete/{id}/activities` GET → params: ["id"], resources: ["activities"] → `list`
- `/api/v1/athlete/{id}/wellness/{date}` GET → params: ["id", "date"], resources: ["wellness"] → `get`
- `/api/v1/athlete/{id}/workouts/{workoutId}` GET → params: ["id", "workoutId"], resources: ["workouts"] → `get` |

**Test coverage**: 39 tests, 100% pass rate. 98.88% line coverage.

---

### 5b: Command Registration (`src/api/mapping.ts`)

Commander.js hierarchy creation.

| Function | Purpose |
|----------|---------|
| `mapRoutesToCommands(program, schemaIndex, spec)` | Main entry - iterates paths, creates command hierarchy |
| `registerCommand(program, pathInfo, method, op, cache)` | Register single command with positional args and flags |
| `getCommandPath(pathInfo, action)` | Build command path array for hierarchy |
| `getOrCreateCommand(program, cmdPath, cache)` | Get or create nested commands with caching |

**Command structure**:
```
program
├── athlete
│   ├── get <id>
│   ├── update <id>
│   ├── activities
│   │   ├── list <id> --oldest <date> [--newest] [--limit]
│   │   └── create <id> --file <path>
│   ├── events
│   │   ├── list <id> --oldest <date>
│   │   └── create <id>
│   ├── wellness
│   │   ├── get <id> <date>
│   │   └── update <id> <date>
│   └── workouts
│       ├── list <id>
│       ├── get <id> <workoutId>
│       └── update <id> <workoutId>
├── activity
│   ├── get <id>
│   ├── update <id>
│   ├── delete <id>
│   ├── streams <id>
│   └── intervals <id>
└── chats
    ├── get <id>
    └── messages
        └── list <id> [--before-id] [--limit]
```

**Positional args**: Use OpenAPI param names as-is (e.g., `<id>`, `<workoutId>`, `<athleteId>`)

**Common flags**:
- `--fields <fields>` - Limit output fields
- `--format <json|ids|count>` - Output format (default: json)
- `--full` - Full response for update/delete
- `--file <path>` - JSON payload from file

**Test coverage**: 94 tests, 100% pass rate. Overall: 177 tests, 100% pass rate.

---

### 5c: Command Execution (`src/api/mapping.ts`)

Action handler + output processing + API calls.

| Function | Purpose |
|----------|---------|
| `createActionHandler(pathInfo, method, op)` | Returns async handler for command |
| `processOutput(data, options, action)` | Apply `--fields`, `--format`, minimal output |
| `extractQueryParams(options, op)` | Get query params from OpenAPI spec |

**Output processing**:
- **Minimal** (default for `update`/`delete`): `id` + request fields only
- **`--fields`**: Filter to specified fields
- **`--format ids`**: Return `[id1, id2, ...]`
- **`--format count`**: Return count
- **`--full`**: Return complete API response

**Pagination**: 
- `--oldest` is **required** for list commands (API requirement)
- `--newest`, `--limit` are optional
- No auto-pagination (KISS)

**Test coverage**: Full execution flow, output formats, error handling, query param extraction.

---

### Endpoint Policy

**Include ALL endpoints** (1:1 with API):
- `{ext}` paths → registered as-is
- Download paths → registered as-is  
- Bulk paths → registered as-is

User discovers via `--help` and subcommand exploration.

---

## Phase 6: Entry Point & Commands - [x] COMPLETE

### 6.1 `src/index.ts` - [x] COMPLETE

**Global options**:
- `-d, --dry-run` - Simulate requests
- `-f, --force` - Enable destructive operations
- `-c, --config <path>` - Config file path

**Static commands**:
1. `sync` - Fetch OpenAPI spec from `https://intervals.icu/api/v1/docs`
2. `config` - Interactive setup (delegate to `commands/config.ts`)
3. `version` - Display version (via `.version()` method)

**Auto-sync logic**:
- Run on startup unless: `sync`, `--help`, no args, or config command
- Check `needsSync()` → `performSync()` if true

**Process.exit(0)** after all outputs (prevent hangs)

**Stdout/stderr contract**:
- Primary data → stdout (JSON API responses)
- Diagnostics/errors → stderr (logs, warnings, sync progress)
- Always JSON output for agents; minimal by default, `--full` for complete response

**Test coverage**: 4 tests, 100% pass rate

### 6.2 `src/commands/config.ts` - [x] COMPLETE

Interactive config setup:
1. Prompt for API key
2. Save to `~/.config/intervals-icu-cli/config.json`

**Implementation**: Uses Bun's built-in readline module for prompts

---

## Phase 7: Testing Infrastructure

### 7.1 Test Setup
- Create `tests/fixtures/` for OpenAPI spec mocks
- Mock fixtures for API responses
- Test coverage > 80%

### 7.2 Test Files
- `config.test.ts` - Config loading, priority order (17 tests)
- `client.test.ts` - API client, auth, retries (33 tests)
- `schema.test.ts` - Schema sync, index generation (33 tests)
- `mapping.test.ts` - Core utilities (5a), command registration (5b) (94 tests)
- `index.test.ts` - Entry point, static commands, auto-sync (4 tests) |

---

## Phase 8: Documentation (Complete)

### MVP Commands (Examples - 1:1 with API)

**1. Athlete commands**:
- `athlete get <id>` - Get athlete profile
- `athlete update <id> --file <path>` - Update athlete

**2. Activity commands**:
- `athlete activities list <id> --oldest <date>` - List activities (required: oldest)
  - Optional: `--newest`, `--limit`, `--route-id`, `--fields`, `--format`
- `activity get <id>` - Get single activity
- `activity update <id> --file <path>` - Update activity
- `activity delete <id>` - Delete activity
- `activity streams <id>` - Get activity streams (separate endpoint)
- `activity intervals <id>` - Get activity intervals (separate endpoint)

**3. Event commands**:
- `athlete events list <id> --oldest <date>` - List events
- `athlete events create <id> --file <path>` - Create event
- `athlete events get <id> <eventId>` - Get event details
- `athlete events update <id> <eventId> --file <path>` - Update event

**4. Wellness commands**:
- `athlete wellness get <id> <date>` - Get wellness for date
- `athlete wellness update <id> <date> --file <path>` - Update wellness

### Analytics Commands (Examples - 1:1 with API)

**1. Wellness**:
- `athlete wellness-bulk update <id> --file <path>` - Bulk wellness updates

**2. Performance**:
- `athlete power-curves get <id>` - Power curves
- `athlete pace-curves get <id>` - Pace curves  
- `athlete hr-curves get <id>` - HR curves
- `athlete mmp-model get <id>` - Mean Max Power model
- `athlete power-hr-curve get <id>` - Power vs HR relationship
- `athlete summary get <id>` - Athlete summary

---

## Decisions Made

### 1. Schema Sync Endpoint
**Endpoint**: `https://intervals.icu/api/v1/docs` (OpenAPI spec)

### 2. Error Handling
**Decision**: Preserve intervals.icu's native error format (Option B)
- Do not mirror WP's error structure
- Return API's native error codes and messages

### 3. Pagination
**Finding**: Intervals.icu uses query parameters instead of headers:
- `oldest` (required) - Start date (ISO-8601)
- `newest` - End date (optional, defaults to now)
- `limit` - Max results count
- No X-Total headers like WP

**Decision**: No auto-pagination. User must specify `--oldest` (required by API). KISS principle.

### 4. Version Handling
**Clarification**: `.version()` is Commander.js method for CLI version:
```typescript
program.version("1.0.0")
```
- Set in `src/index.ts`
- Synced with `package.json` version

### 5. Exit Codes
**Decision**: Exit codes defined in AGENTS.md and README.md:
- `0`: Success
- `1`: API error / generic failure / config file error (not found or invalid JSON)
- `2`: Invalid usage (missing required args)
- `3`: Timeout / network error
- `4`: Missing configuration
- `10`: --force required for write operation

### 6. Command Mapping Philosophy
**Decision**: 1:1 mapping with API. No convenience layers.
- No `--include-*` flags for activity sub-resources → use separate commands
- No auto-pagination → user specifies `--oldest` (required by API)
- No parameter name transformation → use OpenAPI param names as-is
- All endpoints registered → user discovers via `--help`

---

## Implementation Order

1. [x] **Phase 1-2**: Foundation & config
2. [x] **Phase 3**: API client
3. [x] **Phase 4**: Schema sync (fetch OpenAPI spec)
4. [x] **Phase 5a**: Core utilities (parsePath, detectAction, pickFields, buildPath)
5. [x] **Phase 5b**: Command registration (mapRoutesToCommands hierarchy)
6. [x] **Phase 5c**: Command execution (action handlers, output processing)
7. [x] **Phase 6**: Entry point & static commands
8. **Phase 7**: Tests (ongoing)

Note: Phase 8 (Documentation) complete - AGENTS.md and README.md finalized with CLI Guidelines compliance.

---

## Open Questions (Future)

1. **Wellness bulk format**: What's the expected JSON structure for `--file` input on bulk endpoints? (check API docs when implemented)

2. **Download endpoints**: How to handle binary responses (GPX, FIT files)? Stream to file or stdout?

---

## Notes

- **API Docs**: https://intervals.icu/api-docs.html
- **OpenAPI Spec**: https://intervals.icu/api/v1/docs
- **Reference**: wordpress-bridge at `/mnt/c/Users/Baptiste/Documents/Projects/wordpress-bridge/`
- **Agent Style**: Telegraphic, KISS/DRY/YAGNI
- **Coverage**: > 80% required
- **CLI Termination**: MUST `process.exit(0)` after output
