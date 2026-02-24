# Intervals.icu CLI

Bridge for intervals.icu API - athletic training data management.

## Installation

### Local (Development)

```bash
bun install
```

### Global (CLI)

⚠️ **Prerequisite**: Bun must be installed on the system.

To install intervals-icu-cli globally:

```bash
bun run build
npm install -g .
```

After global install, configure access:

```bash
intervals-icu config
```

## Usage

⚠️ **IMPORTANT**: Use `bun run src/index.ts` for development. The global command `intervals-icu` points to the same API - no separate staging environment.

### Local (with Bun)

**Note**: CLI commands follow API path hierarchy: `namespace resource action <id> [flags]`

```bash
# Sync API schema (run on first launch)
bun run src/index.ts sync

# Get athlete by ID (use "0" for API key's default athlete)
bun run src/index.ts athlete get <id>

# List activities (oldest required by API)
bun run src/index.ts athlete activities list <id> --oldest 2024-01-01

# List activities for specific athlete with date range
bun run src/index.ts athlete activities list <id> --oldest 2024-01-01 --newest 2024-12-31 --limit 100

# Get activity details
bun run src/index.ts activity get <id>

# Get activity with streams
bun run src/index.ts activity get <id> --include-streams

# Get event details
bun run src/index.ts event get <id>
```

### Output Modes

- **Minimal (default)**: Returns only id + modified fields
- **Full**: Use `--full` flag for complete response

## Global Flags

- `-h, --help`: Show help
- `--version`: Show version
- `-d, --dry-run`: Simulate request without sending
- `-f, --force`: Enable write operations (required for create/update/delete)
- `-c, --config <path>`: Path to config file
- `--full`: Return complete response (default: minimal)
- `--format <json|ids|count>`: Output format
- `--fields <fields>`: Limit output to specific fields (comma-separated)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | API error / generic failure |
| 2 | Invalid usage |
| 3 | Timeout / network error |
| 4 | Missing configuration |
| 10 | --force required |

## Configuration

### Configuration Methods

Configuration priority order:

1. **Environment variables** (highest priority)
2. **Global config file** (~/.config/intervals-icu-cli/config.json)
3. **Local file** (.env in current directory)

### Environment Variables

```env
INTERVALS_ICU_API_KEY=your_api_key
INTERVALS_ICU_TIMEOUT=30000
```

The API uses basic authentication: username is "API_KEY", password is your API key.

**Note**: The API is per-athlete. Use "0" as athlete ID to reference the athlete associated with your API key.

## Project Structure

- `src/index.ts`: Entry point, CLI commands (`sync`, `config`).
- `src/api/`: API client and dynamic command generation from OpenAPI spec.
- `tests/`: Unit and integration tests.
- `.specify/`: Project specifications and templates.

## License

MIT

## Contributing

PRs welcome. See GitHub.