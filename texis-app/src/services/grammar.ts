const LT_API = "https://api.languagetool.org/v2/check";

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
}

export async function checkGrammar(text: string, ltLang: string): Promise<GrammarResult> {
  const body = new URLSearchParams({ text, language: ltLang, enabledOnly: "false" });
  const res = await fetch(LT_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`LanguageTool API error: ${res.status}`);

  const data = await res.json();

  return {
    language: (data.language?.name as string) ?? ltLang,
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
