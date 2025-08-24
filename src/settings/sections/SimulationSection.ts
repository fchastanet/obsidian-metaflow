import {App, Setting} from "obsidian";
import {MetadataMenuAdapter} from "../../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "../../externalApi/TemplaterAdapter";
import {MetaFlowSettings} from "../types";
import {LogNoticeManager} from "../../managers/LogNoticeManager";
import {ObsidianAdapter} from "../../externalApi/ObsidianAdapter";
import {MetaFlowService} from "../../services/MetaFlowService";
import {FrontmatterParseResult, FrontMatterService} from "../../services/FrontMatterService";

export class SimulationSection {
  constructor(
    private app: App,
    private container: HTMLElement,
    private settings: MetaFlowSettings,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private obsidianAdapter: ObsidianAdapter,
    private templaterAdapter: TemplaterAdapter,
    private metaFlowService: MetaFlowService,
  ) { }

  render() {
    this.container.empty();
    if (!this.metadataMenuAdapter.isMetadataMenuAvailable() || !this.templaterAdapter.isTemplaterAvailable()) {
      this.container.setAttr('style', 'display: none');
      return;
    }
    this.container.setAttr('style', 'display: block');
    this.container.empty();

    // FileClass selection
    const fileClassSetting = new Setting(this.container)
      .setName('FileClass for simulation')
      .setDesc('Select the fileClass to use for testing');

    let fileClassSelect: HTMLSelectElement;
    fileClassSetting.addDropdown(dropdown => {
      fileClassSelect = dropdown.selectEl;
      dropdown.addOption('', 'Select a fileClass...');

      // Get available fileClasses from MetadataMenu
      if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        try {
          const metadataMenuPlugin = this.app.plugins?.plugins?.['metadata-menu'];
          if (metadataMenuPlugin?.fieldIndex?.fileClassesFields) {
            const fileClasses = Array.from(metadataMenuPlugin.fieldIndex.fileClassesFields.keys()).sort();
            fileClasses.forEach(fileClass => {
              const fileClassName = String(fileClass);
              dropdown.addOption(fileClassName, fileClassName);
            });
          }
        } catch (error) {
          console.error('Error getting fileClasses:', error);
        }
      }

      // Also add fileClasses from folder mappings
      this.settings.folderFileClassMappings.forEach(mapping => {
        if (mapping.fileClass && !dropdown.selectEl.querySelector(`option[value="${mapping.fileClass}"]`)) {
          dropdown.addOption(mapping.fileClass, mapping.fileClass);
        }
      });
    });

    // Input frontmatter
    const sampleSetting = new Setting(this.container)
      .setName('Frontmatter content sample')
      .setDesc('Enter frontmatter content sample to test with your configuration');
    sampleSetting.addTextArea(textarea => {
      textarea.inputEl.placeholder = `---
title: Sample Title
author:
date:
tags: []
----

This is sample content for testing.`;
      textarea.inputEl.classList.add('metaflow-settings-simulation-textarea');
    });
    const inputTextarea = sampleSetting.settingEl.querySelector('textarea') as HTMLTextAreaElement;

    // Run simulation button
    const simulationButtonContainer = this.container.createEl('div', {cls: 'setting-item'});
    const simulateButton = simulationButtonContainer.createEl('button', {text: '🚀 Run Simulation'});
    simulateButton.classList.add('metaflow-settings-simulation-btn');

    // Status message
    const statusDiv = simulationButtonContainer.createEl('div');
    statusDiv.classList.add('metaflow-settings-simulation-status');
    statusDiv.classList.add('metaflow-settings-hide');

    // Output container
    const outputContainer = this.container.createEl('div', {cls: 'setting-item'});
    outputContainer.createEl('p', {text: 'Simulation Output'});

    const outputTextarea = outputContainer.createEl('textarea', {
      placeholder: 'Simulation results will appear here...'
    });
    outputTextarea.classList.add('metaflow-settings-simulation-output');
    outputTextarea.readOnly = true;

    // Event listener for simulation
    simulateButton.addEventListener('click', async () => {
      const selectedFileClass = fileClassSelect.value;
      let inputContent = inputTextarea.value.trim();

      // Validation
      if (!selectedFileClass) {
        this.showStatus(statusDiv, 'Please select a fileClass for simulation.', 'error');
        return;
      }

      if (!inputContent) {
        this.showStatus(statusDiv, 'Please enter some input frontmatter content.', 'error');
        return;
      }

      // inject fileClass inside inputContent metadata
      const frontMatterService = new FrontMatterService();
      const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
      const parseResult: FrontmatterParseResult | null = frontMatterService.parseFrontmatter(inputContent);
      if (parseResult === null) {
        this.showStatus(statusDiv, `❌ Invalid input sample`, 'error');
        return;
      }
      parseResult.metadata[fileClassAlias] = selectedFileClass;
      inputContent = frontMatterService.serializeFrontmatter(parseResult.metadata, parseResult.restOfContent);

      const originalGetFileClassFromMetadata = this.metadataMenuAdapter.getFileClassFromMetadata;
      try {
        simulateButton.disabled = true;
        simulateButton.textContent = '⏳ Running...';
        this.showStatus(statusDiv, 'Running simulation...', 'info');

        // Create a mock file object for simulation
        const mockFile = ObsidianAdapter.createMockTFile('folder/simulation-test.md');

        // Use the provided MetaFlowService instance
        const metaFlowService = this.metaFlowService;

        // Override the fileClass detection to use the selected one
        this.metadataMenuAdapter.getFileClassFromMetadata = () => selectedFileClass;

        // Run the simulation
        const logManager = new LogNoticeManager(this.obsidianAdapter);
        const result = metaFlowService.processContent(inputContent, mockFile, logManager);

        // Display results
        outputTextarea.value = result;
        this.showStatus(statusDiv, `✅ Simulation completed successfully with fileClass: ${selectedFileClass}`, 'success');

      } catch (error) {
        console.error('Simulation error:', error);
        outputTextarea.value = `Error during simulation:\n${error.message}\n\nStack trace:\n${error.stack}`;
        this.showStatus(statusDiv, `❌ Simulation failed: ${error.message}`, 'error');
      } finally {
        // Restore original method
        this.metadataMenuAdapter.getFileClassFromMetadata = originalGetFileClassFromMetadata;

        simulateButton.disabled = false;
        simulateButton.textContent = '🚀 Run Simulation';
      }
    });

    // Pre-fill with example content
    inputTextarea.value = SAMPLE;
  }

  private showStatus(statusDiv: HTMLElement, message: string, type: 'success' | 'error' | 'info'): void {
    statusDiv.textContent = message;
    statusDiv.className = 'metaflow-settings-simulation-status';
    statusDiv.classList.remove('success', 'error', 'info', 'metaflow-settings-hide');
    statusDiv.classList.add(type);
  }
}

const SAMPLE = `---
title:
author:
date:
tags: []
status:
---

This is sample content for testing MetaFlow configuration.

The simulation will:
1. Parse this frontmatter
2. Apply the selected fileClass
3. Insert missing fields from MetadataMenu
4. Execute property default value scripts
5. Sort properties according to your settings
`;
