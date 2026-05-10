/* TeXisStudio — Compilar + errores y Sistema de diseño */

const cmpStyles = {
  shell: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0, background: 'var(--bg-app)' },
  panel: { display: 'flex', flexDirection: 'column', minHeight: 0 },
  panelHeader: {
    height: 38, padding: '0 16px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--bg-panel)',
    fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--fg-strong)',
  },
  errorList: { flex: 1, overflow: 'auto' },

  errCard: (sev) => ({
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    borderLeft: `3px solid ${
      sev === 'err' ? 'var(--build-err)' :
      sev === 'warn' ? 'var(--build-warn)' : 'var(--link)'
    }`,
    background: 'var(--bg-panel)',
    cursor: 'pointer',
  }),
  errHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  errCode: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)' },
  errTitle: { fontSize: 'var(--fs-md)', fontWeight: 500, color: 'var(--fg-strong)' },
  errMsg: { fontSize: 'var(--fs-sm)', color: 'var(--fg-default)', lineHeight: 1.55, marginBottom: 8 },
  errSugg: {
    background: 'var(--accent-tint)', color: 'var(--accent-deep)',
    padding: '8px 10px', borderRadius: 'var(--r-sm)', fontSize: 'var(--fs-sm)',
    display: 'flex', gap: 8, alignItems: 'flex-start',
  },
  errLoc: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 },

  log: {
    flex: 1, overflow: 'auto',
    fontFamily: 'var(--font-mono)', fontSize: 11,
    background: 'var(--ink-900)', color: '#C8C2B5',
    padding: '14px 18px', lineHeight: 1.65,
  },
  logLine: (kind) => ({
    color: kind === 'err' ? '#E89090' : kind === 'warn' ? '#E5C97A' : kind === 'ok' ? '#A8D49C' : kind === 'cmd' ? '#9DBEDC' : '#9C9685',
    whiteSpace: 'pre',
  }),
};

function ErrorCard({ sev, code, title, msg, sugg, loc }) {
  return (
    <div style={cmpStyles.errCard(sev)}>
      <div style={cmpStyles.errHeader}>
        {sev === 'err' && <IconErr size={13} style={{ color: 'var(--build-err)' }}/>}
        {sev === 'warn' && <IconWarn size={13} style={{ color: 'var(--build-warn)' }}/>}
        {sev === 'info' && <IconInfo size={13} style={{ color: 'var(--link)' }}/>}
        <span style={cmpStyles.errTitle}>{title}</span>
        <span style={{ marginLeft: 'auto', ...cmpStyles.errCode }}>{code}</span>
      </div>
      <div style={cmpStyles.errMsg}>{msg}</div>
      {sugg && (
        <div style={cmpStyles.errSugg}>
          <IconInfo size={12} style={{ flexShrink: 0, marginTop: 1 }}/>
          <span><strong>Sugerencia:</strong> {sugg}</span>
        </div>
      )}
      {loc && <div style={cmpStyles.errLoc}>{loc}</div>}
    </div>
  );
}

