import {App} from "obsidian";
import {MetaFlowSettings} from "../settings/types";
import {ScriptContextService} from "../services/ScriptContextService";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {FrontMatterService} from "../services/FrontMatterService";
import {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {FileValidationService} from "../services/FileValidationService";
import {FileClassDeductionService} from "../services/FileClassDeductionService";
import {PropertyManagementService} from "../services/PropertyManagementService";
import {FileOperationsService} from "../services/FileOperationsService";
import {NoteTitleService} from "../services/NoteTitleService";
import {UIService} from "../services/UIService";

/**
 * Service container that provides access to all MetaFlow services
 */
export class ServiceContainer {
  public readonly app: App;
  public readonly metaFlowSettings: MetaFlowSettings;

  // Core services
  public readonly scriptContextService: ScriptContextService;
  public readonly metadataMenuAdapter: MetadataMenuAdapter;
  public readonly frontMatterService: FrontMatterService;
  public readonly templaterAdapter: TemplaterAdapter;
  public readonly obsidianAdapter: ObsidianAdapter;

  // Domain services
  public readonly fileValidationService: FileValidationService;
  public readonly fileClassDeductionService: FileClassDeductionService;
  public readonly propertyManagementService: PropertyManagementService;
  public readonly fileOperationsService: FileOperationsService;
  public readonly noteTitleService: NoteTitleService;
  public readonly uiService: UIService;

  constructor(app: App, metaFlowSettings: MetaFlowSettings) {
    this.app = app;
    this.metaFlowSettings = metaFlowSettings;

    // Initialize core services
    this.scriptContextService = new ScriptContextService(app, metaFlowSettings);
    this.metadataMenuAdapter = new MetadataMenuAdapter(app, metaFlowSettings);
    this.frontMatterService = new FrontMatterService();
    this.templaterAdapter = new TemplaterAdapter(app, metaFlowSettings);
    this.obsidianAdapter = new ObsidianAdapter(app, metaFlowSettings);

    // Initialize domain services
    this.fileValidationService = new FileValidationService(
      metaFlowSettings,
      this.metadataMenuAdapter,
      this.templaterAdapter,
      this.obsidianAdapter
    );

    this.fileClassDeductionService = new FileClassDeductionService(
      metaFlowSettings,
      this.obsidianAdapter,
      this.metadataMenuAdapter,
      this.frontMatterService
    );

    this.propertyManagementService = new PropertyManagementService(
      metaFlowSettings,
      this.metadataMenuAdapter,
      this.scriptContextService
    );

    this.noteTitleService = new NoteTitleService(
      metaFlowSettings,
      this.scriptContextService
    );

    this.fileOperationsService = new FileOperationsService(
      app,
      metaFlowSettings,
      this.obsidianAdapter,
      this.fileValidationService,
      this.noteTitleService
    );

    this.uiService = new UIService();
  }
}
