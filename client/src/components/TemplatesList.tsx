import React, { useState } from "react";
import templatesData from "../data/templates.json";

// Define the expected type for templatesData
type TemplatesJson = string[] | { templates: string[] };

// Cast the imported data to the expected type
const templatesDataTyped = templatesData as unknown as TemplatesJson;

// If templates.json exports an object like { templates: [...] }, extract the array:
const templates: string[] = Array.isArray(templatesDataTyped)
  ? templatesDataTyped
  : templatesDataTyped.templates;
import { FaFileWord } from "react-icons/fa";

const FileWordIcon = FaFileWord as unknown as React.FC<{ size?: number; className?: string }>;
const getLabel = (filename: string) => filename.replace(/_/g, " ").replace(/\.docx$/, "");

const TemplatesList: React.FC = () => {
  const [view, setView] = useState<'text' | 'icon'>('icon');

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📄 Available Templates</h2>
      <div className="mb-4 flex gap-2">
        <button
          className={`px-3 py-1 rounded border ${view === 'text' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          onClick={() => setView('text')}
        >
          Text View
        </button>
        <button
          className={`px-3 py-1 rounded border ${view === 'icon' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          onClick={() => setView('icon')}
        >
          Icon View
        </button>
      </div>
      {view === 'text' ? (
        <ul className="space-y-2">
          {(templates as string[]).map((template, index) => (
            <li key={index} className="flex items-center gap-2">
              <FileWordIcon size={18} className="text-blue-500" />
              <a
                href={`/Templates/${template}`}
                download
                className="hover:underline"
              >
                {getLabel(template)}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(templates as string[]).map((template, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg shadow hover:bg-blue-100 transition flex flex-col items-center cursor-pointer"
              onClick={() => window.location.href = `/Templates/${template}`}
              tabIndex={0}
              role="button"
              aria-label={`Download ${getLabel(template)}`}
            >
              <FileWordIcon size={40} className="text-blue-600 mb-2" />
              <span className="text-center mb-2">{getLabel(template)}</span>
              <span className="text-xs text-gray-500">Click to download</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatesList;
