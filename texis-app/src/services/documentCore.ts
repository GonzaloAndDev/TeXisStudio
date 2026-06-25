// Servicio puente con el NÚCLEO DOCUMENTAL NUEVO (Plan Maestro A→J).
//
// React consume el mismo caso de uso de ensamblado que la CLI a través del
// comando Tauri `document_build`. No compila a PDF: importa el proyecto al
// DocumentIR, ejecuta el pipeline bloqueante y devuelve diagnósticos, plan,
// capacidades y manifiesto para mostrarlos en la UI.

import { invoke } from "@tauri-apps/api/core";

/** Modo de build del núcleo nuevo. */
export type BuildMode = "draft" | "review" | "final";

/** Diagnóstico estructurado emitido por el dominio (códigos estables). */
export interface DocumentDiagnostic {
  code: string;
  module: string;
  severity: "error" | "warning" | "info" | "hint";
  stage: string;
  message_key: string;
  params?: Record<string, string>;
  blocking: boolean;
}

/** Resultado del ensamblado para la UI. */
export interface DocumentBuildResult {
  usable: boolean;
  blocked: boolean;
  mode: BuildMode;
  diagnostics: DocumentDiagnostic[];
  phases: string[];
  capabilities: string[];
  manifest: unknown | null;
}

/**
 * Ejecuta el pipeline del núcleo nuevo sobre un proyecto.
 *
 * @param projectDir Ruta de la carpeta del proyecto (contiene tesis.project.yaml).
 * @param mode `draft` itera con diagnósticos; `review`/`final` bloquean ante
 *             diagnósticos críticos.
 */
export async function documentBuild(
  projectDir: string,
  mode: BuildMode = "draft",
): Promise<DocumentBuildResult> {
  return invoke<DocumentBuildResult>("document_build", {
    projectDir,
    mode,
  });
}

/** Diagnósticos bloqueantes (errores) del resultado. */
export function blockingDiagnostics(
  result: DocumentBuildResult,
): DocumentDiagnostic[] {
  return result.diagnostics.filter((d) => d.blocking);
}
