<!--
Sync Impact Report:
- Version change: None → 1.0.0 (initial creation)
- Added principles: API-First, CLI Interface, Safety First
- Added sections: Technology Stack, Development Workflow
- Templates requiring updates: ✅ All templates align with new principles
-->

# Intervals.icu CLI Constitution

## Core Principles

### I. API-First
Every feature maps directly to intervals.icu API endpoints. CLI commands MUST reflect the API structure with subcommands for each resource type (athletes, activities, workouts, etc.). The CLI generates commands dynamically from the OpenAPI specification, ensuring parity with the upstream API.

### II. CLI Interface
Text in/out protocol: stdin/args → stdout, errors → stderr. The CLI MUST support JSON output for scripting and human-readable format for interactive use. Output MUST be minimal by default (id + modified fields only) with --full flag for complete response. CLI tools MUST terminate with process.exit(0) after output to prevent hangs.

### III. Safety First (NON-NEGOTIABLE)
Every write operation (create, update, delete) MUST require explicit --force confirmation. Dry-run mode MUST be available for all destructive operations. The CLI MUST never make assumptions about data - explicit flags for all modifications.

## Technology Stack

- **Runtime**: Bun + TypeScript
- **CLI Framework**: Commander.js
- **API Client**: Native fetch with proper headers (Connection: close for CLI termination)
- **Configuration**: Environment variables + config file (~/.config/intervals-icu-cli/)
- **Schema**: OpenAPI sync from intervals.icu API (cached locally)

## Development Workflow

- **Testing**: Bun test with >80% coverage required
- **Version Bump**: Update BOTH package.json and version in entry point
- **Build**: TypeScript compilation before publish
- **Dev Environment**: Use .env for development

## Governance

This constitution supersedes all other practices. Amendments require:
1. Documentation of the proposed change
2. Review and approval
3. Migration plan if breaking changes

All PRs/reviews MUST verify compliance with these principles. Complexity MUST be justified in the plan document.

**Version**: 1.0.0 | **Ratified**: 2026-02-24 | **Last Amended**: 2026-02-24
