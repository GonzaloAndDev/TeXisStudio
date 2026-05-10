/* TeXisStudio — Editor principal: árbol + bloques + preview PDF */

const edStyles = {
  shell: { flex: 1, display: 'grid', gridTemplateColumns: 'var(--sidebar-w) 1fr 420px', minHeight: 0, background: 'var(--bg-app)' },
  /* ─── Árbol ─── */
  tree: {
    borderRight: '1px solid var(--border-subtle)',
    background: 'var(--bg-chrome)',
    display: 'flex', flexDirection: 'column', minHeight: 0,
  },
  treeHeader: {
    padding: '12px 14px 8px',
    fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'var(--fg-faint)', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  treeBody: { flex: 1, overflow: 'auto', padding: '0 6px 12px' },
  treeGroup: {
    margin: '6px 8px 2px', fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'var(--fg-faint)',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  treeRow: (active, depth = 0) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 8px',
    paddingLeft: 8 + depth * 14,
    borderRadius: 'var(--r-sm)',
    fontSize: 'var(--fs-base)', cursor: 'pointer',
    background: active ? 'var(--bg-selected)' : 'transparent',
    color: active ? 'var(--accent-deep)' : 'var(--fg-default)',
    fontWeight: active ? 500 : 400,
    minHeight: 26,
  }),
  treeNum: {
    fontFamily: 'var(--font-mono)', fontSize: 10,
    color: 'var(--fg-faint)', minWidth: 18, textAlign: 'right',
  },
  treeBadge: { marginLeft: 'auto', fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' },

  /* ─── Centro: editor de bloques ─── */
  center: { display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' },
  toolbar: {
    height: 38, flexShrink: 0,
    borderBottom: '1px solid var(--border-subtle)',
    padding: '0 14px',
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--bg-panel)',
    fontSize: 'var(--fs-sm)',
  },
  paperWrap: {
    flex: 1, overflow: 'auto', padding: '32px 0',
    background: 'var(--bg-app)',
  },
  paper: {
    width: 720, margin: '0 auto',
    background: 'var(--bg-paper)',
    borderRadius: 4,
    boxShadow: 'var(--shadow-paper)',
    border: '1px solid var(--bg-paper-edge)',
    padding: '56px 72px 80px',
    minHeight: 800,
    fontFamily: 'var(--font-display)',
    color: 'var(--fg-strong)',
    lineHeight: 1.65,
  },
  chTag: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)', letterSpacing: '0.05em' },
  chTitle: {
    fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500,
    color: 'var(--fg-strong)', margin: '4px 0 28px', letterSpacing: '-0.015em', lineHeight: 1.15,
  },

  /* ─── Bloques ─── */
  block: { position: 'relative', margin: '6px -32px', padding: '8px 32px', borderRadius: 6 },
  blockHandle: {
    position: 'absolute', left: 4, top: 10,
    display: 'flex', gap: 2, opacity: 0.7,
    color: 'var(--fg-faint)',
  },
  blockTypeChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 7px', borderRadius: 4,
    fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)',
    color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
    background: 'var(--bg-app)', border: '1px solid var(--border-subtle)',
  },

  paragraph: {
    fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.7,
    color: 'var(--fg-strong)', textAlign: 'justify', textIndent: '1.5em',
    margin: 0,
  },

  heading: {
    fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500,
    color: 'var(--fg-strong)', letterSpacing: '-0.005em',
    margin: '28px 0 8px', display: 'flex', alignItems: 'baseline', gap: 12,
  },
  headingNum: { color: 'var(--accent-deep)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, letterSpacing: 0 },

  figureBlock: {
    margin: '14px 0', padding: 14,
    background: 'var(--bg-panel)', borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-soft)',
    display: 'flex', gap: 14,
  },
  figureThumb: {
    width: 140, height: 90, flexShrink: 0,
    borderRadius: 4, background: 'linear-gradient(135deg, var(--ink-100), var(--ink-200))',
    border: '1px solid var(--border-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--fg-faint)',
    fontFamily: 'var(--font-mono)', fontSize: 10,
    backgroundImage: `repeating-linear-gradient(45deg, transparent 0 8px, rgba(0,0,0,0.03) 8px 9px)`,
  },
  citation: {
    background: 'var(--accent-tint)',
    color: 'var(--accent-deep)',
    padding: '1px 6px', borderRadius: 4,
    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
    border: '1px solid var(--accent-soft)',
    cursor: 'pointer',
  },
  equation: {
    margin: '14px 0', padding: '14px 18px',
    background: 'var(--bg-panel)', borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-soft)',
    fontFamily: 'var(--font-mono)', fontSize: 13,
    color: 'var(--fg-strong)',
    display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
  },

  insertBar: {
    margin: '6px -32px', padding: '4px 32px',
    display: 'flex', alignItems: 'center', gap: 4, height: 28,
    opacity: 0.55,
  },
  insertLine: { flex: 1, height: 1, background: 'var(--border-soft)', borderStyle: 'dashed' },
  insertBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)',
    padding: '2px 8px', border: '1px dashed var(--border-firm)', borderRadius: 999,
    background: 'var(--bg-panel)', cursor: 'pointer',
  },

  /* ─── Preview ─── */
  preview: {
    borderLeft: '1px solid var(--border-subtle)',
    background: 'var(--bg-chrome)',
    display: 'flex', flexDirection: 'column', minHeight: 0,
  },
  previewHeader: {
    height: 38, flexShrink: 0, padding: '0 14px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 'var(--fs-sm)',
  },
  previewBody: {
    flex: 1, overflow: 'auto',
    padding: 18,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
  },
  pdfPage: {
    width: 280, aspectRatio: '17/22',
    background: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 20px -8px rgba(0,0,0,0.16)',
    borderRadius: 2,
    padding: '28px 26px',
    fontFamily: 'var(--font-display)', fontSize: 7.5, lineHeight: 1.55,
    color: '#1a1a1a',
    overflow: 'hidden', position: 'relative',
  },
};

