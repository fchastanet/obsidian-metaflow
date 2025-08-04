# Obsidian MetaFlow

An advanced metadata workflow automation plugin for Obsidian that streamlines frontmatter management through intelligent sorting, automatic field insertion, and customizable default value scripts.

## ✨ Features

- **Automated Metadata Workflow**: Streamline your note metadata management
- **Smart Field Insertion**: Automatically insert missing fields based on MetadataMenu fileClass definitions
- **Custom Default Values**: Execute JavaScript scripts to generate dynamic default values
- **Template Integration**: Seamless integration with Templater plugin for folder-based workflows
- **Intelligent Sorting**: Sort frontmatter properties in your preferred order
- **Folder Mapping**: Automatically assign fileClasses based on folder patterns

## 🚀 Commands

### Update metadata properties

Single command that handles the complete metadata workflow:

- Determines fileClass from folder mapping or existing frontmatter
- Inserts missing metadata fields using MetadataMenu definitions
- Executes custom scripts to populate default values
- Sorts properties according to your configuration

### Mass-update metadata properties

Applies the metadata workflow to all files in your vault:

- Processes all markdown files in the vault
- Shows progress notifications during processing
- Provides completion summary with update count

## ⚙️ Settings

### Folder/FileClass Mapping

Map folder patterns to MetadataMenu fileClasses, similar to Templater's folder template system:

- Support for glob patterns (`Books/.*`) and regex patterns
- First-match-wins evaluation with fallback support
- Auto-population from existing Templater folder mappings
- Validation against MetadataMenu fileClass definitions

### Property Default Value Scripts

Create JavaScript scripts to generate dynamic default values:

- **Context Variables**: Access to `fileClass`, `file`, and `metadata`
- **Utility Functions**: Built-in `prompt`, `date`, `generateMarkdownLink`, and `detectLanguage`
- **Property Ordering**: Control execution order of scripts
- **Selective Execution**: Enable/disable scripts per property
- **Auto-Population**: Import properties from MetadataMenu definitions

### Integration Settings

- **MetadataMenu Integration**: Enable/disable MetadataMenu field insertion
- **Templater Integration**: Optional integration with Templater plugin
- **Property Sorting**: Customize the order of frontmatter properties

## 📁 Project Structure

```text
src/
├── index.ts                    # Main plugin entry point
├── auto-update-command.ts      # Core workflow automation
├── metadata-auto-inserter.ts   # MetadataMenu integration
├── settings/
│   ├── types.ts               # Type definitions
│   ├── settings.ts            # Default settings
│   └── settings-tab.ts        # Settings UI
├── services/
│   ├── MetadataService.ts     # Metadata sorting and processing
│   ├── FrontMatterService.ts  # YAML frontmatter parsing
│   └── ScriptContextService.ts # Script execution context
├── externalApi/
│   ├── MetadataMenuAdapter.ts # MetadataMenu plugin integration
│   ├── TemplaterAdapter.ts    # Templater plugin integration
│   └── ObsidianAdapter.ts     # Obsidian API utilities
└── utils/
    ├── yaml-utils.ts          # YAML parsing utilities
    └── field-utils.ts         # Field validation utilities
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Development mode (watch for changes, but restart of obsidian required)
npm run dev

# Debug mode (with source maps)
npm run debug

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📋 Algorithm

When executing "Update metadata properties":

1. **Validate Dependencies** - Check MetadataMenu availability (required) and Templater (optional)
2. **Determine FileClass** - Extract from frontmatter or deduce from folder mapping
3. **Validate FileClass** - Verify against MetadataMenu fileClass definitions
4. **Insert Missing Fields** - Use MetadataMenu API to add missing properties with ancestor chain support
5. **Execute Default Scripts** - Run JavaScript scripts to populate default values for empty fields
6. **Sort Properties** - Arrange frontmatter properties according to configured order
7. **Save Changes** - Write enriched metadata back to file

## 🔧 Configuration Examples

### Folder Mappings

```text
Books/.*        → book
Articles/.*     → article
Daily Notes/.*  → daily-note
.*              → default  // fallback pattern
```

### Property Scripts

```javascript
// Title generation
if (!metadata.title) {
    return file.basename.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

// Author prompt with smart defaults
return await prompt("Enter author", metadata.fileClass === 'book' ? 'Unknown Author' : 'Me');

// Dynamic date generation
return date.now("YYYY-MM-DD");

// Language detection
return detectLanguage(file.content);
```

### Ace editor

You can use the [Ace Editor plugin](https://github.com/RavenHogWarts/obsidian-ace-code-editor) to enhance your editing experience with advanced code editing features.
This plugin settings are using this `ace` editor if available, otherwise it falls back to simple textarea.

## 🧪 Testing

The plugin includes comprehensive test coverage:

- **Unit Tests**: Individual service and adapter testing
- **Integration Tests**: Cross-component workflow testing
- **Mock Environment**: Isolated testing without external dependencies

The tests use Jest with TypeScript support (`ts-jest`). The test configuration is in `jest.config.js`.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Debugging Tests

<https://jestjs.io/docs/troubleshooting#debugging-in-vs-code>

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests for any improvements.

## 🔗 Links

- **Issues**: [GitHub Issues](https://github.com/fchastanet/obsidian-metaflow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/fchastanet/obsidian-metaflow/discussions)
- **Support**: ☕ [Buy me a coffee](https://coff.ee/fchastanetl)

## Acknowledgments

This plugin would never exist without [Obsidian](https://obsidian.md/)
and those great Obsidian plugins:

- [Obsidian Metadata Menu plugin](https://mdelobelle.github.io/metadatamenu)
- [Obsidian Templater plugin](https://github.com/SilentVoid13/Templater)
- [Ace Editor plugin](https://github.com/RavenHogWarts/obsidian-ace-code-editor)
- [Update frontmatter modified date plugin](https://github.com/alangrainger/obsidian-frontmatter-modified-date) for the inspiration on how to handle manual file modification
