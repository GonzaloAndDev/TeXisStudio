import React, { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "../version";
import { useToast } from "../components/ui/ToastProvider";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { IconSettings, IconBook, IconFolder, IconDownload } from "../components/Icons";
import { SUPPORTED_LANGUAGES, SPELL_CHECK_LANGS } from "../i18n/index";
import i18n, { ensureDynamicLocale } from "../i18n/index";
import { normalizeUiLanguage } from "../i18n/languageState";
import { useSettingsStore } from "../stores/settings";
import { useLangPacksStore } from "../stores/languagePacks";
import type { LangPackEntry } from "../types";
import { VocabularyPacksPanel } from "../components/settings/VocabularyPacksPanel";
import { LatexEngineSettings } from "../components/settings/LatexEngineSettings";

import { SectionHeading, Card, Toggle, FieldRow } from "./settings/SettingsWidgets";
import { checkForUpdate, UPDATER_ENABLED } from "../services/updater";
import { LatexMinimalGuide } from "../components/help/LatexMinimalGuide";
import { api } from "../lib/tauri";
// ── Layout constants ──────────────────────────────────────────────────────

const SECTIONS = [
  "language",
  "dictionary",
  "community",
  "user",
  "projects",
  "latex",
  "text",
  "help",
  "about",
] as const;

type Section = (typeof SECTIONS)[number];

const BASIC_SECTIONS: Section[] = [
  "language",
  "community",
  "latex",
  "text",
  "help",
  "about",
];

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


function LatexGuideCard() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card style={{ marginBottom: 16 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="settings-latex-guide"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: 0, color: "var(--fg-strong)", fontSize: "var(--fs-sm)", fontWeight: 600,
        }}
      >
        <span>{t("help.section_latex")}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", fontSize: 10, color: "var(--fg-muted)" }}>▼</span>
      </button>
      {open && (
        <div id="settings-latex-guide" style={{ marginTop: 14 }}>
          <LatexMinimalGuide />
        </div>
      )}
    </Card>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────

export default function SettingsView() {
  const navigate = useNavigate();
  const { section: sectionParam } = useParams<{ section?: string }>();
  const { t } = useTranslation();
  const {
    lang, userMode, uiScale, windowMode, spellLang,
    autocorrectEnabled, grammarAutoCheck, grammarEnabled,
    customDictionary, userName, userInstitution, userEmail, projectDir,
    setLang, setUserMode, setUiScale, setWindowMode, setSpellLang, setAutocorrect, setGrammarAutoCheck, setGrammarEnabled,
    addToCustomDictionary, removeFromCustomDictionary,
    setUserName, setUserInstitution, setUserEmail, setProjectDir,
  } = useSettingsStore();

  const {
    catalog, catalogLoading, catalogError,
    installed: installedPacks,
    installing, installProgress,
    loadCatalog, install: installPack, uninstall: uninstallPack, isInstalled,
  } = useLangPacksStore();

  const toast = useToast();
  const validParam = SECTIONS.includes(sectionParam as Section) ? (sectionParam as Section) : "language";
  const [activeSection, setActiveSection] = useState<Section>(validParam);
  const [newWord, setNewWord] = useState("");
  const [userSaved, setUserSaved] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "up-to-date" | "error" | "disabled">(UPDATER_ENABLED ? "idle" : "disabled");
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus("checking");
    setUpdateMsg(null);
    try {
      const result = await checkForUpdate();
      if (result.available) {
        setUpdateStatus("available");
        setUpdateMsg(result.version ?? null);
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (e) {
      setUpdateStatus("error");
      setUpdateMsg(String(e));
    }
  }, []);
  const [localName, setLocalName] = useState(userName);
  const [localInstitution, setLocalInstitution] = useState(userInstitution);
  const [localEmail, setLocalEmail] = useState(userEmail);
  const [localProjectDir, setLocalProjectDir] = useState(projectDir);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeLanguage = normalizeUiLanguage(i18n.resolvedLanguage || i18n.language || lang);

  useEffect(() => {
    if (lang !== activeLanguage) setLang(activeLanguage);
  }, [activeLanguage, lang, setLang]);

  // Load catalog when entering community section
  useEffect(() => {
    if (activeSection === "community" && !catalog && !catalogLoading) {
      loadCatalog();
    }
  }, [activeSection, catalog, catalogLoading, loadCatalog]);

  async function handleInstall(entry: LangPackEntry) {
    try {
      await installPack(entry);
    } catch (e) {
      toast.error(String(e));
    }
  }

  function pickLang(code: string) {
    const normalized = normalizeUiLanguage(code);
    ensureDynamicLocale(normalized);
    setLang(normalized);
    i18n.changeLanguage(normalized);
    const spellCode = SPELL_CHECK_LANGS[normalized];
    const installedPack = installedPacks.find((p) => p.id === normalized);
    if (spellCode !== undefined) {
      setSpellLang(spellCode);
    } else if (installedPack?.entry.capabilities.spelling) {
      setSpellLang(normalized);
    } else {
      setSpellLang(null);
    }
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

  useEffect(() => {
    if (userMode === "basic" && !BASIC_SECTIONS.includes(activeSection)) {
      setActiveSection("text");
    }
  }, [activeSection, userMode]);

  const visibleNavItems = userMode === "basic"
    ? navItems.filter((item) => BASIC_SECTIONS.includes(item.key))
    : navItems;

  const spellLanguageOptions = [
    ...SUPPORTED_LANGUAGES,
    ...installedPacks
      .filter((p) => p.entry.capabilities.ui || p.entry.capabilities.spelling)
      .map((p) => ({
        code: p.id,
        label: p.entry.native_name,
        flag: p.entry.flag,
        bundled: false,
      })),
  ].filter((entry, index, all) => all.findIndex((candidate) => candidate.code === entry.code) === index);

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
          {visibleNavItems.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="tx-unstyled-button"
              aria-current={activeSection === key ? "page" : undefined}
              onClick={() => setActiveSection(key)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: "var(--r-md)",
                fontSize: "var(--fs-base)", width: "100%", textAlign: "left",
                background: activeSection === key ? "var(--bg-selected)" : "transparent",
                color: activeSection === key ? "var(--accent-deep)" : "var(--fg-default)",
                fontWeight: activeSection === key ? 500 : 400,
              }}
            >
              {label}
            </button>
          ))}
          {userMode === "basic" && (
            <div style={{
              marginTop: 12,
              padding: "10px",
              borderRadius: "var(--r-md)",
              background: "var(--bg-panel)",
              border: "1px solid var(--border-subtle)",
              fontSize: "var(--fs-xs)",
              color: "var(--fg-muted)",
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 600, color: "var(--fg-strong)", marginBottom: 4 }}>
                {t("settings.basic_mode_title")}
              </div>
              {t("settings.basic_mode_body")}{" "}
              <strong style={{ color: "var(--fg-strong)" }}>{t("settings.text_mode_advanced")}</strong>{" "}
              {t("settings.basic_mode_suffix")}
            </div>
          )}
        </aside>

        {/* Content */}
        <main className="scroll" style={{ flex: 1, overflow: "auto", padding: "32px 48px 64px" }}>
          {userMode === "basic" && (
            <div style={{
              maxWidth: 840,
              marginBottom: 18,
              padding: "14px 16px",
              borderRadius: "var(--r-lg)",
              background: "var(--accent-tint)",
              border: "1px solid var(--accent-soft)",
              color: "var(--accent-deep)",
              fontSize: "var(--fs-sm)",
              lineHeight: 1.7,
            }}>
              {t("settings.basic_top_body")}{" "}
              <strong>{t("settings.text_mode_advanced")}</strong>.
            </div>
          )}

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
                      className={`btn ${activeLanguage === l.code ? "btn-accent" : "btn-ghost"}`}
                      style={{ gap: 6 }}
                      onClick={() => pickLang(l.code)}
                    >
                      <span style={{ fontSize: 18 }}>{l.flag}</span>
                      <span>{l.label}</span>
                      {activeLanguage === l.code && <span style={{ fontSize: 11, opacity: 0.7 }}>✓</span>}
                    </button>
                  ))}
                  {/* Community-installed UI packs */}
                  {installedPacks.filter((p) => p.entry.capabilities.ui).map((p) => (
                    <button
                      key={p.id}
                      className={`btn ${activeLanguage === p.id ? "btn-accent" : "btn-ghost"}`}
                      style={{ gap: 6 }}
                      onClick={() => pickLang(p.id)}
                    >
                      <span style={{ fontSize: 18 }}>{p.entry.flag}</span>
                      <span>{p.entry.native_name}</span>
                      {activeLanguage === p.id && <span style={{ fontSize: 11, opacity: 0.7 }}>✓</span>}
                      <span style={{ fontSize: 9, color: "var(--fg-faint)", background: "var(--border-subtle)", padding: "1px 4px", borderRadius: 3 }}>{t("settings.installed_chip")}</span>
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
                    ...spellLanguageOptions,
                  ].map((l) => {
                    const hasBundledSpell =
                      Object.prototype.hasOwnProperty.call(SPELL_CHECK_LANGS, l.code)
                      && SPELL_CHECK_LANGS[l.code] !== null;
                    const hasInstalledSpell =
                      installedPacks.some((p) => p.id === l.code && p.entry.capabilities.spelling);
                    const hasSpell = hasBundledSpell || hasInstalledSpell;
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
                        <span style={{ fontSize: "var(--fs-sm)" }}>{l.label}</span>
                        {spellLang === l.code && <span style={{ fontSize: 11, opacity: 0.7 }}>✓</span>}
                        {!hasSpell && <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>{t("settings.no_dict_chip")}</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 10, lineHeight: 1.6 }}>
                  {t("settings.spell_lang_hint_1")}{" "}
                  <span style={{ color: "var(--accent-deep)", cursor: "pointer" }} onClick={() => setActiveSection("community")}>{t("settings.section_community")}</span>{" "}
                  {t("settings.spell_lang_hint_2")}
                </div>
              </Card>
            </div>
          )}

          {activeSection === "latex" && <LatexEngineSettings />}

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
                  {t("settings.dict_format_hint")}
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
                    title={t("settings.refresh_catalog")}
                  >
                    {catalogLoading ? "…" : "↻"}
                  </button>
                </div>

                {catalogError && (
                  <div style={{ color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 12 }}>
                    {catalogError}
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
                            {t(`settings.package_status_${pkg.status}`, pkg.status)}
                          </span>
                        </div>
                        {/* Capability pills */}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {pkg.capabilities.ui && <span className="chip" style={{ fontSize: 10 }}>{t("settings.capability_ui")}</span>}
                          {pkg.capabilities.spelling && <span className="chip" style={{ fontSize: 10 }}>{t("settings.capability_spelling")}</span>}
                          {pkg.capabilities.autocorrect && <span className="chip" style={{ fontSize: 10 }}>{t("settings.capability_autocorrect")}</span>}
                          {pkg.capabilities.grammar_remote && <span className="chip" style={{ fontSize: 10 }}>{t("settings.capability_grammar")}</span>}
                          {pkg.capabilities.latex_babel && <span className="chip" style={{ fontSize: 10 }}>babel</span>}
                          {pkg.capabilities.latex_polyglossia && <span className="chip" style={{ fontSize: 10 }}>polyglossia</span>}
                          {!pkg.capabilities.spelling && (
                            <span className="chip" style={{ fontSize: 10, opacity: 0.5 }}>{t("settings.capability_no_spelling")}</span>
                          )}
                        </div>
                        {isInstalling && progress && (
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent)", marginTop: 4 }}>
                            {progress === "ui" ? t("settings.installing_ui") : progress === "spelling" ? t("settings.installing_dictionary") : progress === "autocorrect" ? t("settings.installing_rules") : "✓"}
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
                  {t("settings.user_defaults_hint")}
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
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 12, color: "var(--fg-strong)" }}>
                  {t("settings.text_mode_title")}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <button
                    className={`btn ${userMode === "basic" ? "btn-accent" : "btn-ghost"}`}
                    onClick={() => setUserMode("basic")}
                  >
                    {t("settings.text_mode_basic")}
                  </button>
                  <button
                    className={`btn ${userMode === "advanced" ? "btn-accent" : "btn-ghost"}`}
                    onClick={() => setUserMode("advanced")}
                  >
                    {t("settings.text_mode_advanced")}
                  </button>
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {userMode === "basic"
                    ? t("settings.text_mode_basic_hint")
                    : t("settings.text_mode_advanced_hint")}
                </div>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 12, color: "var(--fg-strong)" }}>
                  {t("settings.ui_scale_title")}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  {([
                    ["normal", t("settings.ui_scale_normal")],
                    ["large", t("settings.ui_scale_large")],
                    ["xlarge", t("settings.ui_scale_xlarge")],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      className={`btn ${uiScale === value ? "btn-accent" : "btn-ghost"}`}
                      onClick={() => setUiScale(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {t("settings.ui_scale_hint")}
                </div>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 12, color: "var(--fg-strong)" }}>
                  {t("settings.window_mode_title")}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  {([
                    ["default", t("settings.window_mode_default")],
                    ["remember", t("settings.window_mode_remember")],
                    ["maximized", t("settings.window_mode_maximized")],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      className={`btn ${windowMode === value ? "btn-accent" : "btn-ghost"}`}
                      onClick={() => setWindowMode(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {t("settings.window_mode_hint")}
                </div>
              </Card>

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
                  {t("settings.grammar_remote_note")}
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

              <LatexGuideCard />

              <Card>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => void api.openInSystem("https://github.com/GonzaloAndDev/TeXisStudio/wiki")}
                    style={{ padding: 0, background: "none", border: "none", cursor: "pointer", color: "var(--link)", fontSize: "var(--fs-sm)", textDecoration: "none", textAlign: "left" }}
                  >
                    {t("settings.help_docs")} →
                  </button>
                  <button
                    type="button"
                    onClick={() => void api.openInSystem("https://github.com/GonzaloAndDev/TeXisStudio/issues/new")}
                    style={{ padding: 0, background: "none", border: "none", cursor: "pointer", color: "var(--link)", fontSize: "var(--fs-sm)", textDecoration: "none", textAlign: "left" }}
                  >
                    {t("settings.help_report")} →
                  </button>
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
                    ["about_version", `v${APP_VERSION}`],
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

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCheckUpdate}
                  disabled={updateStatus === "checking" || updateStatus === "disabled"}
                >
                  <IconDownload size={13} />
                  {updateStatus === "checking"
                    ? t("settings.update_checking")
                    : t("settings.update_check_btn")}
                </button>
                {updateStatus === "disabled" && (
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                    {t("settings.update_disabled")}
                  </span>
                )}
                {updateStatus === "available" && (
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--accent)" }}>
                    {t("settings.update_available", { version: updateMsg ?? "" })}
                  </span>
                )}
                {updateStatus === "up-to-date" && (
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                    {t("settings.update_up_to_date")}
                  </span>
                )}
                {updateStatus === "error" && (
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)" }}>
                    {t("settings.update_error")}
                  </span>
                )}
              </div>

              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/about")}>
                <IconBook size={13} /> {t("settings.about_view_full")}
              </button>
            </div>
          )}

        </main>
      </div>

      <TxStatusbar items={[
        { icon: <IconSettings size={11} />, text: t("settings.title") },
        { right: true, text: `TeXisStudio v${APP_VERSION}` },
      ]} />
    </>
  );
}
