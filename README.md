# node--ai-api-translator

使用 Node.js 建立的文件翻譯流程，分成 5 個步驟 + 最終 PDF 轉換：

1. 將 `scripts/A-source-docs/` 的來源文件轉成 Markdown 到 `scripts/B-docs-to-md/`
2. 先將 Markdown 依規則切成多個 batch 檔案到 `scripts/C-splited-sections-md/`
3. 逐段呼叫 OpenAI API 將 batch Markdown 翻譯到 `scripts/D-translated-md/`
4. 產生「翻譯在上、原文在下」的對照文件到 `scripts/E-side-by-side-md/`
5. 將 Step4 全部檔案合併成一份完整 Markdown 到 `scripts/F-combined-md/full-side-by-side.md`

最後可再將完整 Markdown 轉換為有 markdown 樣式的 PDF。

## 目錄

- `scripts/A-source-docs/`：原始文件
- `scripts/B-docs-to-md/`：Step1 轉檔輸出
- `scripts/C-splited-sections-md/`：Step2 split 輸出
- `scripts/D-translated-md/`：Step3 翻譯輸出
- `scripts/E-side-by-side-md/`：Step4 對照合併輸出
- `scripts/F-combined-md/`：Step5 完整 md 與 PDF 輸出

## 安裝

```bash
npm install
```

## API Key 設定

可用兩種方式擇一：

1. `.env` 設定 `OPENAI_API_KEY`
2. 將 key 放到專案根目錄 `key.txt`

建議做法：

```bash
copy .env.example .env
```

然後編輯 `.env`。

## Step 1：文件轉 Markdown

```bash
npm run step1:convert
```

目前支援來源檔案類型：

- `.md`, `.markdown`
- `.txt`
- `.html`, `.htm`
- `.docx`

不支援的副檔名會顯示 `Skip`。

## Step 2：先依 Regex 拆分 Markdown batch

```bash
npm run step2:split
```

預設分段條件：遇到標題行符合 `# △ Section` 就切分（regex 預設：`^#\s*△\s*Section\b`）。

可調整 split 條件：

```bash
node scripts/02-split-md-by-regex.js --split-regex="^#\\s*△\\s*Section\\b"
```

也可使用環境變數：

- `SPLIT_REGEX`
- `SPLIT_REGEX_FLAGS`（例如 `i`）

## Step 3：Markdown 分段翻譯

```bash
npm run step3:translate
```

若要覆蓋既有翻譯結果：

```bash
node scripts/03-translate-md-with-openai.js --force
```

測試模式：

```bash
node scripts/03-translate-md-with-openai.js --test-run --max-files=3
```

可調整的環境變數：

- `OPENAI_MODEL`：預設 `gpt-4.1-mini`
- `TARGET_LANGUAGE`：預設 `繁體中文（台灣）`
- `TRANSLATION_SYSTEM_PROMPT`：可覆蓋整段 system prompt
- `TEST_RUN`：是否測試模式
- `TEST_MAX_FILES`：每次最多翻幾個 split 檔案

## Step 4：組合中英對照 Markdown

```bash
npm run step4:merge
```

輸出格式為每段：

- 上方：翻譯段落
- 下方：空一行後接原文段落

## Step 5：合併 Step4 結果為完整 Markdown

```bash
npm run step5:combine
```

預設輸入/輸出：

- Input: `scripts/E-side-by-side-md/**/*.md`
- Output: `scripts/F-combined-md/full-side-by-side.md`

也可自訂：

```bash
node scripts/05-merge-side-by-side-to-full-md.js --input-dir="scripts/E-side-by-side-md" --output="scripts/F-combined-md/custom-full.md"
```

## 最終轉換：完整 Markdown 轉 PDF（含 markdown styling）

```bash
npm run final:pdf
```

預設輸入/輸出：

- Input: `scripts/F-combined-md/full-side-by-side.md`
- Output: `scripts/F-combined-md/full-side-by-side.pdf`

此步驟使用 `md-to-pdf`，並套用 GitHub Markdown CSS，讓 PDF 視覺盡量貼近 markdown 顯示。

## 建議執行順序

```bash
npm run step1:convert
npm run step2:split
npm run step3:translate
npm run step4:merge
npm run step5:combine
npm run final:pdf
```