// Auto-update is intentionally disabled until a signing keypair is provisioned
// and a release server is set up. The button in Settings is kept for future use.

export const UPDATER_ENABLED = false;

export interface UpdateCheckResult {
  available: boolean;
  version?: string;
  body?: string;
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  return { available: false };
}
