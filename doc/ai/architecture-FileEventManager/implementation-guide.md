# FileEventManager Implementation Guide

## Quick Start

This guide provides practical implementation steps for the FileEventManager architecture.

### 1. Create Folder Structure

```bash
mkdir -p src/eventManager/{core,processors,cache,metrics,types}
```

### 2. Core Implementation Order

1. **Data Types & Interfaces** (`src/eventManager/types/`)
2. **Core Components** (`src/eventManager/core/`)
3. **Processing Engine** (`src/eventManager/processors/`)
4. **Cache & Metrics** (`src/eventManager/cache/`, `src/eventManager/metrics/`)
5. **Integration Layer** (`src/eventManager/integration/`)

### 3. Key Implementation Files

```typescript
// src/eventManager/types/index.ts
export interface FileEvent { /* ... */ }
export interface FileState { /* ... */ }
export interface ProcessingRule { /* ... */ }

// src/eventManager/core/FileEventManager.ts
export class FileEventManager { /* ... */ }

// src/eventManager/core/FileEventQueue.ts
export class FileEventQueue { /* ... */ }

// src/eventManager/processors/FileEventProcessor.ts
export class FileEventProcessor { /* ... */ }
```

### 4. Testing Strategy

```typescript
// __tests__/eventManager/
describe('FileEventManager', () => {
  // Unit tests for core functionality
});

describe('FileEventManager Integration', () => {
  // Integration tests with mocked Obsidian APIs
});
```

### 5. Migration Checklist

- [ ] Implement core classes
- [ ] Create comprehensive test suite
- [ ] Add performance benchmarks
- [ ] Create compatibility layer
- [ ] Document migration process
- [ ] Validate with existing codebase

## Design Decisions

### Algorithm Choice: Checksum-Based Filtering

**Rationale:** Chosen for deterministic behavior and simplicity over transaction-based approach.

**Benefits:**

- No complex timing dependencies
- Easy to test and debug
- Natural loop prevention mechanism

**Implementation:**

```typescript
// Update checksum BEFORE processing to prevent self-generated events
async processFile(file: TFile): Promise<void> {
  const newChecksum = await this.calculateChecksum(file);
  this.cache.updateChecksum(file.path, newChecksum); // Critical: update FIRST
  await this.applyChanges(file);
}
```

### Event Collapsing Strategy

**Priority Order:**

1. DELETE events → Skip all processing
2. MODIFY + RENAME → Process RENAME only
3. Plugin-generated batch → Ignore entire batch
4. Default → Process all events

### Performance Optimizations Applied

1. **LRU Cache** with configurable eviction
2. **Adaptive Debouncing** based on queue depth
3. **Burst Detection** for high-frequency events
4. **Batch Processing** to reduce overhead

## Common Pitfalls & Solutions

### Pitfall 1: Race Conditions

**Problem:** Multiple events for same file processed simultaneously **Solution:** ProcessingLockManager with
timeout-based cleanup

### Pitfall 2: Cache Overflow

**Problem:** Unbounded cache growth in large vaults **Solution:** LRU eviction with configurable size limits

### Pitfall 3: Event Loop Detection

**Problem:** Plugin modifications triggering new events **Solution:** Pre-update checksum calculation breaks loops
deterministically

## Extension Examples

### Custom Processing Rule

```typescript
class SkipLargeFilesRule implements ProcessingRule {
  name = 'skip_large_files';
  priority = 100;

  condition(events: FileEventHistory, context: ProcessingContext): boolean {
    const file = context.getFile(events.filePath);
    return file?.size > 1024 * 1024; // 1MB limit
  }

  action = ProcessingAction.SKIP;
}
```

### Custom Event Filter

```typescript
class MarkdownOnlyFilter implements EventFilter {
  shouldProcess(event: FileEvent, context: FilterContext): boolean {
    return context.filePath.endsWith('.md');
  }
}
```

## Monitoring & Debugging

### Key Metrics to Track

- Processing time per file
- Cache hit rate
- Event queue depth
- Error rate by category
- Lock acquisition failures

### Debug Commands

```typescript
// Add to FileEventManager for debugging
getDebugInfo(): DebugInfo {
  return {
    queueDepth: this.eventQueue.getSize(),
    activeLocks: this.lockManager.getActiveLocks(),
    cacheStats: this.cache.getStats(),
    recentErrors: this.getRecentErrors()
  };
}
```
