import type { ReactNode } from "react";
import { APP_VERSION } from "../version";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook,
  IconCheck,
  IconFile,
  IconInfo,
  IconWarn,
} from "../components/Icons";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: "var(--fs-xs)",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--fg-faint)",
        marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoCard({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  const palette = {
    neutral: {
      background: "var(--bg-panel)",
      border: "1px solid var(--border-soft)",
      icon: <IconInfo size={13} style={{ color: "var(--accent)" }} />,
    },
    ok: {
      background: "var(--build-ok-tint)",
      border: "1px solid var(--build-ok)",
      icon: <IconCheck size={13} sw={2.5} style={{ color: "var(--build-ok)" }} />,
    },
    warn: {
      background: "color-mix(in srgb, var(--build-warn) 10%, var(--bg-panel))",
      border: "1px solid var(--build-warn)",
      icon: <IconWarn size={13} style={{ color: "var(--build-warn)" }} />,
    },
  } as const;

  const current = palette[tone];

  return (
    <div style={{
      padding: "14px 16px",
      background: current.background,
      border: current.border,
      borderRadius: "var(--r-md)",
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{current.icon}</div>
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.65 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function SimpleList({
  items,
}: {
  items: string[];
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((item) => (
        <div key={item} style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontSize: "var(--fs-sm)",
          color: "var(--fg-muted)",
          lineHeight: 1.6,
        }}>
          <span style={{ color: "var(--build-ok)", fontSize: 13, lineHeight: 1 }}>✓</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function AboutView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const capabilities = [
    t("about.capability_structure"),
    t("about.capability_profiles"),
    t("about.capability_citations"),
    t("about.capability_health"),
    t("about.capability_exports"),
  ];

  const boundaries = [
    t("about.boundary_institution"),
    t("about.boundary_profiles"),
    t("about.boundary_quality"),
  ];

  const stack = [
    t("about.stack_app"),
    t("about.stack_core"),
    t("about.stack_profiles"),
    t("about.stack_language"),
  ];

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ {t("about.title")}</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>← {t("library.back_home").replace("← ", "")}</button>}
      />

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-app)" }} className="scroll">
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 42 }}>
            <div style={{ marginBottom: 16 }}>
              <TxLogo size={32} />
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-3xl)",
              fontWeight: 400,
              color: "var(--fg-strong)",
              margin: "0 0 10px",
              letterSpacing: "-0.02em",
            }}>
              TeXis<em style={{ fontStyle: "italic", color: "var(--detail)" }}>Studio</em>
            </h1>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
              v{APP_VERSION} · {t("about.tagline")}
            </div>
            <div style={{
              marginTop: 18,
              padding: "14px 18px",
              background: "var(--accent-tint)",
              borderRadius: "var(--r-md)",
              fontSize: "var(--fs-sm)",
              color: "var(--accent-deep)",
              lineHeight: 1.7,
            }}>
              {t("about.hero")}
            </div>
          </div>

          <Section title={t("about.what_is")}>
            <InfoCard
              title={t("about.what_is_card_title")}
              tone="ok"
              body={t("about.what_is_card_body")}
            />
          </Section>

          <Section title={t("about.capabilities_title")}>
            <SimpleList items={capabilities} />
          </Section>

          <Section title={t("about.boundaries_title")}>
            <InfoCard
              title={t("about.boundaries_card_title")}
              tone="warn"
              body={<SimpleList items={boundaries} />}
            />
          </Section>

          <Section title={t("about.stack_title")}>
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)" }}>
              <SimpleList items={stack} />
            </div>
          </Section>

          <Section title={t("about.maturity_title")}>
            <div style={{ display: "grid", gap: 12 }}>
              <InfoCard
                title={t("about.maturity_strong_title")}
                tone="ok"
                body={t("about.maturity_strong_body")}
              />
              <InfoCard
                title={t("about.maturity_transition_title")}
                body={t("about.maturity_transition_body")}
              />
              <InfoCard
                title={t("about.maturity_honest_title")}
                tone="warn"
                body={t("about.maturity_honest_body")}
              />
            </div>
          </Section>

          <Section title={t("about.authorship_title")}>
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
              <div style={{ marginBottom: 8, color: "var(--fg-strong)", fontWeight: 600 }}>
                Gonzalo Andrade Estrella
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                {t("about.main_repo")}:{" "}
                <a href="https://github.com/GonzaloAndDev/TeXisStudio" target="_blank" rel="noreferrer" style={{ color: "var(--link)", textDecoration: "none" }}>
                  GonzaloAndDev/TeXisStudio
                </a>
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                GitHub:{" "}
                <a href="https://github.com/GonzaloAndDev" target="_blank" rel="noreferrer" style={{ color: "var(--link)", textDecoration: "none" }}>
                  @GonzaloAndDev
                </a>
              </div>
            </div>
          </Section>

          <Section title={t("about.license_title")}>
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--fg-strong)" }}>
                AGPL v3 + Commons Clause
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                {t("about.license_body")}
              </div>
            </div>
          </Section>
        </div>
      </div>

      <TxStatusbar items={[
        { icon: <IconBook size={11} />, text: `TeXisStudio v${APP_VERSION}` },
        { icon: <IconFile size={11} />, text: t("about.statusbar_guided") },
        { right: true, text: "github.com/GonzaloAndDev/TeXisStudio" },
      ]} />
    </>
  );
}
