import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconBuilding, IconDownload, IconMap, IconRefresh, IconSearch, IconX } from "../../components/Icons";
import { api } from "../../lib/tauri";
import type { ProfileInfo } from "../../types";
import { CommunityProfileCard } from "../../components/library/CommunityProfileCard";
import { fetchProfileCatalog, type CatalogProfile } from "../../services/profileCatalog";
import { AiHelpButton } from "../../components/AiHelpButton";

// ── Helpers de localización ───────────────────────────────────────────────────

const CONTINENT_LABEL: Record<string, string> = {
  america: "América", europe: "Europa", asia: "Asia", generic: "Genérico",
};
const CONTINENT_ABBR: Record<string, string> = {
  america: "AM", europe: "EU", asia: "AS", generic: "GN",
};
const CONTINENT_COLOR: Record<string, string> = {
  america: "#4338CA", europe: "#0369A1", asia: "#B45309", generic: "#4F7A68",
};
const COUNTRY_LABEL: Record<string, string> = {
  mexico: "México", usa: "Estados Unidos", canada: "Canadá",
  brazil: "Brasil", argentina: "Argentina", chile: "Chile",
  uk: "Reino Unido", germany: "Alemania", spain: "España",
  netherlands: "Países Bajos", italy: "Italia", sweden: "Suecia",
  france: "Francia",
  china: "China", japan: "Japón", south_korea: "Corea del Sur",
  singapore: "Singapur", india: "India",
  generic: "Genérico",
};


const ACADEMIC_LEVEL_LABEL: Record<string, string> = {
  bachillerato: "Bachillerato",
  tecnico: "Técnico",
  licenciatura: "Licenciatura",
  especialidad: "Especialidad",
  maestria: "Maestría",
  doctorado: "Doctorado",
  posdoctorado: "Posdoctorado",
};

const PROFILE_SCOPE_LABEL: Record<string, string> = {
  institutional: "Institucional",
  degree_specific: "Por grado",
  program_specific: "Por programa",
  discipline_specific: "Por área",
};

const DISCIPLINE_LABEL: Record<string, string> = {
  all_disciplines: "Todas las disciplinas",
  engineering: "Ingeniería",
  social_sciences: "Ciencias sociales",
  humanities: "Humanidades",
  health_sciences: "Ciencias de la salud",
  computing: "Computación",
  natural_sciences: "Ciencias naturales",
};


// ── CommunityTab ──────────────────────────────────────────────────────────────

// CatalogProfile and catalog URL are now in services/profileCatalog.ts

