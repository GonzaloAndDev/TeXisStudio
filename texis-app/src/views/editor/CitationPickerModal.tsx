import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconCheck, IconSearch, IconX } from "../../components/Icons";
import { api } from "../../lib/tauri";
import type { BatchDoiResult, BibReference, ZoteroImportResult, ZoteroItem, ZoteroStatus } from "../../types";

// ── Pure helpers (exported for testing) ──────────────────────────

export function matchesCitationQuery(ref: BibReference, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    ref.key.toLowerCase().includes(q) ||
    ref.title.toLowerCase().includes(q) ||
    ref.author.toLowerCase().includes(q) ||
    ref.year.includes(q)
  );
}

// ── CitationPickerModal ───────────────────────────────────────────

export function CitationPickerModal({
  refs,
  onInsert,
  onClose,
  projectPath,
  onBibUpdated,
}: {
  refs: BibReference[];
  onInsert: (ref: BibReference) => void;
  onClose: () => void;
  projectPath: string | null;
  onBibUpdated: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [citationType, setCitationType] = useState<"parenthetical" | "narrative" | "footnote">("parenthetical");
  const inputRef = useRef<HTMLInputElement>(null);
  const doiInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Panel importación: modo "single" | "batch" | "zotero"
  const [doiMode, setDoiMode] = useState<"single" | "batch" | "zotero">("single");

  // Single DOI
  const [doiInput, setDoiInput] = useState("");
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiResult, setDoiResult] = useState<string | null>(null);
  const [doiError, setDoiError] = useState<string | null>(null);
  const [doiSaved, setDoiSaved] = useState(false);

  // Batch DOI
  const [batchInput, setBatchInput] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchDoiResult[]>([]);
  const [batchSaved, setBatchSaved] = useState<Set<string>>(new Set());

  // Zotero
  const [zoteroStatus, setZoteroStatus] = useState<ZoteroStatus | null>(null);
  const [zoteroChecked, setZoteroChecked] = useState(false);
  const [zoteroQuery, setZoteroQuery] = useState("");
  const [zoteroItems, setZoteroItems] = useState<ZoteroItem[]>([]);
  const [zoteroLoading, setZoteroLoading] = useState(false);
  const [zoteroSelected, setZoteroSelected] = useState<Set<string>>(new Set());
  const [zoteroImporting, setZoteroImporting] = useState(false);
  const [zoteroSaved, setZoteroSaved] = useState<Set<string>>(new Set());
  const [zoteroImportResults, setZoteroImportResults] = useState<ZoteroImportResult[]>([]);

  const checkZotero = async () => {
    setZoteroChecked(false);
    const status = await api.checkZoteroStatus().catch(() => ({ available: false, version: null, message: t("citation.error_connect") }));
    setZoteroStatus(status);
    setZoteroChecked(true);
    if (status.available) {
      handleZoteroSearch("");
    }
  };

  const handleZoteroSearch = async (q: string) => {
    setZoteroLoading(true);
    try {
      const items = await api.searchZotero(q);
      setZoteroItems(items);
    } catch {
      setZoteroItems([]);
    } finally {
      setZoteroLoading(false);
    }
  };

  const toggleZoteroSelect = (key: string) => {
    setZoteroSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleZoteroImport = async () => {
    if (!projectPath || zoteroSelected.size === 0) return;
    setZoteroImporting(true);
    try {
      const results = await api.importZoteroItems([...zoteroSelected]);
      setZoteroImportResults(results);
      const newSaved = new Set(zoteroSaved);
      for (const r of results) {
        if (r.bibtex && !r.error) {
          try {
            await api.appendBibEntry(projectPath, r.bibtex);
            newSaved.add(r.key);
          } catch { /* duplicado u otro error — no fatal */ }
        }
      }
      setZoteroSaved(newSaved);
      if (newSaved.size > 0) {
        onBibUpdated();
        setZoteroSelected(new Set());
      }
    } finally {
      setZoteroImporting(false);
    }
  };

  const handleDoiLookup = async () => {
    if (!doiInput.trim()) return;
    setDoiLoading(true);
    setDoiResult(null);
    setDoiError(null);
    setDoiSaved(false);
    try {
      const bibtex = await api.importDoi(doiInput.trim());
      setDoiResult(bibtex);
    } catch (e) {
      setDoiError(String(e));
    } finally {
      setDoiLoading(false);
    }
  };

  const handleDoiSave = async () => {
    if (!doiResult || !projectPath) return;
    try {
      await api.appendBibEntry(projectPath, doiResult);
      setDoiSaved(true);
      onBibUpdated();
    } catch (e) {
      setDoiError(String(e));
    }
  };

  const handleBatchImport = async () => {
    const dois = batchInput.split(/[\n,;]+/).map((d) => d.trim()).filter(Boolean);
    if (!dois.length) return;
    setBatchLoading(true);
    setBatchResults([]);
    setBatchSaved(new Set());
    try {
      const results = await api.importDoisBatch(dois);
      setBatchResults(results);
    } catch (e) {
      setBatchResults([{ doi: "—", error: String(e) }]);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchSaveOne = async (r: BatchDoiResult) => {
    if (!r.bibtex || !projectPath) return;
    try {
      await api.appendBibEntry(projectPath, r.bibtex);
      setBatchSaved((prev) => new Set([...prev, r.doi]));
      onBibUpdated();
    } catch (e) {
      setBatchResults((prev) =>
        prev.map((x) => x.doi === r.doi ? { ...x, error: String(e) } : x)
      );
    }
  };

  const handleBatchSaveAll = async () => {
    if (!projectPath) return;
    for (const r of batchResults) {
      if (r.bibtex && !batchSaved.has(r.doi)) {
        await handleBatchSaveOne(r);
      }
    }
  };

  const filtered = refs.filter((r) => matchesCitationQuery(r, query));

  const typeLabel: Record<string, string> = {
    parenthetical: "\\parencite",
    narrative:     "\\textcite",
    footnote:      "\\footcite",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 100, zIndex: 900,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 580, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--border-firm)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", flex: 1 }}>
            {t("citation.insert_title")}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)" }}>
            <IconX size={14} />
          </button>
        </div>

        {/* Tipo de cita */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginRight: 4 }}>{t("citation.type")}:</span>
          {(["parenthetical", "narrative", "footnote"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setCitationType(t)}
              className={`btn btn-sm ${citationType === t ? "btn-accent" : "btn-ghost"}`}
              style={{ fontSize: 11, fontFamily: "var(--font-mono)", padding: "3px 10px" }}
            >
              {citationType === t && <IconCheck size={9} sw={2.5} />}
              {typeLabel[t]}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
          <IconSearch size={13} style={{ color: "var(--fg-faint)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("citation.search_placeholder")}
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: "var(--fs-sm)", color: "var(--fg-strong)",
            }}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          />
        </div>

        {/* Panel importar por DOI — tabulado: único / múltiples */}
        <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-subtle)" }}>
          {/* Pestañas */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", padding: "0 16px" }}>
            {(["single", "batch", "zotero"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setDoiMode(m);
                  if (m === "zotero" && !zoteroChecked) checkZotero();
                }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 12px", fontSize: "var(--fs-xs)", fontWeight: doiMode === m ? 600 : 400,
                  color: doiMode === m ? "var(--accent)" : "var(--fg-muted)",
                  borderBottom: doiMode === m ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {m === "single" ? t("citation.single_doi") : m === "batch" ? t("citation.multiple_dois") : "Zotero"}
              </button>
            ))}
          </div>

          {doiMode === "single" && (
            <div style={{ padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  ref={doiInputRef}
                  value={doiInput}
                  onChange={(e) => { setDoiInput(e.target.value); setDoiResult(null); setDoiError(null); setDoiSaved(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleDoiLookup(); }}
                  placeholder="10.1000/xyz123 o https://doi.org/…"
                  style={{
                    flex: 1, border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)",
                    padding: "5px 8px", fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
                    background: "var(--bg-chrome)", color: "var(--fg-strong)", outline: "none",
                  }}
                />
                <button
                  onClick={handleDoiLookup}
                  disabled={doiLoading || !doiInput.trim()}
                  className="btn btn-sm btn-accent"
                  style={{ fontSize: 11, whiteSpace: "nowrap" }}
                >
                  {doiLoading ? t("common.loading") : t("common.search")}
                </button>
              </div>
              {doiError && (
                <div style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: "var(--build-err)", background: "var(--build-err-tint)", borderRadius: "var(--r-xs)", padding: "4px 8px" }}>
                  {doiError}
                </div>
              )}
              {doiResult && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    readOnly value={doiResult} rows={4}
                    style={{
                      width: "100%", resize: "none", fontFamily: "var(--font-mono)",
                      fontSize: 10, background: "var(--bg-chrome)", border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--r-xs)", padding: "6px 8px", color: "var(--fg-default)", boxSizing: "border-box",
                    }}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button onClick={handleDoiSave} disabled={doiSaved || !projectPath} className="btn btn-sm btn-accent" style={{ fontSize: 11 }}>
                      {doiSaved ? t("citation.added_check") : t("citation.add_to_bib")}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(doiResult!)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>
                      {t("citation.copy_bibtex")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {doiMode === "batch" && (
            <div style={{ padding: "10px 16px" }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 6 }}>
                {t("citation.batch_hint")}
              </div>
              <textarea
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                rows={3}
                placeholder={"10.1038/nature12373\n10.1126/science.1260419\nhttps://doi.org/10.1145/3442188.3445922"}
                style={{
                  width: "100%", resize: "vertical", fontFamily: "var(--font-mono)",
                  fontSize: 10, background: "var(--bg-chrome)", border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--r-xs)", padding: "6px 8px", color: "var(--fg-default)",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  onClick={handleBatchImport}
                  disabled={batchLoading || !batchInput.trim()}
                  className="btn btn-sm btn-accent"
                  style={{ fontSize: 11 }}
                >
                  {batchLoading ? t("citation.importing") : t("citation.search_all")}
                </button>
                {batchResults.some((r) => r.bibtex && !batchSaved.has(r.doi)) && (
                  <button onClick={handleBatchSaveAll} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }} disabled={!projectPath}>
                    {t("citation.add_all_to_bib")}
                  </button>
                )}
              </div>
              {batchResults.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {batchResults.map((r) => (
                    <div key={r.doi} style={{
                      padding: "6px 8px", borderRadius: "var(--r-xs)",
                      background: r.error ? "var(--build-err-tint)" : batchSaved.has(r.doi) ? "var(--build-ok-tint)" : "var(--bg-chrome)",
                      border: `1px solid ${r.error ? "var(--build-err)" : batchSaved.has(r.doi) ? "var(--build-ok)" : "var(--border-subtle)"}`,
                      fontSize: "var(--fs-xs)", display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontFamily: "var(--font-mono)", flex: 1, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.key ?? r.doi}
                      </span>
                      {r.error && <span style={{ color: "var(--build-err)", flexShrink: 0 }}>{r.error}</span>}
                      {r.bibtex && !r.error && !batchSaved.has(r.doi) && (
                        <button onClick={() => handleBatchSaveOne(r)} className="btn btn-xs btn-accent" disabled={!projectPath} style={{ flexShrink: 0 }}>
                          {t("common.add")}
                        </button>
                      )}
                      {batchSaved.has(r.doi) && <span style={{ color: "var(--build-ok)", flexShrink: 0 }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

          {doiMode === "zotero" && (
            <div style={{ padding: "10px 16px" }}>
              {!zoteroChecked ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <button onClick={checkZotero} className="btn btn-sm btn-accent">
                    {t("citation.detect_zotero")}
                  </button>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 6 }}>
                    {t("citation.zotero_requirement")}
                  </div>
                </div>
              ) : !zoteroStatus?.available ? (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", textAlign: "center", padding: "8px 0" }}>
                  <div style={{ marginBottom: 4 }}>{t("citation.zotero_unavailable")}</div>
                  <div style={{ color: "var(--fg-faint)" }}>{zoteroStatus?.message}</div>
                  <button onClick={checkZotero} className="btn btn-xs btn-ghost" style={{ marginTop: 8 }}>
                    {t("editor.retry")}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input
                      value={zoteroQuery}
                      onChange={(e) => setZoteroQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleZoteroSearch(zoteroQuery); }}
                      placeholder={t("citation.zotero_search_placeholder")}
                      style={{
                        flex: 1, border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)",
                        padding: "5px 8px", fontSize: "var(--fs-xs)",
                        background: "var(--bg-chrome)", color: "var(--fg-strong)", outline: "none",
                      }}
                    />
                    <button
                      onClick={() => handleZoteroSearch(zoteroQuery)}
                      disabled={zoteroLoading}
                      className="btn btn-xs btn-ghost"
                    >
                      {zoteroLoading ? "…" : t("common.search")}
                    </button>
                  </div>

                  {zoteroItems.length > 0 && (
                    <div style={{ maxHeight: 180, overflow: "auto", display: "flex", flexDirection: "column", gap: 2 }} className="scroll">
                      {zoteroItems.map((item) => {
                        const sel = zoteroSelected.has(item.key);
                        const saved = zoteroSaved.has(item.key);
                        return (
                          <div
                            key={item.key}
                            onClick={() => !saved && toggleZoteroSelect(item.key)}
                            style={{
                              padding: "5px 8px", borderRadius: "var(--r-xs)", cursor: saved ? "default" : "pointer",
                              background: saved ? "var(--build-ok-tint)" : sel ? "var(--accent-tint, #e8f0fe)" : "var(--bg-chrome)",
                              border: `1px solid ${saved ? "var(--build-ok)" : sel ? "var(--accent)" : "var(--border-subtle)"}`,
                              display: "flex", alignItems: "center", gap: 8,
                            }}
                          >
                            <input type="checkbox" checked={sel || saved} readOnly style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: "var(--fs-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--fg-faint)", flexShrink: 0 }}>
                              {item.author && `${item.author} `}{item.year}
                            </span>
                            {saved && <span style={{ color: "var(--build-ok)", fontSize: 10, flexShrink: 0 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {zoteroSelected.size > 0 && (
                    <button
                      onClick={handleZoteroImport}
                      disabled={zoteroImporting || !projectPath}
                      className="btn btn-sm btn-accent"
                      style={{ marginTop: 8, fontSize: 11 }}
                    >
                      {zoteroImporting
                        ? t("citation.importing")
                        : t("citation.import_refs_to_bib", { count: zoteroSelected.size })}
                    </button>
                  )}

                  {zoteroImportResults.some((r) => r.error) && (
                    <div style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: "var(--build-err)" }}>
                      {zoteroImportResults.filter((r) => r.error).map((r) => (
                        <div key={r.key}>{r.cite_key ?? r.key}: {r.error}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Lista de referencias */}
        <div style={{ flex: 1, overflow: "auto" }} className="scroll">
          {refs.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-faint)" }}>
              <div style={{ fontSize: "var(--fs-sm)", marginBottom: 6 }}>{t("citation.bib_not_found")}</div>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 14 }}>
                {t("citation.create_bib_prefix")} <span style={{ fontFamily: "var(--font-mono)" }}>content/bibliography/references.bib</span> {t("citation.create_bib_suffix")}
              </div>
              <button
                className="btn btn-accent btn-sm"
                onClick={() => { setDoiMode("single"); setTimeout(() => doiInputRef.current?.focus(), 50); }}
              >
                {t("citation.add_via_doi")}
              </button>
            </div>
          )}
          {refs.length > 0 && filtered.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>
              {t("citation.no_results", { query })}
            </div>
          )}
          {filtered.map((ref) => (
            <button
              key={ref.key}
              type="button"
              className="tx-unstyled-button tx-card-action"
              onClick={() => { onInsert(ref); onClose(); }}
              style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", gap: 12, alignItems: "flex-start", width: "100%", textAlign: "left",
              }}
            >
              {/* Chip de tipo */}
              <span style={{
                flexShrink: 0, padding: "2px 6px", borderRadius: "var(--r-xs)",
                background: "var(--ink-100)", fontFamily: "var(--font-mono)",
                fontSize: 9, color: "var(--fg-faint)", marginTop: 2,
              }}>
                {ref.entry_type}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--accent-deep)", marginBottom: 2 }}>
                  {ref.key}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", lineHeight: 1.3, marginBottom: 3 }}>
                  {ref.title || <em style={{ color: "var(--fg-faint)" }}>{t("citation.no_title")}</em>}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ref.author && <span>{ref.author.split(" and ")[0]}{ref.author.includes(" and ") ? " et al." : ""}</span>}
                  {ref.year && <span style={{ fontFamily: "var(--font-mono)" }}>{ref.year}</span>}
                  {ref.journal && <span style={{ fontStyle: "italic" }}>{ref.journal}</span>}
                  {ref.doi && (
                    <span
                      title={ref.doi}
                      style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {ref.doi}
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                flexShrink: 0, fontSize: 10, fontFamily: "var(--font-mono)",
                color: "var(--fg-faint)", padding: "3px 7px",
                background: "var(--bg-panel)", borderRadius: "var(--r-xs)",
                border: "1px solid var(--border-subtle)", alignSelf: "center",
              }}>
                {typeLabel[citationType]}{"{"}…{"}"}
              </div>
            </button>
          ))}
        </div>
      </div>
  );
}
