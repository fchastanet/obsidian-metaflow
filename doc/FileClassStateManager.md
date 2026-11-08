# FileClassStateManager

- [1. Goal](#1-goal)
- [2. Challenges](#2-challenges)
- [3. Current Status](#3-current-status)
  - [3.1. Structures](#31-structures)
  - [3.2. Event Handlers](#32-event-handlers)
  - [3.3. Use Cases](#33-use-cases)
  - [3.4. Edge cases](#34-edge-cases)
  - [3.5. Process](#35-process)
  - [3.6. Solution](#36-solution)
- [4. Implementation](#4-implementation)
  - [4.1. Core Architecture](#41-core-architecture)
    - [4.1.1. Class Structure](#411-class-structure)
    - [4.1.2. Data Structures Enhancement](#412-data-structures-enhancement)
    - [4.1.3. FileState Structure Enhancement](#413-filestate-structure-enhancement)
  - [4.2. Event Handling System](#42-event-handling-system)
    - [4.2.1. Event Registration and Lifecycle](#421-event-registration-and-lifecycle)
    - [4.2.2. Event Handler Implementation](#422-event-handler-implementation)
    - [4.2.3. Enhanced scheduleProcessing Logic](#423-enhanced-scheduleprocessing-logic)
  - [4.3. File Processing Engine](#43-file-processing-engine)
    - [4.3.1. Core Processing Pipeline](#431-core-processing-pipeline)
    - [4.3.2. Checksum Strategy](#432-checksum-strategy)
    - [4.3.3. Conflict Resolution](#433-conflict-resolution)
  - [4.4. Performance Optimizations](#44-performance-optimizations)
    - [4.4.1. Cache Management](#441-cache-management)
    - [4.4.2. Event Optimization](#442-event-optimization)
    - [4.4.3. Memory Management](#443-memory-management)
  - [4.5. Error Handling and Recovery](#45-error-handling-and-recovery)
    - [4.5.1. Error Categories](#451-error-categories)
    - [4.5.2. Recovery Strategies](#452-recovery-strategies)
  - [4.6. Integration Points](#46-integration-points)
    - [4.6.1. Plugin Lifecycle](#461-plugin-lifecycle)
    - [4.6.2. External Plugin Compatibility](#462-external-plugin-compatibility)
  - [4.7. Monitoring and Diagnostics](#47-monitoring-and-diagnostics)
    - [4.7.1. Metrics Collection](#471-metrics-collection)
    - [4.7.2. Debug Support](#472-debug-support)
  - [4.8. Testing Strategy](#48-testing-strategy)
    - [4.8.1. Unit Testing](#481-unit-testing)
    - [4.8.2. Integration Testing](#482-integration-testing)
    - [4.8.3. Edge Case Testing](#483-edge-case-testing)
- [5. Proposed Improvements](#5-proposed-improvements)
  - [5.1. Enhanced Event Filtering](#51-enhanced-event-filtering)
  - [5.2. Advanced Caching Strategy](#52-advanced-caching-strategy)
  - [5.3. User Experience Enhancements](#53-user-experience-enhancements)
  - [5.4. Configuration and Customization](#54-configuration-and-customization)
  - [5.5. Advanced Features](#55-advanced-features)
  - [5.6. Reliability Improvements](#56-reliability-improvements)
  - [5.7. Additional Architectural Improvements](#57-additional-architectural-improvements)
    - [5.7.1. Event-Driven Architecture Enhancements](#571-event-driven-architecture-enhancements)
    - [5.7.2. State Management Optimizations](#572-state-management-optimizations)
    - [5.7.3. Plugin Integration Framework](#573-plugin-integration-framework)
    - [5.7.4. Performance Monitoring and Analytics](#574-performance-monitoring-and-analytics)
    - [5.7.5. Development and Maintenance Tools](#575-development-and-maintenance-tools)
    - [5.7.6. Security and Data Integrity](#576-security-and-data-integrity)
    - [5.7.7. Scalability Considerations](#577-scalability-considerations)
    - [5.7.8. User Experience and Accessibility](#578-user-experience-and-accessibility)
  - [5.8. Implementation Phases](#58-implementation-phases)
    - [5.8.1. Phase 1: Core Foundation](#581-phase-1-core-foundation)
    - [5.8.2. Phase 2: Advanced Event Handling](#582-phase-2-advanced-event-handling)
    - [5.8.3. Phase 3: Performance and Optimization](#583-phase-3-performance-and-optimization)
    - [5.8.4. Phase 4: Integration and Testing](#584-phase-4-integration-and-testing)
    - [5.8.5. Phase 5: Advanced Features and Polish](#585-phase-5-advanced-features-and-polish)
  - [5.9. Success Metrics and Validation](#59-success-metrics-and-validation)
    - [5.9.1. Performance Metrics](#591-performance-metrics)
    - [5.9.2. Reliability Metrics](#592-reliability-metrics)
    - [5.9.3. User Experience Metrics](#593-user-experience-metrics)
- [IA Prompt](#ia-prompt)

## 1. Goal

Ensure that the fileClass of files is always up-to-date with their metadata and title.

## 2. Challenges

- Multiple sources of changes: metadata, title, file location
- Avoiding infinite loops when updating metadata or title
- Handling rapid successive changes (debouncing)
- Ensuring consistency between metadata and fileClass definitions
- Efficiently processing only changed files
- Robust error handling and logging
- Integration with Obsidian's file system events
- Managing state for files being processed, renamed, or deleted
- Handling edge cases like simultaneous events, bulk operations, and external changes
- Maintaining performance with large vaults
- Ensuring compatibility with other plugins that may modify files or metadata
- Providing clear feedback to users when changes are made or errors occur
- Testing and validating the implementation to ensure reliability
- Maintaining a cache of file states to avoid redundant processing
- Ensuring thread safety if applicable (e.g., in multi-threaded environments)
- Handling files that are currently open in the editor versus those that are not

## 3. Current Status

### 3.1. Structures

Structures:

- renamingFiles: Map\<string, string> to track files currently being renamed (by this plugin to avoid processing twice)
  - key: new file path
  - value: old file path
  - the file being renamed by this plugin will be removed from this list at the end of the renaming process
- deletedFiles: Set<string> to track files currently being deleted
  - key: file path
  - if process is run, the file should not be processed and removed from deletedFiles and fileStateCache
- processingFiles: Set<string> to track files currently being processed
  - key: file path
  - if process is run, the file should be removed from processingFiles at the start of the process
- fileStateCache: Map\<string, FileState>
  - key: file path
  - FileState structure
    - checksum: string is a hash of the file title and metadata
    - fileClass: string
    - mtime: number

### 3.2. Event Handlers

handleActiveLeafChange should just compute file state handleMetadataChanged should scheduleProcessing
handleCreateFileEvent should scheduleProcessing handleModifyFileEvent is it needed ? handleDeleteFileEvent should mark
file as deleted so scheduleProcessing will not process anything handleRenameFileEvent

- should skip if the renaming has been triggered by this plugin
- should scheduleProcessing

scheduleProcessing

- should skip if file is in deletedFiles or processingFiles
- should add file to processingFiles
- should debounce the processing (500ms)
- should call process after debounce

### 3.3. Use Cases

- new created file
  - handleMetadataChanged file, data=""
  - handleMetadataChanged file, data="{type: xxx, ...}"
  - handleModifyFileEvent file
- updated file
  - metadata change
    - handleMetadataChanged file, cache={frontmatter: {type: xxx, ...}, ...}, data="..."
    - handleModifyFileEvent file
  - content change
    - handleMetadataChanged file, data="..."
    - handleModifyFileEvent file
  - title change
    - handleRenameFileEvent file, oldPath
- from outside obsidian
  - metadata change
    - handleMetadataChanged file, cache={frontmatter: {type: xxx, ...}, ...}, data="..."
    - handleModifyFileEvent file
- load file or change active view (handleActiveLeafChange)
- deleted file
  - does not seem to be triggered
  - cron to clean deleted files from cache
- renamed file
  - handleRenameFileEvent file, oldPath
- moved file to folder
  - handleRenameFileEvent file, oldPath

Finally handleModifyFileEvent is not needed

### 3.4. Edge cases

- Simultaneous Events: Multiple events (e.g., rename and modify) occurring in quick succession or during processing.
  Mitigation: Ensure debouncing and event queueing are robust.
- Event Overlap: Events that overlap in their effects, such as a file being modified while it's being renamed.
  Mitigation: Use locks or flags to indicate when a file is being processed.
- Vault-wide Operations: Bulk operations like mass rename, move, or delete (e.g., via external scripts or plugins).
  Mitigation: Ensure your cache and event handlers can handle bursts of events.
- File System Sync/External Changes: Files added, removed, or changed outside Obsidian (e.g., via cloud sync or git).
  Mitigation: Rely on Obsidian's events, but consider periodic cache reconciliation.
- FileClass Definition Changes: If a fileClass definition is updated, all files using it may need to be reprocessed.
  Mitigation: Invalidate or update affected cache entries.
- Obsidian Vault Rename/Move: If the entire vault is moved or renamed, paths may change. Mitigation: Usually handled by
  Obsidian, but worth noting for absolute path tracking.

### 3.5. Process

when process is executed, the events that happened during the processing should be ignored

- a solution could be to update the fileStateCache checksum before saving the file

### 3.6. Solution

Handle metadata change event only for file currently edited (activeLeaf).

## 4. Implementation

### 4.1. Core Architecture

#### 4.1.1. Class Structure

- **FileClassStateManager**: Main orchestrator class
- **FileStateCache**: Dedicated cache management with persistence
- **EventDebouncer**: Specialized debouncing mechanism for file events
- **FileProcessor**: Core file processing logic
- **StateValidator**: Checksum calculation and validation utilities

#### 4.1.2. Data Structures Enhancement

- **renamingFiles**: Map\<string, {oldPath: string, timestamp: number}>
  - Add timestamp for cleanup of stale entries
  - Include metadata about the rename operation
- **deletedFiles**: Set<string> with TTL mechanism
  - Automatic cleanup after configurable timeout (default: 5 seconds)
- **processingFiles**: Map\<string, {startTime: number, operation: string}>
  - Track operation type and start time for timeout detection
- **fileStateCache**: Map\<string, FileState> with LRU eviction
  - Add cache size limits and LRU eviction policy
  - Include dirty flag for pending writes
- **pendingEvents**: Queue\<{file: TFile, eventType: string, timestamp: number}>
  - Event queue for burst handling and conflict resolution

#### 4.1.3. FileState Structure Enhancement

```typescript
interface FileState {
  checksum: string;           // Hash of title + metadata + content signature
  fileClass: string;
  mtime: number;
  lastProcessed: number;      // Timestamp of last processing
  version: number;            // Incremental version for conflict detection
  isDirty: boolean;           // Pending changes flag
  processingLock?: {          // Processing lock information
    startTime: number;
    operation: string;
  };
}
```

### 4.2. Event Handling System

#### 4.2.1. Event Registration and Lifecycle

- Register all Obsidian events during plugin load
- Implement graceful event handler cleanup on plugin unload
- Add event handler error recovery and logging

#### 4.2.2. Event Handler Implementation

**handleActiveLeafChange(leaf: WorkspaceLeaf)**

- Immediate processing for active file (no debouncing)
- Update UI indicators if file class changes
- Cache the active file reference for optimized metadata change handling

**handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata)**

- Filter: Only process if file is the active leaf (per solution requirement)
- Skip if file is in deletedFiles or has active processing lock
- Extract metadata and compute preliminary checksum
- Call scheduleProcessing with 'metadata' event type

**handleCreateFileEvent(file: TFile)**

- Mark as new file in processing context
- Schedule processing with 'create' event type
- Initialize cache entry with minimal state

**handleDeleteFileEvent(file: TFile)**

- Add to deletedFiles set with TTL
- Remove from all tracking structures (renamingFiles, processingFiles)
- Mark cache entry for deletion
- Cancel any pending debounced processing for this file

**handleRenameFileEvent(file: TFile, oldPath: string)**

- Check if rename was initiated by this plugin (skip if true)
- Update cache key mapping (oldPath → newPath)
- Transfer all state from old to new path
- Remove old path from all tracking structures
- Schedule processing with 'rename' event type

#### 4.2.3. Enhanced scheduleProcessing Logic

```
scheduleProcessing(file: TFile, eventType: string, priority: 'high' | 'normal' = 'normal')
  1. Validate file existence and accessibility
  2. Skip if file in deletedFiles
  3. Check for existing processing lock with timeout detection
  4. Add to pendingEvents queue with priority and timestamp
  5. Update processingFiles with operation context
  6. Setup debounced processing (100ms for high priority, 500ms for normal)
  7. Implement burst detection and queue management
```

### 4.3. File Processing Engine

#### 4.3.1. Core Processing Pipeline

```
process(file: TFile, eventContext: EventContext)
  1. Pre-processing validation
     - Verify file still exists
     - Check processing lock and resolve conflicts
     - Remove from processingFiles at start

  2. State computation
     - Calculate current checksum (title + metadata + content signature)
     - Determine target fileClass based on metadata and rules
     - Compare with cached state

  3. Change detection and processing
     - Skip if no changes detected (checksum match)
     - Update fileStateCache with new checksum BEFORE making changes
     - Apply fileClass updates (metadata, title, location)
     - Handle processing errors with rollback capability

  4. Post-processing cleanup
     - Update cache with final state
     - Remove from all tracking structures
     - Log processing results
     - Trigger UI updates if necessary
```

#### 4.3.2. Checksum Strategy

- **Metadata Hash**: JSON.stringify(frontmatter) + file.basename
- **Content Signature**: Hash of first/last N characters + file size + mtime
- **Combined Checksum**: SHA-256 of metadata hash + content signature
- **Optimization**: Cache intermediate hashes to avoid recomputation

#### 4.3.3. Conflict Resolution

- **Processing Lock**: Prevent simultaneous processing of same file
- **Version Control**: Use version numbers to detect concurrent modifications
- **Retry Mechanism**: Exponential backoff for failed operations
- **Rollback Support**: Maintain previous state for error recovery

### 4.4. Performance Optimizations

#### 4.4.1. Cache Management

- **LRU Eviction**: Limit cache size (default: 1000 files)
- **Batch Operations**: Group multiple file updates when possible
- **Lazy Loading**: Load cache entries on demand
- **Periodic Cleanup**: Remove stale entries and validate consistency

#### 4.4.2. Event Optimization

- **Event Coalescing**: Merge similar events for same file
- **Priority Queue**: Process active file changes before background operations
- **Batch Processing**: Handle multiple files in single operation when possible
- **Smart Debouncing**: Adaptive debounce timing based on event frequency

#### 4.4.3. Memory Management

- **Weak References**: Use weak references where appropriate
- **Event Cleanup**: Automatic cleanup of completed event handlers
- **Cache Persistence**: Save/restore cache across plugin restarts

### 4.5. Error Handling and Recovery

#### 4.5.1. Error Categories

- **File System Errors**: Handle file access, permission, and I/O errors
- **Processing Errors**: Recover from fileClass computation failures
- **Concurrency Errors**: Resolve conflicts from simultaneous operations
- **Plugin Integration Errors**: Handle failures in external plugin interactions

#### 4.5.2. Recovery Strategies

- **Graceful Degradation**: Continue operation with reduced functionality on errors
- **Automatic Retry**: Retry failed operations with exponential backoff
- **State Reconciliation**: Periodic validation and correction of cache state
- **User Notification**: Clear error reporting through LogNoticeManager

### 4.6. Integration Points

#### 4.6.1. Plugin Lifecycle

- **Initialization**: Load persisted cache, register event handlers
- **Shutdown**: Persist cache, cleanup event handlers, complete pending operations
- **Settings Changes**: Invalidate affected cache entries, reprocess if needed

#### 4.6.2. External Plugin Compatibility

- **Event Priority**: Ensure proper event ordering with other plugins
- **State Sharing**: Minimal shared state to avoid conflicts
- **API Boundaries**: Clear interfaces for external plugin integration

### 4.7. Monitoring and Diagnostics

#### 4.7.1. Metrics Collection

- **Performance Metrics**: Processing times, cache hit rates, event frequencies
- **Error Tracking**: Error counts, types, and recovery success rates
- **State Monitoring**: Cache size, pending operations, processing queue depth

#### 4.7.2. Debug Support

- **Detailed Logging**: Configurable log levels for troubleshooting
- **State Inspection**: Commands to inspect cache and processing state
- **Event Tracing**: Track event flow for debugging complex scenarios

### 4.8. Testing Strategy

#### 4.8.1. Unit Testing

- **State Management**: Test cache operations, checksum calculation
- **Event Handling**: Mock Obsidian events, test event processing logic
- **Error Scenarios**: Test error handling and recovery mechanisms

#### 4.8.2. Integration Testing

- **File Operations**: Test with real file system operations
- **Plugin Interactions**: Test compatibility with other plugins
- **Performance Testing**: Stress test with large vaults and high event frequency

#### 4.8.3. Edge Case Testing

- **Concurrent Operations**: Test simultaneous file modifications
- **Bulk Operations**: Test mass file operations and imports
- **External Changes**: Test handling of external file system changes

## 5. Proposed Improvements

### 5.1. Enhanced Event Filtering

- **Smart Event Detection**: Use file content analysis to determine if processing is actually needed
- **Metadata-Only Changes**: Optimize processing for metadata-only modifications
- **Content Change Detection**: Implement more sophisticated content change detection beyond mtime

### 5.2. Advanced Caching Strategy

- **Hierarchical Caching**: Cache at folder level for bulk operations
- **Predictive Caching**: Pre-load related files based on usage patterns
- **Cache Warming**: Background cache updates during idle periods

### 5.3. User Experience Enhancements

- **Progress Indicators**: Show processing progress for large operations
- **Conflict Resolution UI**: Interactive resolution for processing conflicts
- **Performance Dashboard**: Real-time monitoring of system performance

### 5.4. Configuration and Customization

- **Processing Rules Engine**: Configurable rules for file class determination
- **Event Filtering**: User-configurable event filtering and processing rules
- **Performance Tuning**: Adjustable debounce timings and cache sizes

### 5.5. Advanced Features

- **Undo/Redo Support**: Track changes for undo/redo functionality
- **Batch Processing Commands**: Manual commands for bulk file processing
- **Export/Import**: Cache and configuration export/import for backup/sharing

### 5.6. Reliability Improvements

- **Health Checks**: Periodic system health validation
- **Self-Healing**: Automatic detection and correction of inconsistent states
- **Graceful Degradation**: Fallback modes for various error conditions

### 5.7. Additional Architectural Improvements

#### 5.7.1. Event-Driven Architecture Enhancements

- **Event Bus Pattern**: Implement a centralized event bus for better decoupling
- **Event Middleware**: Add middleware for event transformation and filtering
- **Event Replay**: Capability to replay events for debugging and recovery

#### 5.7.2. State Management Optimizations

- **Immutable State**: Use immutable data structures for better concurrency
- **State Snapshots**: Create periodic snapshots for quick recovery
- **Delta Updates**: Track only changes rather than full state updates

#### 5.7.3. Plugin Integration Framework

- **Plugin API**: Well-defined API for other plugins to integrate with FileClassStateManager
- **Event Hooks**: Extensible hook system for custom processing logic
- **Configuration Schema**: Structured configuration validation and migration

#### 5.7.4. Performance Monitoring and Analytics

- **Real-time Metrics**: Live performance monitoring dashboard
- **Resource Usage Tracking**: Monitor memory and CPU usage patterns
- **Bottleneck Detection**: Automatic identification of performance bottlenecks
- **Usage Analytics**: Track feature usage and optimization opportunities

#### 5.7.5. Development and Maintenance Tools

- **Debug Console**: Interactive debugging interface for development
- **State Visualization**: Visual representation of cache and processing state
- **Performance Profiler**: Built-in profiling tools for optimization
- **Migration Tools**: Automated migration for schema changes

#### 5.7.6. Security and Data Integrity

- **Data Validation**: Comprehensive input validation and sanitization
- **Integrity Checks**: Regular validation of cache consistency
- **Secure Operations**: Safe file operations with proper error handling
- **Privacy Protection**: Minimal data exposure and secure logging

#### 5.7.7. Scalability Considerations

- **Horizontal Scaling**: Design for potential distributed processing
- **Resource Pooling**: Efficient resource management and pooling
- **Load Balancing**: Distribute processing load across available resources
- **Memory Optimization**: Efficient memory usage for large vaults

#### 5.7.8. User Experience and Accessibility

- **Progressive Enhancement**: Graceful feature degradation for older systems
- **Accessibility Support**: Screen reader and keyboard navigation support
- **Internationalization**: Multi-language support for error messages and UI
- **Theme Integration**: Proper integration with Obsidian themes and styling

### 5.8. Implementation Phases

#### 5.8.1. Phase 1: Core Foundation

- Implement basic data structures and cache management
- Set up event registration and basic event handlers
- Create fundamental file processing pipeline
- Establish error handling framework

#### 5.8.2. Phase 2: Advanced Event Handling

- Implement sophisticated debouncing and event coalescing
- Add conflict resolution and processing locks
- Create comprehensive state management
- Build retry and recovery mechanisms

#### 5.8.3. Phase 3: Performance and Optimization

- Implement caching strategies and LRU eviction
- Add performance monitoring and metrics
- Optimize memory usage and resource management
- Create batch processing capabilities

#### 5.8.4. Phase 4: Integration and Testing

- Comprehensive unit and integration testing
- Plugin compatibility testing
- Performance benchmarking and optimization
- Documentation and user guides

#### 5.8.5. Phase 5: Advanced Features and Polish

- Implement advanced debugging and monitoring tools
- Add user experience enhancements
- Create configuration and customization options
- Final testing and release preparation

### 5.9. Success Metrics and Validation

#### 5.9.1. Performance Metrics

- **Processing Time**: Average file processing time < 50ms
- **Cache Hit Rate**: Cache hit rate > 90%
- **Memory Usage**: Memory overhead < 10MB for 1000 files
- **Event Processing**: Event queue processing latency < 100ms

#### 5.9.2. Reliability Metrics

- **Error Rate**: Processing error rate < 0.1%
- **Recovery Success**: Automatic error recovery rate > 95%
- **Data Consistency**: Cache consistency validation > 99.9%
- **Plugin Compatibility**: Zero conflicts with top 20 plugins

#### 5.9.3. User Experience Metrics

- **Response Time**: UI responsiveness < 100ms for user actions
- **Resource Impact**: CPU usage spike < 10% during normal operations
- **Error Handling**: Clear error messages and recovery guidance
- **Documentation**: Comprehensive API and user documentation

## IA Prompt

Write a complete set of unit tests for the FileClassStateManager class (not the one existing, but the one described in
this document), covering all methods and edge cases. Use Jest testing framework, and include mock objects for
dependencies such as Obsidian's file system events. Ensure that the tests validate the correct behavior of event
handling, state management, error handling, and performance optimizations. Include tests for:

- Event handling methods (handleActiveLeafChange, handleMetadataChanged, handleCreateFileEvent, handleDeleteFileEvent,
  handleRenameFileEvent)
- scheduleProcessing method with debouncing and priority handling
- process method with state computation, change detection, and error handling
- Cache management and eviction policies
- Mocking Obsidian's file system events and dependencies
- re-implement completely the FileClassStateManager class and all dependencies.