function PDFPage({ children, n = 14 }) {
  return (
    <div style={edStyles.pdfPage}>
      {children}
      <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 6.5, color: '#666', fontFamily: 'var(--font-mono)' }}>{n}</div>
    </div>
  );
}

const TREE = [
  { kind: 'group', label: 'Front matter' },
  { id: 'title', label: 'Portada', icon: <IconDoc size={12}/>, depth: 0, badge: 'fields' },
  { id: 'abstract_es', label: 'Resumen', icon: <IconText size={12}/>, depth: 0 },
  { id: 'abstract_en', label: 'Abstract', icon: <IconText size={12}/>, depth: 0 },
  { id: 'dedication', label: 'Dedicatoria', icon: <IconText size={12}/>, depth: 0 },
  { kind: 'group', label: 'Cuerpo · mainmatter' },
  { id: 'cap1', label: '1. Introducción', icon: <IconChevronR size={11}/>, depth: 0, num: '01' },
  { id: 'cap2', label: '2. Marco teórico', icon: <IconChevronD size={11}/>, depth: 0, num: '02', active: true },
  { id: 'cap2.1', label: '2.1 Antecedentes', depth: 1 },
  { id: 'cap2.2', label: '2.2 Bases conceptuales', depth: 1, active: true },
  { id: 'cap2.3', label: '2.3 Estado del arte', depth: 1 },
  { id: 'cap3', label: '3. Metodología', icon: <IconChevronR size={11}/>, depth: 0, num: '03' },
  { id: 'cap4', label: '4. Resultados', icon: <IconChevronR size={11}/>, depth: 0, num: '04', badge: '⚠ 1' },
  { id: 'cap5', label: '5. Discusión', icon: <IconChevronR size={11}/>, depth: 0, num: '05' },
  { id: 'cap6', label: '6. Conclusiones', icon: <IconChevronR size={11}/>, depth: 0, num: '06' },
  { kind: 'group', label: 'Back matter' },
  { id: 'refs', label: 'Referencias', icon: <IconQuote size={12}/>, depth: 0, badge: '87' },
  { id: 'apx', label: 'Anexos', icon: <IconFolder size={12}/>, depth: 0 },
];

