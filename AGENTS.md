# Intervals.icu CLI

## General
- Bridge for intervals.icu API - athletic training data management.
- Agent style: telegraphic, KISS/DRY/YAGNI.
- **Philosophy**: CLI is a thin wrapper around API. No magic, no assumptions. Commands map directly to API endpoints.

## Commands
- `bun test`: Run all tests.
- `bun test <path>`: Run targeted test.
- `bun test -- --coverage`: Run tests with coverage report.

## Project Structure
- `src/index.ts`: Entry point, CLI commands.
- `src/api/`: API client and mapping from OpenAPI spec.
- `tests/`: Unit and integration tests.
- `README.md`: Project documentation.
- `AGENTS.md`: Agent directives.

## Build/Test
- **Version Bump**: Always update BOTH `package.json` and `.version()` in `src/index.ts`.
- Test types: quick (unit), global (all), targeted (feature).
- Coverage: > 80% required.
- [quick]: `bun test --watch`
- [global]: `bun test`
- [targeted]: `bun test <file>`

## Architecture
- **Schema Index**: CLI loads cached schema from `~/.config/intervals-icu-cli/schema-index.json`.
- **Path Format**: Normalized paths from OpenAPI spec.
- **Dynamic Options**: Commands use `allowUnknownOption()` + argument parsing.
- **Auto-Sync**: Schema auto-syncs if missing or stale (>24h).
- **Config Lazy-Load**: Config only loaded when needed.

## CLI Termination
- **Native fetch() keeps connections alive** (~30s). CLI tools MUST `process.exit(0)` after output or hang.
- **Fix for hangs**: `Connection: close` header + `process.exit(0)` after success output.
- **Check error paths too**: Ensure all code paths exit cleanly.

## Exit Codes
- `0`: Success
- `1`: API error / generic failure / config file error (not found or invalid JSON)
- `2`: Invalid usage (missing required args)
- `3`: Timeout / network error
- `4`: Missing configuration
- `10`: --force required for write operation

## Testing
- Use mock fixtures for API responses.
- Test both JSON output and human-readable formats.

---

## Agent Instructions

### Adding Guardrails
When you discover a rule, local convention, or important constraint for working safely and consistently, add an entry to the "Guardrails" section below by exactly imitating the following format:

```
### [Zone] - [Theme]
Rule: ...
Context: ...
Example: ... (optional if necessary for clarification)
```

**Predefined Zones** (use these):
- `API` - API authentication, endpoints, pagination, error handling, rate limiting
- `CLI` - Command structure, flags, output format, termination
- `Config` - Environment variables, file precedence, auth setup
- `Testing` - Mocks, coverage, test types, fixtures
- `Build` - Versioning, compilation, dependencies
- `Architecture` - Schema, dynamic commands, caching
- `Infra` - WSL/Windows paths, file system, networking

**Theme**: Short descriptor (e.g., "Pagination", "Error Handling", "Auth", "Output Format")

**IMPORTANT**: NEVER edit or rewrite existing guardrails unless the issue has truly been resolved and no longer exists.

---

## Guardrails

### CLI - Standard Flags
Rule: All commands support global flags: -h/--help, --version, -d/--dry-run, -f/--force, -c/--config.
Context: Follow clig.dev conventions. Long flags required; short flags for common operations.

### CLI - Output Contract
Rule: Primary data to stdout, diagnostics/errors to stderr. Always JSON output for agents.
Context: stdout for API responses; stderr for logs/warnings. Default minimal output, --full for complete response.
Example: `activity get 123` outputs JSON to stdout; sync progress goes to stderr.

### Architecture - API Parity
Rule: CLI commands MUST map directly to API endpoints without abstraction or convenience layers.
Context: No optional parameters, no defaults beyond what API provides. If API requires a param, CLI requires it.
Example: `athlete get <id>` requires id because API path is `/api/v1/athlete/{id}` with `required: true`.

### API - Pagination
Rule: Intervals.icu uses date-range pagination (oldest/newest/limit), NOT page-based pagination like WordPress.
Context: Activities endpoint requires `oldest` param, optionally `newest` and `limit`. No X-Total headers.
Example: `activities list --athlete-id 123 --oldest 2024-01-01 --newest 2024-12-31 --limit 100`

