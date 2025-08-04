import {FrontMatterService} from './FrontMatterService';

describe('FrontMatterService', () => {
  let service: FrontMatterService;

  beforeEach(() => {
    service = new FrontMatterService();
  });

  describe('parseFrontmatter', () => {
    it('should parse valid YAML frontmatter', () => {
      const content = `---\ntitle: Test\ndate: 2025-07-30\n---\nBody text here.`;
      const result = service.parseFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.metadata.title).toBe('Test');
      expect(result?.metadata.date).toBe('2025-07-30');
      expect(result?.restOfContent).toBe('Body text here.');
    });

    it('should return empty frontmatter if no frontmatter present', () => {
      const content = 'No frontmatter here.';
      const result = service.parseFrontmatter(content);
      expect(result).toEqual({
        content: "",
        metadata: {},
        restOfContent: 'No frontmatter here.'
      });
    });

    it('should return empty frontmatter if frontmatter empty', () => {
      const content = `---\n---\nBody`;
      const result = service.parseFrontmatter(content);
      expect(result).toEqual({
        content: "",
        metadata: {},
        restOfContent: 'Body'
      });
    });

    it('should return empty frontmatter if frontmatter with empty lines', () => {
      const content = `---\n   \n\t\n\n---\nBody`;
      const result = service.parseFrontmatter(content);
      expect(result).toEqual({
        content: "",
        metadata: {},
        restOfContent: 'Body'
      });
    });

    it('should return empty frontmatter for malformed YAML', () => {
      const content = `---\ntitle: Test\ndate: [unclosed\n---\nBody`;
      const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const result = service.parseFrontmatter(content);
      expect(spy).toHaveBeenCalledWith('Error parsing YAML frontmatter:', expect.any(Error));
      spy.mockRestore();
      expect(result).toEqual({
        content: "",
        metadata: {},
        restOfContent: content
      });
    });
  });

  describe('parseFileClassFromContent', () => {
    it('should extract fileClass from frontmatter', () => {
      const content = `---\nfileClass: book\ntitle: Test\n---\nText`;
      const result = service.parseFileClassFromContent(content);
      expect(result).toBe('book');
    });

    it('should return null if no fileClass present', () => {
      const content = `---\ntitle: Test\n---\nText`;
      const result = service.parseFileClassFromContent(content);
      expect(result).toBeNull();
    });
  });

  describe('getFileClassFromMetadata', () => {
    it('should return fileClass if present', () => {
      const metadata = {fileClass: 'article'};
      const result = service.getFileClassFromMetadata(metadata);
      expect(result).toBe('article');
    });

    it('should return null if fileClass not present', () => {
      const metadata = {title: 'Test'};
      const result = service.getFileClassFromMetadata(metadata);
      expect(result).toBeNull();
    });
  });

  describe('serializeFrontmatter', () => {
    it('should serialize metadata and append rest of content', () => {
      const metadata = {title: 'Test', date: '2025-07-30'};
      const rest = 'Body text.';
      const result = service.serializeFrontmatter(metadata, rest);
      expect(result.startsWith('---\n')).toBe(true);
      expect(result).toContain('title: Test');
      expect(result).toContain('date: 2025-07-30');
      expect(result.endsWith('Body text.')).toBe(true);
    });

    it('should throw and log error for unserializable metadata', () => {
      const circular: any = {};
      circular.self = circular;
      const rest = 'Body.';
      const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
      expect(() => service.serializeFrontmatter(circular, rest)).toThrow();
      spy.mockRestore();
    });
  });
});
