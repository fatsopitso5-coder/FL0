# FL0 Local MVP Architecture

## Current executable flow

```text
User
  ↓
Next.js / React
  ↓
Upload PDF
  ↓
pdf-lib reads AcroForm
  ↓
Normalized Field Schema
  ↓
Conversation UI
  ↓
Field Answers
  ↓
pdf-lib writes answers
  ↓
Completed PDF
```

Everything in this starter happens locally in the browser.

## Normalized Field Schema

A PDF field becomes an FL0 object roughly like:

```js
{
  id: "field-1",
  name: "first_name",
  label: "First Name",
  type: "text",
  required: false,
  options: []
}
```

That is an important architectural boundary. Later, AcroForm, Textract, OCR or another document parser can all produce the same schema. The conversation layer should not care how a field was discovered.

## Diagram → code mapping

| Architecture block | Starter implementation |
|---|---|
| FL0 Web App | `app/page.js` |
| Upload | `analyseFile()` |
| AcroForm Engine | `pdf-lib` |
| Normalized Field Schema | `normalisePdfFields()` result |
| Conversation / Answer Service | React state + `AnswerInput()` |
| Completion / output | `generatePdf()` |
| Preview | Browser PDF iframe |

## Not implemented yet

| Future block | Planned implementation |
|---|---|
| Application API | Server/API layer |
| Document Session Orchestrator | Server-side service |
| Object Storage | Amazon S3 |
| Metadata DB | DynamoDB |
| Logs / monitoring | CloudWatch |
| AI model endpoint | Provider adapter, likely Bedrock first |
| Flat/scanned PDF lane | Textract + coordinates |
| Authentication | Later milestone |

## Design rule

Once FL0 moves to AWS, the browser may keep temporary UI state but authoritative state should live server-side. The LLM can help interpret and phrase; it must not become the source of truth for saved form data.
