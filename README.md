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

```bash
# Sync API schema (run on first launch)
bun run src/index.ts sync

# Get current athlete (uses API key's default athlete, or use "0")
bun run src/index.ts athlete get

# Get athlete by ID
bun run src/index.ts athlete get <id>

# List activities
bun run src/index.ts activities list

# List activities for specific athlete
bun run src/index.ts activities list --athlete-id <id>

# List workouts
bun run src/index.ts workouts list

# Create a workout (safety --force required)
bun run src/index.ts workouts create --force --file workout.json

# Update athlete settings
bun run src/index.ts athlete update --name "New Name" --force

# Upload activity (FIT/TCX/GPX file)
bun run src/index.ts activities upload --file activity.fit --force
```

### Output Modes

- **Minimal (default)**: Returns only id + modified fields
- **Full**: Use `--full` flag for complete response

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