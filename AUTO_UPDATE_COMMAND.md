# Auto Update Metadata Fields Command

## Overview

The "Auto Update metadata fields" command is a comprehensive solution for automatically managing metadata in Obsidian notes. It integrates with MetadataMenu and optionally with Templater to provide intelligent field insertion and default value generation.

## Features

### 📁 Folder/FileClass Mapping

- **Purpose**: Automatically determine the correct MetadataMenu fileClass based on file location
- **How it works**: Similar to Templater's folder template mapping
- **Configuration**: Define patterns (glob or regex) that map folder paths to fileClasses
- **Fallback**: Uses `.*` pattern as a catch-all for unmatched files

#### Example Configuration:

```text
Books/**     → book
Articles/**  → article
Notes/*      → note
.*           → default  (fallback)
```

### 🔧 Property Default Value Scripts

- **Purpose**: Generate intelligent default values for metadata properties
- **Language**: JavaScript with access to context variables and utility functions
- **Execution**: Only runs for missing properties (won't overwrite existing values)

#### Available Context Variables:

- `fileClass` - The determined fileClass name
- `file` - The TFile object being processed
- `metadata` - Current frontmatter metadata

#### Available Utility Functions:

- `prompt(message, defaultValue)` - Ask user for input
- `date` - Templater-style date functions (if Templater integration enabled)
- `generateMarkdownLink(file)` - Create markdown links to other files
- `detectLanguage(text)` - Basic language detection

#### Example Scripts:

```javascript
// Auto-generate creation date
return new Date().toISOString();

// Use file name as title
return file.basename;

// Prompt user with intelligent default
return await prompt("Enter author", "Unknown Author");

// Language detection from content
const content = await app.vault.read(file);
return detectLanguage(content);
```

## Command Algorithm

### When Triggered:

1. Manual execution: "Auto Update metadata fields" command
2. File creation: First time a file is created (future enhancement)

### Execution Steps

1. **✅ Dependency Check**
   - Verify MetadataMenu plugin is available
   - Verify Templater plugin is available (if integration enabled)

2. **🔍 FileClass Determination**
   - Check for existing `fileClass` property in frontmatter
   - If missing, deduce from folder/fileClass mapping
   - Validate fileClass exists in MetadataMenu settings

3. **📝 Field Insertion**
   - Use MetadataMenu API to insert missing fields
   - Process fileClass ancestor chain (e.g., book → default → default-basic)
   - Insert fields in correct order: most basic ancestor → most specific

4. **💡 Default Value Generation**
   - Execute property default value scripts for missing properties
   - Skip properties that already have values
   - Handle script errors gracefully

5. **💾 File Update**
   - Save the enriched metadata back to the file
   - Preserve existing content and formatting

## Settings Configuration

### Folder/FileClass Mappings

- **Pattern Types**: Glob patterns or regular expressions
- **Evaluation Order**: First match wins
- **Pattern Examples**:
  - `Books/*` - Files directly in Books folder
  - `Books/**` - Files anywhere under Books folder
  - `.*\.md$` - All markdown files (regex)

### Property Default Value Scripts

- **Per-Property**: Each property can have its own script
- **Enable/Disable**: Scripts can be individually enabled/disabled
- **Error Handling**: Script errors don't stop the overall process

### Templater Integration

- **Optional**: Can be enabled/disabled independently
- **Consistency Check**: Validates that folder mappings align with Templater settings
- **Extended Functions**: Provides access to Templater's date and utility functions

## Error Handling

The command handles various error scenarios gracefully:

- **Missing Dependencies**: Clear error messages if required plugins aren't available
- **Invalid FileClass**: Validation against MetadataMenu settings
- **Script Errors**: Individual script failures don't affect other properties
- **File Access**: Handles file read/write permissions issues

## Integration Benefits

### MetadataMenu Integration

- **Ancestor Support**: Properly handles fileClass inheritance chains
- **Field Validation**: Uses MetadataMenu's field definitions and constraints
- **API Compatibility**: Works with MetadataMenu's native field insertion

### Templater Integration (Optional)

- **Consistency Validation**: Ensures folder mappings align between plugins
- **Extended Scripting**: Access to Templater's powerful function library
- **Template Compatibility**: Works alongside existing Templater workflows

## Usage Examples

### Basic Setup

1. Configure folder mappings in plugin settings
2. Set up property scripts for common fields (created, title, author)
3. Run "Auto Update metadata fields" on any note

### Advanced Workflow

1. Create folder structure: Books/, Articles/, Notes/
2. Map each folder to appropriate fileClass
3. Configure scripts for:
   - `created`: Auto-timestamp
   - `title`: File basename with formatting
   - `author`: Prompt with smart defaults
   - `language`: Auto-detect from content

### Result

Every note gets properly classified metadata with intelligent defaults, reducing manual data entry while maintaining consistency across your vault.

## Technical Implementation

### Core Components

- **`AutoUpdateCommand`**: Main command orchestration
- **Pattern Matching**: Glob and regex support for folder mapping
- **Script Execution**: Safe JavaScript execution with sandboxed context
- **Error Recovery**: Graceful handling of edge cases

### Performance Considerations

- **Lazy Evaluation**: Scripts only execute for missing properties
- **Caching**: FileClass definitions are cached during execution
- **Atomic Updates**: File changes are applied atomically

### Security

- **Sandboxed Execution**: Scripts run in controlled environment
- **Input Validation**: All user inputs are validated
- **Error Containment**: Script failures are isolated

## Future Enhancements

- **Automatic Triggers**: Run on file creation, folder moves
- **Template Integration**: Deeper integration with note templates
- **Batch Processing**: Process multiple files simultaneously
- **Custom Functions**: User-defined utility functions for scripts
- **Conflict Resolution**: Smart handling of conflicting metadata