function TxCompileScreen() {
  return (
    <>
      <TxAppbar
        left={<>
          <TxLogo size={16}/>
          <span style={{ width: 1, height: 16, background: 'var(--border-firm)' }}></span>
          <TxBreadcrumb parts={['tesis-redes-neuronales', 'Compilar']}/>
        </>}
        center={<>
          <span className="chip chip-warn"><IconWarn size={10}/> 2 errores · 5 advertencias</span>
        </>}
        right={<>
          <button className="btn btn-sm"><IconRefresh size={12}/> Recompilar</button>
          <button className="btn btn-accent btn-sm"><IconDownload size={12}/> Abrir PDF</button>
        </>}
      />

      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-panel)', display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--build-err-tint)', color: 'var(--build-err)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconErr size={18}/>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--fg-strong)' }}>
              Compilación con errores
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              latexmk · xelatex · biber 2.20 · 8.4s
            </div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <span className="chip chip-err">2 errores</span>
          <span className="chip chip-warn">5 advertencias</span>
          <span className="chip">3 pasadas</span>
        </div>
      </div>

      <div style={cmpStyles.shell}>
        {/* ─── Errores traducidos ─── */}
        <div style={cmpStyles.panel}>
          <div style={cmpStyles.panelHeader}>
            <IconErr size={13} style={{ color: 'var(--build-err)' }}/>
            Problemas detectados
            <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)', fontWeight: 400 }}>traducidos al lenguaje humano</span>
          </div>
          <div style={cmpStyles.errorList} className="scroll">
            <ErrorCard sev="err" code="E_FIG_NOT_FOUND"
              title="Falta una imagen"
              msg="No se encontró la imagen referenciada en la figura 4.2 (histograma-resultados.png)."
              sugg="Coloca el archivo en content/figures/ o cambia la ruta del bloque Figura. La extensión debe coincidir exactamente."
              loc="capítulos/04_resultados.tex · línea 87"/>

            <ErrorCard sev="err" code="E_BIB_KEY"
              title="Cita sin referencia bibliográfica"
              msg="El bloque Cita usa la clave smith2023 pero no existe en references.bib."
              sugg="Abre el gestor de bibliografía y agrega la entrada, o cámbiala a una existente. Las claves son sensibles a mayúsculas."
              loc="capítulos/02_marco_teorico.tex · línea 142"/>

            <ErrorCard sev="warn" code="W_OVERFULL"
              title="Caja desbordada (1.2pt)"
              msg="Una línea de la sección 3.4 excede el ancho del párrafo en aproximadamente 1.2 puntos."
              sugg="Casi imperceptible. Suele resolverse al ajustar la palabra o agregar una división silábica con \\-."
              loc="capítulos/03_metodologia.tex · línea 56"/>

            <ErrorCard sev="warn" code="W_DUP_LABEL"
              title="Etiqueta duplicada"
              msg="La etiqueta tab:resultados aparece dos veces. La segunda referencia apuntará a la primera tabla."
              sugg="Renombra una de las dos a tab:resultados-2 o usa un nombre más específico."
              loc="capítulos/04_resultados.tex · línea 22 y 198"/>

            <ErrorCard sev="info" code="I_BIB_BUILT"
              title="Bibliografía construida"
              msg="Biber procesó 87 entradas. 1 tipo de cita usado: parenthetical."/>
          </div>
        </div>

        {/* ─── Log crudo ─── */}
        <div style={{ ...cmpStyles.panel, borderLeft: '1px solid var(--border-subtle)' }}>
          <div style={{ ...cmpStyles.panelHeader, background: 'var(--ink-800)', color: '#E0DBCF', borderBottomColor: 'var(--ink-700)' }}>
            <IconCode size={13}/>
            Log crudo
            <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: '#9C9685', fontWeight: 400, fontFamily: 'var(--font-mono)' }}>
              build/main.log · 1,247 líneas
            </span>
          </div>
          <div style={cmpStyles.log} className="scroll">
            <div style={cmpStyles.logLine('cmd')}>$ cd build && latexmk -xelatex -interaction=nonstopmode main.tex</div>
            <div style={cmpStyles.logLine()}>Latexmk: applying rule 'xelatex'...</div>
            <div style={cmpStyles.logLine()}>This is XeTeX, Version 3.141592653-2.6-0.999995 (TeX Live 2024)</div>
            <div style={cmpStyles.logLine()}>(./main.tex</div>
            <div style={cmpStyles.logLine()}>LaTeX2e {`<2024-06-01>`}</div>
            <div style={cmpStyles.logLine()}>(./configuracion/paquetes.tex)</div>
            <div style={cmpStyles.logLine()}>(./configuracion/estilo.tex)</div>
            <div style={cmpStyles.logLine()}>(./capitulos/01_introduccion.tex)</div>
            <div style={cmpStyles.logLine()}>(./capitulos/02_marco_teorico.tex</div>
            <div style={cmpStyles.logLine('warn')}>{`Package biblatex Warning: Citation 'smith2023' on page 14 undefined on input line 142.`}</div>
            <div style={cmpStyles.logLine()}>) [13] [14])</div>
            <div style={cmpStyles.logLine()}>(./capitulos/03_metodologia.tex</div>
            <div style={cmpStyles.logLine('warn')}>{`Overfull \\hbox (1.20007pt too wide) in paragraph at lines 56--58`}</div>
            <div style={cmpStyles.logLine()}>) [42] [43] [44]</div>
            <div style={cmpStyles.logLine()}>(./capitulos/04_resultados.tex</div>
            <div style={cmpStyles.logLine('err')}>{`! LaTeX Error: File \`figures/histograma-resultados.png' not found.`}</div>
            <div style={cmpStyles.logLine('err')}>l.87 \includegraphics[width=0.75\textwidth]{`{histograma-resultados}`}</div>
            <div style={cmpStyles.logLine('warn')}>{`LaTeX Warning: Label \`tab:resultados' multiply defined.`}</div>
            <div style={cmpStyles.logLine()}>) [85]</div>
            <div style={cmpStyles.logLine()}>(./capitulos/05_discusion.tex) [102] [103]</div>
            <div style={cmpStyles.logLine()}>(./capitulos/06_conclusiones.tex) [128]</div>
            <div style={cmpStyles.logLine('cmd')}>{`$ biber main`}</div>
            <div style={cmpStyles.logLine()}>{`INFO - This is Biber 2.20`}</div>
            <div style={cmpStyles.logLine('ok')}>{`INFO - Output to main.bbl (87 entries)`}</div>
            <div style={cmpStyles.logLine()}>{`Output written on main.pdf (142 pages, 4.2 MB).`}</div>
            <div style={cmpStyles.logLine('warn')}>{`Latexmk: Run terminated. PDF generated with errors.`}</div>
          </div>
        </div>
      </div>

      <TxStatusbar items={[
        { text: 'finalizado con errores', dot: 'var(--build-err)' },
        { icon: <IconClock size={11}/>, text: '8.4s' },
        { text: 'PDF parcial: 142 págs · 4.2 MB' },
        { right: true, text: 'build/pdf/main.pdf · ⌘O para abrir' },
      ]}/>
    </>
  );
}

