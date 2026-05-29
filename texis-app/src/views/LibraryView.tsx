import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { IconFolder, IconGlobe, IconGrid, IconLayers, IconPlus, IconSearch, IconTrash, IconUpload } from "../components/Icons";
import { api } from "../lib/tauri";
import { useSettingsStore } from "../stores/settings";
import type { ProfileInfo } from "../types";
import { BLOCK_CATALOG } from "./library/constants";
import { ProfileCard } from "./library/ProfileCard";
import { ProfileDetailPanel } from "./library/ProfileDetailPanel";
import { ProfileEditorPanel } from "./library/ProfileEditorPanel";
import { ElementsTab } from "./library/ElementsTab";
import { StylesTab } from "./library/StylesTab";
import { CommunityTab } from "./library/CommunityTab";

type LibTab = "profiles" | "community" | "styles" | "elements";

export default function LibraryView() {
  const navigate = useNavigate();
  const userMode = useSettingsStore((s) => s.userMode);
  const [profiles, setProfiles]     = useState<ProfileInfo[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [tab, setTab]               = useState<LibTab>("profiles");
  const [selected, setSelected]     = useState<ProfileInfo | null>(null);
  const [editing, setEditing]       = useState(false);
  const [importing, setImporting]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProfileInfo | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    api.getProfiles()
      .then((p) => { setProfiles(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = profiles.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tags.some((t) => t.includes(search.toLowerCase()))
  );

  async function handleImport() {
    setImporting(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ directory: true, multiple: false, title: "Selecciona el directorio del perfil" });
      const src = Array.isArray(result) ? result[0] : result;
      if (!src) { setImporting(false); return; }
      const imported = await api.importProfile(src);
      setProfiles((prev) => [...prev, imported]);
      setSelected(imported);
      showToast(`Perfil '${imported.name}' importado correctamente.`);
    } catch (e) { showToast(`Error al importar: ${e}`, false); }
    finally { setImporting(false); }
  }

  async function handleExport(profile: ProfileInfo) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dest = await open({ directory: true, multiple: false, title: "Selecciona la carpeta de destino" });
      const destPath = Array.isArray(dest) ? dest[0] : dest;
      if (!destPath) return;
      const result = await api.exportProfile(profile.id, destPath);
      showToast(`Perfil exportado en: ${result.exported_to}`);
    } catch (e) { showToast(`Error al exportar: ${e}`, false); }
  }

  async function handleDelete(profile: ProfileInfo) {
    setConfirmDelete(null);
    try {
      await api.deleteProfile(profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      if (selected?.id === profile.id) setSelected(null);
    } catch (e) { showToast(`Error al eliminar: ${e}`, false); }
  }

  function handleSaveEdit(updated: ProfileInfo) {
    setProfiles((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelected(updated); setEditing(false);
  }

  function handleUseProfile(profile: ProfileInfo) {
    navigate(`/new?profile=${encodeURIComponent(profile.id)}`);
  }

  const TABS: { id: LibTab; label: string; icon: React.ReactNode }[] = [
    { id: "profiles",  label: "Perfiles",  icon: <IconFolder size={13} /> },
    { id: "community", label: "Comunidad", icon: <IconGlobe size={13} /> },
    { id: "styles",    label: "Estilos",   icon: <IconLayers size={13} /> },
    { id: "elements",  label: "Elementos", icon: <IconGrid size={13} /> },
  ];

  return (
    <>
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          padding: "10px 18px", borderRadius: "var(--r-lg)",
          background: toast.ok ? "var(--build-ok)" : "var(--build-err)",
          color: "#fff", fontSize: "var(--fs-sm)", boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          pointerEvents: "none",
        }}>
          {toast.ok ? "✓ " : "✗ "}{toast.msg}
        </div>
      )}
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ Biblioteca</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>← Inicio</button>}
      />

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-chrome)", borderRadius: "var(--r-lg)", padding: 24, maxWidth: 380, width: "90%", border: "1px solid var(--border-firm)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-strong)" }}>¿Eliminar perfil?</div>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
              Se eliminará <strong>{confirmDelete.name}</strong> ({confirmDelete.id}). Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn" style={{ background: "var(--build-err)", color: "white", border: "none" }} onClick={() => handleDelete(confirmDelete)}><IconTrash size={13} /> Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", padding: "20px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(({ id, label, icon }) => (
            <div key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-md)", cursor: "pointer", fontSize: "var(--fs-base)", background: tab === id ? "var(--bg-selected)" : "transparent", color: tab === id ? "var(--accent-deep)" : "var(--fg-default)", fontWeight: tab === id ? 500 : 400 }}>
              {icon} {label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ padding: "10px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 3 }}>Release 1.0</div>
            {profiles.length} perfiles · {BLOCK_CATALOG.length} elementos
          </div>
        </div>

        {/* Profiles tab */}
        {tab === "profiles" && (
          <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }} className="scroll">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>Perfiles instalados</h1>
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>{loading ? "Cargando…" : `${profiles.length} perfiles · haz clic para ver detalle`}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm" onClick={handleImport} disabled={importing} title="Importar perfil desde directorio"><IconUpload size={13} /> {importing ? "Importando…" : "Importar"}</button>
                  <button className="btn btn-sm" onClick={() => navigate("/new-profile")} title="Crear un perfil propio"><IconPlus size={13} /> Crear perfil</button>
                  <button className="btn btn-accent btn-sm" onClick={() => navigate("/new")}><IconPlus size={13} /> Nuevo proyecto</button>
                </div>
              </div>
              <div style={{
                maxWidth: 920, marginBottom: 20, padding: "14px 16px",
                borderRadius: "var(--r-lg)", background: "var(--accent-tint)",
                border: "1px solid var(--accent-soft)",
              }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 6 }}>
                  Cómo elegir un perfil sin complicarte
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                  Primero busca tu institución o una parecida. Luego revisa si el perfil cubre tu grado, tu área y el estilo de citas que necesitas.
                  Si no encuentras una coincidencia exacta, empieza con un perfil genérico o con la variante más cercana y ajusta después.
                </div>
              </div>
              <div style={{ position: "relative", maxWidth: 380, marginBottom: 24 }}>
                <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o etiqueta…" style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none" }} />
              </div>
              {loading ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0" }}>Cargando perfiles…</div>
              ) : filtered.length === 0 ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>No se encontraron perfiles para «{search}»</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                  {filtered.map((p) => (
                    <ProfileCard key={p.id} profile={p} selected={selected?.id === p.id} onClick={() => { if (editing && selected?.id === p.id) return; setEditing(false); setSelected(selected?.id === p.id ? null : p); }} />
                  ))}
                </div>
              )}
            </div>
            {selected && !editing && <ProfileDetailPanel profile={selected} onClose={() => setSelected(null)} onEdit={() => setEditing(true)} onUse={() => handleUseProfile(selected)} onExport={() => handleExport(selected)} onDelete={() => setConfirmDelete(selected)} />}
            {selected && editing && <ProfileEditorPanel profile={selected} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />}
          </div>
        )}

        {tab === "community" && (
          <CommunityTab
            installedIds={new Set(profiles.map((p) => p.id))}
            onInstalled={(p) => { setProfiles((prev) => { const exists = prev.some((x) => x.id === p.id); return exists ? prev : [...prev, p]; }); }}
            userMode={userMode}
          />
        )}

        {tab === "styles" && <StylesTab />}

        {tab === "elements" && <ElementsTab />}
      </div>

      <TxStatusbar items={[
        { text: `${profiles.length} perfiles instalados` },
        { icon: <IconUpload size={11} />, text: "Importar" },
        { right: true, text: "TeXisStudio 1.0.0" },
      ]} />
    </>
  );
}
