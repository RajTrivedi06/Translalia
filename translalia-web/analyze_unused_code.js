#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const srcDir = path.join(__dirname, 'src');
const appDir = path.join(srcDir, 'app');

// Helper functions
function getAllTsFiles(dir, exclude = []) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !exclude.includes(path.basename(fullPath))) {
        traverse(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  // Analyze imports
  const imports = [];
  const importPattern = /^import\s+(?:(?:\*\s+as\s+\w+)|(?:\{([^}]+)\})|(\w+))\s+from\s+['"]([^'"]+)['"]/;
  const importLinePattern = /^import\s+/;

  lines.forEach((line, index) => {
    if (importLinePattern.test(line)) {
      const match = line.match(importPattern);
      if (match) {
        const [, namedImports, defaultImport, from] = match;
        if (namedImports) {
          const names = namedImports.split(',').map(name => name.trim().replace(/\s+as\s+\w+/, ''));
          imports.push(...names.map(name => ({ name, line: index + 1, from })));
        }
        if (defaultImport) {
          imports.push({ name: defaultImport, line: index + 1, from });
        }
      }
    }
  });

  // Check for unused imports
  imports.forEach(importItem => {
    const usagePattern = new RegExp(`\\b${importItem.name}\\b`, 'g');
    const usages = content.match(usagePattern) || [];
    // If only appears once (in the import statement), it's unused
    if (usages.length <= 1) {
      issues.push({
        type: 'unused_import',
        line: importItem.line,
        code: importItem.name,
        from: importItem.from
      });
    }
  });

  // Check for unused variables
  const variablePattern = /(?:const|let|var)\s+(\w+)/g;
  let match;
  while ((match = variablePattern.exec(content)) !== null) {
    const varName = match[1];
    const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
    const usages = content.match(usagePattern) || [];
    if (usages.length <= 1) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({
        type: 'unused_variable',
        line: lineNum,
        code: varName
      });
    }
  }

  return issues;
}

// Main analysis
console.log('Analyzing TypeScript files for unused code...\n');

const srcFiles = getAllTsFiles(srcDir, ['app']);
const appFiles = getAllTsFiles(appDir);

console.log(`Found ${srcFiles.length} files in src/ (excluding app/)`);
console.log(`Found ${appFiles.length} files in src/app/\n`);

const results = {};

// Analyze non-app files
srcFiles.forEach(file => {
  const relativePath = path.relative(process.cwd(), file);
  const issues = analyzeFile(file);
  if (issues.length > 0) {
    results[relativePath] = issues;
  }
});

// Output results
console.log('='.repeat(80));
console.log('UNUSED CODE ANALYSIS RESULTS');
console.log('='.repeat(80));

if (Object.keys(results).length === 0) {
  console.log('No obvious unused code found.');
} else {
  Object.entries(results).forEach(([file, issues]) => {
    console.log(`\n📄 ${file}`);
    console.log('-'.repeat(file.length + 2));

    issues.forEach(issue => {
      switch (issue.type) {
        case 'unused_import':
          console.log(`  Line ${issue.line}: Unused import '${issue.code}' from '${issue.from}'`);
          break;
        case 'unused_variable':
          console.log(`  Line ${issue.line}: Unused variable '${issue.code}'`);
          break;
      }
    });
  });
}

console.log('\n' + '='.repeat(80));