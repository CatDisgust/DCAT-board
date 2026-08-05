import type { ReactNode } from "react";

export function ChoiceField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="choice-field">
      <legend>{label}</legend>
      {hint && <p className="field-hint">{hint}</p>}
      <div className="choice-grid">{children}</div>
    </fieldset>
  );
}

export function Choice({ name, value, label, description, defaultChecked, required }: {
  name: string;
  value: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  return (
    <label className="choice-card">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} required={required} />
      <span className="choice-control"><i /> <b>{label}</b>{description && <small>{description}</small>}</span>
    </label>
  );
}

export function Segmented({ name, options, defaultValue }: {
  name: string;
  options: readonly (readonly [string, string])[];
  defaultValue?: string | number | boolean | null;
}) {
  const normalized = defaultValue === null || defaultValue === undefined ? "" : String(defaultValue);
  return (
    <div className="segmented">
      {options.map(([value, label]) => (
        <label key={value}>
          <input type="radio" name={name} value={value} defaultChecked={normalized === value} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
