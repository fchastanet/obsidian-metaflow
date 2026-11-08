import {SettingPage} from "obsidian";

/**
 * Renders a settings section into the given container.
 */
export type SectionRenderer = (containerEl: HTMLElement) => void;

/**
 * Settings sub-page bridging an imperative section view with the declarative
 * settings API (`SettingDefinitionPage.page` factory).
 * The page is re-created each time the user opens it.
 */
export class SectionSettingPage extends SettingPage {
  constructor(
    title: string,
    private readonly renderer: SectionRenderer,
    private readonly description?: string,
    private readonly onHide?: () => void,
  ) {
    super();
    this.title = title;
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.addClass('metaflow-settings-page');
    if (this.description) {
      this.containerEl.createEl('p', {text: this.description, cls: 'setting-item-description'});
    }
    this.renderer(this.containerEl.createDiv());
  }

  hide(): void {
    super.hide();
    this.onHide?.();
  }
}
