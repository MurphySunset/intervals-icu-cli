# Integration Plan: Intervals.icu CLI

## Current State
- **Phase 2 COMPLETE**: Configuration module
- **Phase 1 COMPLETE**: Project infrastructure setup
- package.json, tsconfig.json, bin wrapper created
- Directory structure: src/, src/api/, src/commands/, tests/, tests/fixtures/
- README.md and AGENTS.md exist
- .specify directory with constitution
- .env file configured

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

### 3.1 `src/api/client.ts`

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

---

## Phase 4: Schema Sync (OpenAPI 3.0.1)

### 4.1 `src/api/schema.ts`

**Functions**:
- `getConfigPaths()` - Return config paths with WSL support
- `getSchemaMeta()` - Load schema metadata
- `isSchemaStale()` - Check if cache > 24h old
- `needsSync()` - Check if sync needed
- `saveSchemaMeta(source)` - Save metadata
- `loadSchemaIndex()` - Load cached index
- `generateIndex(openApiSpec)` - Generate index from OpenAPI paths

**SchemaIndex type**:
```typescript
type SchemaIndex = Record<string, string[]>;  // path -> [methods]
```

**Cached files** (in `~/.config/intervals-icu-cli/`):
- `schema.json` - Full OpenAPI spec
- `schema-index.json` - Lightweight index (path → methods)
- `schema-meta.json` - Sync metadata (timestamp, source)

---

## Phase 5: Dynamic Command Mapping

### 5.1 `src/api/mapping.ts`

**`mapRoutesToCommands(program, schemaIndex)`**:

**HTTP → Command mapping**:
| HTTP | Single/Collection | Command |
|------|-------------------|---------|
| GET  | Collection        | `list`  |
| GET  | Single            | `get`   |
| POST | Collection        | `create`|
| PUT/PATCH | Single        | `update`|
| DELETE| Single           | `delete`|

**Resource detection**:
- Parse path: `/api/v1/athlete/{id}/activities` → namespace: `athlete`, resource: `activities`
- Detect single vs collection (presence of `{id}`)

**Common flags**:
- `--fields <fields>` - Limit output fields
- `--format <json|ids|count>` - Output format
- `--all` - Auto-pagination for list (if API supports)
- `--full` - Full response for get/delete
- `--file <path>` - JSON payload from file
- `--force` - Required for writes (global)

**Activity-specific flags** (only on `activity get`):
- `--include-streams` - Fetch `/activity/{id}/streams`
- `--include-intervals` - Fetch `/activity/{id}/intervals`
- `--include-best-efforts` - Fetch `/activity/{id}/best-efforts`
- `--include-curves` - Fetch power/pace/HR curves
- `--include-histograms` - Fetch distribution histograms
- `--include-models` - Fetch HR load, power spike models
- `--include-segments` - Fetch course segments
- `--include-map` - Fetch activity map

**Output processing**:
- Minimal by default (id + modified fields)
- `--fields` uses `pickFields()` helper
- `--format ids` returns array of IDs
- `--format count` returns number
- Always JSON output for agents

---

## Phase 6: Entry Point & Commands

### 6.1 `src/index.ts`

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

### 6.2 `src/commands/config.ts`

Interactive config setup:
1. Prompt for API key
2. Save to `~/.config/intervals-icu-cli/config.json`

---

## Phase 7: Testing Infrastructure

### 7.1 Test Setup
- Create `tests/fixtures/` for OpenAPI spec mocks
- Mock fixtures for API responses
- Test coverage > 80%

### 7.2 Test Files
- `config.test.ts` - Config loading, priority order
- `client.test.ts` - API client, auth, retries
- `schema.test.ts` - Schema sync, index generation
- `mapping.test.ts` - Command generation, flag handling

---

## Phase 8: Documentation (Complete)

### MVP Commands (First Iteration)

**1. Athlete commands**:
- `athlete get <id>` - Get athlete profile/settings
  - Output: name, weight, FTP, zones, settings

**2. Activity commands**:
- `activities list --athlete-id <id> --oldest <date>` - List activities
  - Output: id, date, type, duration, distance, TSS
  - Flags: `--fields`, `--format`, `--limit`, `--route-id`, `--newest`
- `activity get <id>` - Get single activity
  - Output: basic info
  - Flags: `--include-streams`, `--include-curves`, etc.

**3. Event commands**:
- `events list --athlete-id <id>` - List scheduled events
  - Output: id, date, name, type, status
- `event get <id>` - Get event details
  - Output: event info with workout details

### Analytics Commands (General - Future)

**1. Wellness**:
- `athlete wellness <id>` - Daily wellness data
- `athlete wellness-bulk <id>` - Bulk wellness updates

**2. Performance**:
- `athlete curves <id>` - Long-term performance curves
- `athlete summary <id>` - Overall athlete summary
- `athlete mmp-model <id>` - Mean Max Power model
- `athlete power-hr-curve <id>` - Power vs HR relationship

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

**Implication**: Auto-pagination logic needs adjustment - use `limit` parameter instead of page-based pagination.

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

---

## Implementation Order

1. [x] **Phase 1-2**: Foundation & config
2. **Phase 3**: API client
3. **Phase 4**: Schema sync (fetch OpenAPI spec)
4. **Phase 5**: Dynamic command mapping
5. **Phase 6**: Entry point & static commands
6. **Phase 7**: Tests (ongoing)

Note: Phase 8 (Documentation) complete - AGENTS.md and README.md finalized with CLI Guidelines compliance.

---

## Open Questions (Future)

1. **Wellness commands**: Should wellness accept a date parameter or list all dates by default? (to be addressed when implemented)

2. **Auto-pagination**: Does intervals.icu support cursor-based pagination for large datasets? (check docs during implementation)

3. **Activity flags**: Should we add shorthand flags like `--all-analytics` for convenience? (defer to user feedback)

---

## Notes

- **API Docs**: https://intervals.icu/api-docs.html
- **OpenAPI Spec**: https://intervals.icu/api/v1/docs
- **Reference**: wordpress-bridge at `/mnt/c/Users/Baptiste/Documents/Projects/wordpress-bridge/`
- **Agent Style**: Telegraphic, KISS/DRY/YAGNI
- **Coverage**: > 80% required
- **CLI Termination**: MUST `process.exit(0)` after output
