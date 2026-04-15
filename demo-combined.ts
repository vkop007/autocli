import { transformOutput } from './src/core/output/output-transform.js';
import { formatOutput } from './src/core/output/format-transformer.js';

const githubRepos = {
  data: {
    items: [
      {
        name: 'react',
        language: 'JavaScript',
        stargazers_count: 215000,
        forks_count: 43000,
        open_issues_count: 892,
        created_at: '2013-05-24T16:15:13Z'
      },
      {
        name: 'vue',
        language: 'TypeScript',
        stargazers_count: 207000,
        forks_count: 34000,
        open_issues_count: 623,
        created_at: '2013-07-29T03:24:51Z'
      },
      {
        name: 'svelte',
        language: 'TypeScript',
        stargazers_count: 79000,
        forks_count: 4200,
        open_issues_count: 445,
        created_at: '2016-12-16T22:52:59Z'
      },
      {
        name: 'angular',
        language: 'TypeScript',
        stargazers_count: 94000,
        forks_count: 24000,
        open_issues_count: 2500,
        created_at: '2014-09-18T23:24:16Z'
      },
      {
        name: 'ember',
        language: 'JavaScript',
        stargazers_count: 22000,
        forks_count: 4100,
        open_issues_count: 150,
        created_at: '2011-04-21T22:52:59Z'
      }
    ]
  }
};

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║       FILTERING + FORMAT TRANSFORMATION DEMO               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Example 1: Filter TypeScript + Format as Table
console.log('📊 EXAMPLE 1: TypeScript Frameworks (Table Format)');
console.log('Command: autocli ... --filter \'language = "TypeScript"\' --format table');
console.log('---');
const tsRepos = transformOutput(githubRepos.data, {
  filter: 'language = "TypeScript"'
});
const tsTable = formatOutput(tsRepos, { format: 'table' });
console.log(tsTable);
console.log();

// Example 2: Filter high stars + select specific fields + CSV
console.log('📊 EXAMPLE 2: Popular Repos > 100k Stars (CSV Format)');
console.log('Command: autocli ... --filter \'stargazers_count > 100000\' --select name,stargazers_count,language --format csv');
console.log('---');
const popularRepos = transformOutput(githubRepos.data, {
  filter: 'stargazers_count > 100000',
  select: ['name', 'stargazers_count', 'language']
});
const popularCSV = formatOutput(popularRepos, { format: 'csv' });
console.log(popularCSV);
console.log();

// Example 3: TypeScript + High stars + Markdown
console.log('📊 EXAMPLE 3: Popular TypeScript (Markdown Format)');
console.log('Command: autocli ... --filter \'language = "TypeScript" AND stargazers_count > 50000\' --select name,stargazers_count,forks_count --format markdown');
console.log('---');
const tsMature = transformOutput(githubRepos.data, {
  filter: 'language = "TypeScript" AND stargazers_count > 50000',
  select: ['name', 'stargazers_count', 'forks_count']
});
const tsMarkdown = formatOutput(tsMature, { format: 'markdown' });
console.log(tsMarkdown);
console.log();

// Example 4: HTML output
console.log('📊 EXAMPLE 4: All Repos (HTML Format for Email/Report)');
console.log('Command: autocli ... --select name,language,stargazers_count --format html > repos.html');
console.log('---');
const allRepos = transformOutput(githubRepos.data, {
  select: ['name', 'language', 'stargazers_count']
});
const html = formatOutput(allRepos, { format: 'html' });
console.log(html);
console.log();

// Example 5: YAML for configuration
console.log('📊 EXAMPLE 5: High Stars (YAML Format for Config)');
console.log('Command: autocli ... --filter \'stargazers_count > 50000\' --format yaml > top-repos.yaml');
console.log('---');
const highStars = transformOutput(githubRepos.data, {
  filter: 'stargazers_count > 50000',
  select: ['name', 'language', 'stargazers_count']
});
const yaml = formatOutput(highStars, { format: 'yaml' });
console.log(yaml.substring(0, 300) + '...');
console.log();

console.log('✅ All transformations completed successfully!');
console.log('\n💡 Real-world usage:');
console.log('  autocli developer github repos --json \\');
console.log('    --filter \'language = "TypeScript" AND stargazers_count > 100000\' \\');
console.log('    --select name,stargazers_count,forks_count \\');
console.log('    --format csv > top-ts-repos.csv');
