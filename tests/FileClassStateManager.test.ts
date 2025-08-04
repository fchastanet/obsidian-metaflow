import {FileClassStateManager} from "../src/managers/FileClassStateManager";
import {MetaFlowService} from "../src/services/MetaFlowService";
import {MetaFlowSettings} from "../src/settings/types";
import {MarkdownView, TFile, WorkspaceLeaf} from "obsidian";

describe("FileClassStateManager", () => {
  let mockApp: any;
  let mockMetaFlowService: any;
  let mockSettings: MetaFlowSettings;
  let manager: FileClassStateManager;
  let mockFile: TFile;

  beforeEach(() => {
    mockSettings = {propertyDefaultValueScripts: [], folderFileClassMappings: []} as MetaFlowSettings;
    mockMetaFlowService = {
      getFileClassFromMetadata: jest.fn()
    };
    mockApp = {
      metadataCache: {
        getFileCache: jest.fn()
      }
    };
    mockFile = {path: "file.md"} as TFile;
    // Patch the manager to use the mock MetaFlowService
    manager = new FileClassStateManager(mockApp, mockSettings);
    (manager as any).metaFlowService = mockMetaFlowService;
  });

  describe("constructor", () => {
    it("should initialize fileClassMap and metaFlowService", () => {
      expect((manager as any).fileClassMap).toBeInstanceOf(Map);
      expect((manager as any).metaFlowService).toBe(mockMetaFlowService);
    });
  });

  describe("handleActiveLeafChange", () => {
    it("should not register file class if leaf/view is null or not MarkdownView", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
      manager.handleActiveLeafChange(null);
      expect(warnSpy).toHaveBeenCalled();
      manager.handleActiveLeafChange({view: {}} as WorkspaceLeaf);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should not register file class if file is missing or not TFile", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
      const leaf = {view: new MarkdownView(null)} as WorkspaceLeaf;
      (leaf.view as any).file = undefined;
      manager.handleActiveLeafChange(leaf);
      expect(warnSpy).toHaveBeenCalled();
      (leaf.view as any).file = {};
      manager.handleActiveLeafChange(leaf);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should call registerFileClass if valid", () => {
      const leaf = {view: new MarkdownView(null)} as WorkspaceLeaf;
      (leaf.view as any).file = mockFile;
      Object.setPrototypeOf(mockFile, TFile.prototype);
      const spy = jest.spyOn(manager as any, "registerFileClass");
      manager.handleActiveLeafChange(leaf);
      expect(spy).toHaveBeenCalledWith(mockFile);
      spy.mockRestore();
    });
  });

  describe("registerFileClass", () => {
    it("should set fileClassMap with correct value from metadata", () => {
      mockApp.metadataCache.getFileCache.mockReturnValue({frontmatter: {fileClass: "book"}});
      mockMetaFlowService.getFileClassFromMetadata.mockReturnValue("book");
      (manager as any).registerFileClass(mockFile);
      expect((manager as any).fileClassMap.get(mockFile.path)).toBe("book");
    });

    it("should set empty string if no fileCache/frontmatter", () => {
      mockApp.metadataCache.getFileCache.mockReturnValue(null);
      (manager as any).registerFileClass(mockFile);
      expect((manager as any).fileClassMap.get(mockFile.path)).toBe("");
    });
  });

  describe("handleMetadataChanged", () => {
    it("should update fileClassMap with new file class", () => {
      (manager as any).fileClassMap.set(mockFile.path, "oldClass");
      mockMetaFlowService.getFileClassFromMetadata.mockReturnValue("newClass");
      const spy = jest.spyOn(console, "log").mockImplementation(() => { });
      manager.handleMetadataChanged(mockFile, {fileClass: "newClass"});
      expect((manager as any).fileClassMap.get(mockFile.path)).toBe("newClass");
      expect(spy).toHaveBeenCalledWith(
        `File class for ${mockFile.path} changed from oldClass to newClass`
      );
      spy.mockRestore();
    });

    it("should not log if file class remains the same", () => {
      (manager as any).fileClassMap.set(mockFile.path, "sameClass");
      mockMetaFlowService.getFileClassFromMetadata.mockReturnValue("sameClass");
      const spy = jest.spyOn(console, "log").mockImplementation(() => { });
      manager.handleMetadataChanged(mockFile, {fileClass: "sameClass"});
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
