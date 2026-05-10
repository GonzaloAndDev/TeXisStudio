/* TeXisStudio — Wizard de creación: tipo → país → perfil → datos */

const wizStyles = {
  shell: { flex: 1, display: 'flex', minHeight: 0, background: 'var(--bg-app)' },
  rail: {
    width: 280, flexShrink: 0,
    background: 'var(--bg-chrome)',
    borderRight: '1px solid var(--border-subtle)',
    padding: '32px 24px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  railTitle: {
    fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 500,
    color: 'var(--fg-strong)', margin: '0 0 4px', letterSpacing: '-0.01em',
  },
  railSub: { fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)', marginBottom: 28 },
  step: (s) => ({
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '10px 8px',
    color: s === 'done' ? 'var(--fg-muted)' : s === 'active' ? 'var(--fg-strong)' : 'var(--fg-faint)',
    cursor: s === 'todo' ? 'default' : 'pointer',
  }),
  stepNum: (s) => ({
    width: 22, height: 22, flexShrink: 0,
    borderRadius: '50%',
    border: `1.5px solid ${s === 'active' ? 'var(--accent)' : 'var(--border-firm)'}`,
    background: s === 'done' ? 'var(--accent)' : s === 'active' ? 'var(--accent-tint)' : 'transparent',
    color: s === 'done' ? 'white' : s === 'active' ? 'var(--accent-deep)' : 'var(--fg-faint)',
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  }),
  stepBody: { display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 1 },
  stepName: { fontSize: 'var(--fs-base)', fontWeight: 500, lineHeight: 1.3 },
  stepHint: { fontSize: 'var(--fs-xs)', color: 'var(--fg-faint)' },
  stepBar: (active) => ({
    width: 1, flex: 1, marginLeft: 11, marginTop: 4, marginBottom: 4,
    background: active ? 'var(--accent)' : 'var(--border-soft)',
    minHeight: 8,
  }),

  main: { flex: 1, overflow: 'auto', padding: '40px 56px 32px', display: 'flex', flexDirection: 'column' },
  q: {
    fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 400,
    color: 'var(--fg-strong)', margin: '0 0 6px', letterSpacing: '-0.015em',
    lineHeight: 1.2,
  },
  qSub: { color: 'var(--fg-muted)', fontSize: 'var(--fs-md)', marginBottom: 28, maxWidth: 540 },
  optionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, maxWidth: 820 },
  option: (sel) => ({
    background: sel ? 'var(--accent-tint)' : 'var(--bg-panel)',
    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-soft)'}`,
    borderRadius: 'var(--r-lg)',
    padding: 18, cursor: 'pointer',
    boxShadow: sel ? '0 0 0 3px var(--accent-soft)' : 'none',
    transition: 'border-color .15s, box-shadow .15s',
    display: 'flex', flexDirection: 'column', gap: 8,
    minHeight: 130,
  }),
  optionIcon: (sel) => ({
    width: 32, height: 32, borderRadius: 'var(--r-md)',
    background: sel ? 'var(--accent)' : 'var(--ink-100)',
    color: sel ? 'white' : 'var(--fg-default)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }),
  optionTitle: { fontSize: 'var(--fs-md)', fontWeight: 500, color: 'var(--fg-strong)' },
  optionDesc: { fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)', lineHeight: 1.5, margin: 0 },
  optionMeta: {
    marginTop: 'auto', display: 'flex', gap: 6, paddingTop: 8,
    borderTop: '1px dashed var(--border-soft)', fontSize: 'var(--fs-xs)',
    color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
  },

  footer: {
    marginTop: 'auto', paddingTop: 32,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    maxWidth: 820,
  },
};

function WizStep({ n, name, hint, state, last }) {
  return (
    <>
      <div style={wizStyles.step(state)}>
        <div style={wizStyles.stepNum(state)}>
          {state === 'done' ? <IconCheck size={11} sw={3}/> : n}
        </div>
        <div style={wizStyles.stepBody}>
          <div style={wizStyles.stepName}>{name}</div>
          <div style={wizStyles.stepHint}>{hint}</div>
        </div>
      </div>
      {!last && <div style={wizStyles.stepBar(state === 'done')}></div>}
    </>
  );
}

function TxWizardScreen() {
  const profiles = [
    { id: 'generic.thesis', title: 'Tesis genérica', desc: 'Estructura clásica con marco teórico, metodología, resultados y conclusiones.', meta: 'XeLaTeX · biber · APA 7', sel: true },
    { id: 'generic.tesina', title: 'Tesina', desc: 'Versión simplificada para licenciatura: introducción, desarrollo y cierre.', meta: 'XeLaTeX · biber · APA 7' },
    { id: 'engineering.basic', title: 'Ingeniería', desc: 'Reporte técnico con secciones de diseño, implementación y pruebas.', meta: 'XeLaTeX · biber · IEEE' },
    { id: 'vancouver.health', title: 'Ciencias de la salud', desc: 'Estructura IMRyD para investigación clínica con bibliografía Vancouver.', meta: 'XeLaTeX · biber · Vancouver' },
  ];
  return (
    <>
      <TxAppbar
        left={<><TxLogo/></>}
        center={<span style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>Nuevo proyecto · paso 3 de 4</span>}
        right={<button className="btn btn-ghost btn-sm">Cancelar <span className="kbd">Esc</span></button>}
      />
      <div style={wizStyles.shell}>
        <aside style={wizStyles.rail}>
          <h2 style={wizStyles.railTitle}>Crear proyecto</h2>
          <p style={wizStyles.railSub}>Te guiamos en la configuración inicial. Todo es editable después.</p>
          <WizStep n="1" name="Tipo de documento" hint="Tesis · Tesina · Reporte" state="done"/>
          <WizStep n="2" name="País e institución" hint="México · UNAM · FES Acatlán" state="done"/>
          <WizStep n="3" name="Perfil" hint="Estructura y normas" state="active"/>
          <WizStep n="4" name="Datos del autor" hint="Título, asesor, palabras clave" state="todo" last/>
          <div style={{ marginTop: 24, padding: 12, borderRadius: 'var(--r-md)', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--fg-default)', fontSize: 'var(--fs-sm)' }}>¿Por qué un perfil?</strong><br/>
            Define la clase LaTeX, paquetes, estilo de bibliografía y secciones obligatorias. Puedes cambiarlo después.
          </div>
        </aside>

        <main style={wizStyles.main} className="scroll">
          <h1 style={wizStyles.q}>¿Qué <em style={{ color: 'var(--accent-deep)', fontStyle: 'italic' }}>perfil</em> usarás como base?</h1>
          <p style={wizStyles.qSub}>
            Cada perfil empaqueta una clase LaTeX, paquetes y reglas. La comunidad publica perfiles institucionales que puedes importar.
          </p>

          <div style={wizStyles.optionGrid}>
            {profiles.map(p => (
              <div key={p.id} style={wizStyles.option(p.sel)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={wizStyles.optionIcon(p.sel)}>
                    <IconBook size={16}/>
                  </div>
                  {p.sel && <span className="chip chip-accent" style={{ marginTop: 4 }}><IconCheck size={9} sw={2.5}/> seleccionado</span>}
                </div>
                <div style={wizStyles.optionTitle}>{p.title}</div>
                <p style={wizStyles.optionDesc}>{p.desc}</p>
                <div style={wizStyles.optionMeta}>{p.meta}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 'var(--r-md)', background: 'var(--accent-tint)', border: '1px dashed var(--accent-soft)', fontSize: 'var(--fs-sm)', color: 'var(--accent-deep)', display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: 820 }}>
            <IconInfo size={14}/>
            <div>
              <strong>¿Tu institución no aparece?</strong> Puedes importar un perfil comunitario desde un archivo <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>.texisprofile</code> o crear uno propio basado en el genérico.
              <a style={{ marginLeft: 8, color: 'var(--accent-deep)', textDecoration: 'underline' }}>Importar perfil →</a>
            </div>
          </div>

          <div style={wizStyles.footer}>
            <button className="btn"><IconChevronL size={13}/> País e institución</button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>generic.thesis · v1.2</span>
              <button className="btn btn-accent">Continuar <IconChevronR size={13}/></button>
            </div>
          </div>
        </main>
      </div>
      <TxStatusbar items={[
        { text: 'Wizard activo', dot: 'var(--accent)' },
        { icon: <IconFile size={11}/>, text: 'tesis.project.yaml (sin guardar)' },
        { right: true, text: 'Esc para cancelar · ↵ para continuar' },
      ]}/>
    </>
  );
}

Object.assign(window, { TxWizardScreen });
