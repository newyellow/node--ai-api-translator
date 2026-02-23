const fs = require('fs/promises');
const path = require('path');
const fg = require('fast-glob');
const dotenv = require('dotenv');

dotenv.config();

const ROOT_DIR = process.cwd();
const BASE_DOCS_DIR = path.join(ROOT_DIR, 'scripts');
const INPUT_DIR = path.join(BASE_DOCS_DIR, 'B-docs-to-md');
const OUTPUT_DIR = path.join(BASE_DOCS_DIR, 'C-splited-sections-md');

function getArgValue(name) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  if (!arg) return null;
  return arg.slice(name.length + 1);
}

function removeGlobalFlag(flags) {
  return (flags || '').replace(/g/g, '');
}

function sanitizeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function extractHeading(line) {
  const heading = line.match(/^#{1,6}\s+(.+)$/);
  return heading ? heading[1].trim() : null;
}

function splitMarkdownByLineRegex(markdown, splitRegex) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  let startLine = 1;
  let currentLines = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i];
    const isSplitLine = splitRegex.test(line);

    if (isSplitLine && currentLines.length > 0) {
      chunks.push({
        startLine,
        endLine: lineNumber - 1,
        content: currentLines.join('\n').trim()
      });
      currentLines = [line];
      startLine = lineNumber;
      continue;
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    chunks.push({
      startLine,
      endLine: lines.length,
      content: currentLines.join('\n').trim()
    });
  }

  return chunks.filter((chunk) => chunk.content.length > 0);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function run() {
  const splitPatternRaw =
    getArgValue('--split-regex') || process.env.SPLIT_REGEX || '^#\\s*△\\s*Section\\b';
  const splitFlagsRaw =
    getArgValue('--split-regex-flags') || process.env.SPLIT_REGEX_FLAGS || '';
  const splitFlags = removeGlobalFlag(splitFlagsRaw);
  const splitRegex = new RegExp(splitPatternRaw, splitFlags);

  await ensureDir(OUTPUT_DIR);

  const files = await fg('**/*.md', {
    cwd: INPUT_DIR,
    onlyFiles: true,
    dot: false
  });

  if (files.length === 0) {
    console.log('[Step2] No markdown files found in scripts/B-docs-to-md.');
    return;
  }

  console.log(`[Step2] Split regex: /${splitPatternRaw}/${splitFlags}`);

  for (const relPath of files) {
    const absInputPath = path.join(INPUT_DIR, relPath);
    const sourceMarkdown = await fs.readFile(absInputPath, 'utf8');
    const chunks = splitMarkdownByLineRegex(sourceMarkdown, splitRegex);

    if (chunks.length === 0) {
      console.log(`[Step2][Skip] Empty markdown: ${relPath}`);
      continue;
    }

    const parsed = path.parse(relPath);
    const outputDir = path.join(OUTPUT_DIR, parsed.dir, parsed.name);
    await ensureDir(outputDir);

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const firstLine = chunk.content.split('\n')[0] || '';
      const headingText = extractHeading(firstLine) || 'section';
      const safeHeading = sanitizeFileName(headingText) || 'section';
      const batchNumber = String(i + 1).padStart(3, '0');
      const chunkFileName = `${batchNumber}-${safeHeading}-L${chunk.startLine}-L${chunk.endLine}.md`;
      const absOutputPath = path.join(outputDir, chunkFileName);

      await fs.writeFile(absOutputPath, `${chunk.content}\n`, 'utf8');
      console.log(`[Step2][OK] ${relPath} -> ${path.join(parsed.name, chunkFileName)}`);
    }

    console.log(`[Step2][Done] ${relPath} (${chunks.length} chunks)`);
  }

  console.log('\n[Step2] Complete.');
}

run().catch((error) => {
  console.error('[Step2] Failed:', error);
  process.exit(1);
});