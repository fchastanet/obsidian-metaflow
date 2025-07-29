# Project Structure Refactoring

## Overview

The project has been refactored to follow modern TypeScript/JavaScript project conventions with a clean separation of concerns.

## New Structure

```
├── src/                          # Source code
│   ├── index.ts                  # Main plugin entry point (formerly main.ts)
│   ├── types.ts                  # Type definitions and interfaces
│   ├── settings.ts               # Default settings configuration
│   ├── metadata-sorter.ts        # Core metadata sorting functionality
│   ├── metadata-auto-inserter.ts # MetadataMenu integration
│   ├── yaml-utils.ts             # YAML parsing and serialization utilities
│   └── field-utils.ts            # Field validation and default value utilities
├── tests/                        # Test files
├── scripts/                      # Build and utility scripts
│   ├── sync.mjs                  # File synchronization script
│   └── version-bump.mjs          # Version bumping script
├── coverage/                     # Test coverage reports
├── esbuild.config.mjs            # Build configuration
├── jest.config.js                # Test configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Project dependencies and scripts
```

## Key Changes

### 1. Source Code Organization

- **Moved main.ts → src/index.ts**: Following standard entry point conventions
- **Extracted types**: All interfaces and types moved to `src/types.ts`
- **Extracted settings**: Default configuration moved to `src/settings.ts`
- **Extracted utilities**: 
  - YAML operations → `src/yaml-utils.ts`
  - Field operations → `src/field-utils.ts`

### 2. Updated Import Paths

- All tests now import from `src/` directory
- ESBuild configuration updated to use `src/index.ts` as entry point
- TypeScript configuration updated to include `src/` and `tests/` directories

### 3. Scripts Organization

- Build and utility scripts moved to `scripts/` folder
- Updated package.json scripts to reference new locations

### 4. Benefits

- **Better separation of concerns**: Each file has a single responsibility
- **Improved maintainability**: Related functionality is grouped together
- **Standard project structure**: Follows modern JavaScript/TypeScript conventions
- **Easier testing**: Clear separation between source and test code
- **Reusable utilities**: Extracted utilities can be easily imported and tested

## Migration Notes

- All existing functionality is preserved
- Tests continue to pass with updated import paths
- Build process remains unchanged for end users
- No breaking changes to the plugin API

## File Descriptions

### `src/index.ts`
Main plugin entry point containing the Obsidian plugin class and settings UI.

### `src/types.ts`
Central location for all TypeScript interfaces and type definitions used throughout the project.

### `src/settings.ts`
Default configuration values for the plugin.

### `src/metadata-sorter.ts`
Core metadata sorting functionality with functions to sort properties and process frontmatter.

### `src/metadata-auto-inserter.ts`
Integration with MetadataMenu plugin for automatic field insertion and management.

### `src/yaml-utils.ts`
Utilities for parsing and serializing YAML frontmatter with proper error handling.

### `src/field-utils.ts`
Utilities for working with MetadataMenu fields, including validation and default value generation.

## Development Workflow

The development workflow remains the same:

```bash
# Development with watch mode
npm run dev

# Debug mode with source maps
npm run debug

# Production build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```
