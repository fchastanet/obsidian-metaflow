import {MetadataMenuAdapter} from './MetadataMenuAdapter';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {MetaFlowException} from '../MetaFlowException';

describe('MetadataMenuAdapter', () => {
  let mockApp: any;
  let adapter: MetadataMenuAdapter;

  beforeEach(() => {
    mockApp = {
      plugins: {
        enabledPlugins: new Set(['metadata-menu']),
        plugins: {}
      }
    };
    adapter = new MetadataMenuAdapter(mockApp);
  });

  describe('isMetadataMenuAvailable', () => {
    test('returns false if integration setting is off', () => {
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns false if plugin is missing', () => {
      adapter = new MetadataMenuAdapter(mockApp);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns false if plugin has no api', () => {
      mockApp.plugins.plugins['metadata-menu'] = {notApi: {}};
      adapter = new MetadataMenuAdapter(mockApp);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns false if plugin disabled', () => {
      mockApp.plugins.enabledPlugins.delete('metadata-menu');
      mockApp.plugins.plugins['metadata-menu'] = {api: {}, settings: {}, };
      adapter = new MetadataMenuAdapter(mockApp);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns true if plugin and api are present and integration enabled', () => {
      mockApp.plugins.plugins['metadata-menu'] = {api: {}, settings: {}, };
      adapter = new MetadataMenuAdapter(mockApp);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(true);
    });
  });

  describe('getMetadataMenuPlugin', () => {
    test('throw MetaFlowException if not available', async () => {
      expect.assertions(2);
      try {
        await adapter.getMetadataMenuPlugin();
      } catch (e) {
        expect(e).toBeInstanceOf(MetaFlowException);
        expect(e.message).toBe('MetadataMenu integration is not enabled or plugin is not available');
      }
    });

    test('returns plugin if available', async () => {
      const pluginObj = {api: {}, foo: 'bar', settings: {}};
      mockApp.plugins.plugins['metadata-menu'] = pluginObj;
      adapter = new MetadataMenuAdapter(mockApp);
      const result = await adapter.getMetadataMenuPlugin();
      expect(result).toBe(pluginObj);
    });
  });

  describe('getAllFieldsFileClassesAssociation', () => {
    test('throws exception when MetadataMenu not available', () => {
      expect(() => {
        adapter.getAllFieldsFileClassesAssociation();
      }).toThrow(MetaFlowException);
    });

    test('throws exception when no fileClass definitions found', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      expect(() => {
        adapter.getAllFieldsFileClassesAssociation();
      }).toThrow('No fileClass definitions found in MetadataMenu');
    });

    test('returns correct field associations', () => {
      const mockFieldsMap = new Map([
        ['book', [{name: 'title'}, {name: 'author'}]],
        ['article', [{name: 'title'}, {name: 'date'}]]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const result = adapter.getAllFieldsFileClassesAssociation();

      expect(result).toEqual({
        title: {fileClasses: ['book', 'article']},
        author: {fileClasses: ['book']},
        date: {fileClasses: ['article']}
      });
    });
  });

  describe('getFileClassFromMetadata', () => {
    test('returns null for null metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const result = adapter.getFileClassFromMetadata(null);
      expect(result).toBe(null);
    });

    test('returns null for non-object metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const result = adapter.getFileClassFromMetadata('string');
      expect(result).toBe(null);
    });

    test('returns fileClass value from metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const metadata = {fileClass: 'book', title: 'Test'};
      const result = adapter.getFileClassFromMetadata(metadata);
      expect(result).toBe('book');
    });

    test('returns null when fileClass not present in metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const metadata = {title: 'Test'};
      const result = adapter.getFileClassFromMetadata(metadata);
      expect(result).toBe(null);
    });
  });

  describe('getFileClassAlias', () => {
    test('throws exception when plugin not available', () => {
      expect(() => {
        adapter.getFileClassAlias();
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
    });

    test('returns default fileClass alias when not configured', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const result = adapter.getFileClassAlias();
      expect(result).toBe('fileClass');
    });

    test('returns configured fileClass alias', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'customFileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const result = adapter.getFileClassAlias();
      expect(result).toBe('customFileClass');
    });
  });

  describe('getFileClassByName', () => {
    test('throws exception when fileClassesFields not available', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {}
      };
      adapter = new MetadataMenuAdapter(mockApp);

      expect(() => {
        adapter.getFileClassByName('book');
      }).toThrow('MetadataMenu fileClassesFields settings not available');
    });

    test('throws exception when fileClass not found', () => {
      const mockFieldsMap = new Map([
        ['article', [{name: 'title'}]]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      expect(() => {
        adapter.getFileClassByName('book');
      }).toThrow('File class "book" not found in MetadataMenu');
    });

    test('returns fields for existing fileClass', () => {
      const mockFields = [{name: 'title'}, {name: 'author'}];
      const mockFieldsMap = new Map([
        ['book', mockFields]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const result = adapter.getFileClassByName('book');
      expect(result).toBe(mockFields);
    });
  });

  describe('insertMissingFields', () => {
    test('throws exception when MetadataMenu not available', () => {
      const frontmatter = {title: 'Test'};

      expect(() => {
        adapter.insertMissingFields(frontmatter, 'book');
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
    });

    test('inserts missing fields from fileClass', () => {
      const mockFields = [{name: 'title'}, {name: 'author'}, {name: 'date'}];
      const mockFieldsMap = new Map([
        ['book', mockFields]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: new Map()
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {title: 'Existing Title'};
      const result = adapter.insertMissingFields(frontmatter, 'book');

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        author: null,             // Missing field added
        date: null                // Missing field added
      });
    });

    test('inserts fields from ancestors first, then main fileClass', () => {
      const ancestorFields = [{name: 'id'}, {name: 'created'}];
      const bookFields = [{name: 'title'}, {name: 'author'}];

      const mockFieldsMap = new Map([
        ['default', ancestorFields],
        ['book', bookFields]
      ]);

      const mockAncestorsMap = new Map([
        ['book', ['default']]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: mockAncestorsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {title: 'Existing Title'};
      const result = adapter.insertMissingFields(frontmatter, 'book');

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        id: null,                 // From ancestor
        created: null,            // From ancestor
        author: null              // From main fileClass
      });
    });
  });

  describe('insertFileClassMissingFields', () => {
    test('throws exception when MetadataMenu not available', () => {
      const frontmatter = {title: 'Test'};

      expect(() => {
        adapter.insertFileClassMissingFields(frontmatter, 'book');
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
    });

    test('no exception when no fields found for fileClass', () => {
      const mockFieldsMap = new Map();

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      const frontmatter = {};
      adapter = new MetadataMenuAdapter(mockApp);
      const result = adapter.insertFileClassMissingFields(frontmatter, 'book');
      expect(result).toEqual(frontmatter);
    });

    test('inserts missing fields only', () => {
      const mockFields = [{name: 'title'}, {name: 'author'}, {name: 'date'}];
      const mockFieldsMap = new Map([
        ['book', mockFields]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {title: 'Existing Title'};
      const result = adapter.insertFileClassMissingFields(frontmatter, 'book');

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        author: null,             // Missing field added
        date: null                // Missing field added
      });
    });

    test('preserves existing fields', () => {
      const mockFields = [{name: 'title'}, {name: 'author'}];
      const mockFieldsMap = new Map([
        ['book', mockFields]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {
        title: 'Existing Title',
        author: 'Existing Author',
        extraField: 'Extra Value'
      };
      const result = adapter.insertFileClassMissingFields(frontmatter, 'book');

      expect(result).toEqual({
        title: 'Existing Title',   // Preserved
        author: 'Existing Author', // Preserved
        extraField: 'Extra Value'  // Preserved
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('insertMissingFields throws exception when fieldIndex missing', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        // No fieldIndex
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {title: 'Test'};

      expect(() => {
        adapter.insertMissingFields(frontmatter, 'book');
      }).toThrow('No fileClass definitions found in MetadataMenu');
    });

    test('insertMissingFields handles ancestor chain errors gracefully', () => {
      const mockFields = [{name: 'title'}];
      const mockFieldsMap = new Map([
        ['book', mockFields]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: 'invalid-data' // Invalid data type
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {existing: 'value'};
      const result = adapter.insertMissingFields(frontmatter, 'book');

      // Should still process the main fileClass even if ancestors fail
      expect(result).toEqual({
        existing: 'value',
        title: null
      });
    });

    test('insertMissingFields handles multiple ancestor levels correctly', () => {
      const basicFields = [{name: 'id'}];
      const defaultFields = [{name: 'created'}, {name: 'updated'}];
      const bookFields = [{name: 'title'}, {name: 'author'}];

      const mockFieldsMap = new Map([
        ['basic', basicFields],
        ['default', defaultFields],
        ['book', bookFields]
      ]);

      // Complex ancestor chain: book -> default -> basic
      const mockAncestorsMap = new Map([
        ['book', ['default', 'basic']]  // Reverse order needed
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: mockAncestorsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {title: 'Existing Title'};
      const result = adapter.insertMissingFields(frontmatter, 'book');

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        id: null,                 // From basic (most basic ancestor)
        created: null,            // From default
        updated: null,            // From default
        author: null              // From book
      });
    });

    test('insertMissingFields works with object-based ancestors (not Map)', () => {
      const defaultFields = [{name: 'created'}];
      const bookFields = [{name: 'title'}];

      const mockFieldsMap = new Map([
        ['default', defaultFields],
        ['book', bookFields]
      ]);

      // Use object instead of Map for ancestors
      const mockAncestorsObject = {
        'book': ['default']
      };

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: mockAncestorsObject // Object, not Map
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {};
      const result = adapter.insertMissingFields(frontmatter, 'book');

      expect(result).toEqual({
        created: null,  // From ancestor
        title: null     // From main fileClass
      });
    });

    test('getAllFieldsFileClassesAssociation handles empty field names', () => {
      const mockFieldsMap = new Map([
        ['book', [{name: 'title'}, {name: ''}, {name: 'author'}]], // Empty name
        ['article', [{name: 'title'}]]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const result = adapter.getAllFieldsFileClassesAssociation();

      // Should handle empty field names gracefully
      expect(result).toEqual({
        title: {fileClasses: ['book', 'article']},
        '': {fileClasses: ['book']},      // Empty string field
        author: {fileClasses: ['book']}
      });
    });

    test('getFileClassAlias throws exception when settings is null', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: null  // No settings
      };
      adapter = new MetadataMenuAdapter(mockApp);

      expect(() => {
        adapter.getFileClassAlias();
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
    });

    test('getFileClassAlias throws exception when settings is not object', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: 'not-an-object'  // Invalid settings
      };
      adapter = new MetadataMenuAdapter(mockApp);

      expect(() => {
        adapter.getFileClassAlias();
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
    });

    test('insertFileClassMissingFields handles fields without names', () => {
      const mockFields = [
        {name: 'title'},
        {name: ''}, // Empty name
        {name: null}, // Null name
        {name: 'author'}
      ];
      const mockFieldsMap = new Map([
        ['book', mockFields]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap
        }
      };
      adapter = new MetadataMenuAdapter(mockApp);

      const frontmatter = {};
      const result = adapter.insertFileClassMissingFields(frontmatter, 'book');

      // Should only add fields with valid names
      expect(result).toEqual({
        title: null,
        author: null
        // Empty and null names should be skipped
      });
    });
  });
});
