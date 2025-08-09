# QA tests

- [1. Commands](#1-commands)
  - [1.1. Update fileClass](#11-update-fileclass)
  - [1.2. 1.2 Metadata properties initialization](#12-12-metadata-properties-initialization)
  - [1.3. Sort metadata properties](#13-sort-metadata-properties)
  - [1.4. Move note to the right folder](#14-move-note-to-the-right-folder)
  - [1.6. Toggle properties panel visibility](#16-toggle-properties-panel-visibility)
- [2. Context menu](#2-context-menu)
  - [2.1. Update metadata in folder](#21-update-metadata-in-folder)
- [3. Automatic processes](#3-automatic-processes)
  - [3.1. Auto-update metadata properties](#31-auto-update-metadata-properties)
  - [3.2. Create a note from a template with a specific fileClass](#32-create-a-note-from-a-template-with-a-specific-fileclass)
- [4. Settings](#4-settings)
  - [4.1. General Settings](#41-general-settings)
  - [4.2. Folder/FileClass Mappings](#42-folderfileclass-mappings)
  - [4.3. Property Default Value Scripts](#43-property-default-value-scripts)
  - [4.4. Export/Import Settings](#44-exportimport-settings)
  - [4.5. Simulation \& Testing](#45-simulation--testing)

## 1. Commands

### 1.1. Update fileClass

- enable auto-insert metadata properties in settings.
- Open a note with frontmatter.
- Run the 'Update metadata properties' command from the command palette.
- Verify that the frontmatter is updated according to the plugin's rules (e.g., missing fields are added, values are updated).
- **Edge case:** Try updating metadata on a note inside an excluded folder. Confirm that the command does not update metadata and shows a warning or does nothing.
- **Edge case:** Run the command on a note with malformed frontmatter. Check for error handling and that the note is not corrupted.
- **Edge case:** update fileClass from properties panel, should result in the same behavior as updating metadata in the note editor.

### 1.2. 1.2 Metadata properties initialization

- disable auto-insert metadata properties in settings.
- Open a note with frontmatter fileClass.
- metadata properties should not be initialized.
- Run the 'Update metadata properties' command.
- Check the metadata properties are correctly initialized with default values automatically computed.
- the file should not be moved to the right folder.
- **Edge case:** Run the command on a note with no frontmatter. Confirm that the command does not fail and no properties are added (except if the note is in a mapped folder, then fileClass is initialized with the mapped fileClass).
- **Edge case:** Run the command on a note with existing metadata properties. Ensure that only missing properties are added and existing ones are not overwritten.
- **Edge case:** note in a configured folder, fileClass should be deduced from the folder, and metadata properties should be initialized accordingly.

### 1.3. Sort metadata properties

- Open a note with unsorted frontmatter properties.
- Run the 'Sort metadata properties' command.
- Check that the properties are sorted as per the settings (custom order, unknown properties).
- **Edge case:** Sort a note with only unknown properties. Confirm they are sorted alphabetically or as per settings.
- **Edge case:** Sort a note with no frontmatter. Ensure the command does not fail or corrupt the note.

### 1.4. Move note to the right folder

- Open a note that is not in its mapped folder.
- Run the 'Move note to the right folder' command.
- Confirm the note is moved to the correct folder based on folder/fileClass mapping.
- **Edge case:** Try moving a note when no mapping exists for its fileClass. Confirm no move occurs and a warning is shown.
- **Edge case:** Move a note that is already in the correct folder. Ensure no duplicate or unnecessary move happens.

### 1.6. Toggle properties panel visibility

- Open a note in the editor.
- Use the command or settings to toggle the properties panel.
- Confirm the properties panel appears/disappears as expected.
- **Edge case:** Toggle visibility when no properties exist. Confirm the UI does not break.
- **Edge case:** Rapidly toggle the panel multiple times. Ensure no UI glitches or errors occur.

## 2. Context menu

### 2.1. Update metadata in folder

- Right-click a folder in the file explorer.
- in Metadata-Menu settings, add a new property
- in MetaFlow, add default value for this new property
- Select 'Update metadata in folder' from the context menu.
- Verify all notes in the folder are updated with correct metadata (new property should have been added with the default value).
- **Edge case:** Right-click an excluded folder. Confirm no notes are updated and a warning is shown.
- **Edge case:** Folder contains non-note files. Ensure only notes are processed.

## 3. Automatic processes

### 3.1. Auto-update metadata properties

- Create or modify a note.
- Save the note and check if metadata properties are automatically updated (e.g., missing fields inserted, sorted).
- **Edge case:** Create a note in an excluded folder. Confirm auto-update does not run.
- **Edge case:** Save a note with invalid frontmatter. Ensure no corruption and error is handled gracefully.
- **Edge case:** disable auto insert, changing fileClass should not insert missing metadata fields.
- **Edge case:** disable auto sort, changing fileClass should not sort metadata properties.
- **Edge case:** disable auto move, changing fileClass should not move the note to the right folder.

### 3.2. Create a note from a template with a specific fileClass

- Create a note using a template that includes frontmatter with a specific fileClass.
- Verify that the note's frontmatter is populated with the correct fileClass and any default properties.
- **Edge case:** Use a template that has an invalid or unsupported fileClass. Confirm the plugin handles it gracefully, either by skipping the update or showing an error.
- **Edge case:** Create a note with a fileClass that has no associated folder mapping. Ensure the note is created without errors, but no folder move occurs.

## 4. Settings

### 4.1. General Settings

- Open the settings tab.
- Change options like auto-sort, hide properties, auto-insert fields.
- Save and verify the changes take effect in note behavior.
- **Edge case:** Set all toggles off and verify plugin disables all automation.
- **Edge case:** Enter invalid values in settings fields. Confirm validation and error handling.

### 4.2. Folder/FileClass Mappings

- Add, edit, or remove folder/fileClass mappings in settings.
- Test moving notes and verify they go to the correct folder.
- **Edge case:** Add duplicate mappings. Confirm only one mapping is used or a warning is shown.
- **Edge case:** Remove all mappings. Ensure plugin falls back to default behavior.

### 4.3. Property Default Value Scripts

- Add or edit property scripts in settings.
- Create a note and check if default values are generated by the script.
- **Edge case:** Add a script with invalid JavaScript. Confirm error is shown and note is not corrupted.
- **Edge case:** Disable all scripts. Ensure no default values are generated.

### 4.4. Export/Import Settings

- Use the export button to download settings as JSON.
- Use the import button to upload a JSON file.
- Confirm settings are correctly exported/imported and reflected in the UI.
- **Edge case:** Import a malformed or incompatible JSON file. Confirm error is shown and settings are not overwritten.
- **Edge case:** Export settings with empty or default values. Ensure file is valid and can be imported.

### 4.5. Simulation & Testing

- Use the simulation section in settings to test configuration with sample frontmatter and fileClasses.
- Verify the simulated output matches expectations.
- **Edge case:** Simulate with missing or invalid fileClass. Confirm error or warning is shown.
- **Edge case:** Simulate with empty frontmatter. Ensure output is handled gracefully.
