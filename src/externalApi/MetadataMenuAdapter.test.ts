import {MetadataMenuAdapter} from './MetadataMenuAdapter';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {MetaFlowException} from '../MetaFlowException';
import {MetaFlowSettings} from '../settings/types';
import {expectNoLogs, mockLogManager} from '../__mocks__/logManager';

describe('MetadataMenuAdapter', () => {
  let mockApp: any;
  let adapter: MetadataMenuAdapter;
  let settings: MetaFlowSettings;

  beforeEach(() => {
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => { });
    mockApp = {
      plugins: {
        enabledPlugins: new Set(['metadata-menu']),
        plugins: {}
      }
    };
    settings = {...DEFAULT_SETTINGS, debugMode: true};
  });

  describe('isMetadataMenuAvailable', () => {
    test('returns false if integration setting is off', () => {
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
      expectNoLogs();
    });

    test('returns false if plugin is missing', () => {
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
      expectNoLogs();
    });

    test('returns false if plugin has no api', () => {
      mockApp.plugins.plugins['metadata-menu'] = {notApi: {}};
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
      expectNoLogs();
    });

    test('returns false if plugin disabled', () => {
      mockApp.plugins.enabledPlugins.delete('metadata-menu');
      mockApp.plugins.plugins['metadata-menu'] = {api: {}, settings: {}, };
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
      expectNoLogs();
    });

    test('returns true if plugin and api are present and integration enabled', () => {
      mockApp.plugins.plugins['metadata-menu'] = {api: {}, settings: {}, };
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(true);
      expectNoLogs();
    });
  });

  describe('getMetadataMenuPlugin', () => {
    test('throw MetaFlowException if not available', async () => {
      adapter = new MetadataMenuAdapter(mockApp, settings);
      expect.assertions(2);
      try {
        adapter.getMetadataMenuPlugin();
        expectNoLogs();
      } catch (e) {
        expect(e).toBeInstanceOf(MetaFlowException);
        expect(e.message).toBe('MetadataMenu integration is not enabled or plugin is not available');
      }
    });

    test('returns plugin if available', () => {
      const pluginObj = {api: {}, foo: 'bar', settings: {}};
      mockApp.plugins.plugins['metadata-menu'] = pluginObj;
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.getMetadataMenuPlugin();
      expect(result).toBe(mockApp.plugins.plugins['metadata-menu']);
      expectNoLogs();
    });
  });

  describe('getAllFieldsFileClassesAssociation', () => {
    test('throws exception when MetadataMenu not available', () => {
      expect(() => {
        adapter.getAllFieldsFileClassesAssociation();
      }).toThrow(MetaFlowException);
      expectNoLogs();
    });

    test('throws exception when no fileClass definitions found', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      expect(() => {
        const spy = jest.spyOn(console, 'log').mockImplementation(() => { });
        adapter.getAllFieldsFileClassesAssociation();
        expect(spy).toHaveBeenCalledWith('MetadataMenu fieldIndex.fileClassesAncestors not available');
        spy.mockRestore();
        expectNoLogs();
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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = adapter.getAllFieldsFileClassesAssociation();

      expect(result).toEqual({
        title: {fileClasses: ['book', 'article']},
        author: {fileClasses: ['book']},
        date: {fileClasses: ['article']}
      });
      expectNoLogs();
    });
  });

  describe('getFileClassFromMetadata', () => {
    test('returns null for null metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = adapter.getFileClassFromMetadata(null);
      expect(result).toBe(null);
      expectNoLogs();
    });

    test('returns null for non-object metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = adapter.getFileClassFromMetadata('string');
      expect(result).toBe(null);
      expectNoLogs();
    });

    test('returns fileClass value from metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const metadata = {fileClass: 'book', title: 'Test'};
      const result = adapter.getFileClassFromMetadata(metadata);
      expect(result).toBe('book');
      expectNoLogs();
    });

    test('returns null when fileClass not present in metadata', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'fileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const metadata = {title: 'Test'};
      const result = adapter.getFileClassFromMetadata(metadata);
      expect(result).toBe(null);
      expectNoLogs();
    });
  });

  // ...existing code...

  describe('getFileClassAndAncestorsFields', () => {
    test('returns fields for fileClass and its ancestors (Map ancestors)', () => {
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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = (adapter as any).getFileClassAndAncestorsFields('book');
      expect(result).toEqual([
        ...ancestorFields,
        ...bookFields
      ]);
    });

    test('returns fields for fileClass and its ancestors (object ancestors)', () => {
      const ancestorFields = [{name: 'id'}];
      const bookFields = [{name: 'title'}];

      const mockFieldsMap = new Map([
        ['default', ancestorFields],
        ['book', bookFields]
      ]);
      const mockAncestorsObj = {
        'book': ['default']
      };

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: mockAncestorsObj
        }
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = (adapter as any).getFileClassAndAncestorsFields('book');
      expect(result).toEqual([
        ...ancestorFields,
        ...bookFields
      ]);
    });

    test('returns only fileClass fields if no ancestors', () => {
      const bookFields = [{name: 'title'}];
      const mockFieldsMap = new Map([
        ['book', bookFields]
      ]);

      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: new Map()
        }
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = (adapter as any).getFileClassAndAncestorsFields('book');
      expect(result).toEqual(bookFields);
    });

    test('throws exception if fileClass not found', () => {
      const mockFieldsMap = new Map([
        ['default', [{name: 'id'}]]
      ]);
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: new Map()
        }
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = (adapter as any).getFileClassAndAncestorsFields('book');
      expect(result).toEqual([]);
    });

    test('returns empty array if no fields and no ancestors', () => {
      const mockFieldsMap = new Map();
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: mockFieldsMap,
          fileClassesAncestors: new Map()
        }
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = (adapter as any).getFileClassAndAncestorsFields('book');
      expect(result).toEqual([]);
    });
  });

  describe('getFileClassAlias', () => {
    test('throws exception when plugin not available', () => {
      adapter = new MetadataMenuAdapter(mockApp, settings);
      expect(() => {
        adapter.getFileClassAlias();
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
      expectNoLogs();
    });

    test('returns default fileClass alias when not configured', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = adapter.getFileClassAlias();
      expect(result).toBe('fileClass');
      expectNoLogs();
    });

    test('returns configured fileClass alias', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {fileClassAlias: 'customFileClass'}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = adapter.getFileClassAlias();
      expect(result).toBe('customFileClass');
      expectNoLogs();
    });
  });

  describe('getFileClassByName', () => {
    test('throws exception when fileClassesFields not available', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {}
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

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
      adapter = new MetadataMenuAdapter(mockApp, settings);

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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = adapter.getFileClassByName('book');
      expect(result).toBe(mockFields);
    });
  });

  describe('syncFields', () => {
    test('throws exception when MetadataMenu not available', () => {
      const frontmatter = {title: 'Test'};
      adapter = new MetadataMenuAdapter(mockApp, settings);
      expect(() => {
        adapter.syncFields(frontmatter, 'book', mockLogManager);
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
      expectNoLogs();
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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const frontmatter = {title: 'Existing Title'};
      const result = adapter.syncFields(frontmatter, 'book', mockLogManager);

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        author: null,             // Missing field added
        date: null                // Missing field added
      });
      expect(mockLogManager.addError).not.toHaveBeenCalledWith();
      expectNoLogs();
    });

    test('inserts fields from ancestors first, then main fileClass', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: new Map([
            ['default', [{name: 'id'}, {name: 'created'}]],
            ['book', [{name: 'title'}, {name: 'author'}]]
          ]),
          fileClassesAncestors: new Map([
            ['book', ['default']]
          ]),
        }
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const frontmatter = {title: 'Existing Title'};
      const result = adapter.syncFields(frontmatter, 'book', mockLogManager);

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        id: null,                 // From ancestor
        created: null,            // From ancestor
        author: null              // From main fileClass
      });
      expectNoLogs();
    });

    test('inserts fields from ancestors and remove obsolete fields', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        fieldIndex: {
          fileClassesFields: new Map([
            ['default', [{name: 'id'}, {name: 'created'}]],
            ['book', [{name: 'title'}, {name: 'author'}]]
          ]),
          fileClassesAncestors: new Map([
            ['book', ['default']]
          ]),
        }
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const frontmatter = {
        title: 'Existing Title',
        obsoleteField1: null,
        obsoleteField2: undefined,
        obsoleteField3: '',
        fieldKept: 'value'
      };
      const result = adapter.syncFields(frontmatter, 'book', mockLogManager);

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        id: null,                 // From ancestor
        fieldKept: 'value',
        created: null,            // From ancestor
        author: null              // From main fileClass
      });
      expectNoLogs();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('syncFields throws exception when fieldIndex missing', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: {},
        // No fieldIndex
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const frontmatter = {title: 'Test'};
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      expect(() => {
        adapter.syncFields(frontmatter, 'book', mockLogManager);
      }).toThrow('No fileClass definitions found in MetadataMenu');
      expect(spy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith('Error inserting missing fields:', expect.any(Error));
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(
        'MetadataMenu fieldIndex.fileClassesAncestors not available'
      );
    });

    test('syncFields handles ancestor chain errors gracefully', () => {
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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const frontmatter = {existing: 'value'};
      const result = adapter.syncFields(frontmatter, 'book', mockLogManager);

      // Should still process the main fileClass even if ancestors fail
      expect(result).toEqual({
        existing: 'value',
        title: null
      });
      expect(mockLogManager.addError).not.toHaveBeenCalled();
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(
        'MetadataMenu fieldIndex.fileClassesAncestors not available'
      );
    });

    test('syncFields handles multiple ancestor levels correctly', () => {
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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const frontmatter = {title: 'Existing Title'};
      const result = adapter.syncFields(frontmatter, 'book', mockLogManager);

      expect(result).toEqual({
        title: 'Existing Title',  // Existing field preserved
        id: null,                 // From basic (most basic ancestor)
        created: null,            // From default
        updated: null,            // From default
        author: null              // From book
      });
      expect(mockLogManager.addError).not.toHaveBeenCalled();
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(
        'MetadataMenu fieldIndex.fileClassesAncestors not available'
      );
    });

    test('syncFields works with object-based ancestors (not Map)', () => {
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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const frontmatter = {};
      const result = adapter.syncFields(frontmatter, 'book', mockLogManager);

      expect(result).toEqual({
        created: null,  // From ancestor
        title: null     // From main fileClass
      });
      expect(mockLogManager.addError).not.toHaveBeenCalled();
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(
        'MetadataMenu fieldIndex.fileClassesAncestors not available'
      );
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
      adapter = new MetadataMenuAdapter(mockApp, settings);

      const result = adapter.getAllFieldsFileClassesAssociation();

      // Should handle empty field names gracefully
      expect(result).toEqual({
        title: {fileClasses: ['book', 'article']},
        '': {fileClasses: ['book']},      // Empty string field
        author: {fileClasses: ['book']}
      });
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(
        'MetadataMenu fieldIndex.fileClassesAncestors not available'
      );
    });

    test('getFileClassAlias throws exception when settings is null', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: null  // No settings
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      expect(() => {
        adapter.getFileClassAlias();
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(
        'MetadataMenu fieldIndex.fileClassesAncestors not available'
      );
    });

    test('getFileClassAlias throws exception when settings is not object', () => {
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {},
        settings: 'not-an-object'  // Invalid settings
      };
      adapter = new MetadataMenuAdapter(mockApp, settings);

      expect(() => {
        adapter.getFileClassAlias();
      }).toThrow('MetadataMenu integration is not enabled or plugin is not available');
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(
        'MetadataMenu fieldIndex.fileClassesAncestors not available'
      );
    });
  });
});