/* ═══ Sistema de diseño visible ═══ */

const dsStyles = {
  root: { flex: 1, padding: '32px 40px', overflow: 'auto', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: 28 },
  h: { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 500, color: 'var(--fg-strong)', margin: 0, letterSpacing: '-0.015em' },
  hSub: { fontSize: 'var(--fs-md)', color: 'var(--fg-muted)', marginTop: 4, maxWidth: 600 },
  block: { background: 'var(--bg-panel)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: 20 },
  blockH: { fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-faint)', fontWeight: 600, margin: '0 0 16px' },
  swatchGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 },
  swatch: (c, dark) => ({
    background: c, height: 64, borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-subtle)',
    padding: 10, color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)',
    fontSize: 11, fontFamily: 'var(--font-mono)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  }),
  typeRow: { display: 'flex', alignItems: 'baseline', gap: 16, padding: '12px 0', borderBottom: '1px dashed var(--border-soft)' },
  typeLabel: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', minWidth: 140 },
};

function Swatch({ name, c, dark }) {
  return (
    <div style={dsStyles.swatch(c, dark)}>
      <span>{name}</span>
      <span style={{ opacity: 0.85 }}>{c}</span>
    </div>
  );
}

function TxDesignSystem() {
  return (
    <>
      <TxAppbar
        left={<><TxLogo size={16}/><span style={{ marginLeft: 8, color: 'var(--fg-muted)', fontSize: 'var(--fs-sm)' }}>· Sistema de diseño</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm">Exportar tokens.css</button>}
      />
      <div style={dsStyles.root} className="scroll">
        <div>
          <h2 style={dsStyles.h}>TeXisStudio · sistema de diseño</h2>
          <p style={dsStyles.hSub}>Híbrido: chrome técnico (productividad) sobre canvas de papel (edición). Sienna como acento, neutros cálidos, serif académico para contenido y sans geométrico para UI.</p>
        </div>

        <div style={dsStyles.block}>
          <div style={dsStyles.blockH}>Color · roles semánticos</div>
          <div style={dsStyles.swatchGrid}>
            <Swatch name="paper-100" c="#FBF8F3"/>
            <Swatch name="paper-300" c="#E9E2D4"/>
            <Swatch name="ink-50" c="#F5F3EE"/>
            <Swatch name="ink-200" c="#D9D4C8"/>
            <Swatch name="ink-500" c="#5C574B" dark/>
            <Swatch name="ink-800" c="#1B1916" dark/>
          </div>
          <div style={{ ...dsStyles.swatchGrid, marginTop: 10 }}>
            <Swatch name="accent · sienna" c="#B5532D" dark/>
            <Swatch name="accent-soft" c="#E9C9B7"/>
            <Swatch name="accent-tint" c="#FBEFE6"/>
            <Swatch name="build-ok" c="#4A7C5A" dark/>
            <Swatch name="build-warn" c="#B7903C" dark/>
            <Swatch name="build-err" c="#B33A3A" dark/>
          </div>
        </div>

        <div style={dsStyles.block}>
          <div style={dsStyles.blockH}>Tipografía</div>
          <div style={dsStyles.typeRow}>
            <div style={dsStyles.typeLabel}>Newsreader · 48 / 500</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--fg-strong)', lineHeight: 1.1 }}>
              Marco <span style={{ fontStyle: 'italic', color: 'var(--accent-deep)' }}>teórico</span>
            </div>
          </div>
          <div style={dsStyles.typeRow}>
            <div style={dsStyles.typeLabel}>Newsreader · 22 / 500</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--fg-strong)' }}>
              2.2 Bases conceptuales del aprendizaje profundo
            </div>
          </div>
          <div style={dsStyles.typeRow}>
            <div style={dsStyles.typeLabel}>Newsreader · 17 / 1.7</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.7, color: 'var(--fg-strong)', maxWidth: 520, textAlign: 'justify' }}>
              Las redes neuronales convolucionales han transformado el análisis de imágenes médicas durante la última década, alcanzando precisiones notables.
            </div>
          </div>
          <div style={dsStyles.typeRow}>
            <div style={dsStyles.typeLabel}>Geist · 13 / 500 (UI)</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--fg-strong)', fontWeight: 500 }}>
              Compilar · Validar · Exportar PDF · Gestionar bibliografía
            </div>
          </div>
          <div style={{ ...dsStyles.typeRow, borderBottom: 'none' }}>
            <div style={dsStyles.typeLabel}>JetBrains Mono · 11</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
              fig:histograma-clases · build/main.tex · L = -1/N Σ y log(ŷ)
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={dsStyles.block}>
            <div style={dsStyles.blockH}>Botones</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-accent"><IconPlay size={12}/> Compilar</button>
              <button className="btn btn-primary">Continuar</button>
              <button className="btn">Cancelar</button>
              <button className="btn btn-ghost">Ignorar</button>
              <button className="btn btn-sm">Pequeño</button>
              <button className="btn btn-icon"><IconSettings size={13}/></button>
            </div>
          </div>
          <div style={dsStyles.block}>
            <div style={dsStyles.blockH}>Chips de estado</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span className="chip">neutro</span>
              <span className="chip chip-accent"><IconStar size={9}/> seleccionado</span>
              <span className="chip chip-ok"><IconCheck size={9} sw={2.5}/> compilado</span>
              <span className="chip chip-warn"><IconWarn size={9}/> 5 avisos</span>
              <span className="chip chip-err"><IconErr size={9}/> 2 errores</span>
            </div>
          </div>
        </div>

        <div style={dsStyles.block}>
          <div style={dsStyles.blockH}>Bloques de contenido (`ContentBlock`)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {Object.entries(TYPE_CHIPS).map(([k, v]) => (
              <div key={k} style={{
                padding: 12, borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-soft)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', borderRadius: 4,
                  fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  width: 'fit-content',
                  background: v.warn ? 'var(--build-warn-tint)' : 'var(--bg-app)',
                  color: v.warn ? 'var(--build-warn)' : 'var(--fg-muted)',
                  border: '1px solid var(--border-subtle)',
                }}>{v.i} {v.t}{v.warn && ' ⚠'}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { TxCompileScreen, TxDesignSystem });
