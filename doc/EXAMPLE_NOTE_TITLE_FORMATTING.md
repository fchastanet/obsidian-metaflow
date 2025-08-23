# Note Title Formatting Examples

This document shows examples of how the new `formatNoteTitle` method works with different configurations.

## Template Mode Examples

### Configuration:
```json
{
  "folder": "Books",
  "fileClass": "book",
  "templateMode": "template",
  "noteTitleTemplates": [
    { "template": "{{title}} - {{author}}", "enabled": true },
    { "template": "{{title}}", "enabled": true }
  ]
}
```

### Examples:

**Case 1: All metadata available**
- Metadata: `{ title: "The Great Gatsby", author: "F. Scott Fitzgerald" }`
- Result: `"The Great Gatsby - F. Scott Fitzgerald"`

**Case 2: Missing author**
- Metadata: `{ title: "The Great Gatsby" }`
- Result: `"The Great Gatsby"` (fallback to second template)

**Case 3: No metadata**
- Metadata: `{}`
- Result: `"Untitled"`

**Case 4: Invalid characters**
- Metadata: `{ title: "My/Great\\Book:*?" }`
- Result: `"MyGreatBook"` (sanitized)

## Script Mode Examples

### Configuration:
```json
{
  "folder": "Projects",
  "fileClass": "project",
  "templateMode": "script",
  "noteTitleScript": {
    "script": "if (metadata.status && metadata.title) return metadata.status + ' - ' + metadata.title; return metadata.title || 'New Project';",
    "enabled": true
  }
}
```

### Examples:

**Case 1: Complete metadata**
- Metadata: `{ title: "Website Redesign", status: "In Progress" }`
- Result: `"In Progress - Website Redesign"`

**Case 2: No status**
- Metadata: `{ title: "Website Redesign" }`
- Result: `"Website Redesign"`

**Case 3: No title**
- Metadata: `{ status: "In Progress" }`
- Result: `"New Project"`

**Case 4: Script returns non-string**
- Script: `return 42;`
- Result: `"Untitled"`

**Case 5: Script throws error**
- Script: `throw new Error("test");`
- Result: `"Untitled"`

### More advanced scripts

#### rename book based on bookTitle, date and bookAuthors metadata

```javascript
const title = metadata?.bookTitle || false;
const date = metadata?.date || false;
let authorStr = false;
if (typeof metadata?.bookAuthors === "string") {
  authorStr = metadata?.bookAuthors;
} else if (Array.isArray(metadata?.bookAuthors) && typeof metadata?.bookAuthors?.[0] === "string") {
  authorStr = metadata.bookAuthors[0];
}
let author = false;
if (authorStr) {
  const extractAuthorRegexp = /\[\[(.*\/)?(?<author>.*)\]\]$/
  const arr = extractAuthorRegexp.exec(authorStr);
  author = arr?.groups?.author || false;
}
return [date, title, author].filter(Boolean).join(" - ");
```

with the following metadata
```json
{
  "bookTitle": "The Great Gatsby",
  "date": "1925",
  "bookAuthors": "[[F. Scott Fitzgerald]]"
}
```

it will produce the following title: `1925 - The Great Gatsby - F. Scott Fitzgerald`
if the date is missing, it will produce the following title: `The Great Gatsby - F. Scott Fitzgerald`

## Debug Logging

When `debugMode` is enabled, the following messages are logged:

- `"MetaFlow: No folder mapping found for fileClass 'unknown'"` - When no mapping exists
- `"MetaFlow: Template '{{invalid}}' could not be processed due to missing metadata"` - When template has missing placeholders
- `"MetaFlow: Note title script returned non-string value (number)"` - When script returns wrong type
- `"MetaFlow: Note title script result 'invalid/file:name' is not a valid filename"` - When result needs sanitization

## Error Handling

The method is designed to be robust and will always return a string:
- Returns `"Untitled"` for any error condition
- Logs appropriate debug/error messages
- Never throws exceptions that could break the application
