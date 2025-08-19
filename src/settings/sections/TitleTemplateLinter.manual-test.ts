import {TitleTemplateLinter} from './TitleTemplateLinter';
import {TitleScriptLinter} from './TitleScriptLinter';

// Simple manual test runner
const templateLinter = new TitleTemplateLinter();
const scriptLinter = new TitleScriptLinter();

console.log('=== TitleTemplateLinter Manual Tests ===\n');

// Test template validation
console.log('Template Tests:');
console.log('1. Valid template:', templateLinter.validateTemplate('{{title}} - {{author}}'));
console.log('2. Empty template:', templateLinter.validateTemplate(''));
console.log('3. Invalid braces:', templateLinter.validateTemplate('{{title} - {{author}}'));
console.log('4. Single braces:', templateLinter.validateTemplate('{title} - {{author}}'));
console.log('5. Empty variable:', templateLinter.validateTemplate('{{title}} {{}} {{author}}'));

console.log('\nScript Tests:');
console.log('1. Valid script:', scriptLinter.validateScript('return "Hello World";'));
console.log('2. Empty script:', scriptLinter.validateScript(''));
console.log('3. No return:', scriptLinter.validateScript('const title = "Hello";'));
console.log('4. Syntax error:', scriptLinter.validateScript('return "Hello;'));
console.log('5. Security issue:', scriptLinter.validateScript('return eval("test");'));
console.log('6. Complex valid:', scriptLinter.validateScript(`
  if (metadata.title) {
    return metadata.title;
  } else {
    return file.basename;
  }
`));

export { };
