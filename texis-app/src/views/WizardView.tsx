import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconCheck, IconChevronL, IconChevronR, IconFile, IconInfo,
} from "../components/Icons";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { ProfileInfo } from "../types";

type StepState = "done" | "active" | "todo";

const BUILTIN_PROFILES: ProfileInfo[] = [
  {
    id: "generic.thesis",
    name: "Tesis genérica",
    description: "Estructura clásica con marco teórico, metodología, resultados y conclusiones.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["tesis", "licenciatura", "maestria", "doctorado"],
  },
  {
    id: "generic.tesina",
    name: "Tesina",
    description: "Versión simplificada para licenciatura: introducción, desarrollo y cierre.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["tesina", "licenciatura"],
  },
];

const S = {
  shell: { flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" } as const,
  rail: {
    width: 280, flexShrink: 0,
    background: "var(--bg-chrome)", borderRight: "1px solid var(--border-subtle)",
    padding: "32px 24px", display: "flex", flexDirection: "column" as const, gap: 4,
  },
  main: {
    flex: 1, overflow: "auto", padding: "40px 56px 32px",
    display: "flex", flexDirection: "column" as const,
  },
  footer: {
    marginTop: "auto", paddingTop: 32,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    maxWidth: 820,
  } as const,
};

function WizStep({
  n, name, hint, state, last = false,
}: {
  n: number; name: string; hint: string; state: StepState; last?: boolean;
}) {
  return (
    <>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 8px",
        color: state === "done" ? "var(--fg-muted)" : state === "active" ? "var(--fg-strong)" : "var(--fg-faint)",
      }}>
        <div style={{
          width: 22, height: 22, flexShrink: 0, borderRadius: "50%",
          border: `1.5px solid ${state === "active" ? "var(--accent)" : "var(--border-firm)"}`,
          background: state === "done" ? "var(--accent)" : state === "active" ? "var(--accent-tint)" : "transparent",
          color: state === "done" ? "white" : state === "active" ? "var(--accent-deep)" : "var(--fg-faint)",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {state === "done" ? <IconCheck size={11} sw={3} /> : n}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingTop: 1 }}>
          <span style={{ fontSize: "var(--fs-base)", fontWeight: 500, lineHeight: 1.3 }}>{name}</span>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{hint}</span>
        </div>
      </div>
      {!last && (
        <div style={{
          width: 1, flex: 1, marginLeft: 22, marginTop: 4, marginBottom: 4,
          background: state === "done" ? "var(--accent)" : "var(--border-soft)", minHeight: 8,
        }} />
      )}
    </>
  );
}

