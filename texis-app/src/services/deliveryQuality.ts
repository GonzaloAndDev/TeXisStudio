// Servicio de la Compuerta Única de Calidad (Plan Integral §1).
// Espejo del `DeliveryQualityReport` de texis-core: una sola fuente de verdad
// que combina validación, postflight del PDF, diagnóstico del log y confianza
// del perfil, con compuertas por modo de entrega. Es exactamente lo que
// `export_delivery` usa para bloquear, así la UI muestra lo que la exportación
// va a exigir.

import { invokeTauri } from "../lib/tauri";

export type QualitySeverity = "error" | "warning" | "info";

export type QualityDimension =
  | "completeness"
  | "validation"
  | "bibliography"
  | "latex_log"
  | "postflight"
  | "visual_pdf"
  | "profile_trust";

export interface QualityFinding {
  dimension: QualityDimension;
  severity: QualitySeverity;
  code: string;
  message: string;
  suggestion?: string;
  location?: string;
}

export interface GateStatus {
  passed: boolean;
  blocking_codes: string[];
  score: number;
}

export interface ProfileTrustSummary {
  status: string;
  recommended_for_final: boolean;
  note?: string;
}

export interface RepairAction {
  code: string;
  title: string;
  action: string;
  target?: string;
}

export interface DeliveryQualityReport {
  findings: QualityFinding[];
  error_count: number;
  warning_count: number;
  info_count: number;
  score: number;
  repair_actions: RepairAction[];
  draft_gate: GateStatus;
  review_gate: GateStatus;
  final_gate: GateStatus;
  profile_trust: ProfileTrustSummary;
}

export type DeliveryMode = "draft" | "review" | "final";

/** Obtiene el reporte unificado de calidad de entrega para el proyecto. */
export async function deliveryQualityReport(
  projectPath: string,
): Promise<DeliveryQualityReport> {
  return invokeTauri<DeliveryQualityReport>("delivery_quality_report", { projectPath });
}

/** Devuelve la compuerta correspondiente a un modo de entrega. */
export function gateForMode(report: DeliveryQualityReport, mode: DeliveryMode): GateStatus {
  switch (mode) {
    case "final":
      return report.final_gate;
    case "review":
      return report.review_gate;
    default:
      return report.draft_gate;
  }
}

/** Hallazgos que bloquean un modo dado (para explicar cada bloqueo). */
export function blockingFindings(
  report: DeliveryQualityReport,
  mode: DeliveryMode,
): QualityFinding[] {
  const gate = gateForMode(report, mode);
  return report.findings.filter((f) => gate.blocking_codes.includes(f.code));
}
