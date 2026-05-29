import React, { useEffect, useState } from "react";
import { AiHelpButton } from "../AiHelpButton";
import { IconDownload } from "../Icons";
import { useVocabPacksStore } from "../../stores/vocabularyPacks";
import type { VocabPackKind } from "../../types";

export function VocabularyPacksPanel() {
  const {
    officialPacks, catalogLoading, catalogError,
    installed, installing,
    customRepos, repoLoading,
    loadOfficialCatalog, install, uninstall, isInstalled,
    addRepo, removeRepo, syncRepo,
  } = useVocabPacksStore();

  const [newRepoAlias, setNewRepoAlias] = useState("");
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [repoError, setRepoError] = useState<string | null>(null);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [langFilter, setLangFilter] = useState<"all" | "es" | "en">("all");
  const [kindFilter, setKindFilter] = useState<"all" | VocabPackKind>("all");

  useEffect(() => { loadOfficialCatalog(); }, [loadOfficialCatalog]);

  async function handleAddRepo() {
    if (!newRepoAlias.trim() || !newRepoUrl.trim()) return;
    setRepoError(null);
    try {
      await addRepo(newRepoAlias.trim(), newRepoUrl.trim());
      setNewRepoAlias("");
      setNewRepoUrl("");
      setShowAddRepo(false);
    } catch (e) {
      setRepoError(String(e));
    }
  }

  const allPacksRaw = [
    ...officialPacks,
    ...customRepos.flatMap((repo) => (repo.packs ?? []).map((pack) => ({ ...pack, _repoId: repo.id }))),
  ];
  const allPacks = allPacksRaw.filter((pack) => {
    const langOk = langFilter === "all" || (pack.base_language_hint ?? "").toLowerCase() === langFilter;
    const kindOk = kindFilter === "all" || (pack.pack_kind ?? "discipline") === kindFilter;
    return langOk && kindOk;
  });

  const kindOptions: Array<{ id: "all" | VocabPackKind; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "general", label: "General" },
    { id: "academic", label: "Académico" },
    { id: "discipline", label: "Área" },
    { id: "subject", label: "Materia" },
    { id: "program", label: "Programa" },
  ];

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--border-firm)",
    background: "var(--bg-panel)",
    fontSize: "var(--fs-sm)",
    color: "var(--fg-strong)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      marginTop: 16,
      background: "var(--bg-panel)",
      border: "1px solid var(--border-soft)",
      borderRadius: "var(--r-lg)",
      padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
            Vocabularios de dominio
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
            Activa varios a la vez — son independientes entre sí y del idioma base.
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => loadOfficialCatalog()} disabled={catalogLoading}>
          {catalogLoading ? "…" : "↻"}
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <AiHelpButton
          panel="settings_vocabulary"
          mode="app_help"
          label="¿Qué vocabularios debería activar?"
          question="Estoy en la sección de vocabularios de dominio. ¿Cómo elijo una combinación simple y útil para mi tesis si no sé qué instalar?"
          variant="inline"
        />
      </div>

      {catalogError && (
        <div style={{ color: "var(--build-err)", fontSize: "var(--fs-xs)", marginBottom: 10 }}>
          {catalogError}
        </div>
      )}

      {installed.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
            Vocabularios activos ({installed.length}):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {installed.map((pack) => (
              <span key={pack.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: "var(--r-xs)", background: "var(--accent-tint)", color: "var(--accent-deep)", fontSize: "var(--fs-xs)" }}>
                {pack.entry.name}
                <button onClick={() => uninstall(pack.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-deep)", fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 4 }}>
            {installed.reduce((n, pack) => n + (pack.terms?.length ?? 0), 0)} términos combinados
          </div>
        </div>
      )}

      {allPacksRaw.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {(["all", "es", "en"] as const).map((filter) => {
              const count = filter === "all" ? allPacksRaw.length : allPacksRaw.filter((pack) => (pack.base_language_hint ?? "") === filter).length;
              return (
                <button
                  key={filter}
                  onClick={() => setLangFilter(filter)}
                  className={`btn btn-sm ${langFilter === filter ? "btn-accent" : "btn-ghost"}`}
                  style={{ fontSize: 11, padding: "2px 10px" }}
                >
                  {filter === "all" ? `Todos (${count})` : filter === "es" ? `Español (${count})` : `English (${count})`}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {kindOptions.map((option) => {
              const count = option.id === "all"
                ? allPacksRaw.length
                : allPacksRaw.filter((pack) => (pack.pack_kind ?? "discipline") === option.id).length;
              return (
                <button
                  key={option.id}
                  onClick={() => setKindFilter(option.id)}
                  className={`btn btn-sm ${kindFilter === option.id ? "btn-accent" : "btn-ghost"}`}
                  style={{ fontSize: 11, padding: "2px 10px" }}
                >
                  {option.label} ({count})
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {allPacks.length === 0 && !catalogLoading && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0" }}>
            {allPacksRaw.length > 0 ? "Sin paquetes para esta combinación de filtros. Prueba otra." : "Sin paquetes disponibles. Recarga el catálogo."}
          </div>
        )}
        {allPacks.map((pack) => {
          const installedPack = isInstalled(pack.id);
          const installingPack = installing.has(pack.id);
          return (
            <div key={pack.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: `1px solid ${installedPack ? "var(--accent-soft)" : "var(--border-subtle)"}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{pack.name}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 1 }}>{pack.description}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                  <span className="chip" style={{ fontSize: 9 }}>{pack.status}</span>
                  {pack.base_language_hint && <span className="chip" style={{ fontSize: 9 }}>{pack.base_language_hint}</span>}
                  {pack.pack_kind && <span className="chip" style={{ fontSize: 9 }}>{pack.pack_kind}</span>}
                  {pack.discipline && <span className="chip" style={{ fontSize: 9 }}>{pack.discipline}</span>}
                  {pack.subject && <span className="chip" style={{ fontSize: 9 }}>{pack.subject}</span>}
                  {pack.program_name && <span className="chip" style={{ fontSize: 9 }}>{pack.program_name}</span>}
                  {pack.target_levels?.length ? <span className="chip" style={{ fontSize: 9 }}>{pack.target_levels.join(", ")}</span> : null}
                  <span className="chip" style={{ fontSize: 9 }}>v{pack.version}</span>
                </div>
              </div>
              {installedPack ? (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--build-err)" }} onClick={() => uninstall(pack.id)}>
                  Quitar
                </button>
              ) : (
                <button className="btn btn-sm btn-accent" style={{ fontSize: 11 }} disabled={installingPack} onClick={() => install(pack).catch(() => {})}>
                  {installingPack ? "…" : <><IconDownload size={11} /> Instalar</>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Repositorios externos ({customRepos.length})
          </div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setShowAddRepo(!showAddRepo)}>
            + Añadir repo
          </button>
        </div>

        {customRepos.map((repo) => (
          <div key={repo.id} style={{ marginBottom: 6, padding: "6px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-xs)", fontWeight: 500, color: "var(--fg-strong)" }}>{repo.id}</div>
              <div style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repo.url}</div>
              {repo.error && <div style={{ fontSize: 10, color: "var(--build-err)" }}>{repo.error}</div>}
              {!repo.error && <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>{(repo.packs ?? []).length} paquetes</div>}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => syncRepo(repo.id)} disabled={repoLoading}>↻</button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: "var(--build-err)" }} onClick={() => removeRepo(repo.id)}>×</button>
          </div>
        ))}

        {showAddRepo && (
          <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
              Apunta a cualquier <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>catalog.json</code> que tenga sección <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>vocabulary_packs</code>. Puede ser tu propio repo de GitHub.
            </div>
            <input value={newRepoAlias} onChange={(e) => setNewRepoAlias(e.target.value)} placeholder="Alias (ej: mi-lab-terminos)" style={inputStyle} />
            <input value={newRepoUrl} onChange={(e) => setNewRepoUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../catalog.json" style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            {repoError && <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)" }}>{repoError}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={handleAddRepo} disabled={repoLoading || !newRepoAlias.trim() || !newRepoUrl.trim()}>
                {repoLoading ? "Añadiendo…" : "Añadir repo"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRepo(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
