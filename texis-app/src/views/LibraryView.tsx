import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconCheck, IconDownload, IconFile, IconPlus, IconSearch, IconUpload,
} from "../components/Icons";
import { api } from "../lib/tauri";
import type { ProfileInfo } from "../types";

// Perfiles builtin siempre disponibles
const BUILTIN_PROFILES: ProfileInfo[] = [
  {
    id: "generic.thesis",
    name: "Tesis genérica",
    description: "Estructura clásica: marco teórico, metodología, resultados y conclusiones. Clase book, XeLaTeX, biber, APA 7.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["tesis", "licenciatura", "maestría", "doctorado"],
  },
  {
    id: "generic.tesina",
    name: "Tesina",
    description: "Versión simplificada para licenciatura: introducción, desarrollo y cierre.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["tesina", "licenciatura"],
  },
];

// Perfiles planeados para Release 0.3+
const COMING_SOON: Array<{ id: string; name: string; description: string; meta: string; tags: string[] }> = [
  {
    id: "apa.basic",
    name: "APA básico",
    description: "Perfil simplificado con estilo APA estricto para journals y reportes.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["apa", "journal"],
  },
  {
    id: "vancouver.health",
    name: "Ciencias de la salud",
    description: "Estructura IMRyD para investigación clínica con bibliografía Vancouver.",
    meta: "XeLaTeX · biber · Vancouver",
    tags: ["salud", "imryd", "vancouver"],
  },
  {
    id: "engineering.basic",
    name: "Ingeniería",
    description: "Reporte técnico con secciones de diseño, implementación y pruebas.",
    meta: "XeLaTeX · biber · IEEE",
    tags: ["ingeniería", "ieee", "técnico"],
  },
  {
    id: "company.internship",
    name: "Reporte de prácticas",
    description: "Formato empresarial para reportes de residencia profesional.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["prácticas", "residencia", "empresa"],
  },
];

function ProfileCard({
  profile, installed, onUse,
}: {
  profile: ProfileInfo | typeof COMING_SOON[0];
  installed: boolean;
  onUse?: () => void;
}) {
  return (
    <div style={{
      background: "var(--bg-panel)", border: `1px solid ${installed ? "var(--border-soft)" : "var(--border-subtle)"}`,
      borderRadius: "var(--r-lg)", padding: 20,
      display: "flex", flexDirection: "column", gap: 12,
      opacity: installed ? 1 : 0.6,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "var(--r-md)",
            background: installed ? "var(--accent)" : "var(--ink-100)",
            color: installed ? "white" : "var(--fg-muted)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <IconBook size={16} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 500, color: "var(--fg-strong)" }}>
              {profile.name}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
              {profile.id}
            </div>
          </div>
        </div>
        {installed ? (
          <span className="chip chip-ok" style={{ flexShrink: 0 }}>
            <IconCheck size={9} sw={2.5} /> instalado
          </span>
        ) : (
          <span className="chip" style={{ flexShrink: 0, fontSize: 10 }}>próximamente</span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.55 }}>
        {profile.description}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {profile.tags.map((t) => (
          <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>{profile.meta}</span>
        {installed && onUse && (
          <button className="btn btn-sm" onClick={onUse}>
            Usar en proyecto nuevo
          </button>
        )}
      </div>
    </div>
  );
}

export default function LibraryView() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileInfo[]>(BUILTIN_PROFILES);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"profiles" | "elements">("profiles");

  useEffect(() => {
    api.getProfiles().then(setProfiles).catch(() => setProfiles(BUILTIN_PROFILES));
  }, []);

  const filtered = profiles.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tags.some((t) => t.includes(search.toLowerCase()))
  );

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ Biblioteca</span></>}
        center={null}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
            ← Inicio
          </button>
        }
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" }}>
        {/* Sidebar */}
        <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { id: "profiles", label: "Perfiles", icon: <IconBook size={13} /> },
            { id: "elements", label: "Elementos", icon: <IconFile size={13} /> },
          ].map(({ id, label, icon }) => (
            <div
              key={id}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                borderRadius: "var(--r-md)", cursor: "pointer", fontSize: "var(--fs-base)",
                background: tab === id ? "var(--bg-selected)" : "transparent",
                color: tab === id ? "var(--accent-deep)" : "var(--fg-default)",
                fontWeight: tab === id ? 500 : 400,
              }}
              onClick={() => setTab(id as "profiles" | "elements")}
            >
              {icon} {label}
            </div>
          ))}

          <div style={{ height: 1, background: "var(--border-subtle)", margin: "12px 4px" }} />

          <div style={{ padding: "8px 10px", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 4 }}>Release 0.3</div>
            Importar perfiles de la comunidad, crear perfiles personalizados y exportar.
          </div>
        </div>

        {/* Main */}
        <main style={{ flex: 1, overflow: "auto", padding: "32px 40px" }} className="scroll">
          {tab === "profiles" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
                    Perfiles
                  </h1>
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
                    {filtered.length} instalados · {COMING_SOON.length} próximamente
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" title="Importar perfil (.texisprofile)" style={{ opacity: 0.5 }}>
                    <IconUpload size={13} /> Importar
                  </button>
                  <button className="btn btn-accent btn-sm" onClick={() => navigate("/new")}>
                    <IconPlus size={13} /> Nuevo proyecto
                  </button>
                </div>
              </div>

              {/* Buscador */}
              <div style={{ position: "relative", maxWidth: 400, marginBottom: 24 }}>
                <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar perfiles…"
                  style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none" }}
                />
              </div>

              {/* Instalados */}
              <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 12 }}>
                Instalados
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, marginBottom: 32 }}>
                {filtered.map((p) => (
                  <ProfileCard key={p.id} profile={p} installed onUse={() => navigate("/new")} />
                ))}
              </div>

              {/* Próximamente */}
              {!search && (
                <>
                  <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    Próximamente
                    <span style={{ fontSize: 9, background: "var(--bg-app)", border: "1px solid var(--border-firm)", borderRadius: 3, padding: "1px 5px", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>Release 0.3</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                    {COMING_SOON.map((p) => (
                      <ProfileCard key={p.id} profile={p as ProfileInfo} installed={false} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === "elements" && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--fg-faint)" }}>
              <IconFile size={32} style={{ opacity: 0.3, marginBottom: 16 }} />
              <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)", margin: 0 }}>Elementos</p>
              <p style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>Disponible en Release 0.3</p>
              <p style={{ fontSize: "var(--fs-xs)", marginTop: 4, maxWidth: 400, margin: "8px auto 0", lineHeight: 1.6 }}>
                Los elementos son bloques reutilizables que definen plantillas LaTeX: portadas, resúmenes, secciones especiales.
              </p>
            </div>
          )}
        </main>
      </div>

      <TxStatusbar items={[
        { text: `${profiles.length} perfiles instalados` },
        { icon: <IconDownload size={11} />, text: "Importar perfil comunitario — Release 0.3" },
        { right: true, text: "TeXisStudio 0.2.0" },
      ]} />
    </>
  );
}
