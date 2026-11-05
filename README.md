# FL0 MVP1 Starter — Local Vertical Slice

This is the first runnable FL0 proof-of-concept.

It deliberately proves one important thing end-to-end before AWS or AI is added:

**Upload a fillable PDF → extract native form fields → normalise them → answer each field conversationally → write the answers back → preview/download the completed PDF.**

## Run it on your MacBook

Open Terminal in this folder.

```bash
node --version
npm --version
npm install
npm run dev
```

Then open the local address shown in Terminal, normally:

```text
http://localhost:3000
```

To stop FL0, return to Terminal and press **Control + C**.

## Test it immediately

Click **Or use the included sample PDF**.

FL0 should detect the fields, take you through them one at a time, and generate a completed PDF.

## What is included

- Next.js + React interface
- `pdf-lib` PDF form extraction and write-back
- Normalized Field Schema
- One-field-at-a-time conversation UI
- Completed PDF preview/download
- Included fillable sample PDF
- Architecture notes in `docs/ARCHITECTURE.md`
- Build roadmap in `docs/NEXT-STEPS.md`

## Deliberately not included yet

AWS, S3, DynamoDB, Lambda, API Gateway, login, LLM calls, Textract/OCR and scanned PDF support.

First prove the document engine locally. Then we move the same flow into the AWS architecture.

## Review these files first

**`app/page.js`** — main FL0 logic. Look for `normalisePdfFields()`, `analyseFile()`, `AnswerInput()` and `generatePdf()`.

**`app/globals.css`** — presentation and styling.

**`docs/ARCHITECTURE.md`** — how this code maps to the architecture diagram.

## Your first coding exercises

1. Run the included sample successfully.
2. Change the FL0 wording in `app/page.js`.
3. Change a few colours in `app/globals.css`.
4. Add validation to the email field.
5. Upload another fillable PDF of your own.
6. Inspect the normalized JSON metadata.
7. Then move to Milestone 2 in `docs/NEXT-STEPS.md`.

## Limitation

This version expects **AcroForm/fillable PDFs**. A PDF that only looks like a form but has no native fields will show `No AcroForm fields were found.` That is expected; the later Textract/OCR lane handles those files.

## Security

Nothing in this starter is uploaded anywhere. PDF parsing and generation happen in the browser. Do not put API keys in client-side JavaScript.
