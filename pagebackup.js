"use client";

import { useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
} from "pdf-lib";

function humanize(name) {
  return name
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fieldType(field) {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFOptionList) return "optionList";
  return "unsupported";
}

function readOptions(field, type) {
  if (!["dropdown", "radio", "optionList"].includes(type)) return [];
  try {
    return field.getOptions();
  } catch {
    return [];
  }
}

async function normalisePdfFields(bytes) {
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  return form.getFields().map((field, index) => {
    const type = fieldType(field);
    return {
      id: `field-${index + 1}`,
      name: field.getName(),
      label: humanize(field.getName()),
      type,
      required: typeof field.isRequired === "function" ? field.isRequired() : false,
      options: readOptions(field, type),
    };
  });
}

function AnswerInput({ field, value, onChange, onSubmit }) {
  if (field.type === "checkbox") {
    return (
      <div className="choiceRow">
        <button type="button" className={value === true ? "choice active" : "choice"} onClick={() => onChange(true)}>Yes</button>
        <button type="button" className={value === false ? "choice active" : "choice"} onClick={() => onChange(false)}>No</button>
      </div>
    );
  }

  if (["dropdown", "radio", "optionList"].includes(field.type)) {
    return (
      <select className="answerInput" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select an option</option>
        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  if (field.type === "unsupported") {
    return <div className="warning">This field type is not supported in this starter. Skip it for now.</div>;
  }

  return (
    <input
      className="answerInput"
      value={value ?? ""}
      autoFocus
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      placeholder={`Enter ${field.label.toLowerCase()}`}
    />
  );
}

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [originalBytes, setOriginalBytes] = useState(null);
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState("Choose a PDF to begin.");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const currentField = fields[currentIndex] ?? null;
  const supportedFields = useMemo(() => fields.filter((f) => f.type !== "unsupported"), [fields]);
  const answeredCount = useMemo(
    () => supportedFields.filter((f) => Object.prototype.hasOwnProperty.call(answers, f.name)).length,
    [supportedFields, answers]
  );

  async function analyseFile(file) {
    setError("");
    setPreviewUrl("");
    setStatus("Reading the PDF...");
    setFields([]);
    setAnswers({});
    setCurrentIndex(0);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const normalised = await normalisePdfFields(bytes);
      setFileName(file.name);
      setOriginalBytes(bytes);
      setFields(normalised);

      if (normalised.length === 0) {
        setStatus("No AcroForm fields were found.");
        setError("This looks like a flat/scanned PDF or a PDF without native form fields. OCR/Textract is intentionally not part of this first local slice.");
        return;
      }
      setStatus(`Found ${normalised.length} field${normalised.length === 1 ? "" : "s"}. Start the conversation below.`);
    } catch (err) {
      console.error(err);
      setStatus("Could not analyse this PDF.");
      setError("The PDF may be encrypted, damaged, or use a form format that this starter does not support.");
    }
  }

  async function loadSample() {
    const response = await fetch("/sample-fl0-form.pdf");
    const blob = await response.blob();
    const file = new File([blob], "sample-fl0-form.pdf", { type: "application/pdf" });
    await analyseFile(file);
  }

  function saveCurrentAndNext() {
    if (!currentField) return;
    if (currentField.type !== "unsupported" && !Object.prototype.hasOwnProperty.call(answers, currentField.name)) {
      setAnswers((old) => ({ ...old, [currentField.name]: "" }));
    }
    setCurrentIndex((i) => Math.min(i + 1, fields.length - 1));
  }

  async function generatePdf() {
    if (!originalBytes) return;
    setError("");
    setStatus("Generating your completed PDF...");

    try {
      const pdfDoc = await PDFDocument.load(originalBytes);
      const form = pdfDoc.getForm();

      for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(answers, field.name)) continue;
        const value = answers[field.name];
        const target = form.getField(field.name);

        if (target instanceof PDFTextField) target.setText(String(value ?? ""));
        else if (target instanceof PDFCheckBox) value ? target.check() : target.uncheck();
        else if (target instanceof PDFDropdown || target instanceof PDFRadioGroup || target instanceof PDFOptionList) {
          if (value) target.select(String(value));
        }
      }

      const output = await pdfDoc.save();
      const url = URL.createObjectURL(new Blob([output], { type: "application/pdf" }));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setStatus("Completed PDF generated locally in your browser.");
    } catch (err) {
      console.error(err);
      setStatus("PDF generation failed.");
      setError(err?.message || "Unknown PDF generation error.");
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileName(""); setOriginalBytes(null); setFields([]); setAnswers({}); setCurrentIndex(0);
    setStatus("Choose a PDF to begin."); setPreviewUrl(""); setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><div className="logo">FL0</div><div><h1>Conversational Form Engine</h1><p>MVP1 local vertical slice</p></div></div>
        <div className="localBadge">LOCAL ONLY · NO AWS YET</div>
      </header>

      <section className="hero">
        <p className="eyebrow">FIRST WORKING PROOF</p>
        <h2>PDF in → fields detected → conversation → completed PDF out.</h2>
        <p>This starter proves the heart of FL0 before cloud infrastructure or AI is added.</p>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panelTitle"><span className="step">1</span><div><h3>Upload a fillable PDF</h3><p>The document never leaves your browser in this build.</p></div></div>
          <div className="uploadBox">
            <input ref={fileRef} type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && analyseFile(e.target.files[0])} />
            <button className="secondary" type="button" onClick={loadSample}>Or use the included sample PDF</button>
          </div>
          <div className="status"><strong>{fileName || "No PDF selected"}</strong><span>{status}</span></div>
          {error && <div className="error">{error}</div>}
          {fields.length > 0 && <>
            <div className="summary">
              <div><strong>{fields.length}</strong><span>fields found</span></div>
              <div><strong>{answeredCount}</strong><span>answered</span></div>
              <div><strong>{fields.filter((f) => f.required).length}</strong><span>required</span></div>
            </div>
            <details className="metadata"><summary>Review normalized field metadata</summary><pre>{JSON.stringify(fields, null, 2)}</pre></details>
          </>}
        </div>

        <div className="panel">
          <div className="panelTitle"><span className="step">2</span><div><h3>Complete it conversationally</h3><p>One normalized field at a time.</p></div></div>
          {!currentField ? <div className="emptyState">Upload the sample PDF or your own fillable PDF to start.</div> :
            <div className="chat">
              <div className="progress">Field {currentIndex + 1} of {fields.length}<div className="progressTrack"><div className="progressBar" style={{ width: `${((currentIndex + 1) / fields.length) * 100}%` }} /></div></div>
              <div className="bubble"><span className="speaker">FL0</span><p>{currentField.type === "checkbox" ? `Should "${currentField.label}" be selected?` : `What should I enter for "${currentField.label}"?`}</p><small>{currentField.type}{currentField.required ? " · required" : ""}</small></div>
              <AnswerInput field={currentField} value={answers[currentField.name]} onChange={(value) => setAnswers((old) => ({ ...old, [currentField.name]: value }))} onSubmit={saveCurrentAndNext} />
              <div className="navButtons">
                <button className="secondary" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}>Previous</button>
                {currentIndex < fields.length - 1 ? <button type="button" onClick={saveCurrentAndNext}>Save & next</button> : <button type="button" onClick={generatePdf}>Generate completed PDF</button>}
              </div>
            </div>}
        </div>
      </section>

      {previewUrl && <section className="panel previewPanel">
        <div className="panelTitle"><span className="step">3</span><div><h3>Preview the result</h3><p>The generated file is still local. S3 output storage will connect here later.</p></div></div>
        <div className="previewActions"><a className="buttonLink" href={previewUrl} download={`FL0-completed-${fileName || "form.pdf"}`}>Download completed PDF</a><button className="secondary" type="button" onClick={reset}>Start again</button></div>
        <iframe title="Completed PDF preview" src={previewUrl} />
      </section>}

      <footer><strong>Next architecture milestone:</strong> move upload + session state to S3/DynamoDB, then add the AI conversation layer.</footer>
    </main>
  );
}
