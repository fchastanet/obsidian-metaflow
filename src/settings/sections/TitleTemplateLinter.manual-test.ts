import {TitleTemplateLinter} from './TitleTemplateLinter';

// Simple manual test runner
const linter = new TitleTemplateLinter();

console.log('=== TitleTemplateLinter Manual Tests ===\n');

// Test template validation
console.log('Template Tests:');
console.log('1. Valid template:', linter.validateTemplate('{{title}} - {{author}}'));
console.log('2. Empty template:', linter.validateTemplate(''));
console.log('3. Invalid braces:', linter.validateTemplate('{{title} - {{author}}'));
console.log('4. Single braces:', linter.validateTemplate('{title} - {{author}}'));
console.log('5. Empty variable:', linter.validateTemplate('{{title}} {{}} {{author}}'));

console.log('\nScript Tests:');
console.log('1. Valid script:', linter.validateScript('return "Hello World";'));
console.log('2. Empty script:', linter.validateScript(''));
console.log('3. No return:', linter.validateScript('const title = "Hello";'));
console.log('4. Syntax error:', linter.validateScript('return "Hello;'));
console.log('5. Security issue:', linter.validateScript('return eval("test");'));
console.log('6. Complex valid:', linter.validateScript(`
  if (metadata.title) {
    return metadata.title;
  } else {
    return file.basename;
  }
`));

export { };