// Paso 1: tipo de documento
function StepTipo({
  selected, onSelect,
}: {
  selected: string; onSelect: (v: string) => void;
}) {
  const options = [
    { id: "tesis", title: "Tesis", desc: "Investigación original para grado académico.", meta: "Licenciatura · Maestría · Doctorado" },
    { id: "tesina", title: "Tesina", desc: "Trabajo monográfico o ensayo académico.", meta: "Licenciatura" },
  ];
  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        ¿Qué tipo de <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>documento</em> es?
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 540 }}>
        Define la estructura base. Todo es configurable después.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, maxWidth: 820 }}>
        {options.map((o) => (
          <div
            key={o.id}
            onClick={() => onSelect(o.id)}
            style={{
              background: selected === o.id ? "var(--accent-tint)" : "var(--bg-panel)",
              border: `1px solid ${selected === o.id ? "var(--accent)" : "var(--border-soft)"}`,
              borderRadius: "var(--r-lg)", padding: 18, cursor: "pointer",
              boxShadow: selected === o.id ? "0 0 0 3px var(--accent-soft)" : "none",
              display: "flex", flexDirection: "column", gap: 8, minHeight: 130,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "var(--r-md)",
              background: selected === o.id ? "var(--accent)" : "var(--ink-100)",
              color: selected === o.id ? "white" : "var(--fg-default)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconBook size={16} />
            </div>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{o.title}</div>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{o.desc}</p>
            <div style={{ marginTop: "auto", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
              {o.meta}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Paso 2: datos de la institución y alumno
function StepDatos({
  form,
  onChange,
}: {
  form: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const field = (label: string, key: string, placeholder?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)" }}>{label}</label>
      <input
        style={{
          padding: "8px 12px", borderRadius: "var(--r-md)",
          border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
          fontSize: "var(--fs-base)", color: "var(--fg-strong)",
          outline: "none",
        }}
        value={form[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>¿Quién</em> y ¿dónde?
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 540 }}>
        Datos básicos. Se usan para la portada y los metadatos del PDF.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 820 }}>
        {field("Título del trabajo", "title", "Análisis de…")}
        {field("Tu nombre completo", "full_name", "María García López")}
        {field("Universidad / Institución", "institution", "UNAM")}
        {field("Facultad / Departamento", "faculty", "Facultad de Ingeniería")}
        {field("Asesor(a)", "advisor", "Dr. Juan Pérez")}
        {field("Ciudad", "city", "Ciudad de México")}
      </div>
    </>
  );
}

// Paso 3: selección de perfil
function StepPerfil({
  profiles, selected, onSelect,
}: {
  profiles: ProfileInfo[]; selected: string; onSelect: (id: string) => void;
}) {
  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        ¿Qué <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>perfil</em> usarás como base?
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 540 }}>
        Cada perfil define la clase LaTeX, paquetes y estructura de secciones.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, maxWidth: 820 }}>
        {profiles.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              background: selected === p.id ? "var(--accent-tint)" : "var(--bg-panel)",
              border: `1px solid ${selected === p.id ? "var(--accent)" : "var(--border-soft)"}`,
              borderRadius: "var(--r-lg)", padding: 18, cursor: "pointer",
              boxShadow: selected === p.id ? "0 0 0 3px var(--accent-soft)" : "none",
              display: "flex", flexDirection: "column", gap: 8, minHeight: 130,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "var(--r-md)",
                background: selected === p.id ? "var(--accent)" : "var(--ink-100)",
                color: selected === p.id ? "white" : "var(--fg-default)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconBook size={16} />
              </div>
              {selected === p.id && (
                <span className="chip chip-accent" style={{ marginTop: 4 }}>
                  <IconCheck size={9} sw={2.5} /> seleccionado
                </span>
              )}
            </div>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{p.name}</div>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{p.description}</p>
            <div style={{ marginTop: "auto", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
              {p.meta}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 20, padding: "14px 16px", borderRadius: "var(--r-md)",
        background: "var(--accent-tint)", border: "1px dashed var(--accent-soft)",
        fontSize: "var(--fs-sm)", color: "var(--accent-deep)",
        display: "flex", gap: 10, alignItems: "flex-start", maxWidth: 820,
      }}>
        <IconInfo size={14} />
        <div>
          <strong>¿Tu institución no aparece?</strong> Puedes importar un perfil comunitario
          o crear uno propio — disponible en Release 0.3.
        </div>
      </div>
    </>
  );
}

export default function WizardView() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [docType, setDocType] = useState("tesis");
  const [profileId, setProfileId] = useState("generic.thesis");
  const [form, setForm] = useState<Record<string, string>>({
    title: "", full_name: "", institution: "", faculty: "", advisor: "", city: "Ciudad de México",
  });
  const [creating, setCreating] = useState(false);
  const [profiles] = useState<ProfileInfo[]>(BUILTIN_PROFILES);

  const steps = [
    { name: "Tipo de documento", hint: docType ? docType : "Tesis · Tesina" },
    { name: "Datos del trabajo", hint: form.institution || "Institución, autor, asesor" },
    { name: "Perfil", hint: profiles.find((p) => p.id === profileId)?.name ?? "Estructura y normas" },
  ];

  async function handleCreate() {
    if (!form.title.trim()) {
      alert("Escribe un título para el proyecto.");
      return;
    }
    setCreating(true);
    try {
      const outputPath =
        navigator.platform.startsWith("Win")
          ? `C:\\Users\\${window.navigator.userAgent.includes("Win") ? "" : ""}Documents`
          : `${window.location.href.includes("tauri") ? "/home/user/Documents" : "/tmp"}`;

      const result = await api.createProject(form.title, profileId, outputPath);
      const model = await api.getProject(result.project_path);
      useProjectStore.getState().openProject(model, result.project_path);
      navigate(`/project/${encodeURIComponent(result.project_path)}`);
    } catch (e) {
      console.error("Error creando proyecto:", e);
      alert(`Error: ${e}`);
      setCreating(false);
    }
  }

  const stepStates = steps.map((_, i): StepState =>
    i < step ? "done" : i === step ? "active" : "todo"
  );

  return (
    <>
      <TxAppbar
        left={<TxLogo />}
        center={<span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
          Nuevo proyecto · paso {step + 1} de {steps.length}
        </span>}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
            Cancelar <span className="kbd">Esc</span>
          </button>
        }
      />

      <div style={S.shell}>
        <aside style={S.rail}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)", fontWeight: 500, color: "var(--fg-strong)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Crear proyecto
          </h2>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginBottom: 28 }}>
            Te guiamos en la configuración inicial. Todo es editable después.
          </p>
          {steps.map((s, i) => (
            <WizStep
              key={i}
              n={i + 1}
              name={s.name}
              hint={s.hint}
              state={stepStates[i]}
              last={i === steps.length - 1}
            />
          ))}
          <div style={{
            marginTop: 24, padding: 12, borderRadius: "var(--r-md)",
            background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
            fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5,
          }}>
            <strong style={{ color: "var(--fg-default)", fontSize: "var(--fs-sm)" }}>¿Por qué un perfil?</strong>
            <br />
            Define clase LaTeX, paquetes, estilo de bibliografía y secciones. Se puede cambiar después.
          </div>
        </aside>

        <main style={S.main} className="scroll">
          {step === 0 && (
            <StepTipo selected={docType} onSelect={setDocType} />
          )}
          {step === 1 && (
            <StepDatos form={form} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
          )}
          {step === 2 && (
            <StepPerfil profiles={profiles} selected={profileId} onSelect={setProfileId} />
          )}

          <div style={S.footer}>
            {step > 0 ? (
              <button className="btn" onClick={() => setStep((s) => s - 1)}>
                <IconChevronL size={13} /> Atrás
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
                {profileId} · v0.1
              </span>
              {step < steps.length - 1 ? (
                <button className="btn btn-accent" onClick={() => setStep((s) => s + 1)}>
                  Continuar <IconChevronR size={13} />
                </button>
              ) : (
                <button
                  className="btn btn-accent"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? "Creando…" : <>
                    <IconFile size={13} /> Crear proyecto
                  </>}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      <TxStatusbar items={[
        { text: "Wizard activo", dot: "var(--accent)" },
        { icon: <IconFile size={11} />, text: "tesis.project.yaml (sin guardar)" },
        { right: true, text: "Esc para cancelar · ↵ para continuar" },
      ]} />
    </>
  );
}
