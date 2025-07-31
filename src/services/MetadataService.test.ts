import * as fs from 'fs';
import * as path from 'path';
import {MetaFlowSettings} from '../settings/types';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {MetadataService} from './MetadataService';

describe('Metadata Sorting', () => {
  let mockApp: any;
  let metadataService: MetadataService;

  beforeEach(() => {
    mockApp = {
      plugins: {
        plugins: {}
      },
      fileManager: {
        generateMarkdownLink: jest.fn((file, path) => `[[${file.name}]]`)
      }
    };
    metadataService = new MetadataService();
  });

  describe('sortProperties', () => {
    test('should sort properties according to the specified order', () => {
      const metadata = {
        tags: ['tag1', 'tag2'],
        title: 'Test Note',
        status: 'draft',
        custom: 'value'
      };

      const settings: MetaFlowSettings = {
        propertyOrder: ['title', 'status', 'tags'],
        autoSortOnView: true,
        sortUnknownPropertiesLast: true,
        enableAutoMetadataInsertion: false,
        insertMissingFieldsOnSort: false,
        useMetadataMenuDefaults: false,
        metadataMenuIntegration: false,
        folderFileClassMappings: [
          {
            folderPattern: '.*',
            fileClass: 'default',
            isRegex: true
          }
        ],
        propertyDefaultValueScripts: [],
        enableTemplaterIntegration: false
      };

      // Create a service with the test settings
      const testService = new MetadataService();
      const result = testService['sortProperties'](metadata, settings);
      const keys = Object.keys(result);

      expect(keys).toEqual(['title', 'status', 'tags', 'custom']);
    });

    test('should put unknown properties last when sortUnknownPropertiesLast is true', () => {
      const metadata = {
        zebra: 'value',
        apple: 'value',
        title: 'Test Note'
      };

      const settings: MetaFlowSettings = {
        propertyOrder: ['title'],
        autoSortOnView: true,
        sortUnknownPropertiesLast: true,
        enableAutoMetadataInsertion: false,
        insertMissingFieldsOnSort: false,
        useMetadataMenuDefaults: false,
        metadataMenuIntegration: false,
        folderFileClassMappings: [
          {
            folderPattern: '.*',
            fileClass: 'default',
            isRegex: true
          }
        ],
        propertyDefaultValueScripts: [],
        enableTemplaterIntegration: false
      };

      const testService = new MetadataService();
      const result = testService['sortProperties'](metadata, settings);
      const keys = Object.keys(result);

      expect(keys).toEqual(['title', 'apple', 'zebra']);
    });

    test('should place unknown properties at the beginning when sortUnknownPropertiesLast is false', () => {
      const metadata = {
        unknown1: 'value1',
        title: 'Test Note',
        unknown2: 'value2',
        status: 'draft'
      };

      const settings: MetaFlowSettings = {
        propertyOrder: ['title', 'status'],
        autoSortOnView: true,
        sortUnknownPropertiesLast: false,
        enableAutoMetadataInsertion: false,
        insertMissingFieldsOnSort: false,
        useMetadataMenuDefaults: false,
        metadataMenuIntegration: false,
        folderFileClassMappings: [
          {
            folderPattern: '.*',
            fileClass: 'default',
            isRegex: true
          }
        ],
        propertyDefaultValueScripts: [],
        enableTemplaterIntegration: false
      };

      const testService = new MetadataService();
      const result = testService['sortProperties'](metadata, settings);
      const keys = Object.keys(result);

      expect(keys).toEqual(['unknown1', 'unknown2', 'title', 'status']);
    });

    test('should handle properties that exist in the order but not in the metadata', () => {
      const metadata = {
        title: 'Test Note',
        status: 'draft'
      };

      const settings: MetaFlowSettings = {
        propertyOrder: ['title', 'nonexistent', 'status'],
        autoSortOnView: true,
        sortUnknownPropertiesLast: true,
        enableAutoMetadataInsertion: false,
        insertMissingFieldsOnSort: false,
        useMetadataMenuDefaults: false,
        metadataMenuIntegration: false,
        folderFileClassMappings: [
          {
            folderPattern: '.*',
            fileClass: 'default',
            isRegex: true
          }
        ],
        propertyDefaultValueScripts: [],
        enableTemplaterIntegration: false
      };

      const testService = new MetadataService();
      const result = testService['sortProperties'](metadata, settings);
      const keys = Object.keys(result);

      expect(keys).toEqual(['title', 'status']);
    });

    test('should preserve the original metadata if no property order is specified', () => {
      const metadata = {
        tags: ['tag1', 'tag2'],
        title: 'Test Note',
        status: 'draft'
      };

      const settings: MetaFlowSettings = {
        propertyOrder: [],
        autoSortOnView: true,
        sortUnknownPropertiesLast: true,
        enableAutoMetadataInsertion: false,
        insertMissingFieldsOnSort: false,
        useMetadataMenuDefaults: false,
        metadataMenuIntegration: false,
        folderFileClassMappings: [
          {
            folderPattern: '.*',
            fileClass: 'default',
            isRegex: true
          }
        ],
        propertyDefaultValueScripts: [],
        enableTemplaterIntegration: false
      };

      const testService = new MetadataService();
      const result = testService['sortProperties'](metadata, settings);

      expect(result).toEqual(metadata);
    });
  });

  describe('sortMetadataInContent', () => {
    test('should sort frontmatter properties', () => {
      const content = `---
tags: [tag1, tag2]
title: Test Note
status: draft
---

This is the content of the note.`;

      const result = metadataService.sortMetadataInContent(content, DEFAULT_SETTINGS);

      // Check that the content has been modified
      expect(result).not.toBe(content);

      // Check that the content after frontmatter is preserved
      expect(result).toContain('This is the content of the note.');
    });

    test('should handle content without frontmatter', () => {
      const content = 'This is just content without frontmatter.';

      const result = metadataService.sortMetadataInContent(content, DEFAULT_SETTINGS);

      expect(result).toBe(content);
    });

    test('should handle malformed YAML', () => {
      const content = `---
invalid: yaml: content: here
---

Content here`;

      const result = metadataService.sortMetadataInContent(content, DEFAULT_SETTINGS);

      // Should return the original content when YAML is malformed
      expect(result).toBe(content);
    });

    test('should handle empty frontmatter', () => {
      const content = `---
---

Content here`;

      const result = metadataService.sortMetadataInContent(content, DEFAULT_SETTINGS);

      expect(result).toBe(content);
    });

    test('should preserve complex values in frontmatter', () => {
      const content = `---
title: Test Note
tags:
  - javascript
  - nodejs
metadata:
  created: 2023-01-01
  author: John Doe
---

Content here`;

      const result = metadataService.sortMetadataInContent(content, DEFAULT_SETTINGS);

      expect(result).toContain('javascript');
      expect(result).toContain('nodejs');
      expect(result).toContain('created: 2023-01-01');
      expect(result).toContain('author: John Doe');
    });

    test('should work with example.md if it exists', () => {
      const examplePath = path.join(__dirname, 'example.md');

      if (fs.existsSync(examplePath)) {
        const exampleContent = fs.readFileSync(examplePath, 'utf8');
        const sortedContent = metadataService.sortMetadataInContent(exampleContent, DEFAULT_SETTINGS);

        expect(sortedContent).not.toBe(exampleContent);
        expect(sortedContent).toContain('---');
        expect(sortedContent).toContain('Lorem Ipsum');

        // Verify that the content after frontmatter is preserved
        const originalContentPart = exampleContent.split('---\n')[2];
        const sortedContentPart = sortedContent.split('---\n')[2];
        expect(sortedContentPart).toBe(originalContentPart);
      } else {
        test.skip('example.md does not exist, skipping test', () => { });
      }
    });
  });
});
