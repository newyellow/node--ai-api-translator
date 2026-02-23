const fs = require('fs/promises');
const path = require('path');
const fg = require('fast-glob');
const mammoth = require('mammoth');
const TurndownService = require('turndown');

const ROOT_DIR = process.cwd();
const BASE_DOCS_DIR = path.join(ROOT_DIR, 'scripts');
const INPUT_DIR = path.join(BASE_DOCS_DIR, 'A-source-docs');
const OUTPUT_DIR = path.join(BASE_DOCS_DIR, 'B-docs-to-md');

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

function normalizeMarkdown(content) {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function convertFileToMarkdown(absInputPath) {
  const ext = path.extname(absInputPath).toLowerCase();

  if (ext === '.md' || ext === '.markdown') {
    const content = await fs.readFile(absInputPath, 'utf8');
    return normalizeMarkdown(content);
  }

  if (ext === '.txt') {
    const content = await fs.readFile(absInputPath, 'utf8');
    return normalizeMarkdown(content);
  }

  if (ext === '.html' || ext === '.htm') {
    const html = await fs.readFile(absInputPath, 'utf8');
    return normalizeMarkdown(turndownService.turndown(html));
  }

  if (ext === '.docx') {
    const result = await mammoth.convertToHtml({ path: absInputPath });
    return normalizeMarkdown(turndownService.turndown(result.value));
  }

  return null;
}

async function run() {
  await ensureDir(OUTPUT_DIR);

  const files = await fg('**/*.*', {
    cwd: INPUT_DIR,
    onlyFiles: true,
    dot: false
  });

  if (files.length === 0) {
    console.log('[Step1] No source files found in scripts/A-source-docs.');
    return;
  }

  let converted = 0;
  let skipped = 0;

  for (const relPath of files) {
    const absInputPath = path.join(INPUT_DIR, relPath);
    const outputRelPath = relPath.replace(/\.[^/.]+$/, '.md');
    const absOutputPath = path.join(OUTPUT_DIR, outputRelPath);

    const markdown = await convertFileToMarkdown(absInputPath);

    if (markdown == null) {
      skipped += 1;
      console.log(`[Step1][Skip] Unsupported file type: ${relPath}`);
      continue;
    }

    await ensureDir(path.dirname(absOutputPath));
    await fs.writeFile(absOutputPath, markdown, 'utf8');
    converted += 1;
    console.log(`[Step1][OK] ${relPath} -> ${outputRelPath}`);
  }

  console.log(`\n[Step1] Complete. Converted: ${converted}, Skipped: ${skipped}`);
}

run().catch((error) => {
  console.error('[Step1] Failed:', error);
  process.exit(1);
});