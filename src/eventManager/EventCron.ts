import {FileStateCache} from "./cache/FileStateCache";
import type {MetaFlowSettings} from "@metaflow/settings/types";
import {TYPES} from "@metaflow/di";
import {inject} from "inversify";
import {FileProcessor} from "./FileProcessor";
import {MetaFlowException} from "@metaflow/MetaFlowException";
import {SkipException} from "@metaflow/SkipException";

class CronInterruptException extends Error {
}

export default class EventCron {
  private cronInterval: number | null = null;

  constructor(
    @inject(TYPES.FileStateCache) private fileStateCache: FileStateCache,
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.FileProcessor) private fileProcessor: FileProcessor,
    private nowFn = Date.now,
  ) {
  }

  public start() {
    if (this.cronInterval !== null) {
      console.warn('EventCron is already running.');
      return;
    }
    const intervalMs = this.settings.eventCronIntervalMs;
    this.cronInterval = window.setInterval(() => this.run(), intervalMs);
    console.info(`EventCron started with an interval of ${this.settings.eventCronIntervalMs / 1000} seconds.`);
  }

  public stop() {
    if (this.cronInterval === null) {
      console.warn('EventCron is not running.');
      return;
    }
    clearInterval(this.cronInterval);
    this.cronInterval = null;
    console.info('EventCron stopped.');
  }

  private async run(): Promise<void> {
    if (this.settings.debugMode) {
      console.debug('EventCron: Running scheduled tasks...');
    }
    const startTime = this.nowFn();
    try {
      this.fileStateCache.evictStaleEntries();
      this.checkCronDuration(startTime);

      const dirtyFiles = this.fileStateCache.getDirtyFilePaths();
      console.info(`EventCron: ${dirtyFiles.length} dirty files to process.`, dirtyFiles);
      for (const filePath of dirtyFiles) {
        try {
          const state = this.fileStateCache.popState(filePath);
          if (state) {
            const {file: newFile, state: newState} = await this.fileProcessor.processFile(filePath, state);
            this.fileStateCache.setState(newFile.path, newState, false);
          } else {
            console.warn(`EventCron: No state found for dirty file ${filePath}`);
          }
        } catch (error) {
          if (error instanceof SkipException) {
            // Not an error, just skip processing
            continue;
          }
          if (error instanceof MetaFlowException) {
            // already logged in MetaFlowService
            continue;
          }
          throw error;
        }
        this.checkCronDuration(startTime);
      }

      if (this.settings.debugMode) {
        console.debug('EventCron: Completed scheduled tasks.');
      }
    } catch (error) {
      if (error instanceof CronInterruptException) {
        return; // Gracefully exit if interrupted
      }
      console.error('EventCron encountered an error during execution.', error);
    }
  }

  private checkCronDuration(startDatetime: number) {
    const duration = this.nowFn() - startDatetime;
    if (duration > this.settings.eventCronIntervalMs - 1000) {
      console.warn('EventCron: Scheduled tasks are taking longer than the interval.');
      throw new CronInterruptException();
    }
  }
}
