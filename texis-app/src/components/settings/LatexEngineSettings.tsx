import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/tauri";
import type { LatexBackend } from "../../lib/latexBackendPreference";
import { getBestAvailableBackend } from "../../lib/latexBackendPreference";
import { useProjectStore } from "../../stores/project";
import { useSettingsStore } from "../../stores/settings";
import { Card, SectionHeading, Toggle } from "../../views/settings/SettingsWidgets";

type Platform = "macos" | "windows" | "linux" | string;

function getSuiteName(platform: Platform): string {
  if (platform === "macos")   return "MacTeX";
  if (platform === "windows") return "MiKTeX";
  return "TeX Live";
}

export function LatexEngineSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { latexInfo, setLatexInfo } = useProjectStore();
  const {
    latexPrimaryBackend, latexAllowFallback, latexBackendUserExplicit,
    setLatexPrimaryBackend, setLatexAllowFallback, setLatexBackendUserExplicit,
  } = useSettingsStore();

  const [checking, setChecking] = useState(latexInfo === null);
  const [platform, setPlatform] = useState<Platform>("linux");

  useEffect(() => {
    api.getPlatform().then(setPlatform).catch(() => {});
  }, []);

  function refresh() {
    setChecking(true);
    api.detectLatex()
      .then((info) => {
        setLatexInfo(info);
        // Auto-select the most powerful engine if the user never explicitly chose
        if (!latexBackendUserExplicit) {
          const best = getBestAvailableBackend(info);
          if (best !== latexPrimaryBackend) {
            setLatexPrimaryBackend(best);
          }
        }
      })
      .finally(() => setChecking(false));
  }

  function handleSelectBackend(id: LatexBackend) {
    setLatexBackendUserExplicit(true);
    setLatexPrimaryBackend(id);
  }

  useEffect(() => {
    if (!latexInfo) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suiteName = getSuiteName(platform);

  // Upgrade suggestion: user explicitly chose Tectonic but latexmk is now available
  const showUpgradeBanner =
    latexBackendUserExplicit &&
    latexPrimaryBackend === "tectonic" &&
    (latexInfo?.latexmk_usable ?? false);

  const options: Array<{
    id: LatexBackend;
    title: string;
    description: string;
    available: boolean;
    version?: string;
    isBest: boolean;
  }> = [
    {
      id: "tectonic",
      title: t("settings.latex_tectonic_title"),
      description: t("settings.latex_tectonic_description"),
      available: latexInfo?.has_tectonic ?? false,
      version: latexInfo?.tectonic_version,
      isBest: !(latexInfo?.latexmk_usable ?? false),
    },
    {
      id: "latexmk",
      title: t("settings.latex_suite_title_os", { suiteName }),
      description: t("settings.latex_suite_description", { suiteName }),
      available: latexInfo?.latexmk_usable ?? false,
      version: latexInfo?.latexmk_version,
      isBest: latexInfo?.latexmk_usable ?? false,
    },
  ];

  return (
    <div>
      <SectionHeading>{t("settings.section_latex")}</SectionHeading>

      {/* Upgrade banner */}
      {showUpgradeBanner && (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--r-md)", marginBottom: 16,
          background: "color-mix(in srgb, var(--build-ok) 10%, var(--bg-panel))",
          border: "1px solid var(--build-ok)",
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <span style={{ fontSize: 16 }}>⬆</span>
          <div style={{ flex: 1, fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.5 }}>
            {t("settings.latex_upgrade_banner", { suiteName })}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-accent"
            onClick={() => handleSelectBackend("latexmk")}
            style={{ flexShrink: 0 }}
          >
            {t("settings.latex_upgrade_btn", { suiteName })}
          </button>
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "var(--fs-base)", fontWeight: 600, color: "var(--fg-strong)" }}>
          {t("settings.latex_primary_title")}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 4, lineHeight: 1.6 }}>
          {t("settings.latex_primary_hint")}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {options.map((option) => {
            const selected = latexPrimaryBackend === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className="tx-unstyled-button"
                onClick={() => handleSelectBackend(option.id)}
                aria-pressed={selected}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 20,
                  textAlign: "left", padding: "20px 22px", borderRadius: "var(--r-lg)",
                  border: `1px solid ${selected ? "var(--accent)" : "var(--border-soft)"}`,
                  background: selected ? "var(--accent-tint)" : "var(--bg-surface)",
                }}
              >
                {/* Left: name + badges */}
                <div style={{ width: 150, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <strong style={{ color: "var(--fg-strong)", fontSize: "var(--fs-base)" }}>{option.title}</strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                    {option.isBest && option.available && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: "var(--r-xs)", background: "var(--build-ok)", color: "#fff", whiteSpace: "nowrap" }}>
                        {t("settings.latex_recommended_badge")}
                      </span>
                    )}
                    <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: option.available ? "var(--build-ok)" : "var(--fg-faint)", whiteSpace: "nowrap" }}>
                      {option.available ? t("settings.latex_available") : t("settings.latex_not_available")}
                    </span>
                  </div>
                </div>
                {/* Middle: description */}
                <div style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.65 }}>
                  {option.description}
                  {!option.available && option.id === "latexmk" && (
                    <div style={{ marginTop: 8, color: "var(--fg-faint)", fontStyle: "italic" }}>
                      {t("settings.latex_suite_install_hint", { suiteName })}
                    </div>
                  )}
                </div>
                {/* Right: detected version */}
                {option.version && (
                  <div style={{ width: 130, flexShrink: 0, fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.5 }}>
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
