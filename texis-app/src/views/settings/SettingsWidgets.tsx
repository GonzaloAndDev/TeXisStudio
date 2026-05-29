import React from "react";

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
      borderRadius: "var(--r-lg)", padding: "16px 20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)" }}>{label}</div>
        {hint && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>{hint}</div>}
      </div>
    </label>
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ width: 180, flexShrink: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
