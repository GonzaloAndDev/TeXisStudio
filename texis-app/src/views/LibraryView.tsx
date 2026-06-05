import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { IconCode, IconFolder, IconGlobe, IconGrid, IconLayers, IconPlus, IconSearch, IconTrash, IconUpload } from "../components/Icons";
import { api } from "../lib/tauri";
import { ensureProfileLocale, localizeProfile, localizeProfiles } from "../services/profile-i18n";
import { useSettingsStore } from "../stores/settings";
import type { ProfileInfo } from "../types";
import { BLOCK_CATALOG } from "./library/constants";
import { ProfileCard } from "./library/ProfileCard";
import { ProfileDetailPanel } from "./library/ProfileDetailPanel";
import { ProfileEditorPanel } from "./library/ProfileEditorPanel";
import { ElementsTab } from "./library/ElementsTab";
import { StylesTab } from "./library/StylesTab";
import { CommunityTab } from "./library/CommunityTab";
import { PluginsTab } from "./library/PluginsTab";

type LibTab = "profiles" | "community" | "styles" | "elements" | "plugins";

const COUNTRY_KEYS: Record<string, string> = {
  mx: "library.country_mx", us: "library.country_us", uk: "library.country_uk", ca: "library.country_ca",
  es: "library.country_es", de: "library.country_de", fr: "library.country_fr", jp: "library.country_jp",
  br: "library.country_br", ar: "library.country_ar", co: "library.country_co", cl: "library.country_cl",
  generic: "library.country_generic",
};

const DEGREE_TAGS = ["licenciatura", "maestria", "doctorado", "especialidad", "posdoctorado"];
const DEGREE_LABELS: Record<string, string> = {
  licenciatura: "home.level_licenciatura", maestria: "home.level_maestria", doctorado: "home.level_doctorado",
  especialidad: "home.level_especialidad", posdoctorado: "home.level_posdoctorado",
};

function profileCountry(id: string): string {
  const match = id.match(/^([a-z]{2})_/);
  return match ? match[1] : "generic";
}

function profileDegrees(tags: string[]): string[] {
  return tags.filter((t) => DEGREE_TAGS.includes(t));
}

