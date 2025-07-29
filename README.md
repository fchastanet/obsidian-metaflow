# Obsidian Metadata Properties Sorter

This plugin automatically sorts metadata properties in your Obsidian notes and integrates with the MetadataMenu plugin to insert missing fields.

This project uses TypeScript to provide type checking and documentation with a [clean modular structure](STRUCTURE.md).
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

## Plugin description

### Features

- **Metadata Sorting**: Automatically sort frontmatter properties in a customizable order
- **MetadataMenu Integration**: Insert missing fields from MetadataMenu fileClass definitions
- **Ancestor Chain Support**: Process fileClass inheritance hierarchies correctly
- **Auto-sort Options**: Sort on file save, view, or manual command
- **Flexible Configuration**: Customizable property order and sorting rules

### Settings

#### folder/fileClass mapping

The same way the Templater plugin maps folder pattern to template.
This setting allows to map folder pattern to a fileClass.
A last .* match allows fallback.
Each fileClass specified should exists in Metadata Menu plugin.
Check that exact same rules exists in same order in Templater plugin,
display a warning if not.

#### properties default values

The user can define a script to execute to populate a default value to each property.
The setting view allows to add the following mapping:

- name of the property
- script to execute that will return the default value
  - some variables will be passed to this script
    - `fileClass`: in case you want to use different logic depending on the fileClass
    - `file`: the file being edited
    - `metadata`: the current list of metadata headers available
  - some functions will be made available
    - `prompt`: to ask the user some data with default value
      - default value will be used for an existing file
        and when this function will be used for multiple files edit
    - `date`: the Templater plugin `date` function
    - `generateMarkdownLink`: the `app.fileManager.generateMarkdownLink` allowing to generate a markdown link from a file
    - `detectLanguage`: basic detection between common languages
    - other functions could be made available afterwards

### Algorithm

When:

- running the command "Auto Update metadata fields":
- the first time a file is created

Following tasks will be executed:

- check if Metadata Menu plugin is available
  - if not, report an error and stop processing
- check if Templater plugin is available
  - if not, report an error and stop processing
- if metadata field fileClass is not present in frontMatter header
  - try to deduce the fileClass from folder/fileClass mapping setting
    - if no match is found, report an error and stop processing
- if fileClass does not exists in Metadata Menu settings
  - report error and stop processing
- if fileClass does not match any fileClass of folder/fileClass mapping setting
  - report error and stop processing
- insert metadata headers using `src/metadata-auto-inserter.ts` that is using the following algorithm:
  - deduce file class ancestor chain (Eg: bookNote -> default -> default-basics)
  - insert missing file class properties from oldest ancestor (Eg: default-basics) to the more recent (Eg: bookNote)
- add default values to properties
  - using `properties default values` setting, execute the associated function to each metadata property.

For detailed information about this command, see [AUTO_UPDATE_COMMAND.md](AUTO_UPDATE_COMMAND.md).

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `src/index.ts` to `main.js`.
- Make changes to `src/index.ts` (or create new `.ts` files in the `src/` folder). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.


## Auto-sync to Obsidian Plugin Folder

This plugin includes automatic syncing capabilities to copy built files directly to your Obsidian vault's plugin folder for easier development.

### Setup

1. Create or modify the `sync.config.json` file in the project root:

```json
{
    "syncEnabled": true,
    "syncPath": "/path/to/your/vault/.obsidian/plugins/your-plugin-name/",
    "filesToSync": [
        "main.js",
        "manifest.json",
        "styles.css"
    ]
}
```

1. Replace `/path/to/your/vault/.obsidian/plugins/your-plugin-name/` with the actual path to your plugin folder in your Obsidian vault.

### Usage

- **Development mode**: Run `npm run dev` - files will be automatically synced when they change
- **Production build**: Run `npm run build` - files will be synced once after the build completes
- **Manual sync**: Run `npm run sync` - sync files immediately without building

### Benefits

- No need to manually copy files after each build
- Automatic syncing during development
- Easy testing in your actual Obsidian vault
- Configurable list of files to sync

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)

- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code.
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint src/index.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint ./src/`

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See [Obsidian API Documentation](https://github.com/obsidianmd/obsidian-api)
