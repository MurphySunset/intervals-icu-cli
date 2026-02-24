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

⚠️ **IMPORTANT**: Use `bun run src/index.ts` for development (connects to staging via `.env`). The global command `intervals-icu` is for production.

### Local (with Bun)

```bash
# Sync API schema (run on first launch)
bun run src/index.ts sync

# List athletes
bun run src/index.ts athletes list

# Get athlete by ID
bun run src/index.ts athletes get <id>

# List activities
bun run src/index.ts activities list --athlete-id <id>

# Create a workout (safety --force required)
bun run src/index.ts workouts create --force --file workout.json

# Update athlete settings
bun run src/index.ts athletes update <id> --name "New Name" --force
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
INTERVALS_ICU_EMAIL=your@email.com
INTERVALS_ICU_API_KEY=your_api_key
INTERVALS_ICU_TIMEOUT=30000
```

## Project Structure

- `src/index.ts`: Entry point, CLI commands (`sync`, `config`).
- `src/api/`: API client and dynamic command generation from OpenAPI spec.
- `tests/`: Unit and integration tests.
- `.specify/`: Project specifications and templates.

## License

MIT

## Contributing

PRs welcome. See GitHub.