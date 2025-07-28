# Tests

This directory contains unit tests for the Obsidian Metadata Properties Sorter plugin.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

- `metadata-sort.test.ts` - Contains unit tests for the core metadata sorting functionality
  - Tests for `sortProperties` function - sorting metadata properties according to specified order
  - Tests for `sortMetadataInContent` function - parsing and sorting YAML frontmatter in markdown files
  - Integration tests with the example.md file

The tests import and test the actual functions from `../metadata-sorter.ts`, ensuring we're testing the real implementation rather than duplicated code.

## Test Framework

The tests use Jest with TypeScript support (`ts-jest`). The test configuration is in `jest.config.js`.

## Code Coverage

Current coverage: **93.93%** of statements, **83.33%** of branches, **100%** of functions

The tests provide comprehensive coverage of the core metadata sorting logic, ensuring reliability and correctness.

## What's Tested

1. **Property Sorting Logic**: Ensures properties are sorted according to the specified order
2. **Unknown Property Handling**: Tests both alphabetical sorting and preservation of original order
3. **YAML Parsing**: Tests parsing and serializing of YAML frontmatter
4. **Error Handling**: Tests behavior with malformed YAML
5. **Content Preservation**: Ensures content after frontmatter is preserved
6. **Date Handling**: Tests that date strings are preserved without unwanted conversion
7. **Integration**: Tests with real example file to ensure end-to-end functionality
