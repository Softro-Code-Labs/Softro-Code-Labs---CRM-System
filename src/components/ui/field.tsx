import { cn } from "@/lib/utils";
import { PasswordInput } from "./password-input";

const control =
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none disabled:bg-ink-100 aria-[invalid=true]:border-red-500";

type FieldProps = {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
  required?: boolean;
  className?: string;
};

function FieldShell({ label, name, error, hint, required, className, children }: FieldProps & { children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={name} className="block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error?.length ? (
        <p id={`${name}-error`} className="text-xs text-red-600">
          {error[0]}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  error,
  hint,
  required,
  className,
  type,
  ...props
}: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const shared = {
    id: name,
    name,
    required,
    "aria-invalid": error?.length ? true : undefined,
    "aria-describedby": error?.length ? `${name}-error` : undefined,
    className: control,
  } as const;
  return (
    <FieldShell {...{ label, name, error, hint, required, className }}>
      {type === "password" ? <PasswordInput {...shared} {...props} /> : <input {...shared} type={type} {...props} />}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  hint,
  required,
  className,
  ...props
}: FieldProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  return (
    <FieldShell {...{ label, name, error, hint, required, className }}>
      <textarea
        id={name}
        name={name}
        rows={4}
        required={required}
        aria-invalid={error?.length ? true : undefined}
        className={control}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  required,
  className,
  options,
  placeholder,
  ...props
}: FieldProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> & {
    options: { value: string; label: string }[];
    placeholder?: string;
  }) {
  return (
    <FieldShell {...{ label, name, error, hint, required, className }}>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error?.length ? true : undefined}
        className={control}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  ...props
}: { label: string; name: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  return (
    <label htmlFor={name} className="flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        className="mt-0.5 size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      <span>
        <span className="block text-sm font-medium text-ink-700">{label}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}
