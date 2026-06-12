import React from "react";

// ── Logo ─────────────────────────────────────────────────────────

export function TxLogo({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "var(--font-display)",
        fontSize: size,
        fontWeight: 500,
        color: "var(--fg-strong)",
        letterSpacing: "-0.01em",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--accent)" />
        <text
          x="12"
          y="16.5"
          textAnchor="middle"
          fontFamily="Newsreader, serif"
          fontSize="13"
          fontWeight="500"
          fontStyle="italic"
          fill="var(--paper-100)"
        >
          T<tspan dy="2" fontSize="10">e</tspan><tspan dy="-2">X</tspan>
        </text>
      </svg>
      <span>
        <span style={{ fontStyle: "italic" }}>T</span>
        <span style={{ position: "relative", top: 2 }}>e</span>
        <span style={{ position: "relative", top: -1, fontStyle: "italic" }}>X</span>
        isStudio
      </span>
    </span>
  );
}

// ── Appbar ────────────────────────────────────────────────────────

export function TxAppbar({
  left,
  center,
  right,
}: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="tx-appbar"
      style={{
        height: "var(--chrome-h)",
        flexShrink: 0,
        background: "var(--bg-chrome)",
        borderBottom: "1px solid var(--border-soft)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto max-content",
        alignItems: "center",
        padding: "0 12px",
        gap: 12,
      }}
    >
      <div className="tx-appbar-left" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
        {left}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        {center}
      </div>
      <div className="tx-appbar-right" style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
        {right}
      </div>
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────

export function TxBreadcrumb({ parts }: { parts: string[] }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-base)", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: "var(--fg-faint)" }}>/</span>}
          <span
            style={{
              color: i === parts.length - 1 ? "var(--fg-strong)" : "var(--fg-muted)",
              fontWeight: i === parts.length - 1 ? 500 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: i === parts.length - 1 ? 0 : 1,
            }}
          >
            {p}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

// ── Status bar ────────────────────────────────────────────────────

interface StatusItem {
  text?: string;
  dot?: string;
  icon?: React.ReactNode;
  right?: boolean;
}

export function TxStatusbar({ items }: { items: StatusItem[] }) {
  return (
    <div
      className="tx-statusbar"
      style={{
        height: "var(--statusbar-h)",
        flexShrink: 0,
        background: "var(--bg-chrome)",
        borderTop: "1px solid var(--border-firm)",
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 12px",
        fontSize: "var(--fs-xs)",
        color: "var(--fg-muted)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {items.map((it, i) => (
        <span
          className="tx-statusbar-item"
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            ...(it.right ? { marginLeft: "auto" } : {}),
          }}
        >
          {it.dot && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: it.dot,
                flexShrink: 0,
              }}
            />
          )}
          {it.icon}
          {it.text}
        </span>
      ))}
    </div>
  );
}
