"use client";

export default function RollingField({
  fields,
  currentIndex,
  onPrevious,
  onNext,
}) {
  const previousField =
    currentIndex > 0 ? fields[currentIndex - 1] : null;

  const currentField = fields[currentIndex];

  const nextField =
    currentIndex < fields.length - 1
      ? fields[currentIndex + 1]
      : null;

  return (
    <div style={styles.container}>
      <div style={styles.viewport}>
        <div style={styles.sideField}>
          {previousField?.label || ""}
        </div>

        <div style={styles.activeField}>
          {currentField?.label || ""}
        </div>

        <div style={styles.sideField}>
          {nextField?.label || ""}
        </div>
      </div>

      <div style={styles.controls}>
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </button>

        <button
          onClick={onNext}
          disabled={currentIndex === fields.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    maxWidth: "600px",
    margin: "60px auto",
    textAlign: "center",
  },

  viewport: {
    height: "260px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "30px",
    overflow: "hidden",
  },

  activeField: {
    fontSize: "32px",
    fontWeight: "700",
    opacity: 1,
    transform: "scale(1)",
    transition: "all 0.4s ease",
  },

  sideField: {
    fontSize: "20px",
    opacity: 0.25,
    transform: "scale(0.85)",
    filter: "blur(1px)",
    transition: "all 0.4s ease",
  },

  controls: {
    display: "flex",
    justifyContent: "center",
    gap: "16px",
    marginTop: "30px",
  },
};
