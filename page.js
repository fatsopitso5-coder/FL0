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

/* =======================================================
   PDF HELPERS
======================================================= */

function humanize(name) {
  return name
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFieldType(field) {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFOptionList) return "optionList";

  return "unsupported";
}

function getFieldOptions(field, type) {
  if (!["dropdown", "radio", "optionList"].includes(type)) {
    return [];
  }

  try {
    return field.getOptions();
  } catch {
    return [];
  }
}

async function normalisePdfFields(bytes) {
  const pdfDocument = await PDFDocument.load(bytes);

  const form = pdfDocument.getForm();

  const rawFields = form.getFields();

  return rawFields.map((field, index) => {
    const type = getFieldType(field);

    return {
      id: `field-${index + 1}`,
      name: field.getName(),
      label: humanize(field.getName()),
      type,
      required:
        typeof field.isRequired === "function"
          ? field.isRequired()
          : false,
      options: getFieldOptions(field, type),
    };
  });
}

/* =======================================================
   CURRENT FIELD INPUT
======================================================= */

function FieldInput({
  field,
  value,
  onChange,
  onEnter,
}) {
  if (!field) return null;

  if (field.type === "checkbox") {
    return (
      <div style={styles.choiceRow}>
        <button
          type="button"
          onClick={() => onChange(true)}
          style={{
            ...styles.choiceButton,
            ...(value === true
              ? styles.choiceButtonActive
              : {}),
          }}
        >
          Yes
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          style={{
            ...styles.choiceButton,
            ...(value === false
              ? styles.choiceButtonActive
              : {}),
          }}
        >
          No
        </button>
      </div>
    );
  }

  if (
    ["dropdown", "radio", "optionList"].includes(
      field.type
    )
  ) {
    return (
      <select
        style={styles.answerInput}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        <option value="">
          Select an option
        </option>

        {field.options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "unsupported") {
    return (
      <div style={styles.warning}>
        This PDF field type is not supported in
        the current FL0 MVP.
      </div>
    );
  }

  return (
    <input
      style={styles.answerInput}
      value={value ?? ""}
      placeholder={`Enter ${field.label.toLowerCase()}`}
      autoFocus
      onChange={(event) =>
        onChange(event.target.value)
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onEnter();
        }
      }}
    />
  );
}

/* =======================================================
   CONVERSATION REEL
======================================================= */

