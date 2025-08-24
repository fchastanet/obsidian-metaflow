# Title Template and Script Linter Implementation

## Overview

The Linting system for title templates and scripts takes place in the `FolderFileClassMappingsSection.ts` file.
This implementation provides real-time validation feedback to help users create valid templates and scripts, **using Acorn parser for robust JavaScript analysis**.

## Architecture

The linting system is organized into focused classes for maintainability and performance:

1. **`ValidationResult`** - Interface defining validation feedback structure
2. **`ScriptASTParser`** - Centralized AST parsing with caching
3. **`ScriptSyntaxValidator`** - JavaScript syntax validation
4. **`ScriptSecurityAnalyzer`** - Security vulnerability detection
5. **`ScriptReturnAnalyzer`** - Return statement and execution path analysis
6. **`ScriptBestPracticesChecker`** - Code quality warnings
7. **`TitleScriptLinter`** - Main coordinator class
8. **`TitleTemplateLinter`** - Template string validation

## Key Features

### Template Validation
- Empty template detection
- Balanced braces validation (`{}`, `[]`, `()`)
- Valid variable name validation (e.g., `{{title}}`, `{{metadata.date}}`)
- Warning for problematic file system characters
- Warning for single braces (suggesting double braces)
- Warning for very long templates

### Script Validation
- Empty script detection
- Return statement requirement (AST-based detection)
- Execution path analysis: ensures all code branches return a value
- String return type validation: verifies all returns produce strings
- Acorn-based JavaScript syntax validation
- AST-based security analysis (detects `eval()`, `Function()`, `setTimeout()`, etc.)
- AST-based best practice warnings (console statements, string return type detection)
- Intelligent script fragment handling (wraps fragments in functions for parsing)

## Performance Optimization

- **AST Caching**: Scripts are parsed only once and cached for reuse
- **Shared Parser**: All validation components share the same AST parser instance

## Extensibility

- Easy to add new validation components
- Plug-in architecture for validation rules
- Reusable components for other script validation needs

## File Structure

```
src/settings/sections/
├── TitleTemplateLinter.ts                  # Single class that manages template linting
├── TitleScriptLinter.ts                    # Script linter coordinator class
└── script-validation/
    ├── index.ts                            # Barrel export file
    ├── ValidationResult.ts                 # Validation result interface
    ├── ScriptASTParser.ts                  # AST parsing with caching
    ├── ScriptSyntaxValidator.ts            # Syntax validation
    ├── ScriptSecurityAnalyzer.ts           # Security analysis
    ├── ScriptReturnAnalyzer.ts             # Return statement analysis
    └── ScriptBestPracticesChecker.ts       # Best practices checking
```

## Usage

The public API remains unchanged. The `TitleScriptLinter` class can be used as follows:

```typescript
import { TitleScriptLinter } from './TitleScriptLinter';

const linter = new TitleScriptLinter();
const result = linter.validateScript('return "Hello World";');

if (result.isValid) {
  console.log('Script is valid');
} else {
  console.error('Validation error:', result.message);
}

// Cache management
linter.clearCache();         // Clear AST cache
console.log(linter.getCacheSize()); // Get cache size
```

## Integration with FolderFileClassMappingsSection

### Template Input Enhancement
- Real-time validation feedback for template inputs
- Validation messages appear below each template input field
- Color-coded feedback (green for success, yellow for warnings, red for errors)

### Script Editor Enhancement
- Validation feedback for the script editor
- Validation occurs with a 500ms delay to avoid excessive updates
- Feedback appears in a dedicated validation container

### UI Components
Helper methods:
- `createValidationFeedback()`: Creates styled feedback elements
- `updateValidationFeedback()`: Updates validation state for inputs

## Styling

