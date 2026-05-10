/* TeXisStudio — Pantalla de Inicio: proyectos recientes */

const homeStyles = {
  root: { flex: 1, display: 'flex', minHeight: 0, background: 'var(--bg-app)' },
  side: {
    width: 220, flexShrink: 0,
    borderRight: '1px solid var(--border-subtle)',
    padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 4,
    background: 'var(--bg-chrome)',
  },
  sideItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 'var(--r-md)',
    fontSize: 'var(--fs-base)', cursor: 'pointer',
    background: active ? 'var(--bg-selected)' : 'transparent',
    color: active ? 'var(--accent-deep)' : 'var(--fg-default)',
    fontWeight: active ? 500 : 400,
  }),
  main: { flex: 1, overflow: 'auto', padding: '32px 48px 48px' },
  hero: { marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border-subtle)' },
  greet: {
    fontFamily: 'var(--font-display)', fontSize: 'var(--fs-3xl)', fontWeight: 400,
    color: 'var(--fg-strong)', margin: 0, letterSpacing: '-0.02em',
  },
  greetItalic: { fontStyle: 'italic', color: 'var(--accent-deep)' },
  sub: { color: 'var(--fg-muted)', marginTop: 6, fontSize: 'var(--fs-md)' },
  actions: { display: 'flex', gap: 8, marginTop: 18 },
  sectionTitle: {
    fontSize: 'var(--fs-xs)', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--fg-faint)',
    margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: 8,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  card: {
    background: 'var(--bg-panel)', border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-lg)', padding: 16, cursor: 'pointer',
    transition: 'border-color .15s, transform .15s',
    display: 'flex', flexDirection: 'column', gap: 10, minHeight: 132,
  },
  cardSpine: {
    width: 4, height: 28, borderRadius: 2,
    background: 'var(--accent)', flexShrink: 0,
  },
  cardTitle: {
    fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 500,
    color: 'var(--fg-strong)', lineHeight: 1.3, letterSpacing: '-0.005em',
    margin: 0,
  },
  cardMeta: { fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)', display: 'flex', gap: 10, alignItems: 'center' },
  cardFooter: {
    marginTop: 'auto', paddingTop: 10, borderTop: '1px dashed var(--border-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
  },
  templateCard: {
    background: 'var(--bg-panel)', border: '1px dashed var(--border-firm)',
    borderRadius: 'var(--r-lg)', padding: 16, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 8, minHeight: 132,
  },
};

const PROJECTS = [
  { title: 'Análisis de redes neuronales en clasificación de imágenes médicas',
    profile: 'generic.thesis', level: 'Maestría', updated: 'hace 2 h', state: 'compilado',
    pages: 142, refs: 87, words: 28450 },
  { title: 'Determinantes socioeconómicos del rezago educativo en Oaxaca',
    profile: 'generic.thesis', level: 'Licenciatura', updated: 'hace 1 día', state: 'borrador',
    pages: 78, refs: 41, words: 14210 },
  { title: 'Optimización de catalizadores Fischer-Tropsch con Pt/Al₂O₃',
    profile: 'engineering.basic', level: 'Doctorado', updated: 'hace 4 días', state: 'compilado',
    pages: 198, refs: 134, words: 41900 },
  { title: 'Modelos predictivos en epidemiología hospitalaria',
    profile: 'vancouver.health', level: 'Maestría', updated: 'la semana pasada', state: 'errores',
    pages: 56, refs: 62, words: 11240 },
  { title: 'Tesina — Inteligencia artificial y derechos de autor',
    profile: 'generic.tesina', level: 'Licenciatura', updated: 'hace 2 sem', state: 'borrador',
    pages: 34, refs: 23, words: 6800 },
];