function RollingConversation({
  fields,
  currentIndex,
  answers,
  setAnswers,
  onPrevious,
  onNext,
  onGenerate,
}) {
  const ROW_HEIGHT = 105;

  const [trackY, setTrackY] =
    useState(-ROW_HEIGHT);

  const [
    transitionEnabled,
    setTransitionEnabled,
  ] = useState(true);

  const [isRolling, setIsRolling] =
    useState(false);

  const [
    showCurrentAnswer,
    setShowCurrentAnswer,
  ] = useState(false);

  const [
    flyingAnswer,
    setFlyingAnswer,
  ] = useState(null);

  const [
    answerFlying,
    setAnswerFlying,
  ] = useState(false);

  const currentField =
    fields[currentIndex] ?? null;

  const reelFields = [
    -2,
    -1,
    0,
    1,
    2,
  ].map((offset) => ({
    offset,
    field:
      fields[currentIndex + offset] ??
      null,
  }));

  if (!currentField) {
    return (
      <div style={styles.emptyState}>
        Upload a fillable PDF to start the
        FL0 conversation.
      </div>
    );
  }

  const currentValue =
    answers[currentField.name];

  function formatAnswer(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "";
    }

    return String(value);
  }

  /* -------------------------------------------------------
     MOVE REEL
  ------------------------------------------------------- */

  function moveReel(direction) {
    setIsRolling(true);

    setTransitionEnabled(true);

    if (direction === "next") {
      setTrackY(-ROW_HEIGHT * 2);
    }

    if (direction === "previous") {
      setTrackY(0);
    }

    window.setTimeout(() => {
      setTransitionEnabled(false);

      let targetIndex = currentIndex;

      if (direction === "next") {
        targetIndex = Math.min(
          currentIndex + 1,
          fields.length - 1
        );

        onNext();
      }

      if (direction === "previous") {
        targetIndex = Math.max(
          currentIndex - 1,
          0
        );

        onPrevious();
      }

      const targetField =
        fields[targetIndex];

      const targetHasAnswer =
        targetField &&
        Object.prototype.hasOwnProperty.call(
          answers,
          targetField.name
        );

      setShowCurrentAnswer(
        Boolean(targetHasAnswer)
      );

      /*
        Instantly restore the physical
        track position after currentIndex
        changes.
      */

      setTrackY(-ROW_HEIGHT);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnabled(true);

          setIsRolling(false);
        });
      });
    }, 500);
  }

  /* -------------------------------------------------------
     ANSWER FLIES INTO CURRENT REEL FIELD
  ------------------------------------------------------- */

  function saveAnswerAndRoll() {
    if (isRolling) return;

    if (
      currentIndex >=
      fields.length - 1
    ) {
      return;
    }

    const value =
      answers[currentField.name];

    const displayValue =
      formatAnswer(value);

    /*
      No answer entered.

      We still allow movement for now.
      Required-field validation can come
      in the next iteration.
    */

    if (!displayValue) {
      moveReel("next");

      return;
    }

    setIsRolling(true);

    /*
      Create the floating copy of the answer.
    */

    setFlyingAnswer(displayValue);

    setAnswerFlying(false);

    /*
      Wait until the floating element exists,
      then trigger its CSS movement.
    */

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnswerFlying(true);
      });
    });

    /*
      Once it reaches the reel,
      reveal the saved value inside
      the current focused field.
    */

    window.setTimeout(() => {
      setShowCurrentAnswer(true);

      setAnswerFlying(false);
    }, 420);

    /*
      Hold the completed row briefly
      before rolling to the next field.
    */

    window.setTimeout(() => {
      setFlyingAnswer(null);

      moveReel("next");
    }, 900);
  }

  /* -------------------------------------------------------
     PREVIOUS FIELD
  ------------------------------------------------------- */

  function goPrevious() {
    if (
      isRolling ||
      currentIndex === 0
    ) {
      return;
    }

    moveReel("previous");
  }

  /* -------------------------------------------------------
     CLICKING ROWS
  ------------------------------------------------------- */

  function selectRow(offset) {
    if (isRolling) return;

    /*
      Click row above.
    */

    if (offset === -1) {
      goPrevious();
    }

    /*
      Click row below.
    */

    if (offset === 1) {
      saveAnswerAndRoll();
    }
  }

  /* -------------------------------------------------------
     MOUSE / TRACKPAD
  ------------------------------------------------------- */

  function handleWheel(event) {
    if (isRolling) return;

    /*
      Ignore tiny movements from
      a sensitive Mac trackpad.
    */

    if (Math.abs(event.deltaY) < 20) {
      return;
    }

    /*
      Scroll down → next field.
    */

    if (
      event.deltaY > 0 &&
      currentIndex <
        fields.length - 1
    ) {
      saveAnswerAndRoll();
    }

    /*
      Scroll up → previous field.
    */

    if (
      event.deltaY < 0 &&
      currentIndex > 0
    ) {
      goPrevious();
    }
  }

  return (
    <div
      style={styles.conversationWrapper}
    >
      {/* PROGRESS */}

      <div style={styles.progressRow}>
        <span>
          Field {currentIndex + 1} of{" "}
          {fields.length}
        </span>

        <span>
          {Math.round(
            ((currentIndex + 1) /
              fields.length) *
              100
          )}
          %
        </span>
      </div>

      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressBar,

            width: `${
              ((currentIndex + 1) /
                fields.length) *
              100
            }%`,
          }}
        />
      </div>

      {/* =================================================
          REEL
      ================================================= */}

      <div
        style={styles.reelShell}
        onWheel={handleWheel}
      >
        <div
          style={{
            ...styles.reelViewport,
            height: ROW_HEIGHT * 3,
          }}
        >
          {/* CENTRE FOCUS WINDOW */}

          <div
            style={{
              ...styles.reelFocusFrame,
              top: ROW_HEIGHT,
              height: ROW_HEIGHT,
            }}
          />

          {/* MOVING TRACK */}

          <div
            style={{
              ...styles.reelTrack,

              transform:
                `translateY(${trackY}px)`,

              transition:
                transitionEnabled
                  ? "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)"
                  : "none",
            }}
          >
            {reelFields.map(
              ({
                field,
                offset,
              }) => {
                const isCurrent =
                  offset === 0;

                const isPrevious =
                  offset === -1;

                const isNext =
                  offset === 1;

                const isFar =
                  Math.abs(offset) === 2;

                const savedValue =
                  field
                    ? formatAnswer(
                        answers[
                          field.name
                        ]
                      )
                    : "";

                const shouldShowAnswer =
                  field &&
                  savedValue &&
                  (!isCurrent ||
                    showCurrentAnswer);

                let positionLabel = "";

                if (isPrevious) {
                  positionLabel =
                    "Previous";
                }

                if (isCurrent) {
                  positionLabel =
                    "Current";
                }

                if (isNext) {
                  positionLabel =
                    "Next";
                }

                return (
                  <div
                    key={`${currentIndex}-${offset}-${
                      field?.id ??
                      "empty"
                    }`}
                    onClick={() =>
                      selectRow(offset)
                    }
                    style={{
                      ...styles.reelRow,

                      height:
                        ROW_HEIGHT,

                      ...(isCurrent
                        ? styles.reelRowActive
                        : {}),

                      ...(isFar
                        ? styles.reelRowFar
                        : {}),

                      ...((isPrevious ||
                        isNext) &&
                      field
                        ? styles.reelRowClickable
                        : {}),
                    }}
                  >
                    {field && (
                      <>
                        <span
                          style={
                            styles.reelPosition
                          }
                        >
                          {
                            positionLabel
                          }
                        </span>

                        <strong
                          style={{
                            fontSize:
                              isCurrent
                                ? "23px"
                                : "17px",
                          }}
                        >
                          {
                            field.label
                          }
                        </strong>

                        {shouldShowAnswer && (
                          <span
                            style={{
                              ...styles.reelSavedAnswer,

                              ...(isCurrent
                                ? styles.reelSavedAnswerActive
                                : {}),
                            }}
                          >
                            {
                              savedValue
                            }
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              }
            )}
          </div>

          {/* TOP DEPTH FADE */}

          <div
            style={
              styles.reelFadeTop
            }
          />

          {/* BOTTOM DEPTH FADE */}

          <div
            style={
              styles.reelFadeBottom
            }
          />
        </div>

        <div
          style={
            styles.reelScrollHint
          }
        >
          Scroll or click the row above
          or below
        </div>
      </div>

      {/* =================================================
          FLYING ANSWER
      ================================================= */}

      {flyingAnswer && (
        <div
          style={{
            ...styles.flyingAnswer,

            ...(answerFlying
              ? styles.flyingAnswerActive
              : {}),
          }}
        >
          {flyingAnswer}
        </div>
      )}

      {/* =================================================
          ANSWER CARD
      ================================================= */}

      <div
        style={{
          ...styles.answerCard,

          opacity:
            isRolling
              ? 0.55
              : 1,

          transform:
            isRolling
              ? "scale(.985)"
              : "scale(1)",
        }}
      >
        <span
          style={
            styles.rollerPosition
          }
        >
          FL0 IS ASKING
        </span>

        <h3
          style={
            styles.activeFieldTitle
          }
        >
          {currentField.label}
        </h3>

        <p style={styles.question}>
          {currentField.type ===
          "checkbox"
            ? `Should "${currentField.label}" be selected?`
            : `What should I enter for "${currentField.label}"?`}
        </p>

        <div
          style={{
            pointerEvents:
              isRolling
                ? "none"
                : "auto",
          }}
        >
          <FieldInput
            field={currentField}
            value={currentValue}
            onChange={(value) => {
              /*
                Hide the saved-value badge
                while the user edits.
              */

              setShowCurrentAnswer(false);

              setAnswers(
                (
                  oldAnswers
                ) => ({
                  ...oldAnswers,

                  [currentField.name]:
                    value,
                })
              );
            }}
            onEnter={
              saveAnswerAndRoll
            }
          />
        </div>

        <div
          style={styles.fieldMeta}
        >
          {currentField.type}

          {currentField.required
            ? " • required"
            : ""}
        </div>
      </div>

      {/* =================================================
          CONTROLS
      ================================================= */}

      <div
        style={styles.navButtons}
      >
        <button
          type="button"
          onClick={goPrevious}
          disabled={
            currentIndex === 0 ||
            isRolling
          }
          style={{
            ...styles.secondaryButton,

            opacity:
              currentIndex === 0 ||
              isRolling
                ? 0.4
                : 1,
          }}
        >
          ← Previous
        </button>

        {currentIndex <
        fields.length - 1 ? (
          <button
            type="button"
            onClick={
              saveAnswerAndRoll
            }
            disabled={
              isRolling
            }
            style={{
              ...styles.primaryButton,

              opacity:
                isRolling
                  ? 0.65
                  : 1,
            }}
          >
            Save & next →
          </button>
        ) : (
          <button
            type="button"
            onClick={
              onGenerate
            }
            disabled={
              isRolling
            }
            style={
              styles.primaryButton
            }
          >
            Generate completed PDF
          </button>
        )}
      </div>
    </div>
  );
}

/* =======================================================
   MAIN PAGE
======================================================= */

export default function Home() {
  const [fileName, setFileName] =
    useState("");

  const [
    originalBytes,
    setOriginalBytes,
  ] = useState(null);

  const [fields, setFields] =
    useState([]);

  const [answers, setAnswers] =
    useState({});

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [status, setStatus] =
    useState(
      "Choose a PDF to begin."
    );

  const [error, setError] =
    useState("");

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState("");

  const fileRef = useRef(null);

  /* -------------------------------------------------------
     COUNTERS
  ------------------------------------------------------- */

  const supportedFields =
    useMemo(
      () =>
        fields.filter(
          (field) =>
            field.type !==
            "unsupported"
        ),

      [fields]
    );

  const answeredCount =
    useMemo(() => {
      return supportedFields.filter(
        (field) =>
          Object.prototype.hasOwnProperty.call(
            answers,
            field.name
          )
      ).length;
    }, [
      supportedFields,
      answers,
    ]);

  /* -------------------------------------------------------
     PDF ANALYSIS
  ------------------------------------------------------- */

  async function analyseFile(file) {
    setError("");

    setPreviewUrl("");

    setStatus(
      "Reading the PDF..."
    );

    setFields([]);

    setAnswers({});

    setCurrentIndex(0);

    try {
      const arrayBuffer =
        await file.arrayBuffer();

      const bytes =
        new Uint8Array(
          arrayBuffer
        );

      const normalised =
        await normalisePdfFields(
          bytes
        );

      setFileName(file.name);

      setOriginalBytes(bytes);

      setFields(normalised);

      if (
        normalised.length === 0
      ) {
        setStatus(
          "No AcroForm fields were found."
        );

        setError(
          "This PDF does not contain native fillable fields. FL0 will use the OCR / Textract path for flat or scanned forms in a later MVP phase."
        );

        return;
      }

      setStatus(
        `Found ${
          normalised.length
        } field${
          normalised.length === 1
            ? ""
            : "s"
        }. Continue with the reel.`
      );
    } catch (error) {
      console.error(error);

      setStatus(
        "Could not analyse this PDF."
      );

      setError(
        "The PDF may be encrypted, damaged, or use a form type that this version of FL0 does not support."
      );
    }
  }

  /* -------------------------------------------------------
     SAMPLE PDF
  ------------------------------------------------------- */

  async function loadSample() {
    try {
      const response =
        await fetch(
          "/sample-fl0-form.pdf"
        );

      if (!response.ok) {
        throw new Error(
          "sample-fl0-form.pdf could not be found in the public folder."
        );
      }

      const blob =
        await response.blob();

      const sample =
        new File(
          [blob],
          "sample-fl0-form.pdf",
          {
            type: "application/pdf",
          }
        );

      await analyseFile(sample);
    } catch (error) {
      console.error(error);

      setError(
        error.message
      );
    }
  }

  /* -------------------------------------------------------
     NAVIGATION
  ------------------------------------------------------- */

  function movePrevious() {
    setCurrentIndex(
      (current) =>
        Math.max(
          current - 1,
          0
        )
    );
  }

  function moveNext() {
    setCurrentIndex(
      (current) =>
        Math.min(
          current + 1,
          fields.length - 1
        )
    );
  }

  /* -------------------------------------------------------
     GENERATE COMPLETED PDF
  ------------------------------------------------------- */

  async function generatePdf() {
    if (!originalBytes) return;

    setError("");

    setStatus(
      "Generating your completed PDF..."
    );

    try {
      const pdfDocument =
        await PDFDocument.load(
          originalBytes
        );

      const form =
        pdfDocument.getForm();

      for (
        const field of fields
      ) {
        if (
          !Object.prototype.hasOwnProperty.call(
            answers,
            field.name
          )
        ) {
          continue;
        }

        const value =
          answers[field.name];

        const target =
          form.getField(
            field.name
          );

        if (
          target instanceof
          PDFTextField
        ) {
          target.setText(
            String(value ?? "")
          );
        } else if (
          target instanceof
          PDFCheckBox
        ) {
          if (value) {
            target.check();
          } else {
            target.uncheck();
          }
        } else if (
          target instanceof
            PDFDropdown ||
          target instanceof
            PDFRadioGroup ||
          target instanceof
            PDFOptionList
        ) {
          if (value) {
            target.select(
              String(value)
            );
          }
        }
      }

      const output =
        await pdfDocument.save();

      const blob =
        new Blob(
          [output],
          {
            type: "application/pdf",
          }
        );

      const url =
        URL.createObjectURL(blob);

      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        );
      }

      setPreviewUrl(url);

      setStatus(
        "Completed PDF generated locally in your browser."
      );
    } catch (error) {
      console.error(error);

      setStatus(
        "PDF generation failed."
      );

      setError(
        error?.message ||
          "Unknown PDF generation error."
      );
    }
  }

  /* -------------------------------------------------------
     RESET
  ------------------------------------------------------- */

  function reset() {
    if (previewUrl) {
      URL.revokeObjectURL(
        previewUrl
      );
    }

    setFileName("");

    setOriginalBytes(null);

    setFields([]);

    setAnswers({});

    setCurrentIndex(0);

    setStatus(
      "Choose a PDF to begin."
    );

    setError("");

    setPreviewUrl("");

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main style={styles.page}>
      {/* HEADER */}

      <header
        style={styles.topbar}
      >
        <div
          style={
            styles.brandRow
          }
        >
          <div
            style={styles.logo}
          >
            FL0
          </div>

          <div>
            <h1
              style={
                styles.brandTitle
              }
            >
              Conversational Form
              Engine
            </h1>

            <p
              style={
                styles.brandSubtitle
              }
            >
              MVP1 local vertical
              slice
            </p>
          </div>
        </div>

        <div
          style={
            styles.localBadge
          }
        >
          LOCAL ONLY • NO AWS YET
        </div>
      </header>

      {/* HERO */}

      <section
        style={styles.hero}
      >
        <p
          style={
            styles.eyebrow
          }
        >
          FIRST WORKING PROOF
        </p>

        <h2
          style={
            styles.heroTitle
          }
        >
          Upload a form. Complete
          it through conversation.
        </h2>

        <p
          style={
            styles.heroText
          }
        >
          FL0 reads native PDF
          fields, converts them into
          a normalized structure,
          then guides the user
          through each answer using
          the rolling interface.
        </p>
      </section>

      {/* MAIN WORKSPACE */}

      <section
        style={
          styles.twoColumn
        }
      >
        {/* ================================================
            UPLOAD
        ================================================ */}

        <div
          style={styles.panel}
        >
          <div
            style={
              styles.panelHeading
            }
          >
            <div
              style={
                styles.step
              }
            >
              1
            </div>

            <div>
              <h3
                style={
                  styles.panelTitle
                }
              >
                Upload & analyse
              </h3>

              <p
                style={
                  styles.panelSub
                }
              >
                Start with a native
                fillable PDF.
              </p>
            </div>
          </div>

          <div
            style={
              styles.uploadBox
            }
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(
                event
              ) => {
                const file =
                  event.target
                    .files?.[0];

                if (file) {
                  analyseFile(
                    file
                  );
                }
              }}
            />

            <button
              type="button"
              onClick={
                loadSample
              }
              style={
                styles.secondaryButton
              }
            >
              Use included sample
              PDF
            </button>
          </div>

          {/* STATUS */}

          <div
            style={
              styles.statusBox
            }
          >
            <strong>
              {fileName ||
                "No PDF selected"}
            </strong>

            <span
              style={
                styles.statusText
              }
            >
              {status}
            </span>
          </div>

          {/* ERROR */}

          {error && (
            <div
              style={
                styles.errorBox
              }
            >
              {error}
            </div>
          )}

          {/* DOCUMENT SUMMARY */}

          {fields.length > 0 && (
            <>
              <div
                style={
                  styles.summaryGrid
                }
              >
                <div
                  style={
                    styles.summaryCard
                  }
                >
                  <strong
                    style={
                      styles.summaryNumber
                    }
                  >
                    {
                      fields.length
                    }
                  </strong>

                  <span
                    style={
                      styles.summaryLabel
                    }
                  >
                    fields found
                  </span>
                </div>

                <div
                  style={
                    styles.summaryCard
                  }
                >
                  <strong
                    style={
                      styles.summaryNumber
                    }
                  >
                    {
                      answeredCount
                    }
                  </strong>

                  <span
                    style={
                      styles.summaryLabel
                    }
                  >
                    answered
                  </span>
                </div>

                <div
                  style={
                    styles.summaryCard
                  }
                >
                  <strong
                    style={
                      styles.summaryNumber
                    }
                  >
                    {
                      fields.filter(
                        (field) =>
                          field.required
                      ).length
                    }
                  </strong>

                  <span
                    style={
                      styles.summaryLabel
                    }
                  >
                    required
                  </span>
                </div>
              </div>

              <details
                style={
                  styles.metadata
                }
              >
                <summary
                  style={
                    styles.metadataSummary
                  }
                >
                  Review normalized
                  field metadata
                </summary>

                <pre
                  style={
                    styles.pre
                  }
                >
                  {JSON.stringify(
                    fields,
                    null,
                    2
                  )}
                </pre>
              </details>
            </>
          )}
        </div>

        {/* ================================================
            REEL
        ================================================ */}

        <div
          style={styles.panel}
        >
          <div
            style={
              styles.panelHeading
            }
          >
            <div
              style={
                styles.step
              }
            >
              2
            </div>

            <div>
              <h3
                style={
                  styles.panelTitle
                }
              >
                Conversation reel
              </h3>

              <p
                style={
                  styles.panelSub
                }
              >
                Scroll, click, or
                use the buttons to
                move between fields.
              </p>
            </div>
          </div>

          <RollingConversation
            fields={fields}
            currentIndex={
              currentIndex
            }
            answers={answers}
            setAnswers={
              setAnswers
            }
            onPrevious={
              movePrevious
            }
            onNext={moveNext}
            onGenerate={
              generatePdf
            }
          />
        </div>
      </section>

      {/* ================================================
          PREVIEW
      ================================================ */}

      {previewUrl && (
        <section
          style={
            styles.previewPanel
          }
        >
          <div
            style={
              styles.panelHeading
            }
          >
            <div
              style={
                styles.step
              }
            >
              3
            </div>

            <div>
              <h3
                style={
                  styles.panelTitle
                }
              >
                Preview completed PDF
              </h3>

              <p
                style={
                  styles.panelSub
                }
              >
                Your answers have
                now been written
                back into the
                original PDF.
              </p>
            </div>
          </div>

          <div
            style={
              styles.previewActions
            }
          >
            <a
              href={previewUrl}
              download={`FL0-completed-${
                fileName ||
                "form.pdf"
              }`}
              style={
                styles.downloadLink
              }
            >
              Download completed
              PDF
            </a>

            <button
              type="button"
              onClick={reset}
              style={
                styles.secondaryButton
              }
            >
              Start again
            </button>
          </div>

          <iframe
            title="Completed PDF preview"
            src={previewUrl}
            style={
              styles.iframe
            }
          />
        </section>
      )}

      <footer
        style={styles.footer}
      >
        <strong>
          Current FL0 milestone:
        </strong>{" "}
        document engine + interactive
        conversational reel.
      </footer>
    </main>
  );
}

