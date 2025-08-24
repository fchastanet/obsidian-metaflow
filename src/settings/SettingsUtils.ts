export class SettingsUtils {
  static createSection(containerEl: HTMLElement, title: string): HTMLElement {
    // General Settings - Collapsible
    const section = containerEl.createEl('details', {cls: 'setting-details'});
    section.open = false; // Collapsed by default
    const summary = section.createEl('summary', {cls: 'setting-summary'});
    summary.classList.add('metaflow-settings-summary');

    summary.createEl('p', {text: title, cls: 'metaflow-settings-section-header'});

    const generalToggleDiv = summary.createEl('div', {cls: 'setting-item-control'});
    const generalToggleButton = generalToggleDiv.createEl('button', {cls: 'mod-cta metaflow-settings-toggle-button'});

    // Prevent button click from triggering summary toggle
    generalToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      section.open = !section.open;
    });

    const sectionContent = section.createDiv({cls: 'section-content'});

    return sectionContent;
  }

  static createCheckboxWithLabel(container: HTMLElement, options: {
    label?: string,
    labelClass: string,
    labelTitle: string,
    checkboxClass: string,
    checked?: boolean
  }): [HTMLInputElement, HTMLElement] {
    const enabledLabel = container.createEl('label', {title: options.labelTitle});
    enabledLabel.classList.add(options.labelClass);
    const checkbox = enabledLabel.createEl('input', {type: 'checkbox'});
    checkbox.classList.add(options.checkboxClass);
    checkbox.checked = options.checked ?? false;
    if (options.label) enabledLabel.appendChild(document.createTextNode(options.label));
    return [checkbox, enabledLabel];
  }

  static createRadioButtonWithLabel(container: HTMLElement, options: {
    label?: string,
    labelClass: string,
    labelTitle: string,
    radioClass: string,
    radioName: string,
    radioValue: string,
    checked?: boolean
  }): [HTMLInputElement, HTMLElement] {
    const enabledLabel = container.createEl('label', {title: options.labelTitle});
    enabledLabel.classList.add(options.labelClass);
    const radio = enabledLabel.createEl('input', {type: 'radio', attr: {name: options.radioName, value: options.radioValue}});
    radio.classList.add(options.radioClass);
    radio.checked = options.checked ?? false;
    if (options.label) enabledLabel.appendChild(document.createTextNode(options.label));
    return [radio, enabledLabel];
  }

  static emptyAndCreate(container: HTMLElement, cls: string): HTMLElement {
    container.empty();
    return container.createDiv({cls});
  }
}
