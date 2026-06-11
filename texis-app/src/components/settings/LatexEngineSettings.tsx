import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/tauri";
import type { LatexBackend } from "../../lib/latexBackendPreference";
import { useProjectStore } from "../../stores/project";
import { useSettingsStore } from "../../stores/settings";
import { Card, SectionHeading, Toggle } from "../../views/settings/SettingsWidgets";

export function LatexEngineSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { latexInfo, setLatexInfo } = useProjectStore();
  const { latexPrimaryBackend, latexAllowFallback, setLatexPrimaryBackend, setLatexAllowFallback } = useSettingsStore();
  const [checking, setChecking] = useState(latexInfo === null);

  function refresh() {
    setChecking(true);
    api.detectLatex().then(setLatexInfo).finally(() => setChecking(false));
  }

  useEffect(() => {
    if (!latexInfo) refresh();
  }, []);

  const options: Array<{ id: LatexBackend; title: string; description: string; available: boolean; version?: string }> = [
    {
      id: "tectonic",
      title: t("settings.latex_tectonic_title"),
      description: t("settings.latex_tectonic_description"),
      available: latexInfo?.has_tectonic ?? false,
      version: latexInfo?.tectonic_version,
    },
    {
      id: "latexmk",
      title: t("settings.latex_suite_title"),
      description: t("settings.latex_suite_description"),
      available: latexInfo?.latexmk_usable ?? false,
      version: latexInfo?.latexmk_version,
    },
  ];

  return (
    <div>
      <SectionHeading>{t("settings.section_latex")}</SectionHeading>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "var(--fs-base)", fontWeight: 600, color: "var(--fg-strong)" }}>
          {t("settings.latex_primary_title")}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 4, lineHeight: 1.6 }}>
          {t("settings.latex_primary_hint")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 16 }}>
          {options.map((option) => {
            const selected = latexPrimaryBackend === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className="tx-unstyled-button"
                onClick={() => setLatexPrimaryBackend(option.id)}
                aria-pressed={selected}
                style={{
                  textAlign: "left", padding: 16, borderRadius: "var(--r-lg)",
                  border: `1px solid ${selected ? "var(--accent)" : "var(--border-soft)"}`,
                  background: selected ? "var(--accent-tint)" : "var(--bg-surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <strong style={{ color: "var(--fg-strong)" }}>{option.title}</strong>
                  <span style={{ fontSize: "var(--fs-xs)", color: option.available ? "var(--build-ok)" : "var(--fg-faint)" }}>
                    {option.available ? t("settings.latex_available") : t("settings.latex_not_available")}
                  </span>
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 8, lineHeight: 1.5 }}>
                  {option.description}
                </div>
                {option.version && (
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 8 }}>
                    {t("settings.latex_detected_version", { version: option.version })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Toggle
          checked={latexAllowFallback}
          onChange={setLatexAllowFallback}
          label={t("settings.latex_fallback_title")}
          hint={t("settings.latex_fallback_hint")}
        />
      </Card>

      <Card>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
          {t("settings.latex_install_hint")}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={refresh} disabled={checking}>
            {checking ? t("settings.latex_checking") : t("settings.latex_refresh")}
          </button>
          <button type="button" className="btn btn-accent btn-sm" onClick={() => navigate("/setup-latex")}>
            {t("settings.latex_manage_installation")}
          </button>
        </div>
      </Card>
    </div>
  );
}
