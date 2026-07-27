# commit message guidelines

Generate a markdown commit message.

Title: concise summary (50-72 characters) Add a blank line after the title Next paragraph: summary of all relevant
changes (100-200 characters) Use section headers for big features, each with a relevant emoji (e.g. ✨ for features, 🔧
for refactoring, 🖥️ for UI, 🐛 for bug fixes, etc.) Use bullet points for detailed changes under each section Group
related changes together Mention file names when appropriate Explain the "why" behind significant changes Reference
issue numbers with #123 if applicable Make the message clear, concise, and easy to understand Follow the formatting and
emoji usage shown in the example below:

```markdown
# ✨🔧 Automatic Note Renaming Based on Rules

Automatic note renaming based on rules (script or template) is now supported. The codebase is fully migrated to dependency injection, with major service refactoring and accessibility improvements for maintainability and testability.

## ✨ Automatic Note Renaming Feature
- Implement automatic note renaming for notes based on configurable rules (script or title templates).
- Add `renameNote` method in MetaFlowService to handle renaming logic.
...

## 🔧 Dependency Injection & Service Refactoring
- Migrate all core services and commands to dependency injection using InversifyJS.
...

## 🛠️ Command System Overhaul
...

## 🖥️ UI & Settings Improvements
...

## 🔧 Drag and Drop Refactoring
...

## 🛡️ Title Script & Template Linter Refactoring
...

## 🐛 Bug Fixes & Technical Debt Reduction
...

## 📊 Metrics & Results
...

## 🚀 Benefits
...
```

Do not include any explanations or additional text.