export default function LibraryView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const userMode = useSettingsStore((s) => s.userMode);
  const [profiles, setProfiles]     = useState<ProfileInfo[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterDegree, setFilterDegree]   = useState<string>("all");
  const [tab, setTab]               = useState<LibTab>("profiles");
  const [selected, setSelected]     = useState<ProfileInfo | null>(null);
  const [editing, setEditing]       = useState(false);
  const [importing, setImporting]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProfileInfo | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [profileLocaleTick, setProfileLocaleTick] = useState(0);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    api.getProfiles()
      .then((p) => { setProfiles(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureProfileLocale(i18n.language).then(() => {
      if (!cancelled) setProfileLocaleTick((tick) => tick + 1);
    });
    return () => { cancelled = true; };
  }, [i18n.language]);

  const localizedProfiles = useMemo(
    () => localizeProfiles(profiles, i18n.language),
    [profiles, i18n.language, profileLocaleTick],
  );
  const localizedSelected = useMemo(
    () => selected ? localizeProfile(selected, i18n.language) : null,
    [selected, i18n.language, profileLocaleTick],
  );

  const availableCountries = useMemo(
    () => [...new Set(localizedProfiles.map((p) => profileCountry(p.id)))].sort(),
    [localizedProfiles]
  );
  const availableDegrees = useMemo(
    () => [...new Set(localizedProfiles.flatMap((p) => profileDegrees(p.tags)))].sort(
      (a, b) => DEGREE_TAGS.indexOf(a) - DEGREE_TAGS.indexOf(b)
    ),
    [localizedProfiles]
  );

  const filtered = localizedProfiles.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      const match = p.name.toLowerCase().includes(q)
        || (p.description ?? "").toLowerCase().includes(q)
        || p.tags.some((t) => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filterCountry !== "all" && profileCountry(p.id) !== filterCountry) return false;
    if (filterDegree !== "all" && !profileDegrees(p.tags).includes(filterDegree)) return false;
    return true;
  });

  async function handleImport() {
    setImporting(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ directory: true, multiple: false, title: t("library.import_dialog_title") });
      const src = Array.isArray(result) ? result[0] : result;
      if (!src) { setImporting(false); return; }
      const imported = await api.importProfile(src);
      setProfiles((prev) => [...prev, imported]);
      setSelected(imported);
      showToast(t("library.import_success", { name: imported.name }));
    } catch (e) { showToast(t("library.import_error", { error: String(e) }), false); }
    finally { setImporting(false); }
  }

  async function handleExport(profile: ProfileInfo) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dest = await open({ directory: true, multiple: false, title: t("library.export_dialog_title") });
      const destPath = Array.isArray(dest) ? dest[0] : dest;
      if (!destPath) return;
      const result = await api.exportProfile(profile.id, destPath);
      showToast(t("library.export_success", { path: result.exported_to }));
    } catch (e) { showToast(t("library.export_error", { error: String(e) }), false); }
  }

  async function handleDelete(profile: ProfileInfo) {
    setConfirmDelete(null);
    try {
      await api.deleteProfile(profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      if (selected?.id === profile.id) setSelected(null);
    } catch (e) { showToast(t("library.delete_error", { error: String(e) }), false); }
  }

  function handleSaveEdit(updated: ProfileInfo) {
    setProfiles((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelected(updated); setEditing(false);
  }

  function handleUseProfile(profile: ProfileInfo) {
    navigate(`/new?profile=${encodeURIComponent(profile.id)}`);
  }

  const TABS: { id: LibTab; label: string; icon: React.ReactNode }[] = [
    { id: "profiles",  label: t("library.tab_profiles"),  icon: <IconFolder size={13} /> },
    { id: "community", label: t("library.tab_community"), icon: <IconGlobe size={13} /> },
    { id: "styles",    label: t("library.tab_styles"),   icon: <IconLayers size={13} /> },
    { id: "elements",  label: t("library.tab_elements"), icon: <IconGrid size={13} /> },
    { id: "plugins",   label: t("library.tab_plugins"),  icon: <IconCode size={13} /> },
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
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ {t("library.title")}</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>{t("library.back_home")}</button>}
      />

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-chrome)", borderRadius: "var(--r-lg)", padding: 24, maxWidth: 380, width: "90%", border: "1px solid var(--border-firm)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-strong)" }}>{t("library.delete_profile_title")}</div>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
              {t("library.delete_profile_body_before")} <strong>{confirmDelete.name}</strong> ({confirmDelete.id}). {t("library.delete_profile_body_after")}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</button>
              <button className="btn" style={{ background: "var(--build-err)", color: "white", border: "none" }} onClick={() => handleDelete(confirmDelete)}><IconTrash size={13} /> {t("common.delete")}</button>
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
            {t("library.sidebar_counts", { profiles: profiles.length, elements: BLOCK_CATALOG.length })}
          </div>
        </div>

        {/* Profiles tab */}
        {tab === "profiles" && (
          <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }} className="scroll">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>{t("library.installed_profiles")}</h1>
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>{loading ? t("common.loading") : t("library.profile_count_hint", { count: profiles.length })}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm" onClick={handleImport} disabled={importing} title={t("library.import_profile_title")}><IconUpload size={13} /> {importing ? t("library.importing") : t("common.import")}</button>
                  <button className="btn btn-sm" onClick={() => navigate("/new-profile")} title={t("library.create_profile_title")}><IconPlus size={13} /> {t("library.create_profile")}</button>
                  <button className="btn btn-accent btn-sm" onClick={() => navigate("/new")}><IconPlus size={13} /> {t("home.new_project")}</button>
                </div>
              </div>
              <div style={{
                maxWidth: 920, marginBottom: 20, padding: "14px 16px",
                borderRadius: "var(--r-lg)", background: "var(--accent-tint)",
                border: "1px solid var(--accent-soft)",
              }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 6 }}>
                  {t("library.pick_profile_title")}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                  {t("library.pick_profile_body")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ position: "relative", flex: "0 0 300px" }}>
                  <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("library.search_placeholder")} style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none" }} />
                </div>
                {availableCountries.length > 1 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginRight: 2 }}>{t("library.country_filter")}:</span>
                    {["all", ...availableCountries].map((c) => (
                      <button
                        key={c}
                        onClick={() => setFilterCountry(c)}
                        className={filterCountry === c ? "btn btn-xs btn-accent" : "btn btn-xs btn-ghost"}
                        style={{ fontSize: "var(--fs-xs)", padding: "2px 8px" }}
                      >
                        {c === "all" ? t("library.all") : (COUNTRY_KEYS[c] ? t(COUNTRY_KEYS[c]) : c.toUpperCase())}
                      </button>
                    ))}
                  </div>
                )}
                {availableDegrees.length > 1 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginRight: 2 }}>{t("library.degree_filter")}:</span>
                    {["all", ...availableDegrees].map((d) => (
                      <button
                        key={d}
                        onClick={() => setFilterDegree(d)}
                        className={filterDegree === d ? "btn btn-xs btn-accent" : "btn btn-xs btn-ghost"}
                        style={{ fontSize: "var(--fs-xs)", padding: "2px 8px" }}
                      >
                        {d === "all" ? t("library.all") : (DEGREE_LABELS[d] ? t(DEGREE_LABELS[d]) : d)}
                      </button>
                    ))}
                  </div>
                )}
                {(filterCountry !== "all" || filterDegree !== "all" || search) && (
                  <button
                    className="btn btn-xs btn-ghost"
                    style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", padding: "2px 8px" }}
                    onClick={() => { setFilterCountry("all"); setFilterDegree("all"); setSearch(""); }}
                  >
                    {t("library.clear_filters")}
                  </button>
                )}
              </div>
              {loading ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0" }}>{t("library.loading_profiles")}</div>
              ) : filtered.length === 0 ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>{t("library.no_profiles_found", { search })}</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                  {filtered.map((p) => (
                    <ProfileCard key={p.id} profile={p} selected={selected?.id === p.id} onClick={() => { if (editing && selected?.id === p.id) return; setEditing(false); setSelected(selected?.id === p.id ? null : profiles.find((raw) => raw.id === p.id) ?? p); }} />
                  ))}
                </div>
              )}
            </div>
            {selected && localizedSelected && !editing && <ProfileDetailPanel profile={localizedSelected} onClose={() => setSelected(null)} onEdit={() => setEditing(true)} onUse={() => handleUseProfile(selected)} onExport={() => handleExport(selected)} onDelete={() => setConfirmDelete(selected)} />}
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

        {tab === "plugins" && <PluginsTab />}
      </div>

      <TxStatusbar items={[
        { text: t("library.installed_profiles_count", { count: profiles.length }) },
        { icon: <IconUpload size={11} />, text: t("common.import") },
        { right: true, text: "TeXisStudio 1.0.0" },
      ]} />
    </>
  );
}
