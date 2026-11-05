# FL0 Build Roadmap From This Starter

## Milestone 1 — Local document engine
**You are here.**

Exit criteria: included sample works; an external fillable PDF works; you understand the normalized field JSON; answers can be regenerated into the PDF.

## Milestone 2 — Refactor modules

Move logic toward:

```text
lib/pdf/extractFields.js
lib/pdf/populatePdf.js
lib/fl0/normalizeField.js
lib/fl0/validation.js
components/UploadPanel.js
components/Conversation.js
components/Preview.js
```

Goal: make the code mirror the architecture.

## Milestone 3 — AWS document storage

Add IAM, S3 and signed upload/download URLs.

## Milestone 4 — Persistent document sessions

Add DynamoDB records for document status, normalized fields, answers and output references.

## Milestone 5 — Backend orchestration

Add FL0 API, Lambda processing, session orchestration and CloudWatch logging.

## Milestone 6 — Conversational intelligence

Add an `AIProvider` abstraction for natural questions, document context and answer interpretation. The model should not own authoritative saved state.

## Milestone 7 — Flat/scanned PDFs

Add classification, Textract, coordinates, confidence and coordinate-stamp output. Textract output still becomes the same normalized field schema.

## Milestone 8 — Product features

Login, history, templates, saved profiles, signatures, integrations, billing and team workflows.
