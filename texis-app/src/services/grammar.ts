const LT_API = "https://api.languagetool.org/v2/check";

/**
 * Hard cap for a single LanguageTool request. The public LT API rejects
 * payloads above this with HTTP 413; clamping client-side gives a clearer
 * error than a confusing 413 and avoids wasted bandwidth on huge sections.
 * Conservatively below LT's documented 20 000 char default for anonymous
 * users so language packs which proxy through us still have headroom.
 */
const LT_MAX_TEXT_LENGTH = 18_000;

/** Network timeout for a single LT request. */
const LT_TIMEOUT_MS = 30_000;

export interface GrammarMatch {
  message: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId: string;
  category: string;
  context: string;
  contextOffset: number;
}

export interface GrammarResult {
  matches: GrammarMatch[];
  language: string;
  /** True when the input was clamped — the offsets refer to the clamped text. */
  truncated?: boolean;
}

export async function checkGrammar(
  text: string,
  ltLang: string,
  signal?: AbortSignal,
): Promise<GrammarResult> {
  const truncated = text.length > LT_MAX_TEXT_LENGTH;
  const safeText = truncated ? text.slice(0, LT_MAX_TEXT_LENGTH) : text;
  const body = new URLSearchParams({ text: safeText, language: ltLang, enabledOnly: "false" });

  // Compose caller's signal with our timeout so either can cancel the request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(LT_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error(`LanguageTool timeout (${LT_TIMEOUT_MS} ms)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }

  if (!res.ok) throw new Error(`LanguageTool API error: ${res.status}`);

  const data = await res.json();

  return {
    language: (data.language?.name as string) ?? ltLang,
    truncated,
    matches: (data.matches ?? []).map((m: Record<string, unknown>) => ({
      message: m.message as string,
      offset: m.offset as number,
      length: m.length as number,
      replacements: ((m.replacements as { value: string }[]) ?? []).map((r) => r.value).slice(0, 5),
      ruleId: (m.rule as { id: string })?.id ?? "",
      category: (m.rule as { category: { id: string } })?.category?.id ?? "",
      context: (m.context as { text: string })?.text ?? "",
      contextOffset: (m.context as { offset: number })?.offset ?? 0,
    })),
  };
}

export function applyReplacement(text: string, match: GrammarMatch, replacement: string): string {
  return text.slice(0, match.offset) + replacement + text.slice(match.offset + match.length);
}
