/* TeXisStudio — App principal: design canvas con todas las pantallas */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#B5532D"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.dataset.theme = t.theme;
    document.documentElement.style.setProperty('--accent', t.accent);
    // Derivar tonos del acento elegido
    const tints = {
      "#B5532D": { soft: "#E9C9B7", tint: "#FBEFE6", deep: "#8A3E20" },
      "#2D5F8A": { soft: "#B7CFE2", tint: "#E6EFF8", deep: "#1F4564" },
      "#4A7C5A": { soft: "#BFD6C5", tint: "#E8F1EA", deep: "#345C42" },
      "#7C4A6F": { soft: "#D6BFCE", tint: "#F1E8EE", deep: "#5C3452" },
    }[t.accent] || { soft: "#E9C9B7", tint: "#FBEFE6", deep: "#8A3E20" };
    document.documentElement.style.setProperty('--accent-soft', tints.soft);
    document.documentElement.style.setProperty('--accent-tint', tints.tint);
    document.documentElement.style.setProperty('--accent-deep', tints.deep);
  }, [t.theme, t.accent]);

  return (
    <>
      <DesignCanvas
        title="TeXisStudio · Diseño base"
        subtitle="Editor profesional de tesis con LaTeX. Híbrido chrome técnico + canvas de papel. Acento sienna, neutros cálidos, serif académico para contenido.">

        <DCSection id="overview" title="Sistema · vista de proyecto">
          <DCArtboard id="home" label="Inicio · proyectos recientes" width={1280} height={820}>
            <TxWindow title="TeXisStudio"><TxHomeScreen/></TxWindow>
          </DCArtboard>
          <DCArtboard id="editor" label="Editor principal · árbol + bloques + preview" width={1480} height={900}>
            <TxWindow title="tesis-redes-neuronales — TeXisStudio"><TxEditorScreen/></TxWindow>
          </DCArtboard>
        </DCSection>

        <DCSection id="flow" title="Flujos críticos">
          <DCArtboard id="wizard" label="Wizard · paso 3 (selección de perfil)" width={1280} height={820}>
            <TxWindow title="Nuevo proyecto — TeXisStudio"><TxWizardScreen/></TxWindow>
          </DCArtboard>
          <DCArtboard id="compile" label="Compilar · errores traducidos + log crudo" width={1280} height={820}>
            <TxWindow title="tesis-redes-neuronales — Compilar"><TxCompileScreen/></TxWindow>
          </DCArtboard>
        </DCSection>

        <DCSection id="system" title="Sistema de diseño">
          <DCArtboard id="ds" label="Tokens, tipografía y componentes" width={1100} height={1100}>
            <TxWindow title="Sistema de diseño — TeXisStudio"><TxDesignSystem/></TxWindow>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks · TeXisStudio">
        <TweakSection title="Apariencia">
          <TweakRadio label="Tema" value={t.theme} onChange={v => setTweak('theme', v)}
            options={[{value:'light', label:'Claro'}, {value:'dark', label:'Oscuro'}]}/>
          <TweakColor label="Color de acento" value={t.accent} onChange={v => setTweak('accent', v)}
            options={['#B5532D', '#2D5F8A', '#4A7C5A', '#7C4A6F']}/>
        </TweakSection>
        <TweakSection title="Notas">
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            El acento se deriva en 3 tonos (soft / tint / deep). Las pantallas comparten el mismo sistema de tokens en <code style={{ fontFamily: 'var(--font-mono)' }}>src/tokens.css</code>.
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