const TYPE_CHIPS = {
  paragraph: { i: <IconText size={9}/>, t: 'Párrafo' },
  heading:   { i: <IconHeading size={9}/>, t: 'Subsección' },
  figure:    { i: <IconImage size={9}/>, t: 'Figura' },
  citation:  { i: <IconQuote size={9}/>, t: 'Cita' },
  equation:  { i: <IconSigma size={9}/>, t: 'Ecuación' },
  table:     { i: <IconTable size={9}/>, t: 'Tabla' },
  list:      { i: <IconList size={9}/>, t: 'Lista' },
  raw:       { i: <IconCode size={9}/>, t: 'Raw LaTeX', warn: true },
};

function BlockChrome({ type, children, onHover }) {
  const c = TYPE_CHIPS[type];
  return (
    <div style={edStyles.block}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <div style={edStyles.blockHandle}>
        <IconDrag size={12}/>
      </div>
      <div style={{ position: 'absolute', right: 32, top: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{
          ...edStyles.blockTypeChip,
          ...(c.warn && { background: 'var(--build-warn-tint)', color: 'var(--build-warn)' }),
        }}>{c.i} {c.t}{c.warn && ' ⚠'}</span>
      </div>
      {children}
    </div>
  );
}

function InsertBar() {
  return (
    <div style={edStyles.insertBar}>
      <div style={edStyles.insertLine}></div>
      <span style={edStyles.insertBtn}><IconPlus size={9} sw={2.5}/> añadir bloque</span>
      <span style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
        / para comandos
      </span>
      <div style={edStyles.insertLine}></div>
    </div>
  );
}

function TxEditorScreen() {
  return (
    <>
      <TxAppbar
        left={<>
          <TxLogo size={16}/>
          <span style={{ width: 1, height: 16, background: 'var(--border-firm)' }}></span>
          <TxBreadcrumb parts={['~/Documentos', 'tesis-redes-neuronales', 'Marco teórico']}/>
        </>}
        center={<>
          <button className="btn btn-sm"><IconCheckCircle size={12}/> Validar</button>
          <button className="btn btn-accent btn-sm"><IconPlay size={11}/> Compilar <span className="kbd" style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)' }}>⌘B</span></button>
          <button className="btn btn-sm"><IconDownload size={12}/> PDF</button>
        </>}
        right={<>
          <span className="chip chip-ok"><IconCheck size={9} sw={2.5}/> guardado · 14:32</span>
          <button className="btn btn-ghost btn-icon"><IconUser size={13}/></button>
        </>}
      />

      <div style={edStyles.shell}>
        {/* ─── Árbol de secciones ─── */}
        <aside style={edStyles.tree}>
          <div style={edStyles.treeHeader}>
            <span>Estructura</span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon" style={{ padding: 2 }}><IconSearch size={12}/></button>
              <button className="btn btn-ghost btn-icon" style={{ padding: 2 }}><IconPlus size={12}/></button>
            </span>
          </div>
          <div style={edStyles.treeBody} className="scroll">
            {TREE.map((n, i) => n.kind === 'group' ? (
              <div key={i} style={edStyles.treeGroup}>{n.label}</div>
            ) : (
              <div key={i} style={edStyles.treeRow(n.active, n.depth)}>
                {n.num && <span style={edStyles.treeNum}>{n.num}</span>}
                {n.icon || <span style={{ width: 12 }}></span>}
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.label}</span>
                {n.badge && <span style={edStyles.treeBadge}>{n.badge}</span>}
              </div>
            ))}
          </div>
          <div style={{
            padding: '10px 14px', borderTop: '1px solid var(--border-subtle)',
            fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius:'50%', background: 'var(--build-ok)' }}></span>
            142 páginas · 28,450 palabras
          </div>
        </aside>

        {/* ─── Editor de bloques ─── */}
        <main style={edStyles.center}>
          <div style={edStyles.toolbar}>
            <span style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm"><IconHeading size={12}/> H</button>
              <button className="btn btn-ghost btn-sm"><IconImage size={12}/> Figura</button>
              <button className="btn btn-ghost btn-sm"><IconTable size={12}/> Tabla</button>
              <button className="btn btn-ghost btn-sm"><IconQuote size={12}/> Cita</button>
              <button className="btn btn-ghost btn-sm"><IconSigma size={12}/> Ecuación</button>
              <button className="btn btn-ghost btn-sm"><IconList size={12}/> Lista</button>
              <span style={{ width: 1, height: 16, background: 'var(--border-soft)', margin: '0 4px' }}></span>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--build-warn)' }}><IconCode size={12}/> Raw LaTeX</button>
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)' }}>content/sections/theoretical_framework.yaml</span>
              <button className="btn btn-ghost btn-icon"><IconMore size={13}/></button>
            </span>
          </div>

          <div style={edStyles.paperWrap} className="scroll">
            <div style={edStyles.paper}>
              <div style={edStyles.chTag}>CAPÍTULO 02 · MAINMATTER</div>
              <h1 style={edStyles.chTitle}>Marco teórico</h1>

              <BlockChrome type="paragraph">
                <p style={edStyles.paragraph}>
                  Las redes neuronales convolucionales (CNN) han transformado el análisis de imágenes médicas en la última década, alcanzando precisiones que rivalizan con radiólogos expertos en tareas específicas como la detección de retinopatía diabética y la clasificación de lesiones dermatológicas.
                </p>
              </BlockChrome>

              <BlockChrome type="heading">
                <div style={edStyles.heading}>
                  <span style={edStyles.headingNum}>2.2</span>
                  <span>Bases conceptuales</span>
                </div>
              </BlockChrome>

              <BlockChrome type="paragraph">
                <p style={edStyles.paragraph}>
                  Considerando que el dataset CheXpert contiene más de 224,316 radiografías de tórax etiquetadas <span style={edStyles.citation}>[smith2023, p. 42]</span>, el entrenamiento desde cero requiere recursos computacionales considerables. La transferencia de aprendizaje a partir de modelos pre-entrenados en ImageNet resulta una alternativa viable.
                </p>
              </BlockChrome>

              <BlockChrome type="figure">
                <div style={edStyles.figureBlock}>
                  <div style={edStyles.figureThumb}>histograma.png</div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-deep)', fontWeight: 500 }}>fig:histograma-clases</div>
                    <div style={{ fontSize: 13, color: 'var(--fg-strong)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                      Distribución de clases en el conjunto CheXpert tras balanceo SMOTE.
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', gap: 6, fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                      <span>0.75× ancho</span> · <span>incluida en LOF</span>
                    </div>
                  </div>
                </div>
              </BlockChrome>

              <BlockChrome type="equation">
                <div style={edStyles.equation}>
                  <div>
                    <div style={{ color: 'var(--fg-faint)', fontSize: 10, marginBottom: 4 }}>{'$$ \\text{ec:cross-entropy} $$'}</div>
                    <div>{`L = -\\frac{1}{N}\\sum_{i=1}^{N}\\sum_{c=1}^{C} y_{i,c}\\log(\\hat{y}_{i,c})`}</div>
                  </div>
                  <span className="chip">numerada</span>
                </div>
              </BlockChrome>

              <BlockChrome type="paragraph">
                <p style={edStyles.paragraph}>
                  La función de pérdida de entropía cruzada categórica permite penalizar predicciones incorrectas de manera proporcional a su confianza, lo que resulta especialmente útil en problemas multiclase donde el objetivo es maximizar la probabilidad de la clase correcta.
                </p>
              </BlockChrome>

              <InsertBar/>
            </div>
          </div>
        </main>

        {/* ─── Preview PDF ─── */}
        <aside style={edStyles.preview}>
          <div style={edStyles.previewHeader}>
            <IconEye size={13} style={{ color: 'var(--fg-muted)' }}/>
            <span style={{ fontWeight: 500, color: 'var(--fg-strong)' }}>Vista previa</span>
            <span className="chip chip-ok"><IconCheck size={9} sw={2.5}/> sincronizado</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>p. 14</button>
              <button className="btn btn-ghost btn-icon" style={{ padding: 2 }}><IconRefresh size={12}/></button>
            </span>
          </div>
          <div style={edStyles.previewBody} className="scroll">
            <PDFPage n={13}>
              <div style={{ fontWeight: 600, fontSize: 9, marginBottom: 10 }}>2 · Marco teórico</div>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: '0 0 8px' }}>Las redes neuronales convolucionales (CNN) han transformado el análisis de imágenes médicas en la última década, alcanzando precisiones que rivalizan con radiólogos expertos en tareas específicas como la detección de retinopatía diabética y la clasificación de lesiones dermatológicas.</p>
              <div style={{ fontWeight: 600, fontSize: 8.5, margin: '12px 0 4px' }}>2.1  Antecedentes</div>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: '0 0 6px' }}>El primer trabajo seminal de LeCun et al. (1998) introdujo la arquitectura LeNet-5 para el reconocimiento de dígitos manuscritos…</p>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: 0 }}>Posteriormente, AlexNet (Krizhevsky et al., 2012) marcó un punto de inflexión al ganar la competencia ImageNet por un margen considerable…</p>
            </PDFPage>
            <PDFPage n={14}>
              <div style={{ fontWeight: 600, fontSize: 8.5, margin: '0 0 4px' }}>2.2  Bases conceptuales</div>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: '0 0 6px' }}>Considerando que el dataset CheXpert contiene más de 224,316 radiografías de tórax etiquetadas [Smith, 2023, p.42], el entrenamiento desde cero requiere recursos computacionales considerables.</p>
              <div style={{ margin: '8px auto', height: 32, background: '#f0f0f0', border: '1px solid #d0d0d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: '#888' }}>[Figura 2.1]</div>
              <div style={{ fontSize: 6, textAlign: 'center', fontStyle: 'italic', margin: '0 0 8px' }}>Figura 2.1: Distribución de clases en el conjunto CheXpert.</div>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: '0 0 6px' }}>La transferencia de aprendizaje a partir de modelos pre-entrenados en ImageNet resulta una alternativa viable.</p>
              <div style={{ textAlign: 'center', fontFamily: 'serif', fontStyle: 'italic', fontSize: 8, margin: '6px 0' }}>L = -1/N Σ Σ y log(ŷ)</div>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: 0 }}>La función de pérdida de entropía cruzada categórica permite penalizar predicciones incorrectas de manera proporcional…</p>
            </PDFPage>
            <PDFPage n={15}>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: '0 0 6px' }}>…lo que resulta especialmente útil en problemas multiclase donde el objetivo es maximizar la probabilidad de la clase correcta.</p>
              <div style={{ fontWeight: 600, fontSize: 8.5, margin: '12px 0 4px' }}>2.3  Estado del arte</div>
              <p style={{ textAlign: 'justify', textIndent: '1.5em', margin: 0 }}>En los últimos cinco años se han publicado más de 1,800 trabajos…</p>
            </PDFPage>
          </div>
        </aside>
      </div>

      <TxStatusbar items={[
        { text: 'main', dot: 'var(--build-ok)' },
        { icon: <IconBuild size={11}/>, text: 'latexmk · xelatex' },
        { text: 'biber 2.20' },
        { icon: <IconCheck size={10} sw={2.5}/>, text: 'compilado en 4.2s' },
        { right: true, text: 'cap 2.2 · línea 14 · bloque 6/9' },
      ]}/>
    </>
  );
}

Object.assign(window, { TxEditorScreen });