CSS Classes:
```css
.metaflow-validation-feedback - Base feedback container
.metaflow-validation-success - Success state styling
.metaflow-validation-warning - Warning state styling
.metaflow-validation-error - Error state styling
.metaflow-validation-icon - Icon styling
.metaflow-validation-message - Message text styling
.metaflow-settings-template-input-container - Template input wrapper
.metaflow-script-validation-container - Script validation container
```

## User Experience Improvements

### Real-time Feedback
- Immediate validation results as users type
- Clear, actionable error messages
- Visual indicators (✅, ⚠️, ❌) for instant status recognition

### Template Validation Examples
- ✅ `{{title}} - {{author}}` - Valid template
- ⚠️ `{title} - {{author}}` - Warning about single braces
- ❌ `{{title} - {{author}}` - Error: unbalanced braces
- ❌ `{{}} - {{author}}` - Error: empty variable

### Script Validation Examples
- ✅ `return file.basename + " - " + metadata.date;` - Valid script
- ✅ `if (metadata.title) { return metadata.title; } else { return file.basename; }` - All branches return
- ⚠️ `console.log("debug"); return file.basename;` - Warning about console
- ❌ `const title = "test";` - Error: missing return statement
- ❌ `if (test) { return "yes"; }` - Error: missing return in else branch
- ❌ `return eval("file.basename");` - Error: security issue
- ❌ `return 42;` - Error: non-string return value

## Technical Implementation Details

### Acorn Integration
- **AST-based parsing** instead of fragile regex patterns
- **Intelligent fragment handling** - wraps script fragments in functions for valid parsing
- **Execution path analysis** - verifies all code branches return string values
- **Comprehensive flow control** - handles if/else, switch/case, try/catch, loops
- **Accurate syntax validation** with detailed error messages
- **Security analysis** through AST traversal
- **Smart string detection** using AST pattern analysis
- **Fallback to regex** when AST parsing fails

### ValidationResult Interface
```typescript
interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'error' | 'warning' | 'success';
}
```

### Security Features
AST-based security analysis prevents:
- Code injection via `eval()`
- Dynamic function creation (`Function()`, `new Function()`)
- Timer functions (`setTimeout`, `setInterval`)
- Access to system resources via `require()` or dynamic `import()`
- Accurate detection through proper code parsing

### Performance Considerations
- AST parsing with graceful fallback to regex
- Validation is debounced for script editing (500ms delay)
- Intelligent fragment handling
- Efficient AST traversal for security and pattern analysis
- Lightweight parsing using Acorn

## Testing

Comprehensive unit tests for each component:

### Test Coverage
- **ValidationResult.test.ts**: Interface structure, type constraints, serialization
- **ScriptASTParser.test.ts**: Parsing, caching, error handling, edge cases
- **ScriptSyntaxValidator.test.ts**: Valid/invalid syntax, error messages, edge cases
- **ScriptSecurityAnalyzer.test.ts**: Security pattern detection, AST vs regex fallback
- **ScriptReturnAnalyzer.test.ts**: Return detection, execution path analysis, string type checking
- **ScriptBestPracticesChecker.test.ts**: Console warnings, string return warnings, script length
- **ScriptValidationComponents.test.ts**: Individual component integration
- **TitleScriptLinter.integration.test.ts**: Full system integration and regression tests

## Benefits

1. **Improved User Experience**: Immediate feedback helps users create valid templates/scripts
2. **Error Prevention**: Catches common mistakes before they cause runtime issues
3. **Security**: Prevents potentially dangerous script patterns
4. **Maintainability**: Centralized validation logic in dedicated, well-tested classes
5. **Accessibility**: Clear, descriptive error messages help users of all skill levels

## Future Enhancements

Potential improvements:
- Syntax highlighting for template variables
- Template preview functionality
- More sophisticated script analysis

## Limitations

- May not catch all edge cases, especially in complex scripts
- Assumes variables are always strings
- Performance may degrade with very large scripts or templates
- Some JavaScript features (e.g., dynamic imports) may not be fully supported
