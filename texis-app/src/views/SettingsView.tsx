import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { IconSettings, IconBook, IconFolder, IconDownload } from "../components/Icons";
import { SUPPORTED_LANGUAGES, SPELL_CHECK_LANGS } from "../i18n/index";
import i18n, { registerDynamicLocale } from "../i18n/index";
import { useSettingsStore } from "../stores/settings";
import { useLangPacksStore } from "../stores/languagePacks";
import { useVocabPacksStore } from "../stores/vocabularyPacks";
import type { LangPackEntry } from "../types";

// ── Layout constants ──────────────────────────────────────────────────────

const SECTIONS = [
  "language",
  "dictionary",
  "community",
  "user",
  "projects",
  "text",
  "help",
  "about",
] as const;

type Section = (typeof SECTIONS)[number];

const SHORTCUT_ROWS: Array<[string, string]> = [
  ["shortcut_save", "Ctrl+S"],
  ["shortcut_compile", "Ctrl+Shift+B"],
  ["shortcut_palette", "Ctrl+K"],
  ["shortcut_citation", "Ctrl+["],
  ["shortcut_spell", "Ctrl+Shift+S"],
  ["shortcut_grammar", "Ctrl+Shift+G"],
  ["shortcut_new_block", "Ctrl+Enter"],
  ["shortcut_toggle_section", "Ctrl+Shift+E"],
];

// ── Sub-components ────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
      borderRadius: "var(--r-lg)", padding: "16px 20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)" }}>{label}</div>
        {hint && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>{hint}</div>}
      </div>
    </label>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ width: 180, flexShrink: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────

