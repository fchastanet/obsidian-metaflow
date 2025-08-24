/**
 * @jest-environment jsdom
 */
import {ScriptEditor, ScriptEditorConfig} from "./ScriptEditor";

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  App: jest.fn()
}));

// Mock MetadataMenuAdapter
jest.mock('../externalApi/MetadataMenuAdapter', () => ({
  MetadataMenuAdapter: jest.fn().mockImplementation(() => ({
    isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
    getAllFields: jest.fn().mockReturnValue([
      {name: 'title', type: 'text', tooltip: 'Title field'},
      {name: 'author', type: 'text', tooltip: 'Author field'}
    ])
  }))
}));

// Mock ace editor
const mockEditor = {
  setTheme: jest.fn(),
  session: {
    setMode: jest.fn(),
    setUseWrapMode: jest.fn()
  },
  setHighlightActiveLine: jest.fn(),
  setOptions: jest.fn(),
  resize: jest.fn(),
  getValue: jest.fn().mockReturnValue('test script'),
  setValue: jest.fn(),
  destroy: jest.fn(),
  completers: []
};

(global as any).ace = {
  edit: jest.fn().mockReturnValue(mockEditor)
};

// Mock HTMLElement createEl method
const mockCreateEl = jest.fn((tag: string, attrs?: any) => {
  const element = document.createElement(tag);
  if (attrs) {
    if (attrs.placeholder) element.setAttribute('placeholder', attrs.placeholder);
    if (attrs.cls) element.className = attrs.cls;
    if (attrs.value) (element as any).value = attrs.value;
  }
  return element;
});

// Extend HTMLElement prototype with createEl method
(HTMLElement.prototype as any).createEl = mockCreateEl;

describe('ScriptEditor', () => {
  let mockApp: any;
  let mockMetadataMenuAdapter: any;
  let scriptEditor: ScriptEditor;

  beforeEach(() => {
    mockApp = {};
    mockMetadataMenuAdapter = {
      isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
      getAllFields: jest.fn().mockReturnValue([
        {name: 'title', type: 'text', tooltip: 'Title field'},
        {name: 'author', type: 'text', tooltip: 'Author field'}
      ])
    };
    jest.clearAllMocks();
    mockCreateEl.mockClear();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default configuration', () => {
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter);

      const completions = scriptEditor.getCompletions();
      expect(completions).toContainEqual(
        expect.objectContaining({value: 'file', meta: 'TFile'})
      );
      expect(completions).toContainEqual(
        expect.objectContaining({value: 'metadata', meta: 'object'})
      );
      // Date functions should not be included by default
      expect(completions.find(c => c.value === 'now()')).toBeUndefined();
    });

    test('should initialize with date functions enabled', () => {
      const config: ScriptEditorConfig = {
        enableDateFunctions: true
      };
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter, config);

      const completions = scriptEditor.getCompletions();
      expect(completions).toContainEqual(
        expect.objectContaining({value: 'now()', meta: 'string'})
      );
      expect(completions).toContainEqual(
        expect.objectContaining({value: 'tomorrow()', meta: 'string'})
      );
      expect(completions).toContainEqual(
        expect.objectContaining({value: 'yesterday()', meta: 'string'})
      );
    });

    test('should initialize with prompt function enabled', () => {
      const config: ScriptEditorConfig = {
        enablePromptFunction: true
      };
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter, config);

      const completions = scriptEditor.getCompletions();
      expect(completions).toContainEqual(
        expect.objectContaining({
          value: 'prompt("Your prompt here", "defaultValue")',
          meta: 'string: show prompt dialog'
        })
      );
    });

    test('should include additional completions', () => {
      const additionalCompletions = [
        {value: 'customFunction()', score: 1, meta: 'custom', docHTML: 'A custom function'}
      ];
      const config: ScriptEditorConfig = {
        additionalCompletions
      };
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter, config);

      const completions = scriptEditor.getCompletions();
      expect(completions).toContainEqual(additionalCompletions[0]);
    });
  });

  describe('Editor Creation and Management', () => {
    beforeEach(() => {
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter);
    });

    test('should create editor with default placeholder and value', () => {
      const container = document.createElement('div');
      const textarea = scriptEditor.createEditor(container);

      expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
      expect(textarea.placeholder).toBe('return "";');
      expect(textarea.value).toBe('');
      expect(textarea.classList.contains('metaflow-settings-script-textarea')).toBe(true);
    });

    test('should create editor with custom placeholder and initial value', () => {
      const container = document.createElement('div');
      const textarea = scriptEditor.createEditor(
        container,
        'Enter your script here',
        'return "initial value";'
      );

      expect(textarea.placeholder).toBe('Enter your script here');
      expect(textarea.value).toBe('return "initial value";');
    });

    test('should create ace editor when ace is available', () => {
      const container = document.createElement('div');
      scriptEditor.createEditor(container);

      expect((global as any).ace.edit).toHaveBeenCalled();
      expect(mockEditor.setTheme).toHaveBeenCalledWith("ace/theme/dracula");
      expect(mockEditor.session.setMode).toHaveBeenCalledWith("ace/mode/javascript");
      expect(mockEditor.setOptions).toHaveBeenCalled();
    });

    test('should get value from ace editor when available', () => {
      const container = document.createElement('div');
      scriptEditor.createEditor(container);

      const value = scriptEditor.getValue();
      expect(value).toBe('test script');
      expect(mockEditor.getValue).toHaveBeenCalled();
    });

    test('should set value in ace editor when available', () => {
      const container = document.createElement('div');
      scriptEditor.createEditor(container);

      scriptEditor.setValue('new script value');
      expect(mockEditor.setValue).toHaveBeenCalledWith('new script value');
    });

    test('should destroy ace editor', () => {
      const container = document.createElement('div');
      scriptEditor.createEditor(container);

      scriptEditor.destroy();
      expect(mockEditor.destroy).toHaveBeenCalled();
    });
  });

  describe('Fallback behavior without ace', () => {
    beforeEach(() => {
      // Remove ace from global
      delete (global as any).ace;
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter);
    });

    afterEach(() => {
      // Restore ace mock
      (global as any).ace = {
        edit: jest.fn().mockReturnValue(mockEditor)
      };
    });

    test('should work without ace editor', () => {
      const container = document.createElement('div');
      const textarea = scriptEditor.createEditor(container, 'placeholder', 'initial');

      expect(textarea.value).toBe('initial');
      expect(scriptEditor.getValue()).toBe('initial');

      scriptEditor.setValue('new value');
      expect(textarea.value).toBe('new value');
      expect(scriptEditor.getValue()).toBe('new value');
    });
  });

  describe('Metadata Integration', () => {
    test('should include metadata fields in completions when MetadataMenu is available', () => {
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter);

      const completions = scriptEditor.getCompletions();
      // The completions should be properly initialized with metadata
      expect(mockMetadataMenuAdapter.isMetadataMenuAvailable).toHaveBeenCalled();
      expect(mockMetadataMenuAdapter.getAllFields).toHaveBeenCalled();
    });

    test('should handle MetadataMenu not being available', () => {
      mockMetadataMenuAdapter.isMetadataMenuAvailable.mockReturnValue(false);
      scriptEditor = new ScriptEditor(mockApp, mockMetadataMenuAdapter);

      const completions = scriptEditor.getCompletions();
      expect(completions).toContainEqual(
        expect.objectContaining({value: 'file', meta: 'TFile'})
      );
    });
  });
});
