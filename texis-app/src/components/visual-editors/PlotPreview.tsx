/**
 * PlotPreview — vista previa EN VIVO (SVG) de un PGFPlotsDocument, renderizada
 * desde el modelo de datos (sin compilar LaTeX). No es pixel-idéntica al PDF,
 * pero deja de "armar la gráfica a ciegas": ves la forma mientras editas.
 * Para tipos que no se pueden aproximar fielmente (parametric/polar/surface/
 * contour) muestra una nota y remite al compile para el resultado exacto.
 */
import { useTranslation } from "react-i18next";
import type { PGFPlotsDocument, DataSeries } from "../../types-engines";
import { compileExpr } from "../../lib/mathExprEval";

const W = 320, H = 200, PAD = 28;
const APPROX_TYPES = new Set(["function2d", "scatter", "bar", "histogram", "boxplot", "errorbar", "heatmap"]);

/** Color LaTeX → CSS. Quita mezclas xcolor (blue!60 → blue); named colors valen. */
function cssColor(raw: string | undefined, fallback = "var(--accent)"): string {
  if (!raw) return fallback;
  const base = raw.split("!")[0].trim().toLowerCase();
  const map: Record<string, string> = { teal: "#0a8", purple: "#85e", orange: "#f80", brown: "#a63", olive: "#880", violet: "#94e", cyan: "#0bd", magenta: "#e0d", lime: "#7d0" };
  return map[base] ?? base ?? fallback;
}

interface Pt { x: number; y: number }

