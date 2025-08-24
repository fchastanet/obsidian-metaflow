import {TFile} from "obsidian";
import {PropertyManagementService} from "./PropertyManagementService";
import {MetaFlowSettings, PropertyDefaultValueScript} from "../settings/types";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";

describe('PropertyManagementService', () => {
  let propertyManagementService: PropertyManagementService;
  let mockMetaFlowSettings: MetaFlowSettings;
  let mockMetadataMenuAdapter: any;
  let mockScriptContextService: any;
  let mockFile: TFile;
  let mockLogManager: any;

  beforeEach(() => {
    mockMetaFlowSettings = {
      ...DEFAULT_SETTINGS,
      propertyDefaultValueScripts: [
        {
          propertyName: 'author',
          script: 'return "Default Author";',
          enabled: true,
          order: 1
        },
        {
          propertyName: 'tags',
          script: 'return ["default-tag"];',
          enabled: true,
          order: 2
        }
      ]
    };

    mockMetadataMenuAdapter = {
      getFileClassAlias: jest.fn().mockReturnValue('fileClass'),
      getFileClassAndAncestorsFields: jest.fn().mockReturnValue([
        {name: 'author', type: 'text'},
        {name: 'tags', type: 'multi'},
        {name: 'title', type: 'text'}
      ])
    };

    mockScriptContextService = {
      getScriptContext: jest.fn().mockReturnValue({
        metadata: {},
        fileClass: 'book',
        file: {},
        logManager: {}
      })
    };

    // Create a proper mock TFile instance
    mockFile = Object.create(TFile.prototype);
    Object.assign(mockFile, {
      name: 'test.md',
      extension: 'md',
      path: 'test.md'
    });

    mockLogManager = {
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn()
    };

    propertyManagementService = new PropertyManagementService(
      mockMetaFlowSettings,
      mockMetadataMenuAdapter,
      mockScriptContextService
    );
  });

  describe('sortProperties', () => {
    it('should sort properties by order', () => {
      const frontmatter = {
        tags: ['tag1'],
        author: 'John Doe',
        title: 'My Book'
      };

      const result = propertyManagementService.sortProperties(frontmatter, true); // sortUnknownPropertiesLast = true

      const keys = Object.keys(result);

      // Properties with explicit order should come first (author=1, tags=2)
      // Then unknown properties alphabetically (title) - since sortUnknownPropertiesLast is true
      expect(keys.indexOf('author')).toBeLessThan(keys.indexOf('tags'));
      expect(keys.indexOf('author')).toBeLessThan(keys.indexOf('title'));
      expect(keys.indexOf('tags')).toBeLessThan(keys.indexOf('title'));
    });

    it('should handle unknown properties last when sortUnknownPropertiesLast is true', () => {
      const frontmatter = {
        unknown: 'value',
        author: 'John Doe'
      };

      const result = propertyManagementService.sortProperties(frontmatter, true);

      const keys = Object.keys(result);
      expect(keys[0]).toBe('author');   // known property first
      expect(keys[1]).toBe('unknown');  // unknown property last
    });

    it('should handle null frontmatter', () => {
      const result = propertyManagementService.sortProperties(null as any, false);
      expect(result).toBeNull();
    });

    it('should handle array frontmatter', () => {
      const arrayData = ['item1', 'item2'];
      const result = propertyManagementService.sortProperties(arrayData as any, false);
      expect(result).toEqual(arrayData);
    });
  });

  describe('addDefaultValuesToProperties', () => {
    it('should add default values for missing properties', () => {
      const frontmatter = {title: 'My Book'};

      const result = propertyManagementService.addDefaultValuesToProperties(
        frontmatter,
        mockFile,
        'book',
        mockLogManager
      );

      expect(result.fileClass).toBe('book');
      expect(result.title).toBe('My Book');
      expect(result.author).toBe('Default Author');
      expect(result.tags).toEqual(['default-tag']);
    });

    it('should not override existing values', () => {
      const frontmatter = {
        title: 'My Book',
        author: 'Existing Author'
      };

      const result = propertyManagementService.addDefaultValuesToProperties(
        frontmatter,
        mockFile,
        'book',
        mockLogManager
      );

      expect(result.author).toBe('Existing Author'); // Should not be overridden
      expect(result.tags).toEqual(['default-tag']);  // Should be added
    });

    it('should skip disabled scripts', () => {
      mockMetaFlowSettings.propertyDefaultValueScripts[0].enabled = false;
      const frontmatter = {title: 'My Book'};

      const result = propertyManagementService.addDefaultValuesToProperties(
        frontmatter,
        mockFile,
        'book',
        mockLogManager
      );

      expect(result.author).toBeUndefined(); // Should not be added
      expect(result.tags).toEqual(['default-tag']); // Should still be added
    });

    it('should process scripts in order', () => {
      // Reverse the order to test sorting
      mockMetaFlowSettings.propertyDefaultValueScripts = [
        {
          propertyName: 'second',
          script: 'return "second";',
          enabled: true,
          order: 2
        },
        {
          propertyName: 'first',
          script: 'return "first";',
          enabled: true,
          order: 1
        }
      ];

      mockMetadataMenuAdapter.getFileClassAndAncestorsFields.mockReturnValue([
        {name: 'first', type: 'text'},
        {name: 'second', type: 'text'}
      ]);

      const frontmatter = {};
      const result = propertyManagementService.addDefaultValuesToProperties(
        frontmatter,
        mockFile,
        'book',
        mockLogManager
      );

      // Both should be present, processed in order
      expect(result.first).toBe('first');
      expect(result.second).toBe('second');
    });

    it('should skip properties not in fileClass fields', () => {
      mockMetaFlowSettings.propertyDefaultValueScripts.push({
        propertyName: 'nonExistentField',
        script: 'return "value";',
        enabled: true,
        order: 3
      });

      const frontmatter = {};
      const result = propertyManagementService.addDefaultValuesToProperties(
        frontmatter,
        mockFile,
        'book',
        mockLogManager
      );

      expect(result.nonExistentField).toBeUndefined();
    });
  });
});