/* =======================================================
   STYLES
======================================================= */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#122033",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  topbar: {
    background: "#ffffff",
    borderBottom:
      "1px solid #dbe3ee",
    padding: "20px 5vw",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  logo: {
    width: "48px",
    height: "48px",
    display: "grid",
    placeItems: "center",
    background: "#122033",
    color: "#ffffff",
    borderRadius: "14px",
    fontWeight: 900,
  },

  brandTitle: {
    margin: 0,
    fontSize: "17px",
  },

  brandSubtitle: {
    margin: "3px 0 0",
    color: "#687386",
    fontSize: "13px",
  },

  localBadge: {
    color: "#147a57",
    background: "#ecfbf4",
    border:
      "1px solid #b8e2d1",
    padding: "8px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: ".08em",
  },

  hero: {
    maxWidth: "1050px",
    padding:
      "55px 5vw 25px",
  },

  eyebrow: {
    color: "#3157d5",
    fontSize: "12px",
    letterSpacing: ".13em",
    fontWeight: 900,
  },

  heroTitle: {
    fontSize:
      "clamp(34px, 5vw, 58px)",
    lineHeight: 1.03,
    letterSpacing: "-.045em",
    margin: "12px 0 18px",
    maxWidth: "950px",
  },

  heroText: {
    maxWidth: "780px",
    color: "#687386",
    fontSize: "18px",
    lineHeight: 1.55,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "22px",
    padding:
      "20px 5vw 30px",
  },

  panel: {
    background: "#ffffff",
    border:
      "1px solid #dbe3ee",
    borderRadius: "20px",
    padding: "24px",
    boxShadow:
      "0 8px 30px rgba(30,45,75,.05)",
  },

  panelHeading: {
    display: "flex",
    gap: "13px",
    alignItems:
      "flex-start",
    marginBottom: "22px",
  },

  step: {
    minWidth: "31px",
    height: "31px",
    display: "grid",
    placeItems: "center",
    background: "#122033",
    color: "#ffffff",
    borderRadius: "9px",
    fontWeight: 900,
  },

  panelTitle: {
    margin: "1px 0 4px",
    fontSize: "20px",
  },

  panelSub: {
    margin: 0,
    color: "#687386",
    fontSize: "14px",
    lineHeight: 1.45,
  },

  uploadBox: {
    border:
      "1.5px dashed #aebbd0",
    borderRadius: "16px",
    padding: "20px",
    display: "grid",
    gap: "14px",
    background: "#fbfcfe",
  },

  primaryButton: {
    border: 0,
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#3157d5",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },

  secondaryButton: {
    border:
      "1px solid #dbe3ee",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#ffffff",
    color: "#122033",
    fontWeight: 700,
    cursor: "pointer",
  },

  statusBox: {
    marginTop: "18px",
    padding: "14px 16px",
    borderRadius: "12px",
    background: "#eef3ff",
    display: "grid",
    gap: "4px",
  },

  statusText: {
    fontSize: "13px",
    color: "#687386",
  },

  errorBox: {
    marginTop: "14px",
    padding: "13px 15px",
    color: "#b42318",
    background: "#fff1f0",
    border:
      "1px solid #ffd1cc",
    borderRadius: "12px",
    lineHeight: 1.45,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, 1fr)",
    gap: "10px",
    marginTop: "16px",
  },

  summaryCard: {
    border:
      "1px solid #dbe3ee",
    borderRadius: "13px",
    padding: "12px",
    display: "grid",
  },

  summaryNumber: {
    fontSize: "23px",
  },

  summaryLabel: {
    color: "#687386",
    fontSize: "12px",
  },

  metadata: {
    marginTop: "16px",
  },

  metadataSummary: {
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "14px",
  },

  pre: {
    marginTop: "10px",
    overflow: "auto",
    maxHeight: "290px",
    padding: "14px",
    background: "#111827",
    color: "#dbeafe",
    borderRadius: "12px",
    fontSize: "11px",
    lineHeight: 1.55,
  },

  emptyState: {
    minHeight: "380px",
    border:
      "1px dashed #dbe3ee",
    borderRadius: "16px",
    display: "grid",
    placeItems: "center",
    color: "#687386",
    textAlign: "center",
    padding: "35px",
  },

  progressRow: {
    display: "flex",
    justifyContent:
      "space-between",
    color: "#687386",
    fontSize: "12px",
    marginBottom: "7px",
  },

  progressTrack: {
    width: "100%",
    height: "6px",
    background: "#e9edf4",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "24px",
  },

  progressBar: {
    height: "100%",
    background: "#3157d5",
    transition:
      "width .35s ease",
  },

  conversationWrapper: {
    position: "relative",
  },

  reelShell: {
    position: "relative",
    width: "100%",
    marginBottom: "22px",
    borderRadius: "20px",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #eef3ff 50%, #f8fafc 100%)",
    border:
      "1px solid #dbe3ee",
    overflow: "hidden",
    boxShadow:
      "inset 0 8px 25px rgba(18,32,51,.04), inset 0 -8px 25px rgba(18,32,51,.04)",
  },

  reelViewport: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },

  reelTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    willChange: "transform",
  },

  reelRow: {
    width: "100%",
    display: "flex",
    flexDirection:
      "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "4px",
    boxSizing: "border-box",
    color: "#64748b",
    opacity: 0.34,
    transform: "scale(.88)",
    filter: "blur(.7px)",
    transition:
      "opacity 300ms ease, transform 300ms ease, filter 300ms ease",
  },

  reelRowActive: {
    opacity: 1,
    color: "#122033",
    transform: "scale(1)",
    filter: "blur(0)",
  },

  reelRowFar: {
    opacity: 0.08,
    transform: "scale(.78)",
    filter: "blur(2px)",
  },

  reelRowClickable: {
    cursor: "pointer",
  },

  reelFocusFrame: {
    position: "absolute",
    left: "12px",
    right: "12px",
    zIndex: 2,
    pointerEvents: "none",
    borderRadius: "16px",
    border:
      "2px solid rgba(49,87,213,.65)",
    background:
      "rgba(255,255,255,.38)",
    boxShadow:
      "0 8px 30px rgba(49,87,213,.10), inset 0 0 30px rgba(49,87,213,.04)",
  },

  reelPosition: {
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: ".14em",
    textTransform: "uppercase",
    color: "#718096",
  },

  reelSavedAnswer: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 600,
    maxWidth: "85%",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow:
      "ellipsis",
  },

  reelSavedAnswerActive: {
    color: "#3157d5",
    fontSize: "14px",
    fontWeight: 800,
    background: "#eef3ff",
    borderRadius: "999px",
    padding: "4px 10px",
  },

  reelFadeTop: {
    position: "absolute",
    zIndex: 4,
    left: 0,
    right: 0,
    top: 0,
    height: "60px",
    pointerEvents: "none",
    background:
      "linear-gradient(180deg, #f8fafc 0%, rgba(248,250,252,0) 100%)",
  },

  reelFadeBottom: {
    position: "absolute",
    zIndex: 4,
    left: 0,
    right: 0,
    bottom: 0,
    height: "60px",
    pointerEvents: "none",
    background:
      "linear-gradient(0deg, #f8fafc 0%, rgba(248,250,252,0) 100%)",
  },

  reelScrollHint: {
    textAlign: "center",
    fontSize: "10px",
    color: "#94a3b8",
    padding:
      "8px 12px 10px",
    letterSpacing: ".04em",
  },

  answerCard: {
    padding: "22px",
    marginTop: "18px",
    borderRadius: "18px",
    background: "#ffffff",
    border:
      "1px solid #dbe3ee",
    boxShadow:
      "0 10px 30px rgba(30,45,75,.06)",
    transition:
      "opacity 250ms ease, transform 250ms ease",
  },

  rollerPosition: {
    color: "#687386",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: ".12em",
    fontWeight: 800,
    marginBottom: "5px",
  },

  activeFieldTitle: {
    margin: "2px 0 8px",
    fontSize: "28px",
  },

  question: {
    margin: "0 0 16px",
    color: "#4c596c",
    lineHeight: 1.45,
  },

  fieldMeta: {
    marginTop: "10px",
    color: "#687386",
    fontSize: "11px",
  },

  answerInput: {
    width: "100%",
    padding: "14px 15px",
    border:
      "1px solid #bdc8d7",
    borderRadius: "12px",
    background: "#ffffff",
    outline: "none",
    fontSize: "15px",
    boxSizing: "border-box",
  },

  choiceRow: {
    display: "flex",
    gap: "10px",
  },

  choiceButton: {
    flex: 1,
    border:
      "1px solid #dbe3ee",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#ffffff",
    color: "#122033",
    fontWeight: 700,
    cursor: "pointer",
  },

  choiceButtonActive: {
    background: "#3157d5",
    color: "#ffffff",
    borderColor: "#3157d5",
  },

  warning: {
    padding: "14px",
    borderRadius: "12px",
    background: "#fff7e8",
    border:
      "1px solid #f4d698",
  },

  flyingAnswer: {
    position: "absolute",
    zIndex: 30,
    left: "50%",
    top: "445px",
    transform:
      "translate(-50%, 0) scale(1)",
    opacity: 1,
    padding: "8px 16px",
    borderRadius: "999px",
    background: "#3157d5",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "14px",
    boxShadow:
      "0 10px 25px rgba(49,87,213,.28)",
    pointerEvents: "none",
    transition:
      "transform 420ms cubic-bezier(.2,.8,.2,1), opacity 420ms ease",
  },

  flyingAnswerActive: {
    transform:
      "translate(-50%, -285px) scale(.9)",
    opacity: 0.15,
  },

  navButtons: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "12px",
    marginTop: "20px",
  },

  previewPanel: {
    margin:
      "0 5vw 50px",
    background: "#ffffff",
    border:
      "1px solid #dbe3ee",
    borderRadius: "20px",
    padding: "24px",
    boxShadow:
      "0 8px 30px rgba(30,45,75,.05)",
  },

  previewActions: {
    display: "flex",
    gap: "12px",
    marginBottom: "18px",
  },

  downloadLink: {
    display: "inline-block",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#3157d5",
    color: "#ffffff",
    fontWeight: 700,
    textDecoration: "none",
  },

  iframe: {
    width: "100%",
    height: "720px",
    border:
      "1px solid #dbe3ee",
    borderRadius: "14px",
    background: "#f8fafc",
  },

  footer: {
    padding:
      "10px 5vw 45px",
    color: "#687386",
    fontSize: "14px",
  },
};