export function CommunityTab({ installedIds, onInstalled, userMode }: {
  installedIds: Set<string>;
  onInstalled: (profile: ProfileInfo) => void;
  userMode: "basic" | "advanced";
}) {
  const { t } = useTranslation();
  const [catalog, setCatalog]       = useState<CatalogProfile[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError]     = useState<string | null>(null);
  const [catLoaded, setCatLoaded]   = useState(false);

  const [navContinent, setNavContinent] = useState<string | null>(null);
  const [navCountry, setNavCountry]     = useState<string | null>(null);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [opError, setOpError]         = useState<string | null>(null);
  const [opSuccess, setOpSuccess]     = useState<string | null>(null);
  const [customUrl, setCustomUrl]     = useState("");
  const [fetchingCustom, setFetchingCustom] = useState(false);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [styleFilter, setStyleFilter] = useState<"all" | string>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<"all" | string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | string>("all");
  const [institutionFilter, setInstitutionFilter] = useState<"all" | string>("all");
  const [programFilter, setProgramFilter] = useState<"all" | string>("all");
  const [noviceSafeOnly, setNoviceSafeOnly] = useState(false);

  function applyGuidedPreset(preset: "starter" | "verified" | "engineering" | "health" | "doctoral") {
    setNavContinent(null);
    setNavCountry(null);

    if (preset === "starter") {
      setStatusFilter("all");
      setStyleFilter("all");
      setLevelFilter("all");
      setDisciplineFilter("all");
      setScopeFilter("institutional");
      setInstitutionFilter("all");
      setProgramFilter("all");
      return;
    }

    if (preset === "verified") {
      setStatusFilter("verified");
      setStyleFilter("all");
      setLevelFilter("all");
      setDisciplineFilter("all");
      setScopeFilter("all");
      setInstitutionFilter("all");
      setProgramFilter("all");
      return;
    }

    if (preset === "engineering") {
      setStatusFilter("all");
      setStyleFilter("ieee");
      setLevelFilter("all");
      setDisciplineFilter("engineering");
      setScopeFilter("all");
      setInstitutionFilter("all");
      setProgramFilter("all");
      return;
    }

    if (preset === "health") {
      setStatusFilter("all");
      setStyleFilter("vancouver");
      setLevelFilter("all");
      setDisciplineFilter("health_sciences");
      setScopeFilter("all");
      setInstitutionFilter("all");
      setProgramFilter("all");
      return;
    }

    setStatusFilter("all");
    setStyleFilter("all");
    setLevelFilter("doctorado");
    setDisciplineFilter("all");
    setScopeFilter("all");
    setInstitutionFilter("all");
    setProgramFilter("all");
  }

  async function fetchCatalog() {
    setCatLoading(true); setCatError(null);
    try {
      const result = await fetchProfileCatalog();
      setCatalog(result.profiles);
      setCatLoaded(true);
      if (result.skippedCount > 0) {
        console.warn(`[LibraryView] ${result.skippedCount} perfil(es) omitido(s) en el catálogo por validación.`);
      }
    } catch (e) {
      setCatError(`No se pudo cargar el catálogo: ${e}. Verifica tu conexión.`);
    } finally {
      setCatLoading(false);
    }
  }

  useEffect(() => { fetchCatalog(); }, []);

  async function handleInstall(cp: CatalogProfile) {
    setDownloading(cp.id); setOpError(null); setOpSuccess(null);
    try {
      const installed = await api.fetchRemoteProfile(cp.download_url, cp.sha256 ?? undefined);
      onInstalled(installed);
      setOpSuccess(`✓ "${installed.name}" instalado correctamente.`);
    } catch (e) { setOpError(String(e)); }
    finally { setDownloading(null); }
  }

  async function handleCustomUrl() {
    const url = customUrl.trim();
    if (!url) return;
    setFetchingCustom(true); setOpError(null); setOpSuccess(null);
    try {
      const installed = await api.fetchRemoteProfile(url);
      onInstalled(installed);
      setOpSuccess(`✓ "${installed.name}" instalado correctamente.`);
      setCustomUrl("");
    } catch (e) { setOpError(String(e)); }
    finally { setFetchingCustom(false); }
  }

  const filteredCatalog = catalog.filter((p) => {
    const statusOk = statusFilter === "all" || (p.status ?? "unspecified") === statusFilter;
    const styleOk = styleFilter === "all" || (p.style_id ?? p.bibliography_style ?? "unspecified") === styleFilter;
    const profileLevels = [
      ...(p.academic_level ? [p.academic_level] : []),
      ...((p.target_levels ?? []).filter((level) => level !== p.academic_level)),
    ];
    const levelOk = levelFilter === "all"
      || (profileLevels.length === 0 ? "unspecified" === levelFilter : profileLevels.includes(levelFilter as typeof profileLevels[number]));
    const disciplineOk = disciplineFilter === "all" || (p.discipline ?? "unspecified") === disciplineFilter;
    const scopeOk = scopeFilter === "all" || (p.profile_scope ?? "unspecified") === scopeFilter;
    const institutionOk = institutionFilter === "all" || (p.institution ?? "unspecified") === institutionFilter;
    const programOk = programFilter === "all" || (p.program_name ?? "unspecified") === programFilter;
    const noviceOk = !noviceSafeOnly || p.novice_safe === true;
    return statusOk && styleOk && levelOk && disciplineOk && scopeOk && institutionOk && programOk && noviceOk;
  });

  // Build hierarchy from filtered catalog
  const continents = [...new Set(filteredCatalog.map((p) => p.continent))].sort();
  const countriesInContinent = (continent: string) =>
    [...new Set(filteredCatalog.filter((p) => p.continent === continent).map((p) => p.country))].sort();
  const profilesInCountry = (continent: string, country: string) =>
    filteredCatalog.filter((p) => p.continent === continent && p.country === country);

  const availableStatuses = [...new Set(catalog.map((p) => p.status ?? "unspecified"))].sort();
  const availableStyles = [...new Set(catalog.map((p) => p.style_id ?? p.bibliography_style ?? "unspecified"))].sort();
  const availableLevels = [...new Set(
    catalog.flatMap((p) => {
      const levels = [
        ...(p.academic_level ? [p.academic_level] : []),
        ...(p.target_levels ?? []),
      ];
      return levels.length ? levels : ["unspecified"];
    }),
  )].sort();
  const availableDisciplines = [...new Set(catalog.map((p) => p.discipline ?? "unspecified"))].sort();
  const availableScopes = [...new Set(catalog.map((p) => p.profile_scope ?? "unspecified"))].sort();
  const availableInstitutions = [...new Set(catalog.map((p) => p.institution ?? "unspecified"))].sort();
  const availablePrograms = [...new Set(catalog.map((p) => p.program_name ?? "unspecified"))].sort();

  // Search flattens everything
  const searchResults = search.trim()
    ? filteredCatalog.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        (p.institution ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.institution_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.style_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.bibliography_style ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.discipline ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.program_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.faculty ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : [];

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // Profile card for community
  const renderProfileCard = (cp: CatalogProfile) => {
    const isInstalled = installedIds.has(cp.id);
    const isDownloading = downloading === cp.id;
    return (
      <CommunityProfileCard
        key={cp.id}
        profile={cp}
        isInstalled={isInstalled}
        isDownloading={isDownloading}
        onInstall={() => handleInstall(cp)}
        academicLevelLabel={(level) => ACADEMIC_LEVEL_LABEL[level] ?? level}
        disciplineLabel={(value) => DISCIPLINE_LABEL[value] ?? value}
        profileScopeLabel={(value) => PROFILE_SCOPE_LABEL[value] ?? value}
      />
    );
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 48px" }} className="scroll">
      <div style={{ maxWidth: 740 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>{t("community.heading")}</h1>
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>{t("community.heading_desc")}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchCatalog} disabled={catLoading} style={{ flexShrink: 0 }}><IconRefresh size={12} /> {catLoading ? t("common.loading") : t("community.refresh")}</button>
        </div>

        {userMode === "basic" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: 12,
            marginBottom: 18,
          }}>
            <div style={{
              padding: "14px 16px",
              borderRadius: "var(--r-lg)",
              background: "var(--accent-tint)",
              border: "1px solid var(--accent-soft)",
            }}>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 6 }}>
                No necesitas saber el nombre exacto del perfil
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                Empieza por tu institución o por una combinación parecida de grado, área y estilo de citas.
                Si no existe una coincidencia exacta, conviene arrancar con una base institucional simple y ajustar después.
              </div>
            </div>
            <div style={{
              padding: "14px 16px",
              borderRadius: "var(--r-lg)",
              background: "var(--bg-panel)",
              border: "1px solid var(--border-soft)",
            }}>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 6 }}>
                {t("community.confidence_title")}
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--fg-strong)" }}>Verified</strong> {t("community.confidence_body_verified")}
                <strong style={{ color: "var(--fg-strong)" }}> Reviewed</strong> {t("community.confidence_body_reviewed")}
                {" "}{t("community.confidence_tip")}
              </div>
            </div>
          </div>
        )}

        {!isTauri && (
          <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", fontSize: "var(--fs-sm)", color: "var(--accent-deep)", marginBottom: 16 }}>
            ℹ {t("community.browser_warning")}
          </div>
        )}

        {opError && <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-err-tint, #ffeded)", border: "1px solid var(--build-err)", color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 14 }}>{opError}</div>}
        {opSuccess && <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-ok-tint, #edfff3)", border: "1px solid var(--build-ok)", color: "var(--build-ok)", fontSize: "var(--fs-sm)", marginBottom: 14 }}>{opSuccess}</div>}
        {catError && <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-err-tint, #ffeded)", border: "1px solid var(--build-err)", color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 14 }}>{catError}</div>}

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}>
          <button className="btn btn-sm" onClick={() => applyGuidedPreset("starter")}>{t("community.preset_starter")}</button>
          <button className="btn btn-sm" onClick={() => applyGuidedPreset("verified")}>{t("community.preset_verified")}</button>
          <button className="btn btn-sm" onClick={() => applyGuidedPreset("engineering")}>{t("community.preset_engineering")}</button>
          <button className="btn btn-sm" onClick={() => applyGuidedPreset("health")}>{t("community.preset_health")}</button>
          <button className="btn btn-sm" onClick={() => applyGuidedPreset("doctoral")}>{t("home.level_doctorado")}</button>
          <button
            className={noviceSafeOnly ? "btn btn-sm btn-accent" : "btn btn-sm btn-ghost"}
            onClick={() => setNoviceSafeOnly((v) => !v)}
            title={t("community.novice_safe_title")}
          >
            {noviceSafeOnly ? "✓ " : ""}{t("community.novice_safe")}
          </button>
          <AiHelpButton
            panel="library_profiles"
            mode="app_help"
            label={t("community.help_label")}
            question={t("community.help_question")}
            variant="chip"
          />
        </div>

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setNavContinent(null); setNavCountry(null); }} placeholder={t("community.search_placeholder")} style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none", boxSizing: "border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={12} /></button>}
        </div>

        {/* Structured filters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 18 }}>
          <select value={institutionFilter} onChange={(e) => { setInstitutionFilter(e.target.value); setNavContinent(null); setNavCountry(null); }} style={{ padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)" }}>
            <option value="all">{t("community.all_institutions")}</option>
            {availableInstitutions.map((value) => (
              <option key={value} value={value}>{value === "unspecified" ? t("community.unspecified_institution") : value}</option>
            ))}
          </select>
          <select value={programFilter} onChange={(e) => { setProgramFilter(e.target.value); setNavContinent(null); setNavCountry(null); }} style={{ padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)" }}>
            <option value="all">{t("community.all_programs")}</option>
            {availablePrograms.map((value) => (
              <option key={value} value={value}>{value === "unspecified" ? t("community.unspecified_program") : value}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setNavContinent(null); setNavCountry(null); }} style={{ padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)" }}>
            <option value="all">{t("community.all_statuses")}</option>
            {availableStatuses.map((value) => (
              <option key={value} value={value}>{value === "unspecified" ? t("community.unspecified_status") : value}</option>
            ))}
          </select>
          <select value={styleFilter} onChange={(e) => { setStyleFilter(e.target.value); setNavContinent(null); setNavCountry(null); }} style={{ padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)" }}>
            <option value="all">{t("community.all_styles")}</option>
            {availableStyles.map((value) => (
              <option key={value} value={value}>{value === "unspecified" ? t("community.unspecified_style") : value}</option>
            ))}
          </select>
          <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setNavContinent(null); setNavCountry(null); }} style={{ padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)" }}>
            <option value="all">{t("community.all_degrees")}</option>
            {availableLevels.map((value) => (
              <option key={value} value={value}>{value === "unspecified" ? t("community.unspecified_degree") : (ACADEMIC_LEVEL_LABEL[value] ?? value)}</option>
            ))}
          </select>
          <select value={disciplineFilter} onChange={(e) => { setDisciplineFilter(e.target.value); setNavContinent(null); setNavCountry(null); }} style={{ padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)" }}>
            <option value="all">{t("community.all_areas")}</option>
            {availableDisciplines.map((value) => (
              <option key={value} value={value}>{value === "unspecified" ? t("community.unspecified_area") : (DISCIPLINE_LABEL[value] ?? value)}</option>
            ))}
          </select>
          <select value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setNavContinent(null); setNavCountry(null); }} style={{ padding: "7px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)" }}>
            <option value="all">{t("community.all_scopes")}</option>
            {availableScopes.map((value) => (
              <option key={value} value={value}>{value === "unspecified" ? t("community.unspecified_scope") : (PROFILE_SCOPE_LABEL[value] ?? value)}</option>
            ))}
          </select>
        </div>

        {/* Search results */}
        {search.trim() ? (
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 12 }}>{t("community.search_results", { count: searchResults.length, search })}</div>
            {searchResults.length === 0
              ? <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "20px 0" }}>{t("community.no_results")}</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{searchResults.map(renderProfileCard)}</div>
            }
          </div>
        ) : catLoading ? (
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>{t("community.loading_catalog")}</div>
        ) : catLoaded && catalog.length === 0 ? (
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "20px 0" }}>{t("community.empty_catalog")}</div>
        ) : catLoaded && filteredCatalog.length === 0 ? (
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "20px 0" }}>{t("community.no_filter_matches")}</div>
        ) : catLoaded ? (
          <>
            {/* Breadcrumb */}
            {(navContinent || navCountry) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
                <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => { setNavContinent(null); setNavCountry(null); }}>Todos</span>
                {navContinent && (
                  <>
                    <span>›</span>
                    <span style={{ cursor: navCountry ? "pointer" : "default", color: navCountry ? "var(--accent)" : "var(--fg-strong)", fontWeight: navCountry ? 400 : 500 }} onClick={() => { if (navCountry) setNavCountry(null); }}>{CONTINENT_LABEL[navContinent] ?? navContinent}</span>
                  </>
                )}
                {navCountry && (
                  <>
                    <span>›</span>
                    <span style={{ color: "var(--fg-strong)", fontWeight: 500 }}>{COUNTRY_LABEL[navCountry] ?? navCountry}</span>
                  </>
                )}
              </div>
            )}

            {/* Continent view */}
            {!navContinent && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
                {continents.map((continent) => {
                  const count = filteredCatalog.filter((p) => p.continent === continent).length;
                  const color = CONTINENT_COLOR[continent] ?? "var(--accent)";
                  return (
                    <div key={continent} onClick={() => setNavContinent(continent)}
                      style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: "18px 16px", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 0 0 3px ${color}22`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-soft)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                        <IconMap size={16} />
                      </div>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 2 }}>{CONTINENT_LABEL[continent] ?? continent}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{count} perfiles</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color, fontWeight: 700, background: `${color}14`, padding: "1px 5px", borderRadius: "var(--r-xs)" }}>{CONTINENT_ABBR[continent] ?? continent.slice(0,2).toUpperCase()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Country view */}
            {navContinent && !navCountry && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
                {countriesInContinent(navContinent).map((country) => {
                  const count = profilesInCountry(navContinent, country).length;
                  const color = CONTINENT_COLOR[navContinent] ?? "var(--accent)";
                  return (
                    <div key={country} onClick={() => setNavCountry(country)}
                      style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s", display: "flex", alignItems: "center", gap: 10 }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-soft)"; }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", background: `${color}14`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconBuilding size={13} />
                      </div>
                      <div>
                        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{COUNTRY_LABEL[country] ?? country}</div>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{count} perfiles</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Profile list view */}
            {navContinent && navCountry && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {profilesInCountry(navContinent, navCountry).map(renderProfileCard)}
              </div>
            )}
          </>
        ) : null}

        {/* Custom URL */}
        <div style={{ padding: "20px 22px", borderRadius: "var(--r-lg)", border: "1px dashed var(--border-firm)", background: "var(--bg-panel)", marginTop: 16 }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 6 }}>{t("community.install_from_url_title")}</div>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
            {t("community.install_from_url_hint")}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://github.com/.../download/mi_perfil.zip" style={{ flex: 1, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none", fontFamily: "var(--font-mono)" }} onKeyDown={(e) => { if (e.key === "Enter") handleCustomUrl(); }} />
            <button className="btn btn-accent btn-sm" onClick={handleCustomUrl} disabled={!customUrl.trim() || fetchingCustom}>
              {fetchingCustom ? <><IconRefresh size={12} /> …</> : <><IconDownload size={12} /> {t("community.install_btn")}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LibraryView ───────────────────────────────────────────────────────────────

