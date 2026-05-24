import React, { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { IconSettings, IconBook, IconFolder } from "../components/Icons";
import { SUPPORTED_LANGUAGES, SPELL_CHECK_LANGS } from "../i18n/index";
import i18n from "../i18n/index";
import { useSettingsStore } from "../stores/settings";

// ── Community package registry (points to repo community/ directory) ──────
interface CommunityPkg {
  id: string;
  type: "dictionary" | "locale";
  lang: string;
  label: string;
  description: string;
  repoPath: string;
}

const COMMUNITY_PACKAGES: CommunityPkg[] = [
  // placeholder — real entries come from community/dictionaries/index.json in the repo
];

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

  const validParam = SECTIONS.includes(sectionParam as Section) ? (sectionParam as Section) : "language";
  const [activeSection, setActiveSection] = useState<Section>(validParam);
  const [newWord, setNewWord] = useState("");
  const [userSaved, setUserSaved] = useState(false);
  const [localName, setLocalName] = useState(userName);
  const [localInstitution, setLocalInstitution] = useState(userInstitution);
  const [localEmail, setLocalEmail] = useState(userEmail);
  const [localProjectDir, setLocalProjectDir] = useState(projectDir);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 12, color: "var(--fg-strong)" }}>
                  {t("settings.spell_language")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SUPPORTED_LANGUAGES.map((l) => {
                    const hasSpell = SPELL_CHECK_LANGS[l.code] !== null;
                    return (
                      <button
                        key={l.code}
                        className={`btn ${spellLang === l.code ? "btn-accent" : hasSpell ? "btn-ghost" : ""}`}
                        style={{ gap: 6, opacity: hasSpell ? 1 : 0.4, cursor: hasSpell ? "pointer" : "not-allowed" }}
                        onClick={() => hasSpell && setSpellLang(SPELL_CHECK_LANGS[l.code])}
                        title={hasSpell ? l.label : t("settings.spell_not_supported")}
                        disabled={!hasSpell}
                      >
                        <span style={{ fontSize: 18 }}>{l.flag}</span>
                        <span>{l.code.toUpperCase()}</span>
                        {spellLang === l.code && <span style={{ fontSize: 11, opacity: 0.7 }}>✓</span>}
                        {!hasSpell && <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>—</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 10 }}>
                  {t("settings.spell_not_supported")} (中文, 日本語)
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

              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--fg-strong)", marginBottom: 6 }}>
                  {t("settings.community_title")}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                  {t("settings.community_subtitle")}
                </div>

                {COMMUNITY_PACKAGES.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "32px 16px",
                    border: "1px dashed var(--border-firm)", borderRadius: "var(--r-md)",
                    color: "var(--fg-muted)", fontSize: "var(--fs-sm)",
                  }}>
                    {t("settings.community_none")}
                  </div>
                ) : (
                  COMMUNITY_PACKAGES.map((pkg) => (
                    <div key={pkg.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 0", borderBottom: "1px solid var(--border-subtle)",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)", color: "var(--fg-default)" }}>
                          {pkg.label}
                        </div>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                          {pkg.description}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm">{t("settings.community_download")}</button>
                    </div>
                  ))
                )}
              </Card>

              <Card style={{ background: "var(--accent-tint)", border: "1px solid var(--accent-soft)" }}>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.7 }}>
                  {t("settings.community_contribute")}
                </div>
                <div style={{ marginTop: 10 }}>
                  <a
                    href="https://github.com/GonzaloAndDev/TeXisStudio/tree/main/community"
                    style={{ fontSize: "var(--fs-sm)", color: "var(--accent)", fontFamily: "var(--font-mono)", textDecoration: "none" }}
                    target="_blank" rel="noreferrer"
                  >
                    github.com/GonzaloAndDev/TeXisStudio/community →
                  </a>
                </div>
              </Card>
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
