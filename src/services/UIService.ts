export class UIService {
  public togglePropertiesVisibility(hide: boolean): void {
    const styleId = 'metaflow-hide-properties';
    let styleEl = document.getElementById(styleId);

    if (hide) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          .cm-editor .metadata-container {
            display: none !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }
}
