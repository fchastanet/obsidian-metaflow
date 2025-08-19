# Title Template Linter Implementation

## Overview

I've successfully implemented a comprehensive linting system for title templates and scripts in the `FolderFileClassMappingsSection.ts` file. This implementation provides real-time validation feedback to help users create valid templates and scripts, **using Acorn parser for robust JavaScript analysis**.

## New Files Created

### 1. `TitleTemplateLinter.ts`
A dedicated class that provides validation for both template strings and JavaScript scripts used for note title generation.

**Key Features:**
- **Template Validation**: Validates template syntax, variable names, and brace balance
- **Script Validation**: Uses **Acorn AST parser** for accurate JavaScript analysis
- **User-Friendly Feedback**: Returns structured validation results with clear messages
- **Security Analysis**: AST-based detection of dangerous patterns
- **Performance Optimized**: Falls back to regex when AST parsing fails

**Template Validation Checks:**
- Empty template detection
- Balanced braces validation (supporting `{}`, `[]`, `()`)
- Valid variable name validation (e.g., `{{title}}`, `{{metadata.date}}`)
- Warning for problematic file system characters
- Warning for single braces (suggesting double braces)
- Warning for very long templates

**Script Validation Checks:**
- Empty script detection
- Return statement requirement (AST-based detection)
- **Execution path analysis** - ensures all code branches return a value
- **String return type validation** - verifies all returns produce strings
- **Acorn-based JavaScript syntax validation** (more accurate than regex)
- **AST-based security analysis** (detects `eval()`, `Function()`, `setTimeout()`, etc.)
- **AST-based best practice warnings** (console statements, string return type detection)
- Intelligent script fragment handling (wraps fragments in functions for parsing)

### 2. `TitleTemplateLinter.test.ts`
Comprehensive unit tests covering all validation scenarios including:
- Edge cases (empty inputs, malformed syntax)
- Security validation (dangerous functions)
- Warning conditions (best practices)
- Valid input acceptance

## Integration with FolderFileClassMappingsSection

### Template Input Enhancement
- Added real-time validation feedback for template inputs
- Validation messages appear below each template input field
- Color-coded feedback (green for success, yellow for warnings, red for errors)

### Script Editor Enhancement
- Added validation feedback for the script editor
- Validation occurs with a 500ms delay to avoid excessive updates
- Feedback appears in a dedicated validation container

### UI Components
Added helper methods:
- `createValidationFeedback()`: Creates styled feedback elements
- `updateValidationFeedback()`: Updates validation state for inputs

## Styling

### CSS Classes Added to `styles.css`
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
- Users see immediate validation results as they type
- Clear, actionable error messages help users fix issues quickly
- Visual indicators (✅, ⚠️, ❌) provide instant status recognition

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
The linter uses **Acorn parser** for robust JavaScript analysis:
- **AST-based parsing** instead of fragile regex patterns
- **Intelligent fragment handling** - wraps script fragments in functions for valid parsing
- **Execution path analysis** - verifies all code branches return string values
- **Comprehensive flow control** - handles if/else, switch/case, try/catch, loops
- **Accurate syntax validation** with detailed error messages
- **Security analysis** through AST traversal
- **Smart string detection** using AST pattern analysis
- **Fallback to regex** when AST parsing fails (graceful degradation)

### ValidationResult Interface
```typescript
interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'error' | 'warning' | 'success';
}
```

### Security Features
The linter includes **AST-based security analysis** to prevent:
- Code injection via `eval()` (detected through AST traversal)
- Dynamic function creation (`Function()`, `new Function()`)
- Timer functions that could cause performance issues (`setTimeout`, `setInterval`)
- Access to system resources via `require()` or dynamic `import()`
- **More accurate detection** than regex patterns through proper code parsing

### Performance Considerations
- **AST parsing** with graceful fallback to regex for robustness
- Validation is debounced for script editing (500ms delay)
- **Intelligent fragment handling** - scripts don't need to be complete programs
- Efficient AST traversal for security and pattern analysis
- **Lightweight parsing** using Acorn (already included in project dependencies)

## Benefits

1. **Improved User Experience**: Immediate feedback helps users create valid templates/scripts
2. **Error Prevention**: Catches common mistakes before they cause runtime issues
3. **Security**: Prevents potentially dangerous script patterns
4. **Maintainability**: Centralized validation logic in a dedicated, well-tested class
5. **Accessibility**: Clear, descriptive error messages help users of all skill levels

## Future Enhancements

Potential improvements that could be added:
- Syntax highlighting for template variables
- Auto-completion for available metadata fields
- Template preview functionality
- More sophisticated script analysis
- Integration with TypeScript for better script validation

## Testing

The implementation includes comprehensive unit tests that cover:
- All validation scenarios
- Edge cases and error conditions
- Security validation
- Performance considerations
- User experience flows

To run the tests:
```bash
npm test -- TitleTemplateLinter.test.ts
```

This implementation significantly improves the user experience by providing immediate, helpful feedback for template and script creation while maintaining security and performance standards.
