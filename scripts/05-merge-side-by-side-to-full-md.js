const fs = require('fs/promises');
const path = require('path');
const fg = require('fast-glob');

const ROOT_DIR = process.cwd();
const BASE_DOCS_DIR = path.join(ROOT_DIR, 'scripts');

function getArgValue(name) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  if (!arg) return null;
  return arg.slice(name.length + 1);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function run() {
  const inputDir = path.resolve(
    getArgValue('--input-dir') || path.join(BASE_DOCS_DIR, 'E-side-by-side-md')
  );
  const outputPath = path.resolve(
    getArgValue('--output') || path.join(BASE_DOCS_DIR, 'F-combined-md', 'full-side-by-side.md')
  );

  const files = await fg('**/*.md', {
    cwd: inputDir,
    onlyFiles: true,
    dot: false
  });

  if (files.length === 0) {
    console.log('[Step5] No markdown files found to merge.');
    return;
  }

  const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));
  const mergedSections = [];

  for (const relPath of sortedFiles) {
    const absFilePath = path.join(inputDir, relPath);
    const content = (await fs.readFile(absFilePath, 'utf8')).trim();

    if (!content) {
      console.log(`[Step5][Skip] Empty file: ${relPath}`);
      continue;
    }

    mergedSections.push(content);
    console.log(`[Step5][OK] ${relPath}`);
  }

  if (mergedSections.length === 0) {
    console.log('[Step5] All files are empty, no output generated.');
    return;
  }

  await ensureDir(path.dirname(outputPath));
  const fullMarkdown = `${mergedSections.join('\n\n')}\n`;
  await fs.writeFile(outputPath, fullMarkdown, 'utf8');

  console.log(`\n[Step5] Complete. Merged ${mergedSections.length} files.`);
  console.log(`[Step5] Output: ${outputPath}`);
}

run().catch((error) => {
  console.error('[Step5] Failed:', error);
  process.exit(1);
});