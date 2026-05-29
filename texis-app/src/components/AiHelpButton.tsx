/**
 * AiHelpButton — botón contextual "¿Cómo hago esto?" para paneles.
 *
 * Abre el asistente de IA con el modo y contexto adecuados al panel donde
 * el usuario está. El usuario no necesita saber que existe el asistente
 * ni navegar a él manualmente.
 *
 * Uso:
 *   <AiHelpButton
 *     panel="bibliography"
 *     question="¿Cómo agrego una referencia a mi documento?"
 *     mode="app_help"
 *   />
 */

import { useAiStore } from "../stores/ai";
import type { AiActionMode } from "../stores/ai";

interface AiHelpButtonProps {
  /** Identificador del panel para el contexto de UI */
  panel: string;
  /** Pregunta predefinida que se enviará al asistente */
  question: string;
  /** Modo de acción a seleccionar (default: app_help) */
  mode?: AiActionMode;
  /** Texto visible en el botón */
  label?: string;
  /** Estilo del botón */
  variant?: "ghost" | "inline" | "chip";
}

export function AiHelpButton({
  panel,
  question,
  mode = "app_help",
  label = "¿Cómo hago esto?",
  variant = "ghost",
}: AiHelpButtonProps) {
  const store = useAiStore();

  function handleClick() {
    store.setUiContext({ activePanel: panel });
    store.setActionMode(mode);
    store.setDraftInput(question);
    store.openPanel();
  }

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="chip"
        style={{ cursor: "pointer", color: "var(--accent-deep)", borderColor: "var(--accent-soft)" }}
        title={question}
      >
        ✦ {label}
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11, color: "var(--accent)", textDecoration: "underline",
          padding: 0, fontFamily: "inherit",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="btn btn-ghost btn-sm"
      style={{ fontSize: 11 }}
      title={question}
    >
      ✦ {label}
    </button>
  );
}
