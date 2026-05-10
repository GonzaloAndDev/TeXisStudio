/* TeXisStudio — Chrome compartido: window frame + barra de app + status bar */

const txWindowStyles = {
  frame: {
    width: '100%', height: '100%',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-card)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--fs-base)',
    color: 'var(--fg-default)',
    position: 'relative',
  },
  titlebar: {
    height: 28, flexShrink: 0,
    background: 'var(--bg-chrome)',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    padding: '0 10px',
    fontSize: 'var(--fs-xs)',
    color: 'var(--fg-muted)',
    userSelect: 'none',
  },
  dots: { display: 'flex', gap: 6, alignItems: 'center' },
  dot: (c) => ({ width: 11, height: 11, borderRadius: '50%', background: c }),
  title: { textAlign: 'center', fontWeight: 500, color: 'var(--fg-default)', letterSpacing: '0.01em' },
  ctrls: { display: 'flex', gap: 4, justifyContent: 'flex-end', color: 'var(--fg-faint)' },
};

function TxWindow({ title, children, kind = 'mac' }) {
  return (
    <div style={txWindowStyles.frame}>
      <div style={txWindowStyles.titlebar}>
        <div style={txWindowStyles.dots}>
          {kind === 'mac' ? (
            <>
              <span style={txWindowStyles.dot('#ED6A5F')}></span>
              <span style={txWindowStyles.dot('#F5BD4F')}></span>
              <span style={txWindowStyles.dot('#62C554')}></span>
            </>
          ) : (
            <span style={{ display:'flex', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color:'var(--fg-faint)' }}>
              <span>tx</span>
            </span>
          )}
        </div>
        <div style={txWindowStyles.title}>{title}</div>
        <div style={txWindowStyles.ctrls}>
          <span style={{ fontSize: 10 }}>– □ ✕</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Logo ────────────────────────────────────────────────────────── */

function TxLogo({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 500,
      color: 'var(--fg-strong)', letterSpacing: '-0.01em',
    }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--accent)"/>
        <text x="12" y="16.5" textAnchor="middle"
          fontFamily="Newsreader, serif" fontSize="13" fontWeight="500"
          fontStyle="italic" fill="var(--paper-100)">
          T<tspan dy="2" fontSize="10">e</tspan><tspan dy="-2">X</tspan>
        </text>
      </svg>
      <span><span style={{ fontStyle: 'italic' }}>T</span><span style={{ position:'relative', top: 2 }}>e</span><span style={{ position:'relative', top: -1, fontStyle:'italic' }}>X</span>isStudio</span>
    </span>
  );
}

/* ─── Barra de app (debajo del titlebar OS) ──────────────────────── */

function TxAppbar({ left, center, right }) {
  return (
    <div style={{
      height: 'var(--chrome-h)', flexShrink: 0,
      background: 'var(--bg-chrome)',
      borderBottom: '1px solid var(--border-soft)',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      padding: '0 12px',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>{left}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>{center}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

/* ─── Breadcrumb del proyecto ─────────────────────────────────────── */

function TxBreadcrumb({ parts }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-base)' }}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: 'var(--fg-faint)' }}>/</span>}
          <span style={{
            color: i === parts.length - 1 ? 'var(--fg-strong)' : 'var(--fg-muted)',
            fontWeight: i === parts.length - 1 ? 500 : 400,
          }}>{p}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

/* ─── Status bar inferior ─────────────────────────────────────────── */

function TxStatusbar({ items }) {
  return (
    <div style={{
      height: 'var(--statusbar-h)', flexShrink: 0,
      background: 'var(--bg-chrome)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 12px',
      fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)',
      fontFamily: 'var(--font-mono)',
    }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...(it.right && { marginLeft: 'auto' }) }}>
          {it.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.dot }}></span>}
          {it.icon}
          {it.text}
        </span>
      ))}
    </div>
  );
}

Object.assign(window, { TxWindow, TxLogo, TxAppbar, TxBreadcrumb, TxStatusbar });
