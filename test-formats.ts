import { formatOutput } from './src/core/output/format-transformer.js';

const testData = {
  data: {
    items: [
      {
        name: 'React',
        language: 'JavaScript',
        stars: 215000,
        forks: 43000,
        url: 'https://github.com/facebook/react'
      },
      {
        name: 'Vue',
        language: 'TypeScript',
        stars: 207000,
        forks: 34000,
        url: 'https://github.com/vuejs/vue'
      },
      {
        name: 'Angular',
        language: 'TypeScript',
        stars: 94000,
        forks: 24000,
        url: 'https://github.com/angular/angular'
      }
    ]
  }
};

console.log('==== FORMAT TRANSFORMER TESTS ====\n');

// Test 1: CSV format
console.log('✅ TEST 1: CSV Format');
console.log('---');
const csv = formatOutput(testData, { format: 'csv', headers: true });
console.log(csv);
console.log();

// Test 2: Table format
console.log('✅ TEST 2: Table Format');
console.log('---');
const table = formatOutput(testData, { format: 'table', maxWidth: 30 });
console.log(table);
console.log();

// Test 3: YAML format
console.log('✅ TEST 3: YAML Format');
console.log('---');
const yaml = formatOutput(testData, { format: 'yaml' });
console.log(yaml);
console.log();

// Test 4: Markdown format
console.log('✅ TEST 4: Markdown Table Format');
console.log('---');
const markdown = formatOutput(testData, { format: 'markdown' });
console.log(markdown);
console.log();

// Test 5: HTML format
console.log('✅ TEST 5: HTML Table Format');
console.log('---');
const html = formatOutput(testData, { format: 'html' });
console.log(html);
console.log();

// Test 6: JSON format (default)
console.log('✅ TEST 6: JSON Format (Default)');
console.log('---');
const json = formatOutput(testData, { format: 'json' });
console.log(json.substring(0, 200) + '...');
console.log();

// Test 7: Direct array input (no wrapping)
console.log('✅ TEST 7: Direct Array Input');
console.log('---');
const directArray = [
  { id: 1, title: 'Task 1', done: true },
  { id: 2, title: 'Task 2', done: false }
];
const directCSV = formatOutput(directArray, { format: 'csv' });
console.log(directCSV);
console.log();

console.log('🎉 All format transformer tests completed!');
