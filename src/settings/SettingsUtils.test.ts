import {SettingsUtils} from "./SettingsUtils";

describe('SettingsUtils', () => {
  describe('getValueByPath', () => {
    const source = {debugMode: true, excludeFolders: ['a', 'b'], nested: {deep: {value: 42}}};

    test('should read top level values', () => {
      expect(SettingsUtils.getValueByPath(source, 'debugMode')).toBe(true);
    });

    test('should read array items and nested values', () => {
      expect(SettingsUtils.getValueByPath(source, 'excludeFolders.1')).toBe('b');
      expect(SettingsUtils.getValueByPath(source, 'nested.deep.value')).toBe(42);
    });

    test('should return undefined for unknown paths', () => {
      expect(SettingsUtils.getValueByPath(source, 'unknown.path')).toBeUndefined();
      expect(SettingsUtils.getValueByPath(source, 'debugMode.value')).toBeUndefined();
    });
  });

  describe('setValueByPath', () => {
    test('should write top level values', () => {
      const target: Record<string, unknown> = {debugMode: false};
      SettingsUtils.setValueByPath(target, 'debugMode', true);
      expect(target.debugMode).toBe(true);
    });

    test('should write array items and nested values', () => {
      const target = {excludeFolders: ['a', 'b'], nested: {value: 1}};
      SettingsUtils.setValueByPath(target, 'excludeFolders.0', 'z');
      SettingsUtils.setValueByPath(target, 'nested.value', 2);
      expect(target.excludeFolders).toEqual(['z', 'b']);
      expect(target.nested.value).toBe(2);
    });

    test('should throw when intermediate container does not exist', () => {
      expect(() => SettingsUtils.setValueByPath({}, 'missing.value', 1)).toThrow('Invalid settings path: missing.value');
    });
  });

  describe('toggleDefinition', () => {
    test('should build a toggle control definition', () => {
      const disabled = () => true;
      expect(SettingsUtils.toggleDefinition('debugMode', 'Debug', 'desc', disabled)).toEqual({
        name: 'Debug',
        desc: 'desc',
        control: {type: 'toggle', key: 'debugMode', disabled},
      });
    });
  });
});
