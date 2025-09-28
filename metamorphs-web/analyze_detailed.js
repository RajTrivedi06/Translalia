#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const srcDir = path.join(__dirname, 'src');

function getAllTsFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function analyzeUnusedExports() {
  const allFiles = getAllTsFiles(srcDir);
  const exports = new Map(); // export name -> { file, line, type }
  const imports = new Map(); // import name -> { file, line, from }

  console.log('🔍 Analyzing exports and imports...');

  // First pass: collect all exports
  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), file);

    lines.forEach((line, index) => {
      // Named exports
      const namedExportMatch = line.match(/^export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/);
      if (namedExportMatch) {
        const name = namedExportMatch[1];
        exports.set(name, { file: relativePath, line: index + 1, type: 'named' });
      }

      // Export statements
      const exportStmtMatch = line.match(/^export\s+\{\s*([^}]+)\s*\}/);
      if (exportStmtMatch) {
        const names = exportStmtMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
        names.forEach(name => {
          exports.set(name, { file: relativePath, line: index + 1, type: 'statement' });
        });
      }
    });
  });

  // Second pass: collect all imports
  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), file);

    lines.forEach((line, index) => {
      const importMatch = line.match(/^import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const [, namedImports, defaultImport, from] = importMatch;

        if (namedImports) {
          const names = namedImports.split(',').map(n => n.trim().replace(/\s+as\s+\w+/, '').replace(/^type\s+/, ''));
          names.forEach(name => {
            imports.set(`${name}:${from}`, { file: relativePath, line: index + 1, from });
          });
        }

        if (defaultImport) {
          imports.set(`${defaultImport}:${from}`, { file: relativePath, line: index + 1, from });
        }
      }
    });
  });

  console.log(`📊 Found ${exports.size} exports and ${imports.size} imports`);

  // Find unused exports
  const unusedExports = [];

  for (const [exportName, exportInfo] of exports) {
    let isUsed = false;

    // Check if this export is imported anywhere
    for (const [importKey, importInfo] of imports) {
      const [importName, importFrom] = importKey.split(':');

      // Convert file path to possible import path
      const exportFileWithoutExt = exportInfo.file.replace(/\.(ts|tsx)$/, '');
      const possibleImportPaths = [
        exportFileWithoutExt,
        exportFileWithoutExt.replace(/^src\//, '@/'),
        './' + path.relative(path.dirname(importInfo.file), exportFileWithoutExt),
        '../' + path.relative(path.dirname(importInfo.file), exportFileWithoutExt)
      ];

      if (importName === exportName && possibleImportPaths.some(p => importFrom.includes(p))) {
        isUsed = true;
        break;
      }
    }

    if (!isUsed) {
      unusedExports.push({ name: exportName, ...exportInfo });
    }
  }

  return unusedExports;
}

function analyzeSpecificFiles() {
  console.log('\n🔍 Analyzing specific problematic files...\n');

  const problematicFiles = [
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/policy.ts',
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/schemas.ts',
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/flags/verify.ts',
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/flags/interview.ts',
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/featureFlags.ts',
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/state/uiLang.ts',
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/state/uploads.ts',
    '/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/store/workspace.ts'
  ];

  problematicFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(process.cwd(), file);
      console.log(`📄 ${relativePath}`);
      console.log('-'.repeat(relativePath.length + 2));

      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Look for exported constants/variables that might be unused
        const exportMatch = line.match(/^export\s+const\s+(\w+)/);
        if (exportMatch) {
          console.log(`  Line ${index + 1}: export const ${exportMatch[1]}`);
        }
      });
      console.log();
    }
  });
}

// Run analysis
console.log('🚀 Starting detailed unused code analysis...\n');

// analyzeSpecificFiles();

const unusedExports = analyzeUnusedExports();

console.log('\n' + '='.repeat(80));
console.log('UNUSED EXPORTS ANALYSIS');
console.log('='.repeat(80));

if (unusedExports.length === 0) {
  console.log('✅ No obviously unused exports found.');
} else {
  console.log(`🔍 Found ${unusedExports.length} potentially unused exports:\n`);

  unusedExports.forEach(exp => {
    console.log(`📄 ${exp.file}:${exp.line}`);
    console.log(`   export ${exp.type}: ${exp.name}`);
    console.log();
  });
}

console.log('='.repeat(80));