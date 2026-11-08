import type {SettingDefinitionControl} from "obsidian";
import type {BooleanSettingKey} from "./types";

export class SettingsUtils {
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

  /**
   * Declarative toggle definition bound to a boolean setting
   */
  static toggleDefinition(
    key: BooleanSettingKey, name: string, desc: string, disabled?: () => boolean
  ): SettingDefinitionControl {
    return {name, desc, control: {type: 'toggle', key, disabled}};
  }

  /**
   * Read a value from an object using a dot-notation path (e.g. `excludeFolders.0`).
   */
  static getValueByPath(source: object, path: string): unknown {
    return path.split('.').reduce<unknown>(
      (current, segment) => (current !== null && typeof current === 'object')
        ? (current as Record<string, unknown>)[segment]
        : undefined,
      source
    );
  }

  /**
   * Write a value into an object using a dot-notation path (e.g. `excludeFolders.0`).
   * Intermediate containers must already exist.
   */
  static setValueByPath(target: object, path: string, value: unknown): void {
    const segments = path.split('.');
    const lastSegment = segments.pop();
    if (lastSegment === undefined) return;
    const parent = SettingsUtils.getValueByPath(target, segments.join('.'));
    const container = segments.length === 0 ? target : parent;
    if (container === null || typeof container !== 'object') {
      throw new Error(`Invalid settings path: ${path}`);
    }
    (container as Record<string, unknown>)[lastSegment] = value;
  }
}
