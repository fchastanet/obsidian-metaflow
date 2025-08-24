import {UIService} from "./UIService";

describe('UIService', () => {
  let uiService: UIService;

  beforeEach(() => {
    uiService = new UIService();

    // Clear any existing style elements
    const existingStyle = document.getElementById('metaflow-hide-properties');
    if (existingStyle) {
      existingStyle.remove();
    }
  });

  afterEach(() => {
    // Clean up after each test
    const existingStyle = document.getElementById('metaflow-hide-properties');
    if (existingStyle) {
      existingStyle.remove();
    }
  });

  describe('togglePropertiesVisibility', () => {
    it('should add style element when hiding properties', () => {
      uiService.togglePropertiesVisibility(true);

      const styleElement = document.getElementById('metaflow-hide-properties');
      expect(styleElement).not.toBeNull();
      expect(styleElement?.textContent).toContain('.cm-editor .metadata-container');
      expect(styleElement?.textContent).toContain('display: none !important');
    });

    it('should remove style element when showing properties', () => {
      // First hide
      uiService.togglePropertiesVisibility(true);
      expect(document.getElementById('metaflow-hide-properties')).not.toBeNull();

      // Then show
      uiService.togglePropertiesVisibility(false);
      expect(document.getElementById('metaflow-hide-properties')).toBeNull();
    });

    it('should not create duplicate style elements', () => {
      uiService.togglePropertiesVisibility(true);
      uiService.togglePropertiesVisibility(true);

      const styleElements = document.querySelectorAll('#metaflow-hide-properties');
      expect(styleElements.length).toBe(1);
    });

    it('should handle showing when no style element exists', () => {
      // Should not throw an error
      expect(() => uiService.togglePropertiesVisibility(false)).not.toThrow();
      expect(document.getElementById('metaflow-hide-properties')).toBeNull();
    });
  });
});
