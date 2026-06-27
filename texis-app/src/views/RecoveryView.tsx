// Recovery Center — Programa Industrial §2.
// Superficie de UI para la protección de datos de `texis-platform`: muestra el
// reporte de recuperación (operaciones interrumpidas, temporales sobrantes,
// integridad), lista los snapshots transaccionales y permite restaurarlos.
// Nunca sobrescribe nada sin confirmación explícita (restoreSnapshot).

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconCheckCircle, IconClock, IconLock, IconRefresh, IconWarn,
} from "../components/Icons";
import { useConfirm } from "../components/ui/useConfirm";
import { useToast } from "../components/ui/ToastProvider";
import { useProjectStore } from "../stores/project";
import {
  isHealthy,
  listSnapshots,
  recoveryScan,
  restoreSnapshot,
  verifyIntegrity,
  type RecoveryReport,
  type SnapshotMeta,
} from "../services/recoveryCenter";

// Los timestamps llegan en nanosegundos como string (u128). Convertimos con
// BigInt para no perder precisión antes de pasar a milisegundos.
function formatNanos(nanos: string): string {
  try {
    const ms = Number(BigInt(nanos) / BigInt(1_000_000));
    return new Date(ms).toLocaleString();
  } catch {
    return nanos;
  }
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
      borderRadius: "var(--r-lg)", padding: 20, marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

export default function RecoveryView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const activeProject = useProjectStore((s) => s.activeProject);
  const activeProjectPath = useProjectStore((s) => s.activeProjectPath);

  const [report, setReport] = useState<RecoveryReport | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const [rep, snaps] = await Promise.all([recoveryScan(path), listSnapshots(path)]);
      setReport(rep);
      setSnapshots(snaps);
    } catch (e) {
      toast.error(t("recovery.error", { error: String(e) }));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (activeProjectPath) void refresh(activeProjectPath);
  }, [activeProjectPath, refresh]);

  const handleRestore = useCallback(async (snap: SnapshotMeta) => {
    if (!activeProjectPath) return;
    const ok = await confirm({
      title: t("recovery.restore_confirm_title"),
      message: t("recovery.restore_confirm_body", { when: formatNanos(snap.created_unix_nanos) }),
      confirmLabel: t("recovery.restore"),
      destructive: true,
    });
    if (!ok) return;
    setBusyId(snap.id);
    try {
      const count = await restoreSnapshot(activeProjectPath, snap.id);
      toast.success(t("recovery.restored", { count }));
      await refresh(activeProjectPath);
    } catch (e) {
      toast.error(t("recovery.error", { error: String(e) }));
    } finally {
      setBusyId(null);
    }
  }, [activeProjectPath, confirm, refresh, t, toast]);

  const handleVerify = useCallback(async () => {
    if (!activeProjectPath) return;
    setLoading(true);
    try {
      const issues = await verifyIntegrity(activeProjectPath);
      if (issues.length === 0) toast.success(t("recovery.integrity_ok"));
      else toast.warning(t("recovery.integrity_found", { count: issues.length }));
      await refresh(activeProjectPath);
    } catch (e) {
      toast.error(t("recovery.error", { error: String(e) }));
    } finally {
      setLoading(false);
    }
  }, [activeProjectPath, refresh, t, toast]);

  const projectTitle = activeProject?.metadata.title ?? t("recovery.project_fallback");
  const projectRouteId = encodeURIComponent(activeProjectPath ?? "proyecto");
  const healthy = report ? isHealthy(report) : false;

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ {projectTitle.length > 40 ? projectTitle.slice(0, 40) + "…" : projectTitle}</span></>}
        right={
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn btn-sm"
              onClick={() => activeProjectPath && refresh(activeProjectPath)}
              disabled={loading || !activeProjectPath}
            >
              <IconRefresh size={12} /> {loading ? t("recovery.scanning") : t("recovery.refresh")}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${projectRouteId}`)}>
              {t("recovery.back_to_editor")}
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "32px 48px", background: "var(--bg-app)" }} className="scroll">
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
              {t("recovery.title")}
            </h1>
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4, maxWidth: 620, lineHeight: 1.6 }}>
              {t("recovery.subtitle")}
            </p>
          </div>

          {!activeProjectPath && (
            <Section>
              <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", margin: 0 }}>
                {t("recovery.no_project")}
              </p>
            </Section>
          )}

          {/* ── Estado de salud ── */}
          {report && (
            <Section>
              {healthy ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--build-ok)" }}>
                  <IconCheckCircle size={20} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--fg-strong)" }}>{t("recovery.healthy_title")}</div>
                    <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>{t("recovery.healthy_body")}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, color: "var(--build-warn)" }}>
                    <IconWarn size={18} />
                    <span style={{ fontWeight: 600, color: "var(--fg-strong)" }}>{t("recovery.issues_title")}</span>
                  </div>
                  {report.incomplete_operations.length > 0 && (
                    <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", margin: "0 0 8px" }}>
                      <strong>{t("recovery.incomplete_ops")}:</strong> {report.incomplete_operations.length} — {t("recovery.incomplete_ops_desc")}
                    </p>
                  )}
                  {report.leftover_temporaries.length > 0 && (
                    <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", margin: "0 0 8px" }}>
                      <strong>{t("recovery.leftover_temps")}:</strong> {report.leftover_temporaries.join(", ")}
                    </p>
                  )}
                  {report.integrity_issues.length > 0 && (
                    <ul style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", margin: "0 0 4px", paddingLeft: 18 }}>
                      {report.integrity_issues.map((iss) => (
                        <li key={iss.path}>
                          <code>{iss.path}</code> — {iss.kind === "missing" ? t("recovery.integrity_missing") : t("recovery.integrity_modified")}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {report.lock_holder && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
                  <IconLock size={14} />
                  {t("recovery.lock_held", { pid: report.lock_holder.pid, host: report.lock_holder.host })}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <button className="btn btn-sm btn-ghost" onClick={handleVerify} disabled={loading}>
                  {t("recovery.verify_integrity")}
                </button>
              </div>
            </Section>
          )}

          {/* ── Snapshots ── */}
          <Section>
            <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 500, margin: "0 0 4px", color: "var(--fg-strong)" }}>
              {t("recovery.snapshots_title")}
            </h2>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
              {t("recovery.snapshots_subtitle")}
            </p>

            {snapshots.length === 0 ? (
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", margin: 0 }}>
                {t("recovery.no_snapshots")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {snapshots.map((snap) => (
                  <div key={snap.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                    padding: "10px 14px", background: "var(--bg-app)",
                    border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
                        <IconClock size={13} />
                        {formatNanos(snap.created_unix_nanos)}
                        {snap.label && (
                          <span style={{ fontSize: 11, color: "var(--fg-muted)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: 99, padding: "1px 8px" }}>
                            {snap.label === "pre-save" ? t("recovery.label_presave") : snap.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t("recovery.files_count", { count: snap.files.length })}: {snap.files.join(", ")}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleRestore(snap)}
                      disabled={busyId !== null || !activeProjectPath}
                      style={{ flexShrink: 0 }}
                    >
                      {busyId === snap.id ? t("recovery.restoring") : t("recovery.restore")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      <TxStatusbar items={[
        { text: t("recovery.statusbar_snapshots", { count: snapshots.length }) },
        { text: healthy ? t("recovery.statusbar_healthy") : t("recovery.statusbar_attention") },
      ]} />
    </>
  );
}