function TxHomeScreen({ onOpen }) {
  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span className="chip" style={{ marginLeft: 6 }}>v0.2.0</span></>}
        center={null}
        right={<>
          <button className="btn btn-ghost btn-sm"><IconSearch size={13}/> Buscar <span className="kbd">⌘K</span></button>
          <button className="btn btn-ghost btn-icon"><IconSettings size={14}/></button>
        </>}
      />
      <div style={homeStyles.root}>
        <aside style={homeStyles.side}>
          <div style={homeStyles.sideItem(true)}><IconBook size={13}/> Proyectos</div>
          <div style={homeStyles.sideItem(false)}><IconStar size={13}/> Favoritos</div>
          <div style={homeStyles.sideItem(false)}><IconClock size={13}/> Recientes</div>
          <div style={homeStyles.sideItem(false)}><IconTrash size={13}/> Archivados</div>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 4px' }}></div>
          <div style={{ ...homeStyles.sectionTitle, margin: '4px 4px 8px' }}>Biblioteca</div>
          <div style={homeStyles.sideItem(false)}><IconFolder size={13}/> Perfiles</div>
          <div style={homeStyles.sideItem(false)}><IconFile size={13}/> Elementos</div>
          <div style={{ marginTop: 'auto', padding: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--fs-xs)', color: 'var(--fg-faint)', display: 'flex', alignItems:'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--build-ok)' }}></span>
            TeX Live 2024 · biber 2.20
          </div>
        </aside>

        <main style={homeStyles.main} className="scroll">
          <div style={homeStyles.hero}>
            <h1 style={homeStyles.greet}>Continúa <span style={homeStyles.greetItalic}>donde lo dejaste</span>.</h1>
            <p style={homeStyles.sub}>5 proyectos · último compilado hace 2 horas</p>
            <div style={homeStyles.actions}>
              <button className="btn btn-accent" onClick={onOpen}>
                <IconPlus size={13}/> Nuevo proyecto
              </button>
              <button className="btn"><IconUpload size={13}/> Importar .tex</button>
              <button className="btn btn-ghost">Abrir desde carpeta…</button>
            </div>
          </div>

          <div style={homeStyles.sectionTitle}>
            <span>Proyectos recientes</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}></span>
            <span style={{ color: 'var(--fg-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              Ordenar por: <span style={{ color: 'var(--fg-default)' }}>actualizado ↓</span>
            </span>
          </div>

          <div style={homeStyles.grid}>
            {PROJECTS.map((p, i) => (
              <div key={i} style={homeStyles.card}
                onClick={i === 0 ? onOpen : undefined}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-soft)'}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={homeStyles.cardSpine}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={homeStyles.cardTitle}>{p.title}</h3>
                  </div>
                </div>
                <div style={homeStyles.cardMeta}>
                  <span className="chip">{p.level}</span>
                  <span className="tx-mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{p.profile}</span>
                </div>
                <div style={homeStyles.cardFooter}>
                  <span>{p.pages}p · {p.refs} refs · {p.words.toLocaleString('es')} palabras</span>
                  <span className={
                    p.state === 'compilado' ? 'chip chip-ok' :
                    p.state === 'errores'  ? 'chip chip-err' :
                    'chip chip-warn'
                  }>
                    {p.state === 'compilado' && <IconCheck size={9} sw={2.5}/>}
                    {p.state === 'errores' && <IconErr size={9} sw={2.5}/>}
                    {p.state}
                  </span>
                </div>
                <div style={{ position: 'absolute', display: 'none' }}>{p.updated}</div>
              </div>
            ))}

            <div style={homeStyles.templateCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-muted)' }}>
                <IconPlus size={14}/>
                <span style={{ fontWeight: 500 }}>Crear nuevo</span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                Tesis, tesina, paper o reporte técnico. Comienza desde un perfil o un proyecto vacío.
              </p>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                <span className="chip">Tesis</span>
                <span className="chip">Tesina</span>
                <span className="chip">+ 4 más</span>
              </div>
            </div>
          </div>
        </main>
      </div>
      <TxStatusbar items={[
        { text: 'Listo', dot: 'var(--build-ok)' },
        { icon: <IconFolder size={11}/>, text: '~/Documentos/Tesis' },
        { right: true, text: 'TeXisStudio 0.2.0 · AGPL+CC' },
      ]}/>
    </>
  );
}

Object.assign(window, { TxHomeScreen });
