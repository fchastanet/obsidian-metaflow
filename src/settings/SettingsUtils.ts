import {Setting} from "obsidian";

export class SettingsUtils {
  static createSection(containerEl: HTMLElement, title: string): Setting {
    const section = new Setting(containerEl)
      .setName(title)
      .setHeading();

    return section;
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