export function PlotPreview({ doc }: { doc: PGFPlotsDocument }) {
  const { t } = useTranslation();
  const series = doc.series ?? [];

  // ── Reunir puntos para calcular límites ──────────────────────────────────
  const sampled: { s: DataSeries; pts: Pt[]; kind: string }[] = [];
  for (const s of series) {
    if (s.plotType === "function2d") {
      const fn = compileExpr(s.expression ?? "");
      const [a, b] = s.domain ?? [-5, 5];
      if (fn && Number.isFinite(a) && Number.isFinite(b) && b > a) {
        const pts: Pt[] = [];
        const N = 80;
        for (let i = 0; i <= N; i++) {
          const x = a + (b - a) * (i / N);
          const y = fn(x);
          if (Number.isFinite(y)) pts.push({ x, y });
        }
        sampled.push({ s, pts, kind: "function2d" });
      }
    } else if (APPROX_TYPES.has(s.plotType) && s.data && s.data.length) {
      const pts = s.data.map((d) => ({ x: d.x, y: d.y }));
      sampled.push({ s, pts, kind: s.plotType });
    }
  }

  const unsupported = series.filter((s) => !APPROX_TYPES.has(s.plotType));
  const allPts = sampled.flatMap((g) => g.pts);
  const hasData = allPts.length > 0;

  // límites con margen
  let minX = -1, maxX = 1, minY = -1, maxY = 1;
  if (hasData) {
    minX = Math.min(...allPts.map((p) => p.x)); maxX = Math.max(...allPts.map((p) => p.x));
    minY = Math.min(...allPts.map((p) => p.y)); maxY = Math.max(...allPts.map((p) => p.y));
    // boxplot/errorbar extienden el rango Y con whiskers/errores
    for (const g of sampled) {
      if (g.kind === "boxplot") for (const d of g.s.data ?? []) {
        minY = Math.min(minY, d.whiskerMin ?? d.y - (d.error ?? 5));
        maxY = Math.max(maxY, d.whiskerMax ?? d.y + (d.error ?? 5));
      }
      if (g.kind === "errorbar") for (const d of g.s.data ?? []) {
        minY = Math.min(minY, d.y - (d.error ?? 0)); maxY = Math.max(maxY, d.y + (d.error ?? 0));
      }
      if (g.kind === "bar" || g.kind === "histogram") { minY = Math.min(minY, 0); maxY = Math.max(maxY, 0); }
    }
  }
  if (minX === maxX) { minX -= 1; maxX += 1; }
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const padY = (maxY - minY) * 0.08; minY -= padY; maxY += padY;

  const sx = (x: number) => PAD + ((x - minX) / (maxX - minX)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - minY) / (maxY - minY)) * (H - 2 * PAD);

  if (!hasData && unsupported.length === 0) {
    return <PreviewBox><Empty>{t("plot_preview.empty")}</Empty></PreviewBox>;
  }

  return (
    <PreviewBox>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 220 }} role="img" aria-label={t("plot_preview.title")}>
        {/* ejes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border-firm)" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--border-firm)" strokeWidth={1} />
        {/* y=0 si está en rango */}
        {minY < 0 && maxY > 0 && (
          <line x1={PAD} y1={sy(0)} x2={W - PAD} y2={sy(0)} stroke="var(--border-soft)" strokeDasharray="2 2" />
        )}
        {sampled.map((g, gi) => {
          const col = cssColor(g.s.color, `hsl(${(gi * 70) % 360} 60% 45%)`);
          if (g.kind === "function2d") {
            const d = g.pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
            return <path key={gi} d={d} fill="none" stroke={col} strokeWidth={1.6} />;
          }
          if (g.kind === "scatter") {
            return <g key={gi}>{g.pts.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill={col} />)}</g>;
          }
          if (g.kind === "bar" || g.kind === "histogram") {
            const bw = Math.max(3, (W - 2 * PAD) / (g.pts.length * 1.6));
            return <g key={gi}>{g.pts.map((p, i) => (
              <rect key={i} x={sx(p.x) - bw / 2} y={sy(Math.max(0, p.y))} width={bw} height={Math.abs(sy(p.y) - sy(0))} fill={col} opacity={0.75} />
            ))}</g>;
          }
          if (g.kind === "errorbar") {
            return <g key={gi}>{(g.s.data ?? []).map((d, i) => {
              const cx = sx(d.x), e = d.error ?? 0;
              return <g key={i}>
                <line x1={cx} y1={sy(d.y - e)} x2={cx} y2={sy(d.y + e)} stroke={col} strokeWidth={1.2} />
                <line x1={cx - 3} y1={sy(d.y + e)} x2={cx + 3} y2={sy(d.y + e)} stroke={col} strokeWidth={1.2} />
                <line x1={cx - 3} y1={sy(d.y - e)} x2={cx + 3} y2={sy(d.y - e)} stroke={col} strokeWidth={1.2} />
                <circle cx={cx} cy={sy(d.y)} r={2.4} fill={col} />
              </g>;
            })}</g>;
          }
          if (g.kind === "boxplot") {
            return <g key={gi}>{(g.s.data ?? []).map((d, i) => {
              const cx = sx(d.x), bw = 14;
              const q1 = d.q1 ?? d.y - (d.error ?? 5), q3 = d.q3 ?? d.y + (d.error ?? 5);
              const wl = d.whiskerMin ?? q1 - 1.5 * (q3 - q1), wh = d.whiskerMax ?? q3 + 1.5 * (q3 - q1);
              return <g key={i}>
                <line x1={cx} y1={sy(wl)} x2={cx} y2={sy(wh)} stroke={col} strokeWidth={1} />
                <rect x={cx - bw / 2} y={sy(q3)} width={bw} height={Math.abs(sy(q1) - sy(q3))} fill={col} fillOpacity={0.2} stroke={col} />
                <line x1={cx - bw / 2} y1={sy(d.y)} x2={cx + bw / 2} y2={sy(d.y)} stroke={col} strokeWidth={1.5} />
              </g>;
            })}</g>;
          }
          if (g.kind === "heatmap") {
            const xs = [...new Set(g.pts.map((p) => p.x))].sort((a, b) => a - b);
            const ys = [...new Set(g.pts.map((p) => p.y))].sort((a, b) => a - b);
            const cw = (W - 2 * PAD) / Math.max(1, xs.length), ch = (H - 2 * PAD) / Math.max(1, ys.length);
            const metas = (g.s.data ?? []).map((d) => d.meta ?? d.y);
            const mn = Math.min(...metas), mx = Math.max(...metas);
            return <g key={gi}>{(g.s.data ?? []).map((d, i) => {
              const xi = xs.indexOf(d.x), yi = ys.indexOf(d.y);
              const m = d.meta ?? d.y; const norm = mx > mn ? (m - mn) / (mx - mn) : 0.5;
              // azul→blanco→rojo
              const r = Math.round(255 * Math.min(1, 2 * norm)), bl = Math.round(255 * Math.min(1, 2 * (1 - norm)));
              return <rect key={i} x={PAD + xi * cw} y={H - PAD - (yi + 1) * ch} width={cw - 1} height={ch - 1} fill={`rgb(${r},${Math.round(120 + 60 * (1 - Math.abs(norm - 0.5) * 2))},${bl})`} />;
            })}</g>;
          }
          return null;
        })}
      </svg>
      {unsupported.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--fg-faint)", fontStyle: "italic", marginTop: 4 }}>
          {t("plot_preview.unsupported", { types: [...new Set(unsupported.map((s) => s.plotType))].join(", ") })}
        </div>
      )}
    </PreviewBox>
  );
}

function PreviewBox({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div style={{ background: "var(--bg-paper)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
      <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {t("plot_preview.title")}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>{children}</div>;
}