export default function SettingsView() {
  const navigate = useNavigate();
  const { section: sectionParam } = useParams<{ section?: string }>();
  const { t } = useTranslation();
  const {
    lang, spellLang,
    autocorrectEnabled, grammarAutoCheck, grammarEnabled,
    customDictionary, userName, userInstitution, userEmail, projectDir,
    setLang, setSpellLang, setAutocorrect, setGrammarAutoCheck, setGrammarEnabled,
    addToCustomDictionary, removeFromCustomDictionary,
    setUserName, setUserInstitution, setUserEmail, setProjectDir,
  } = useSettingsStore();

  const {
    catalog, catalogLoading, catalogError,
    installed: installedPacks,
    installing, installProgress,
    loadCatalog, install: installPack, uninstall: uninstallPack, isInstalled,
  } = useLangPacksStore();

  const validParam = SECTIONS.includes(sectionParam as Section) ? (sectionParam as Section) : "language";
  const [activeSection, setActiveSection] = useState<Section>(validParam);
  const [newWord, setNewWord] = useState("");
  const [userSaved, setUserSaved] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [localName, setLocalName] = useState(userName);
  const [localInstitution, setLocalInstitution] = useState(userInstitution);
  const [localEmail, setLocalEmail] = useState(userEmail);
  const [localProjectDir, setLocalProjectDir] = useState(projectDir);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load catalog when entering community section
  useEffect(() => {
    if (activeSection === "community" && !catalog && !catalogLoading) {
      loadCatalog();
    }
  }, [activeSection, catalog, catalogLoading, loadCatalog]);

  async function handleInstall(entry: LangPackEntry) {
    setInstallError(null);
    try {
      await installPack(entry);
      // Register locale immediately so language picker reflects it
      if (entry.capabilities.ui) {
        const raw = localStorage.getItem(`tx-lang-pack-ui:${entry.id}`);
        if (raw) registerDynamicLocale(entry.id, JSON.parse(raw));
      }
    } catch (e) {
      setInstallError(String(e));
    }
  }

  function pickLang(code: string) {
    setLang(code);
    i18n.changeLanguage(code);
    const spellCode = SPELL_CHECK_LANGS[code];
    if (spellLang !== undefined) setSpellLang(spellCode);
  }

  function handleAddWord() {
    const w = newWord.trim();
    if (w) { addToCustomDictionary(w); setNewWord(""); }
  }

  function handleImportDict(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach(addToCustomDictionary);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleExportDict() {
    const blob = new Blob([customDictionary.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "texis-dictionary.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  function saveUserData() {
    setUserName(localName);
    setUserInstitution(localInstitution);
    setUserEmail(localEmail);
    setProjectDir(localProjectDir);
    setUserSaved(true);
    setTimeout(() => setUserSaved(false), 2500);
  }

  const navItems: Array<{ key: Section; label: string }> = SECTIONS.map((key) => ({
    key,
    label: t(`settings.section_${key}`),
  }));

  return (
    <>
      <TxAppbar
        left={
          <>
            <TxLogo />
            <span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginLeft: 4 }}>
              / {t("settings.title")}
            </span>
          </>
        }
        center={null}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            ← {t("common.back")}
          </button>
        }
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" }}>
        {/* Sidebar */}
        <aside style={{
          width: 220, flexShrink: 0,
          borderRight: "1px solid var(--border-subtle)",
          padding: "20px 14px", display: "flex", flexDirection: "column", gap: 2,
          background: "var(--bg-chrome)",
        }}>
          {navItems.map(({ key, label }) => (
            <div
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: "var(--r-md)",
                fontSize: "var(--fs-base)", cursor: "pointer",
                background: activeSection === key ? "var(--bg-selected)" : "transparent",
                color: activeSection === key ? "var(--accent-deep)" : "var(--fg-default)",
                fontWeight: activeSection === key ? 500 : 400,
              }}
            >
              {label}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main className="scroll" style={{ flex: 1, overflow: "auto", padding: "32px 48px 64px" }}>

          {/* ── Language ── */}
          {activeSection === "language" && (
            <div>
              <SectionHeading>{t("settings.section_language")}</SectionHeading>

              {/* UI Language — bundled + installed community packs */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 12, color: "var(--fg-strong)" }}>
                  {t("settings.ui_language")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      className={`btn ${lang === l.code ? "btn-accent" : "btn-ghost"}`}
                      style={{ gap: 6 }}
                      onClick={() => pickLang(l.code)}
                    >
                      <span style={{ fontSize: 18 }}>{l.flag}</span>
                      <span>{l.label}</span>
                      {lang === l.code && <span style={{ fontSize: 11, opacity: 0.7 }}>✓</span>}
                    </button>
                  ))}
                  {/* Community-installed UI packs */}
                  {installedPacks.filter((p) => p.entry.capabilities.ui).map((p) => (
                    <button
                      key={p.id}
                      className={`btn ${lang === p.id ? "btn-accent" : "btn-ghost"}`}
                      style={{ gap: 6 }}
                      onClick={() => pickLang(p.id)}
                    >
                      <span style={{ fontSize: 18 }}>{p.entry.flag}</span>
                      <span>{p.entry.native_name}</span>
                      {lang === p.id && <span style={{ fontSize: 11, opacity: 0.7 }}>✓</span>}
                      <span style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>↓</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 10 }}>
                  {t("settings.community_contribute").split("?")[0]}? →{" "}
                  <span
                    style={{ color: "var(--link)", cursor: "pointer" }}
                    onClick={() => setActiveSection("community")}
                  >
                    {t("settings.section_community")}
                  </span>
                </div>
              </Card>

              {/* Spell-check language — bundled + installed dicts */}
              <Card>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 12, color: "var(--fg-strong)" }}>
                  {t("settings.spell_language")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    ...SUPPORTED_LANGUAGES,
                    ...installedPacks.filter((p) => p.entry.capabilities.ui).map((p) => ({
                      code: p.id, label: p.entry.native_name, flag: p.entry.flag, bundled: false,
                    })),
                  ].map((l) => {
                    const hasSpell = SPELL_CHECK_LANGS[l.code] !== null ||
                      installedPacks.some((p) => p.id === l.code && p.entry.capabilities.spelling);
                    return (
                      <button
                        key={l.code}
                        className={`btn ${spellLang === l.code ? "btn-accent" : hasSpell ? "btn-ghost" : ""}`}
                        style={{ gap: 6, opacity: hasSpell ? 1 : 0.35, cursor: hasSpell ? "pointer" : "default" }}
                        onClick={() => hasSpell && setSpellLang(l.code)}
                        title={hasSpell ? l.label : t("settings.spell_not_supported")}
                        disabled={!hasSpell}
                      >
                        <span style={{ fontSize: 18 }}>{l.flag}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{l.code.toUpperCase()}</span>
                        {spellLang === l.code && <span style={{ fontSize: 11, opacity: 0.7 }}>✓</span>}
                        {!hasSpell && <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>×</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 10 }}>
                  × = {t("settings.spell_not_supported")}
                </div>
              </Card>
            </div>
          )}

          {/* ── Personal dictionary ── */}
          {activeSection === "dictionary" && (
            <div>
              <SectionHeading>{t("settings.section_dictionary")}</SectionHeading>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>
                    {t("settings.dict_custom_title")}
                  </div>
                  <span style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
                    {t(customDictionary.length === 1 ? "settings.dict_word_count_one" : "settings.dict_word_count_other", { count: customDictionary.length })}
                  </span>
                </div>

                {/* Add word */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    className="input"
                    style={{ flex: 1, fontSize: "var(--fs-sm)" }}
                    placeholder={t("settings.dict_add_placeholder")}
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddWord(); }}
                  />
                  <button className="btn btn-accent btn-sm" onClick={handleAddWord}>
                    {t("settings.dict_add_btn")}
                  </button>
                </div>

                {/* Word list */}
                {customDictionary.length === 0 ? (
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", margin: 0 }}>
                    {t("settings.dict_custom_empty")}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                    {customDictionary.map((word) => (
                      <span
                        key={word}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: "var(--r-sm)",
                          background: "var(--bg-chrome)", border: "1px solid var(--border-soft)",
                          fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
                        }}
                      >
                        {word}
                        <button
                          style={{
                            border: "none", background: "none", cursor: "pointer",
                            color: "var(--fg-muted)", padding: 0, lineHeight: 1,
                            fontSize: 12,
                          }}
                          onClick={() => removeFromCustomDictionary(word)}
                          title={t("common.delete")}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Card>

              {/* Import / Export */}
              <Card>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 12, color: "var(--fg-strong)" }}>
                  {t("common.import")} / {t("common.edit")}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    style={{ display: "none" }}
                    onChange={handleImportDict}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                    {t("settings.dict_import_btn")}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleExportDict}
                    disabled={customDictionary.length === 0}
                  >
                    {t("settings.dict_export_btn")}
                  </button>
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 8 }}>
                  Formato: un término por línea (.txt sin cabecera)
                </div>
              </Card>
            </div>
          )}

          {/* ── Community packages ── */}
          {activeSection === "community" && (
            <div>
              <SectionHeading>{t("settings.section_community")}</SectionHeading>

              {/* Language packs */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
                      {t("settings.community_title")}
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
                      {t("settings.community_subtitle")}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => loadCatalog(true)}
                    disabled={catalogLoading}
                    title="Refresh catalog"
                  >
                    {catalogLoading ? "…" : "↻"}
                  </button>
                </div>

                {catalogError && (
                  <div style={{ color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 12 }}>
                    {catalogError}
                  </div>
                )}
                {installError && (
                  <div style={{ color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 12 }}>
                    {installError}
                  </div>
                )}

                {catalogLoading && !catalog && (
                  <div style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", padding: "16px 0" }}>
                    {t("common.loading")}
                  </div>
                )}

                {!catalogLoading && !catalog && !catalogError && (
                  <div style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", padding: "16px 0" }}>
                    {t("settings.community_none")}
                  </div>
                )}

                {catalog?.packages.map((pkg) => {
                  const installed = isInstalled(pkg.id);
                  const isInstalling = installing.has(pkg.id);
                  const progress = installProgress[pkg.id];

                  return (
                    <div key={pkg.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 0", borderBottom: "1px solid var(--border-subtle)",
                    }}>
                      {/* Flag + info */}
                      <span style={{ fontSize: 24, flexShrink: 0 }}>{pkg.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
                            {pkg.native_name}
                          </span>
                          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{pkg.name}</span>
                          {/* Status badge */}
                          <span style={{
                            fontSize: 10, padding: "1px 5px", borderRadius: 3,
                            background: pkg.status === "stable" ? "var(--build-ok-tint, #e6f4ea)"
                              : pkg.status === "beta" ? "var(--accent-tint)" : "var(--bg-chrome)",
                            color: pkg.status === "stable" ? "var(--build-ok)" : "var(--accent-deep)",
                            fontFamily: "var(--font-mono)",
                          }}>
                            {pkg.status}
                          </span>
                        </div>
                        {/* Capability pills */}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {pkg.capabilities.ui && <span className="chip" style={{ fontSize: 10 }}>UI</span>}
                          {pkg.capabilities.spelling && <span className="chip" style={{ fontSize: 10 }}>Spell</span>}
                          {pkg.capabilities.autocorrect && <span className="chip" style={{ fontSize: 10 }}>Auto</span>}
                          {pkg.capabilities.grammar_remote && <span className="chip" style={{ fontSize: 10 }}>Grammar</span>}
                          {pkg.capabilities.latex_babel && <span className="chip" style={{ fontSize: 10 }}>babel</span>}
                          {pkg.capabilities.latex_polyglossia && <span className="chip" style={{ fontSize: 10 }}>polyglossia</span>}
                          {!pkg.capabilities.spelling && (
                            <span className="chip" style={{ fontSize: 10, opacity: 0.5 }}>no spell</span>
                          )}
                        </div>
                        {isInstalling && progress && (
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent)", marginTop: 4 }}>
                            {progress === "ui" ? "↓ UI…" : progress === "spelling" ? "↓ Dict…" : progress === "autocorrect" ? "↓ Rules…" : "✓"}
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      {installed ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                          <span style={{ fontSize: "var(--fs-xs)", color: "var(--build-ok)", fontWeight: 500 }}>
                            ✓ {t("settings.community_installed")}
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)" }}
                            onClick={() => uninstallPack(pkg.id)}
                          >
                            {t("settings.community_remove")}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-accent btn-sm"
                          style={{ flexShrink: 0, gap: 5 }}
                          onClick={() => handleInstall(pkg)}
                          disabled={isInstalling}
                        >
                          <IconDownload size={11} />
                          {isInstalling ? "…" : t("settings.community_download")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </Card>

              <Card style={{ background: "var(--accent-tint)", border: "1px solid var(--accent-soft)" }}>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.7 }}>
                  {t("settings.community_contribute")}
                </div>
                <div style={{ marginTop: 10 }}>
                  <a
                    href="https://github.com/GonzaloAndDev/TeXisStudio/tree/main/community/languages"
                    style={{ fontSize: "var(--fs-sm)", color: "var(--accent)", fontFamily: "var(--font-mono)", textDecoration: "none" }}
                    target="_blank" rel="noreferrer"
                  >
                    github.com/…/TeXisStudio/community/languages →
                  </a>
                </div>
              </Card>

              {/* ── Vocabulary packs ── */}
              <VocabularyPacksPanel />
            </div>
          )}

          {/* ── User profile ── */}
          {activeSection === "user" && (
            <div>
              <SectionHeading>{t("settings.section_user")}</SectionHeading>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                  Estos datos se usarán como valores predeterminados al crear nuevos proyectos.
                </div>

                <FieldRow label={t("settings.user_name")}>
                  <input
                    className="input"
                    style={{ width: "100%", fontSize: "var(--fs-sm)" }}
                    placeholder={t("settings.user_name_placeholder")}
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                  />
                </FieldRow>

                <FieldRow label={t("settings.user_institution")}>
                  <input
                    className="input"
                    style={{ width: "100%", fontSize: "var(--fs-sm)" }}
                    placeholder={t("settings.user_institution_placeholder")}
                    value={localInstitution}
                    onChange={(e) => setLocalInstitution(e.target.value)}
                  />
                </FieldRow>

                <FieldRow label={t("settings.user_email")}>
                  <input
                    className="input"
                    type="email"
                    style={{ width: "100%", fontSize: "var(--fs-sm)" }}
                    placeholder={t("settings.user_email_placeholder")}
                    value={localEmail}
                    onChange={(e) => setLocalEmail(e.target.value)}
                  />
                </FieldRow>

                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <button className="btn btn-accent btn-sm" onClick={saveUserData}>
                    {t("settings.user_save")}
                  </button>
                  {userSaved && (
                    <span style={{ fontSize: "var(--fs-sm)", color: "var(--build-ok)", fontWeight: 500 }}>
                      {t("settings.user_saved")}
                    </span>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* ── Projects directory ── */}
          {activeSection === "projects" && (
            <div>
              <SectionHeading>{t("settings.section_projects")}</SectionHeading>

              <Card>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 6, color: "var(--fg-strong)" }}>
                  {t("settings.projects_dir")}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 12 }}>
                  {t("settings.projects_dir_hint")}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)" }}
                    value={localProjectDir}
                    onChange={(e) => setLocalProjectDir(e.target.value)}
                    placeholder="~/Documentos/TeXisStudio"
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      // In Tauri env, open folder picker; in browser, just save the typed value
                      setProjectDir(localProjectDir);
                    }}
                  >
                    <IconFolder size={13} /> {t("settings.projects_dir_change")}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* ── Text correction ── */}
          {activeSection === "text" && (
            <div>
              <SectionHeading>{t("settings.section_text")}</SectionHeading>

              <Card style={{ marginBottom: 16 }}>
                <Toggle
                  checked={autocorrectEnabled}
                  onChange={setAutocorrect}
                  label={t("settings.text_autocorrect")}
                  hint={t("settings.text_autocorrect_hint")}
                />
              </Card>

              <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Toggle
                  checked={grammarEnabled}
                  onChange={setGrammarEnabled}
                  label={t("settings.text_grammar")}
                  hint={t("settings.text_grammar_hint")}
                />
                <div style={{ paddingLeft: 24, opacity: grammarEnabled ? 1 : 0.4, pointerEvents: grammarEnabled ? "auto" : "none" }}>
                  <Toggle
                    checked={grammarAutoCheck}
                    onChange={setGrammarAutoCheck}
                    label={t("settings.text_grammar_auto")}
                    hint={t("settings.text_grammar_auto_hint")}
                  />
                </div>
                <div style={{
                  paddingLeft: 24, fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6,
                }}>
                  Powered by{" "}
                  <a href="https://languagetool.org" style={{ color: "var(--link)" }} target="_blank" rel="noreferrer">
                    LanguageTool
                  </a>
                  {" "}— texto enviado a sus servidores para análisis
                </div>
              </Card>
            </div>
          )}

          {/* ── Help ── */}
          {activeSection === "help" && (
            <div>
              <SectionHeading>{t("settings.section_help")}</SectionHeading>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 16, color: "var(--fg-strong)" }}>
                  {t("settings.help_shortcuts")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {SHORTCUT_ROWS.map(([key, shortcut]) => (
                    <div key={key} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 0", borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "var(--fs-sm)",
                    }}>
                      <span style={{ color: "var(--fg-default)" }}>{t(`settings.${key}`)}</span>
                      <span
                        className="kbd"
                        style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", letterSpacing: 0 }}
                      >
                        {shortcut}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <a
                    href="https://github.com/GonzaloAndDev/TeXisStudio/wiki"
                    style={{ color: "var(--link)", fontSize: "var(--fs-sm)", textDecoration: "none" }}
                    target="_blank" rel="noreferrer"
                  >
                    {t("settings.help_docs")} →
                  </a>
                  <a
                    href="https://github.com/GonzaloAndDev/TeXisStudio/issues/new"
                    style={{ color: "var(--link)", fontSize: "var(--fs-sm)", textDecoration: "none" }}
                    target="_blank" rel="noreferrer"
                  >
                    {t("settings.help_report")} →
                  </a>
                </div>
              </Card>
            </div>
          )}

          {/* ── About ── */}
          {activeSection === "about" && (
            <div>
              <SectionHeading>{t("settings.section_about")}</SectionHeading>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {([
                    ["about_version", "v1.0.0"],
                    ["about_license", "AGPL v3 + Commons Clause"],
                    ["about_author", "Gonzalo Andrade Estrella"],
                  ] as const).map(([key, value]) => (
                    <div key={key} style={{
                      display: "flex", gap: 16, padding: "8px 0",
                      borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--fs-sm)",
                    }}>
                      <div style={{ width: 140, flexShrink: 0, color: "var(--fg-muted)" }}>{t(`settings.${key}`)}</div>
                      <div style={{ color: "var(--fg-strong)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/about")}>
                <IconBook size={13} /> {t("settings.about_view_full")}
              </button>
            </div>
          )}

        </main>
      </div>

      <TxStatusbar items={[
        { icon: <IconSettings size={11} />, text: t("settings.title") },
        { right: true, text: "TeXisStudio v1.0.0" },
      ]} />
    </>
  );
}

// ── VocabularyPacksPanel ──────────────────────────────────────────────────────

function VocabularyPacksPanel() {
  const {
    officialPacks, catalogLoading, catalogError,
    installed, installing,
    customRepos, repoLoading,
    loadOfficialCatalog, install, uninstall, isInstalled,
    addRepo, removeRepo, syncRepo,
  } = useVocabPacksStore();

  const [newRepoAlias, setNewRepoAlias] = useState("");
  const [newRepoUrl, setNewRepoUrl]     = useState("");
  const [repoError, setRepoError]       = useState<string | null>(null);
  const [showAddRepo, setShowAddRepo]   = useState(false);
  const [langFilter, setLangFilter]     = useState<"all" | "es" | "en">("all");

  useEffect(() => { loadOfficialCatalog(); }, []);

  async function handleAddRepo() {
    if (!newRepoAlias.trim() || !newRepoUrl.trim()) return;
    setRepoError(null);
    try {
      await addRepo(newRepoAlias.trim(), newRepoUrl.trim());
      setNewRepoAlias(""); setNewRepoUrl(""); setShowAddRepo(false);
    } catch (e) { setRepoError(String(e)); }
  }

  const allPacksRaw = [
    ...officialPacks,
    ...customRepos.flatMap((r) => (r.packs ?? []).map((p) => ({ ...p, _repoId: r.id }))),
  ];
  const allPacks = langFilter === "all"
    ? allPacksRaw
    : allPacksRaw.filter((p) => (p.base_language_hint ?? "").toLowerCase() === langFilter);

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: "var(--r-sm)",
    border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
    fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none", width: "100%",
    boxSizing: "border-box",
  };

  return (
    <Card style={{ marginTop: 16 }}>
      {/* Header */}
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

      {catalogError && (
        <div style={{ color: "var(--build-err)", fontSize: "var(--fs-xs)", marginBottom: 10 }}>
          {catalogError}
        </div>
      )}

      {/* Active packs summary */}
      {installed.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
            Vocabularios activos ({installed.length}):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {installed.map((p) => (
              <span key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: "var(--r-xs)", background: "var(--accent-tint)", color: "var(--accent-deep)", fontSize: "var(--fs-xs)" }}>
                {p.entry.name}
                <button onClick={() => uninstall(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-deep)", fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 4 }}>
            {installed.reduce((n, p) => n + (p.terms?.length ?? 0), 0)} términos combinados
          </div>
        </div>
      )}

      {/* Language filter tabs */}
      {allPacksRaw.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {(["all", "es", "en"] as const).map((f) => {
            const count = f === "all" ? allPacksRaw.length : allPacksRaw.filter((p) => (p.base_language_hint ?? "") === f).length;
            return (
              <button
                key={f}
                onClick={() => setLangFilter(f)}
                className={`btn btn-sm ${langFilter === f ? "btn-accent" : "btn-ghost"}`}
                style={{ fontSize: 11, padding: "2px 10px" }}
              >
                {f === "all" ? `Todos (${count})` : f === "es" ? `Español (${count})` : `English (${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Official + custom packs list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {allPacks.length === 0 && !catalogLoading && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0" }}>
            {allPacksRaw.length > 0 ? `Sin paquetes para "${langFilter}". Prueba otro filtro.` : "Sin paquetes disponibles. Recarga el catálogo."}
          </div>
        )}
        {allPacks.map((pack) => {
          const installed_ = isInstalled(pack.id);
          const installing_ = installing.has(pack.id);
          return (
            <div key={pack.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: `1px solid ${installed_ ? "var(--accent-soft)" : "var(--border-subtle)"}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{pack.name}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 1 }}>{pack.description}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <span className="chip" style={{ fontSize: 9 }}>{pack.status}</span>
                  {pack.base_language_hint && <span className="chip" style={{ fontSize: 9 }}>{pack.base_language_hint}</span>}
                  <span className="chip" style={{ fontSize: 9 }}>v{pack.version}</span>
                </div>
              </div>
              {installed_ ? (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--build-err)" }} onClick={() => uninstall(pack.id)}>
                  Quitar
                </button>
              ) : (
                <button className="btn btn-sm btn-accent" style={{ fontSize: 11 }} disabled={installing_} onClick={() => install(pack).catch(() => {})}>
                  {installing_ ? "…" : <><IconDownload size={11} /> Instalar</>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom repos section */}
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
                {repoLoading ? "Conectando…" : "Añadir repositorio"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddRepo(false); setRepoError(null); }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
