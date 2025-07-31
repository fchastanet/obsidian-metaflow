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
    adapter = new MetadataMenuAdapter(mockApp, DEFAULT_SETTINGS);
  });

  describe('isMetadataMenuAvailable', () => {
    test('returns false if integration setting is off', () => {
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns false if plugin is missing', () => {
      const settings = {...DEFAULT_SETTINGS, metadataMenuIntegration: true};
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns false if plugin has no api', () => {
      mockApp.plugins.plugins['metadata-menu'] = {notApi: {}};
      const settings = {...DEFAULT_SETTINGS, metadataMenuIntegration: true};
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns false if plugin disabled', () => {
      mockApp.plugins.enabledPlugins.delete('metadata-menu');
      mockApp.plugins.plugins['metadata-menu'] = {api: {}, settings: {}, };
      const settings = {...DEFAULT_SETTINGS, metadataMenuIntegration: true};
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = adapter.isMetadataMenuAvailable();
      expect(result).toBe(false);
    });

    test('returns true if plugin and api are present and integration enabled', () => {
      mockApp.plugins.plugins['metadata-menu'] = {api: {}, settings: {}, };
      const settings = {...DEFAULT_SETTINGS, metadataMenuIntegration: true};
      adapter = new MetadataMenuAdapter(mockApp, settings);
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
      const settings = {...DEFAULT_SETTINGS, metadataMenuIntegration: true};
      adapter = new MetadataMenuAdapter(mockApp, settings);
      const result = await adapter.getMetadataMenuPlugin();
      expect(result).toBe(pluginObj);
    });
  });
});
