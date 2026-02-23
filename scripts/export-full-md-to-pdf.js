const path = require('path');
const fs = require('fs/promises');
const { mdToPdf } = require('md-to-pdf');

const ROOT_DIR = process.cwd();
const BASE_DOCS_DIR = path.join(ROOT_DIR, 'scripts');

const COLOR_RULES = [
  {
    id: 'line-plus-orange',
    mode: 'line',
    find: '^\\\\\+.*$',
    flags: 'gm',
    color: '#ff8a00'
  },
  {
    id: 'bold-blue',
    mode: 'bold-markdown',
    find: '\\\*\\\*([^\\n]+?)\\\*\\\*',
    flags: 'g',
    color: '#1f6feb'
  }
];

function getArgValue(name) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  if (!arg) return null;
  return arg.slice(name.length + 1);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function splitByCodeFence(markdown) {
  const fencePattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
  return markdown.split(fencePattern);
}

function normalizeHardLineBreaks(markdown) {
  const parts = splitByCodeFence(markdown);

  const transformed = parts.map((part) => {
    const isCodeFence = /^(?:```|~~~)/.test(part);
    if (isCodeFence) {
      return part;
    }

    return part.replace(/[ \t]{2,}\r?\n/g, '<br>\n');
  });

  return transformed.join('');
}

function normalizeFlags(flags, fallback = 'g') {
  const set = new Set((flags || fallback).split('').filter(Boolean));
  if (!set.has('g')) set.add('g');
  return [...set].join('');
}

function toSafeCssClass(id) {
  return String(id)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function applyColorRules(markdown, rules) {
  const parts = splitByCodeFence(markdown);

  const transformed = parts.map((part) => {
    const isCodeFence = /^(?:```|~~~)/.test(part);
    if (isCodeFence) {
      return part;
    }

    let output = part;

    for (const rule of rules) {
      const className = `md-color-${toSafeCssClass(rule.id)}`;
      const regex = new RegExp(rule.find, normalizeFlags(rule.flags));

      if (rule.mode === 'line') {
        output = output.replace(regex, (match) => `<span class="${className}">${match}</span>`);
        continue;
      }

      if (rule.mode === 'bold-markdown') {
        output = output.replace(regex, (_match, inner) => `<strong class="${className}">${inner}</strong>`);
      }
    }

    return output;
  });

  return transformed.join('');
}

function buildRuleCss(rules) {
  return rules
    .map((rule) => {
      const className = `md-color-${toSafeCssClass(rule.id)}`;
      return `.markdown-body .${className} { color: ${rule.color}; }`;
    })
    .join('\n');
}

async function run() {
  const inputPath = path.resolve(
    getArgValue('--input') || path.join(BASE_DOCS_DIR, 'F-combined-md', 'full-side-by-side.md')
  );

  const outputPath = path.resolve(
    getArgValue('--output') || path.join(BASE_DOCS_DIR, 'F-combined-md', 'full-side-by-side.pdf')
  );

  await ensureDir(path.dirname(outputPath));

  const sourceMarkdown = await fs.readFile(inputPath, 'utf8');
  const markdownWithHardBreaks = normalizeHardLineBreaks(sourceMarkdown);
  const styledMarkdown = applyColorRules(markdownWithHardBreaks, COLOR_RULES);
  const ruleCss = buildRuleCss(COLOR_RULES);

  const result = await mdToPdf(
    { content: styledMarkdown },
    {
      dest: outputPath,
      stylesheet: ['https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css'],
      css: `.markdown-body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 28px; }\n${ruleCss}`,
      body_class: 'markdown-body',
      pdf_options: {
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '14mm', bottom: '20mm', left: '14mm' }
      }
    }
  );

  if (!result) {
    throw new Error('PDF conversion failed. No result returned by md-to-pdf.');
  }

  console.log('[Export] PDF generated successfully.');
  console.log(`[Export] Input: ${inputPath}`);
  console.log(`[Export] Output: ${outputPath}`);
}

run().catch((error) => {
  console.error('[Export] Failed:', error);
  process.exit(1);
});