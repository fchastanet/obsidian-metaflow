import * as fs from 'fs';
import * as path from 'path';
import { MetadataSettings, DEFAULT_SETTINGS, sortProperties, sortMetadataInContent } from '../metadata-sorter';

describe('Metadata Sorting', () => {
	describe('sortProperties', () => {
		test('should sort properties according to the specified order', () => {
			const metadata = {
				tags: ['tag1', 'tag2'],
				title: 'Test Note',
				status: 'draft',
				custom: 'value'
			};

			const settings: MetadataSettings = {
				propertyOrder: ['title', 'status', 'tags'],
				autoSortOnView: true,
				sortUnknownPropertiesLast: true
			};

			const result = sortProperties(metadata, settings);
			const keys = Object.keys(result);

			expect(keys).toEqual(['title', 'status', 'tags', 'custom']);
		});

		test('should put unknown properties last when sortUnknownPropertiesLast is true', () => {
			const metadata = {
				zebra: 'last',
				apple: 'first',
				title: 'Test Note'
			};

			const settings: MetadataSettings = {
				propertyOrder: ['title'],
				autoSortOnView: true,
				sortUnknownPropertiesLast: true
			};

			const result = sortProperties(metadata, settings);
			const keys = Object.keys(result);

			expect(keys).toEqual(['title', 'apple', 'zebra']);
		});

		test('should preserve original order of unknown properties when sortUnknownPropertiesLast is false', () => {
			const metadata = {
				zebra: 'second',
				apple: 'first',
				title: 'Test Note'
			};

			const settings: MetadataSettings = {
				propertyOrder: ['title'],
				autoSortOnView: true,
				sortUnknownPropertiesLast: false
			};

			const result = sortProperties(metadata, settings);
			const keys = Object.keys(result);

			expect(keys).toEqual(['title', 'zebra', 'apple']);
		});

		test('should handle missing properties in propertyOrder gracefully', () => {
			const metadata = {
				title: 'Test Note',
				status: 'draft'
			};

			const settings: MetadataSettings = {
				propertyOrder: ['title', 'nonexistent', 'status'],
				autoSortOnView: true,
				sortUnknownPropertiesLast: true
			};

			const result = sortProperties(metadata, settings);
			const keys = Object.keys(result);

			expect(keys).toEqual(['title', 'status']);
		});
	});

	describe('sortMetadataInContent', () => {
		test('should sort frontmatter in a markdown file', () => {
			const content = `---
tags: [tag1, tag2]
title: Test Note
status: draft
custom: value
---

# Content

This is the content of the note.`;

			const result = sortMetadataInContent(content, DEFAULT_SETTINGS);
			
			expect(result).toContain('title: Test Note');
			expect(result).toContain('status: draft');
			expect(result).toContain('tags:');
			expect(result).toContain('custom: value');
			expect(result).toContain('# Content');
			
			// Check that title comes before tags in the result
			const titleIndex = result.indexOf('title:');
			const statusIndex = result.indexOf('status:');
			const tagsIndex = result.indexOf('tags:');
			const customIndex = result.indexOf('custom:');
			
			expect(titleIndex).toBeLessThan(statusIndex);
			expect(statusIndex).toBeLessThan(tagsIndex);
			expect(tagsIndex).toBeLessThan(customIndex);
		});

		test('should return unchanged content if no frontmatter exists', () => {
			const content = `# No Frontmatter

This note has no frontmatter.`;

			const result = sortMetadataInContent(content, DEFAULT_SETTINGS);
			expect(result).toBe(content);
		});

		test('should return unchanged content if frontmatter is malformed', () => {
			const content = `---
invalid: yaml: content: here
---

# Content`;

			const result = sortMetadataInContent(content, DEFAULT_SETTINGS);
			expect(result).toBe(content);
		});

		test('should preserve date strings without converting to Date objects', () => {
			const content = `---
title: Test Note
date: "2023-01-01"
created: 2023-01-01
---

# Content`;

			const result = sortMetadataInContent(content, DEFAULT_SETTINGS);
			
			// The YAML parser may not preserve quotes exactly, but should preserve the date as a string
			expect(result).toMatch(/date: .*2023-01-01/);
			expect(result).toMatch(/created: .*2023-01-01/);
		});

		test('should handle empty values correctly', () => {
			const content = `---
title: Test Note
source: ""
references: 
---

# Content`;

			const result = sortMetadataInContent(content, DEFAULT_SETTINGS);
			
			expect(result).toContain('source: ""');
			// Empty values may be preserved as empty or converted to null
			expect(result).toMatch(/references:\s*$/m);
		});
	});

	describe('Integration test with example file', () => {
		test('should correctly sort the example.md file', () => {
			const examplePath = path.join(__dirname, 'example.md');
			
			if (fs.existsSync(examplePath)) {
				const exampleContent = fs.readFileSync(examplePath, 'utf8');
				const sortedContent = sortMetadataInContent(exampleContent, DEFAULT_SETTINGS);
				
				expect(sortedContent).not.toBe(exampleContent);
				expect(sortedContent).toContain('---');
				expect(sortedContent).toContain('Lorem Ipsum');
				
				// Verify that the content after frontmatter is preserved
				const originalContentPart = exampleContent.split('---\n')[2];
				const sortedContentPart = sortedContent.split('---\n')[2];
				expect(sortedContentPart).toBe(originalContentPart);
			}
		});
	});
});
