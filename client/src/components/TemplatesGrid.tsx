import React from "react";
import templatesData from "../data/templates.json";

// If templatesData is just an array, use this:
// const templates = templatesData as string[];

// If templatesData is an object with a 'templates' property, use this:
const templates: string[] = ((templatesData as unknown) as { templates: string[] }).templates;

  // Helper function to format file names for display
  function getLabel(file: string) {
    return file.replace(/_/g, " ").replace(/\.docx$/, "");
  }

export default function TemplatesGrid() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
      {templates.map((file) => (
        <a
          key={file}
          href={`/Templates/${encodeURIComponent(file)}`}
          download
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            textDecoration: "none",
            background: "#f9fafb",
            color: "#374151",
            transition: "box-shadow 0.2s, background 0.2s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            cursor: "pointer",
            width: "140px"
          }}
        >
          <div style={{ width: 48, height: 60, background: "#bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
            <span style={{ color: "#2563eb", fontWeight: "bold", fontSize: 18 }}>DOCX</span>
          </div>
          <span style={{ textAlign: "center", fontSize: "0.95rem", marginTop: 8 }}>{getLabel(file)}</span>
        </a>
      ))}
    </div>
  );
}
