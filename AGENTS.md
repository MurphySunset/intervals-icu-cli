# Intervals.icu CLI

## General
- Bridge for intervals.icu API - athletic training data management.
- Agent style: telegraphic, KISS/DRY/YAGNI.

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

## Testing
- Use mock fixtures for API responses.
- Test both JSON output and human-readable formats.

## Notes
- **API Docs**: https://intervals.icu/api-docs.html
- **OpenAPI Spec**: https://intervals.icu/api/v1/docs
- **Configuration Precedence**:
    1. Environment variables (highest priority)
    2. Global config file (~/.config/intervals-icu-cli/config.json)
    3. Local .env file
- **CRITICAL**: Always use `--force` for write operations (create, update, delete).
- **Pris en main**: Always read `@README.md` first.
