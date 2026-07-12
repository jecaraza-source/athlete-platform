'use client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrintField {
  label: string;
  value: string | number | null | undefined;
}

export interface PrintSection {
  title: string;
  fields: PrintField[];
}

interface Props {
  /** Title shown at the top of the printed section (e.g. "Evaluación Médica") */
  formTitle: string;
  sections: PrintSection[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PrintableFormView
 *
 * Rendered invisibly on screen (`hidden`) and only revealed when printing
 * (`print:block`).  It receives the form's existing data mapped into
 * sections/fields and automatically filters out any field whose value is
 * empty, null or undefined — so the final PDF only contains real content.
 */
export default function PrintableFormView({ formTitle, sections }: Props) {
  // Filter sections: keep only those that have at least one non-empty field
  const nonEmptySections = sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((f) => {
        const v = f.value;
        return v !== null && v !== undefined && String(v).trim() !== '';
      }),
    }))
    .filter((section) => section.fields.length > 0);

  return (
    <div className="hidden print:block font-sans text-gray-900">
      {/* Section heading */}
      <div className="border-b-2 border-gray-800 pb-3 mb-6 mt-2">
        <h2 className="text-xl font-bold tracking-tight">{formTitle}</h2>
      </div>

      {nonEmptySections.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          Sin información capturada en este rubro.
        </p>
      ) : (
        <div className="space-y-6">
          {nonEmptySections.map((section, si) => (
            <div key={si} style={{ breakInside: 'avoid' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-3">
                {section.title}
              </h3>
              <div className="space-y-3 pl-1">
                {section.fields.map((field, fi) => (
                  <div key={fi}>
                    <p className="text-[9pt] font-semibold text-gray-500 leading-tight mb-0.5">
                      {field.label}
                    </p>
                    <p className="text-[10pt] text-gray-900 whitespace-pre-wrap leading-relaxed">
                      {String(field.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
