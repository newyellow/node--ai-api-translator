const fs = require('fs/promises');
const path = require('path');
const fg = require('fast-glob');
const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const ROOT_DIR = process.cwd();
const BASE_DOCS_DIR = path.join(ROOT_DIR, 'scripts');
const INPUT_DIR = path.join(BASE_DOCS_DIR, 'C-splited-sections-md');
const OUTPUT_DIR = path.join(BASE_DOCS_DIR, 'D-translated-md');
const KEY_FILE = path.join(ROOT_DIR, 'key.txt');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const TARGET_LANGUAGE = process.env.TARGET_LANGUAGE || '繁體中文（台灣）';
const FORCE_REWRITE = process.argv.includes('--force');

function parseBoolean(value) {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getArgValue(name) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  if (!arg) return null;
  return arg.slice(name.length + 1);
}

function parsePositiveInt(value, label) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer. Received: ${value}`);
  }
  return parsed;
}

const TEST_RUN = process.argv.includes('--test-run') || parseBoolean(process.env.TEST_RUN);
const LEGACY_MAX_BLOCKS_ARG = getArgValue('--max-blocks');
const LEGACY_MAX_BLOCKS_ENV = process.env.TEST_MAX_BLOCKS;
const MAX_FILES = parsePositiveInt(
  getArgValue('--max-files') ?? process.env.TEST_MAX_FILES ?? LEGACY_MAX_BLOCKS_ARG ?? LEGACY_MAX_BLOCKS_ENV,
  'max-files / TEST_MAX_FILES'
);

const SYSTEM_PROMPT =
  process.env.TRANSLATION_SYSTEM_PROMPT ||
  [
    '你是一位專業技術文件翻譯員。',
    `請將輸入的 Markdown 翻譯成${TARGET_LANGUAGE}。`,
    '務必保留原始 Markdown 結構、標題層級、清單、表格、連結、程式碼區塊。',
    '程式碼、命令、參數名稱、API 名稱請維持原文，不要翻譯。',
    '只輸出翻譯後內容，不要額外解釋。',
    '另外這份文件本身是一份演出用的劇本，所以有一些符號是給演員看的標記，因此請保留原來的 markdown 結構',
    '故事內容是關於靈媒和幽靈的故事，所以一些專有名詞要注意'
  ].join('\n');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function loadApiKey() {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY.trim();
  }

  try {
    const fileKey = await fs.readFile(KEY_FILE, 'utf8');
    if (fileKey.trim()) {
      return fileKey.trim();
    }
  } catch {
    // ignore
  }

  throw new Error('OPENAI_API_KEY not found. Set env or put key in key.txt');
}

async function translateMarkdownFile(client, sourceMarkdown, relPath) {
  const response = await client.responses.create({
    model: MODEL,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `以下是已切分好的單一 Markdown 檔案（${relPath}），請完整翻譯：\n\n${sourceMarkdown}`
      }
    ],
    temperature: 0.2
  });

  const translated = response.output_text?.trim();
  if (!translated) {
    throw new Error(`Empty translation for file: ${relPath}`);
  }

  return `${translated}\n`;
}

async function run() {
  await ensureDir(OUTPUT_DIR);

  if (LEGACY_MAX_BLOCKS_ARG || LEGACY_MAX_BLOCKS_ENV) {
    console.log('[Step3] Detected legacy max-blocks setting, treated as max-files in current version.');
  }

  if (TEST_RUN) {
    console.log(
      `[Step3] Test run mode is ON (limit: ${MAX_FILES || 1} files).`
    );
  } else if (MAX_FILES) {
    console.log(`[Step3] Partial mode: translate up to ${MAX_FILES} files.`);
  }

  const apiKey = await loadApiKey();
  const client = new OpenAI({ apiKey });

  const files = await fg('**/*.md', {
    cwd: INPUT_DIR,
    onlyFiles: true,
    dot: false
  });

  if (files.length === 0) {
    console.log('[Step3] No markdown files found in scripts/C-splited-sections-md.');
    return;
  }

  const limit = MAX_FILES || (TEST_RUN ? 1 : null);
  const selectedFiles = limit ? files.slice(0, limit) : files;

  if (limit) {
    console.log(`[Step3] Selected ${selectedFiles.length}/${files.length} files for this run.`);
  }

  for (const relPath of selectedFiles) {
    const absInputPath = path.join(INPUT_DIR, relPath);
    const absOutputPath = path.join(OUTPUT_DIR, relPath);

    if (!FORCE_REWRITE) {
      try {
        await fs.access(absOutputPath);
        console.log(`[Step3][Skip] Exists: ${relPath} (use --force to overwrite)`);
        continue;
      } catch {
        // file does not exist
      }
    }

    const sourceMarkdown = (await fs.readFile(absInputPath, 'utf8')).trim();

    if (!sourceMarkdown) {
      console.log(`[Step3][Skip] Empty markdown: ${relPath}`);
      continue;
    }

    console.log(`[Step3] Translating ${relPath} (single split file)...`);
    const translatedMarkdown = await translateMarkdownFile(client, sourceMarkdown, relPath);

    await ensureDir(path.dirname(absOutputPath));
    await fs.writeFile(absOutputPath, translatedMarkdown, 'utf8');
    console.log(`[Step3][Done] ${relPath}`);
  }

  console.log('\n[Step3] Complete.');
}

run().catch((error) => {
  console.error('[Step3] Failed:', error);
  process.exit(1);
});