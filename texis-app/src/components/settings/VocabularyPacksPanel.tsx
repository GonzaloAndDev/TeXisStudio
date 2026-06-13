import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiHelpButton } from "../AiHelpButton";
import { IconDownload } from "../Icons";
import { useVocabPacksStore } from "../../stores/vocabularyPacks";
import type { VocabPackKind } from "../../types";

export function VocabularyPacksPanel() {
  const { t } = useTranslation();
  const {
    officialPacks, catalogLoading, catalogError,
    installed, installing,
    customRepos, repoLoading,
    loadOfficialCatalog, install, uninstall, isInstalled,
    addRepo, removeRepo, syncRepo,
  } = useVocabPacksStore();

  const [newRepoAlias, setNewRepoAlias] = useState("");
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [repoError, setRepoError] = useState(false);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [langFilter, setLangFilter] = useState<"all" | "es" | "en">("all");
  const [kindFilter] = useState<"all" | VocabPackKind>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");

  useEffect(() => { loadOfficialCatalog(); }, [loadOfficialCatalog]);

  async function handleAddRepo() {
    if (!newRepoAlias.trim() || !newRepoUrl.trim()) return;
    setRepoError(false);
    try {
      await addRepo(newRepoAlias.trim(), newRepoUrl.trim());
      setNewRepoAlias("");
      setNewRepoUrl("");
      setShowAddRepo(false);
    } catch {
      setRepoError(true);
    }
  }

  const allPacksRaw = [
    ...officialPacks,
    ...customRepos.flatMap((repo) => (repo.packs ?? []).map((pack) => ({ ...pack, _repoId: repo.id }))),
  ];

  // Collect available disciplines from packs (deduplicated)
  const availableDisciplines = Array.from(
    new Set(allPacksRaw.map((p) => p.discipline).filter(Boolean))
  ).sort() as string[];

  const allPacks = allPacksRaw.filter((pack) => {
    const langOk = langFilter === "all" || (pack.base_language_hint ?? "").toLowerCase() === langFilter;
    const kindOk = kindFilter === "all" || (pack.pack_kind ?? "discipline") === kindFilter;
    const discOk = disciplineFilter === "all" || (pack.discipline ?? "").toLowerCase() === disciplineFilter.toLowerCase();
    return langOk && kindOk && discOk;
  });

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
            {t("vocabulary.title")}
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
            {t("vocabulary.subtitle")}
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
          label={t("vocabulary.help_label")}
          question={t("vocabulary.help_question")}
          variant="inline"
        />
      </div>

      {catalogError && (
        <div style={{ color: "var(--build-err)", fontSize: "var(--fs-xs)", marginBottom: 10 }}>
          {t("vocabulary.catalog_error")}
        </div>
      )}

      {installed.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
            {t("vocabulary.active_count", { count: installed.length })}
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
            {t("vocabulary.combined_terms", { count: installed.reduce((n, pack) => n + (pack.terms?.length ?? 0), 0) })}
          </div>
        </div>
      )}

      {allPacksRaw.length > 0 && (
        <>
          {/* Discipline filter — most important for students */}
          {availableDisciplines.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("vocabulary.filter_by_area")}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button
                  onClick={() => setDisciplineFilter("all")}
                  className={`btn btn-sm ${disciplineFilter === "all" ? "btn-accent" : "btn-ghost"}`}
                  style={{ fontSize: 11, padding: "2px 10px" }}
                >
                  {t("vocabulary.all_areas")}
                </button>
                {availableDisciplines.map((disc) => (
                  <button
                    key={disc}
                    onClick={() => setDisciplineFilter(disciplineFilter === disc ? "all" : disc)}
                    className={`btn btn-sm ${disciplineFilter === disc ? "btn-accent" : "btn-ghost"}`}
                    style={{ fontSize: 11, padding: "2px 10px", textTransform: "capitalize" }}
                  >
                    {disc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Language filter */}
          <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
            {(["all", "es", "en"] as const).map((filter) => {
              const base = disciplineFilter === "all" ? allPacksRaw : allPacksRaw.filter((p) => (p.discipline ?? "").toLowerCase() === disciplineFilter.toLowerCase());
              const count = filter === "all" ? base.length : base.filter((pack) => (pack.base_language_hint ?? "") === filter).length;
              return (
                <button
                  key={filter}
                  onClick={() => setLangFilter(filter)}
                  className={`btn btn-sm ${langFilter === filter ? "btn-accent" : "btn-ghost"}`}
                  style={{ fontSize: 11, padding: "2px 10px" }}
                >
                  {filter === "all" ? t("vocabulary.filter_all", { count }) : filter === "es" ? t("vocabulary.filter_spanish", { count }) : t("vocabulary.filter_english", { count })}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {allPacks.length === 0 && !catalogLoading && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0" }}>
            {allPacksRaw.length > 0 ? t("vocabulary.no_filtered_packs") : t("vocabulary.no_packs")}
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
                  {t("vocabulary.remove")}
                </button>
              ) : (
                <button className="btn btn-sm btn-accent" style={{ fontSize: 11 }} disabled={installingPack} onClick={() => install(pack).catch(() => {})}>
                  {installingPack ? "…" : <><IconDownload size={11} /> {t("vocabulary.install")}</>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {t("vocabulary.external_repos", { count: customRepos.length })}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setShowAddRepo(!showAddRepo)}>
            + {t("vocabulary.add_repo")}
          </button>
        </div>

        {customRepos.map((repo) => (
          <div key={repo.id} style={{ marginBottom: 6, padding: "6px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-xs)", fontWeight: 500, color: "var(--fg-strong)" }}>{repo.id}</div>
              <div style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repo.url}</div>
              {repo.error && <div style={{ fontSize: 10, color: "var(--build-err)" }}>{t("vocabulary.repo_sync_error")}</div>}
              {!repo.error && <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("vocabulary.packs_count", { count: (repo.packs ?? []).length })}</div>}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => syncRepo(repo.id)} disabled={repoLoading}>↻</button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: "var(--build-err)" }} onClick={() => removeRepo(repo.id)}>×</button>
          </div>
        ))}

        {showAddRepo && (
          <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
              {t("vocabulary.repo_hint_prefix")} <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>catalog.json</code> {t("vocabulary.repo_hint_middle")} <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>vocabulary_packs</code>. {t("vocabulary.repo_hint_suffix")}
            </div>
            <input value={newRepoAlias} onChange={(e) => setNewRepoAlias(e.target.value)} placeholder={t("vocabulary.alias_placeholder")} style={inputStyle} />
            <input value={newRepoUrl} onChange={(e) => setNewRepoUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../catalog.json" style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            {repoError && <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)" }}>{t("vocabulary.repo_add_error")}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={handleAddRepo} disabled={repoLoading || !newRepoAlias.trim() || !newRepoUrl.trim()}>
                {repoLoading ? t("vocabulary.adding") : t("vocabulary.add_repo")}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRepo(false)}>{t("common.cancel")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
