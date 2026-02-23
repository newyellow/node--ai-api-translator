const fs = require('fs/promises');
const path = require('path');
const fg = require('fast-glob');

const ROOT_DIR = process.cwd();
const BASE_DOCS_DIR = path.join(ROOT_DIR, 'scripts');
const SOURCE_MD_DIR = path.join(BASE_DOCS_DIR, 'C-splited-sections-md');
const TRANSLATED_MD_DIR = path.join(BASE_DOCS_DIR, 'D-translated-md');
const OUTPUT_DIR = path.join(BASE_DOCS_DIR, 'E-side-by-side-md');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function splitByParagraph(markdown) {
  return markdown
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildBilingualMarkdown(translatedMd, sourceMd) {
  const translatedParts = splitByParagraph(translatedMd);
  const sourceParts = splitByParagraph(sourceMd);

  const maxLen = Math.max(translatedParts.length, sourceParts.length);
  const sections = [];

  for (let i = 0; i < maxLen; i += 1) {
    const zh = translatedParts[i] || '';
    const src = sourceParts[i] || '';

    const section = [
      zh,
      '',
      src,
      '@@linebreak@@',
      '',
    ]
      .join('\n')
      .trim();

    sections.push(section);
  }

  return sections.join('\n\n').trimEnd() + '\n';
}

async function run() {
  await ensureDir(OUTPUT_DIR);

  const translatedFiles = await fg('**/*.md', {
    cwd: TRANSLATED_MD_DIR,
    onlyFiles: true,
    dot: false
  });

  if (translatedFiles.length === 0) {
    console.log('[Step4] No translated markdown files found in scripts/D-translated-md.');
    return;
  }

  for (const relPath of translatedFiles) {
    const absTranslatedPath = path.join(TRANSLATED_MD_DIR, relPath);
    const absSourcePath = path.join(SOURCE_MD_DIR, relPath);
    const absOutputPath = path.join(OUTPUT_DIR, relPath);

    try {
      await fs.access(absSourcePath);
    } catch {
      console.log(`[Step4][Skip] Missing source markdown for ${relPath}`);
      continue;
    }

    const translatedMd = await fs.readFile(absTranslatedPath, 'utf8');
    const sourceMd = await fs.readFile(absSourcePath, 'utf8');
    const mergedMd = buildBilingualMarkdown(translatedMd, sourceMd);

    await ensureDir(path.dirname(absOutputPath));
    await fs.writeFile(absOutputPath, mergedMd, 'utf8');
    console.log(`[Step4][Done] ${relPath}`);
  }

  console.log('\n[Step4] Complete.');
}

run().catch((error) => {
  console.error('[Step4] Failed:', error);
  process.exit(1);
});