### API - Error Handling
Rule: Preserve intervals.icu's native error format; do not mirror WordPress error structure.
Context: API returns its own error codes and messages. Output them as-is.

### API - Auth Format
Rule: Intervals.icu Basic auth uses literal "API_KEY" as username, actual API key as password.
Context: Authorization header format: `Basic base64("API_KEY:" + actualApiKey)`. Not `username:password`.
Example: If API key is "abc123", header is `Basic QVBJX0tFWTphYmMxMjM=`

### Config - Priority Order
Rule: Configuration priority: Flag (--config) > Env vars > Global config > Local .env.
Context: --config flag overrides everything; env vars are checked only if not from local .env; global config fallback; .env lowest priority.
Example: `INTERVALS_ICU_API_KEY=env-value intervals-icu -c custom.json` uses custom.json value.

### Infra - WSL/Windows Path Resolution
Rule: Config file paths must check both $HOME and $USERPROFILE on WSL/Windows systems.
Context: WSL maps Windows paths differently; config.json exists in USERPROFILE on Windows, HOME on Linux/WSL.
Example: Check both `~/.config/intervals-icu-cli/config.json` and `$USERPROFILE/.config/intervals-icu-cli/config.json`.

### Testing - Bun Test API
Rule: Bun's test runner is NOT fully vitest-compatible. Missing: `vi.advanceTimersByTimeAsync`, `vi.runOnlyPendingTimersAsync`.
Context: Use `vi.runAllTimers()` or mock errors directly. Check bun:test API before assuming vitest compatibility.

### Testing - Fetch Mock Structure
Rule: Bun's fetch mock calls are `(url, options)` where options contains headers - NOT a third argument.
Context: Always inspect mock.calls structure first: `const [url, options] = fetchSpy.mock.calls[0]`.
Example: `expect(options?.headers?.Authorization).toBe(...)` not `expect(fetchCall[2]?.Authorization)`

### Testing - Avoid Fake Timers
Rule: Prefer mocking errors directly over `vi.useFakeTimers()` for async code.
Context: Fake timers with async operations cause hangs/timeout issues in bun test runner.
Example: For timeout test, mock fetch to reject with AbortError directly.

### Testing - Data-Driven Test Design
Rule: Analyze all schema endpoints before implementing path parsing logic.
Context: The 114 API paths contain patterns (embedded params, format suffixes) that edge cases must cover.
Example: Run `cat schema.json | jq '.paths | keys[]'` to enumerate all patterns before coding.

### Architecture - OpenAPI Index Format
Rule: Schema index is `Record<path, method[]>` extracted from `spec.paths[path].{get,post,put,patch,delete}`.
Context: Intervals.icu uses OpenAPI 3.0.1, not WordPress REST API. Methods are keys under each path, not a `methods` array.
Example: `spec.paths["/api/v1/athlete/{id}"].get` exists → index entry `["GET"]`

### Architecture - Path Parameter Patterns
Rule: OpenAPI paths may have embedded params like `{ext}` within segments (e.g., `power-curve{ext}`), not just standalone `{param}` segments.
Context: Regex must match `{...}` anywhere in a segment, not only when the entire segment is a param.
Example: `/api/v1/activity/{id}/power-curve{ext}` has params `["id", "ext"]`, not just `["id"]`.

### Build - Bundled Assets
Rule: Static assets in `src/data/` must be copied to `dist/data/` during build.
Context: TypeScript compiler only processes .ts files; JSON assets need explicit copy step. Build output is `dist/` not `dist/src/`.
Example: Build script: `tsc && cp -r src/data dist/`

### Build - FileSystem Type Casting
Rule: When assigning Node's `fs` module to a custom `FileSystem` interface, use `as unknown as FileSystem`.
Context: Node's fs signatures are more complex than simplified test interfaces. Direct assignment causes TS2322 errors.
Example: `let fileSystem: FileSystem = fs as unknown as FileSystem;`

## Notes
- **API Docs**: https://intervals.icu/api-docs.html
- **OpenAPI Spec**: https://intervals.icu/api/v1/docs
- **CRITICAL**: Always use `--force` for write operations (create, update, delete).
- **Pris en main**: Always read `@README.md` first.
