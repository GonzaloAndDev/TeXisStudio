import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  title: string;
  maxHeight: number;
  errorLabel: string;
}

export function PdfPagePreview({ src, title, maxHeight, errorLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let loadingTask: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | null = null;

    setLoading(true);
    setFailed(false);

    void import("pdfjs-dist")
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({ url: src });
        return loadingTask.promise;
      })
      .then(async (pdf) => {
        const page = await pdf.getPage(1);
        if (disposed || !canvasRef.current) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = Math.min(900 / baseViewport.width, maxHeight / baseViewport.height);
        const pixelScale = cssScale * Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: pixelScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas 2D is unavailable");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${baseViewport.width * cssScale}px`;
        canvas.style.height = `${baseViewport.height * cssScale}px`;

        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!disposed) setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setLoading(false);
          setFailed(true);
        }
      });

    return () => {
      disposed = true;
      void loadingTask?.destroy();
    };
  }, [src, maxHeight]);

  return (
    <div
      role="img"
      aria-label={title}
      style={{
        minHeight: loading ? 120 : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {failed ? (
        <span style={{ padding: 16, color: "var(--fg-muted)", fontSize: "var(--fs-xs)" }}>
          {errorLabel}
        </span>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            display: loading ? "none" : "block",
            maxWidth: "100%",
            maxHeight,
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
}
