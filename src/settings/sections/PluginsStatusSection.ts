import {App} from "obsidian";
import {MetadataMenuAdapter} from "../../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "../../externalApi/TemplaterAdapter";

export class PluginsStatusSection {
  constructor(
    private app: App,
    private container: HTMLElement,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private templaterAdapter: TemplaterAdapter
  ) { }

  render() {
    // Add some help text
    this.container.createEl('p', {text: 'Usage', cls: 'metaflow-settings-section-header'});
    this.container.createEl('p', {text: 'Use the command palette to:'});
    const list = this.container.createEl('ul');
    list.createEl('li', {text: 'Update metadata properties - Add missing fields from fileClass (if automatic option disabled)'});
    list.createEl('li', {text: 'Sort metadata properties - Sort current note'});
    list.createEl('li', {text: 'Move the note to the right folder - depending on the fileClass'});
    list.createEl('li', {text: 'Auto Update metadata fields - Complete metadata processing with default values'});
    list.createEl('li', {text: 'Mass-update metadata properties - Apply changes to all notes'});
    list.createEl('li', {text: 'Toggle properties panel visibility on editor'});
    this.container.createEl('p', {text: 'Properties will be sorted according to the order specified above. Unknown properties will be sorted alphabetically and placed at the end if the option is enabled.'});

    // Plugins status
    const metadataMenuStatus = this.container.createEl('p', {text: ''});
    const templaterStatus = this.container.createEl('p', {text: ''});
    this.updatePluginsStatus(metadataMenuStatus, templaterStatus);

    // Add MetaFlow plugin support information
    const pluginSupport = this.container.createDiv({cls: 'vt-support'});
    // Section header
    pluginSupport.createEl('p', {text: 'Enjoying MetaFlow?', cls: 'metaflow-settings-section-header'});
    // Description
    pluginSupport.createEl('div', {text: 'If you like this Plugin, consider donating to support continued development:', cls: 'setting-item-description'});
    // Buttons row
    const buttonsDiv = pluginSupport.createDiv({cls: 'metaflow-settings-buttons'});
    // Buy me a coffee button
    const coffeeA = buttonsDiv.createEl('a', {
      href: 'https://www.buymeacoffee.com/fchastanetl',
      cls: 'metaflow-settings-btn-coffee',
      attr: {
        target: '_blank',
        rel: 'noopener',
        title: 'buy me a coffee to support my work'
      }
    });
    coffeeA.createEl('img', {
      attr: {
        src: 'https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=fchastanetl&button_colour=BD5FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00'
      }
    });
    // GitHub star button
    const githubA = buttonsDiv.createEl('a', {
      href: 'https://github.com/fchastanet/obsidian-metaflow',
      cls: 'metaflow-settings-btn-github',
      attr: {
        target: '_blank',
        rel: 'noopener',
        title: 'Give me a star on Github'
      }
    });
    githubA.createEl('img', {
      attr: {
        height: '30',
        border: '0',
        src: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
      }
    });
    githubA.createEl('span', {text: 'Star on GitHub', cls: 'metaflow-settings-btn-github-label'});
    // Bug report
    const bugDiv = pluginSupport.createDiv({cls: 'bug-report'});
    bugDiv.appendText('Facing issues or have suggestions? ');
    const bugA = bugDiv.createEl('a', {
      href: 'https://github.com/fchastanet/obsidian-metaflow/issues/',
      attr: {
        target: '_blank',
        rel: 'noopener',
        title: 'Submit a report'
      }
    });
    bugA.setText('Submit a report');
    bugDiv.appendText('.');
  }

  private updatePluginsStatus(metadataMenuStatus: HTMLElement, templaterStatus: HTMLElement): void {
    // MetadataMenu status
    if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      const statusMessage = metadataMenuStatus.createEl('p', {cls: 'metaflow-settings-plugin-status-available'});
      statusMessage.appendText('✅ ');
      const strong = statusMessage.createEl('strong');
      strong.setText('MetadataMenu');
      statusMessage.appendText(' plugin is available and enabled.');
    } else {
      const statusMessage = metadataMenuStatus.createEl('p', {cls: 'metaflow-settings-plugin-status-unavailable'});
      statusMessage.appendText('❌ ');
      const strong = statusMessage.createEl('strong');
      strong.setText('MetadataMenu');
      statusMessage.appendText(' plugin is not available. Please install and enable it for full functionality.');
    }

    // Templater status
    if (this.templaterAdapter.isTemplaterAvailable()) {
      const statusMessage = templaterStatus.createEl('p', {cls: 'metaflow-settings-plugin-status-available'});
      statusMessage.appendText('✅ ');
      const strong = statusMessage.createEl('strong');
      strong.setText('Templater');
      statusMessage.appendText(' plugin is available and enabled.');
    } else {
      const statusMessage = templaterStatus.createEl('p', {cls: 'metaflow-settings-plugin-status-unavailable'});
      statusMessage.appendText('❌ ');
      const strong = statusMessage.createEl('strong');
      strong.setText('Templater');
      statusMessage.appendText(' plugin is not available. Install it to use folder template import functionality.');
    }
  }
}
