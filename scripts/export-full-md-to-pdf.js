const path = require('path');
const fs = require('fs/promises');
const { mdToPdf } = require('md-to-pdf');

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
  const inputPath = path.resolve(
    getArgValue('--input') || path.join(BASE_DOCS_DIR, 'F-combined-md', 'full-side-by-side.md')
  );

  const outputPath = path.resolve(
    getArgValue('--output') || path.join(BASE_DOCS_DIR, 'F-combined-md', 'full-side-by-side.pdf')
  );

  await ensureDir(path.dirname(outputPath));

  const result = await mdToPdf(
    { path: inputPath },
    {
      dest: outputPath,
      stylesheet: ['https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css'],
      css: '.markdown-body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 28px; }',
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