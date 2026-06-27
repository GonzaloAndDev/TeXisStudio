// Servicio del Recovery Center (Programa Industrial §2). Envuelve los comandos
// de protección de datos de `texis-platform` expuestos por Tauri. No sobrescribe
// nada salvo `restoreSnapshot`, que el usuario solicita explícitamente.

import { invokeTauri } from "../lib/tauri";

export interface JournalEntry {
  /** u128 nanosegundos, serializado como string para no perder precisión en JS. */
  seq: string;
  op: string;
  status: "begin" | "commit" | "abort";
  /** u128 nanosegundos, serializado como string (excede Number.MAX_SAFE_INTEGER). */
  unix_nanos: string;
  detail?: string;
}

export interface IntegrityIssue {
  path: string;
  kind: "missing" | "modified";
}

export interface LockInfo {
  pid: number;
  host: string;
  created_unix: number;
}

export interface RecoveryReport {
  incomplete_operations: JournalEntry[];
  leftover_temporaries: string[];
  integrity_issues: IntegrityIssue[];
  snapshots_available: number;
  lock_holder: LockInfo | null;
}

export interface SnapshotMeta {
  id: string;
  /** u128 nanosegundos, serializado como string (excede Number.MAX_SAFE_INTEGER). */
  created_unix_nanos: string;
  files: string[];
  label?: string;
}

/** Escanea el proyecto y devuelve el reporte de recuperación. */
export async function recoveryScan(projectDir: string): Promise<RecoveryReport> {
  return invokeTauri<RecoveryReport>("recovery_scan", { projectDir });
}

/** Lista los snapshots de plataforma (más reciente primero). */
export async function listSnapshots(projectDir: string): Promise<SnapshotMeta[]> {
  return invokeTauri<SnapshotMeta[]>("recovery_list_snapshots", { projectDir });
}

/** Restaura un snapshot de plataforma por id. Devuelve cuántos archivos se restauraron. */
export async function restoreSnapshot(
  projectDir: string,
  snapshotId: string,
): Promise<number> {
  return invokeTauri<number>("recovery_restore_snapshot", { projectDir, snapshotId });
}

/** Verifica la integridad del proyecto contra su manifiesto. */
export async function verifyIntegrity(
  projectDir: string,
): Promise<IntegrityIssue[]> {
  return invokeTauri<IntegrityIssue[]>("verify_integrity", { projectDir });
}

/** `true` si el reporte no tiene nada que recuperar (el lock no cuenta). */
export function isHealthy(report: RecoveryReport): boolean {
  return (
    report.incomplete_operations.length === 0 &&
    report.leftover_temporaries.length === 0 &&
    report.integrity_issues.length === 0
  );
}
