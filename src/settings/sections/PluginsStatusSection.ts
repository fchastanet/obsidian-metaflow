import type {SettingDefinition, SettingDefinitionGroup} from "obsidian";
import type {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import type {TemplaterAdapter} from "@metaflow/externalApi/TemplaterAdapter";

const COMMANDS_USAGE = [
  'Update metadata properties - Add missing fields from fileClass (if automatic option disabled)',
  'Sort metadata properties - Sort current note',
  'Move the note to the right folder - depending on the fileClass',
  'Auto Update metadata fields - Complete metadata processing with default values',
  'Mass-update metadata properties - Apply changes to all notes',
  'Toggle properties panel visibility on editor',
];

interface SupportLink {
  href: string;
  cls: string;
  title: string;
  imgSrc: string;
  imgHeight?: string;
  label?: string;
}

const SUPPORT_LINKS: SupportLink[] = [
  {
    href: 'https://www.buymeacoffee.com/fchastanetl',
    cls: 'metaflow-settings-btn-coffee',
    title: 'buy me a coffee to support my work',
    imgSrc: 'https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=fchastanetl&button_colour=BD5FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00',
  },
  {
    href: 'https://github.com/fchastanet/obsidian-metaflow',
    cls: 'metaflow-settings-btn-github',
    title: 'Give me a star on Github',
    imgSrc: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    imgHeight: '30',
    label: 'Star on GitHub',
  },
];

const ISSUES_URL = 'https://github.com/fchastanet/obsidian-metaflow/issues/';

/**
 * Plugin integrations status, usage help and support links (declarative definitions)
 */
export class PluginsStatusSection {
  constructor(
    private metadataMenuAdapter: MetadataMenuAdapter,
    private templaterAdapter: TemplaterAdapter
  ) { }

  getDefinitions(): SettingDefinitionGroup[] {
    return [
      {
        type: 'group',
        heading: 'Plugin integrations',
        items: [
          PluginsStatusSection.statusDefinition('MetadataMenu',
            () => this.metadataMenuAdapter.isMetadataMenuAvailable(),
            'Please install and enable it for full functionality.'),
          PluginsStatusSection.statusDefinition('Templater',
            () => this.templaterAdapter.isTemplaterAvailable(),
            'Install it to use folder template import functionality.'),
        ],
      },
      {
        type: 'group',
        heading: 'Usage',
        items: [this.usageDefinition()],
      },
      {
        type: 'group',
        heading: 'Enjoying MetaFlow?',
        items: [this.supportDefinition()],
      },
    ];
  }

  private static statusDefinition(
    pluginName: string, isAvailable: () => boolean, unavailableHint: string
  ): SettingDefinition {
    return {
      name: pluginName,
      aliases: ['plugin', 'status', 'integration'],
      render: setting => {
        const available = isAvailable();
        setting.setDesc(available
          ? `✅ ${pluginName} plugin is available and enabled.`
          : `❌ ${pluginName} plugin is not available. ${unavailableHint}`);
        setting.descEl.addClass(available
          ? 'metaflow-settings-plugin-status-available'
          : 'metaflow-settings-plugin-status-unavailable');
      },
    };
  }

  private usageDefinition(): SettingDefinition {
    const desc = createFragment(fragment => {
      fragment.createEl('p', {text: 'Use the command palette to:'});
      const list = fragment.createEl('ul');
      COMMANDS_USAGE.forEach(text => list.createEl('li', {text}));
      fragment.createEl('p', {text: 'Properties are sorted according to the fileClass fields order. Unknown properties are sorted alphabetically and placed at the end if the option is enabled.'});
    });
    return {name: 'Commands', desc, aliases: ['usage', 'help', 'command palette']};
  }

  private supportDefinition(): SettingDefinition {
    return {
      name: 'Support MetaFlow',
      desc: 'If you like this plugin, consider donating to support continued development.',
      searchable: false,
      render: setting => {
        const buttonsDiv = setting.controlEl.createDiv({cls: 'metaflow-settings-buttons'});
        SUPPORT_LINKS.forEach(link => PluginsStatusSection.createSupportLink(buttonsDiv, link));
        const bugDiv = setting.descEl.createDiv({cls: 'bug-report'});
        bugDiv.appendText('Facing issues or have suggestions? ');
        bugDiv.createEl('a', {
          text: 'Submit a report',
          href: ISSUES_URL,
          attr: {target: '_blank', rel: 'noopener', title: 'Submit a report'},
        });
        bugDiv.appendText('.');
      },
    };
  }

  private static createSupportLink(container: HTMLElement, link: SupportLink): void {
    const anchor = container.createEl('a', {
      href: link.href,
      cls: link.cls,
      attr: {target: '_blank', rel: 'noopener', title: link.title},
    });
    const imgAttr: Record<string, string> = {src: link.imgSrc};
    if (link.imgHeight) imgAttr.height = link.imgHeight;
    anchor.createEl('img', {attr: imgAttr});
    if (link.label) anchor.createEl('span', {text: link.label, cls: 'metaflow-settings-btn-github-label'});
  }
}
