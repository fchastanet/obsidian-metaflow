import type {App} from "obsidian";
import type {MetaFlowSettings} from "@metaflow/settings/types";

/**
 * Shared dependencies given to declarative settings sections.
 */
export interface SettingsSectionContext {
  app: App;
  settings: MetaFlowSettings;
  /** Persist the settings */
  save(): Promise<void>;
  /** Rebuild the setting definitions (needed when items are added/removed or values changed indirectly) */
  refresh(): void;
}
