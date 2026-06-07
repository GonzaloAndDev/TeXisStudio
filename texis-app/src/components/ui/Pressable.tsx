import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

interface PressableProps {
  children: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  role?: string;
  "aria-selected"?: boolean;
  "aria-current"?: boolean | "page" | "step" | "location" | "date" | "time";
  "aria-label"?: string;
  "aria-expanded"?: boolean;
  className?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
  id?: string;
}

function handleKeyDown(onPress: (() => void) | undefined) {
  return (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPress?.();
    }
  };
}

function stopPropagation(e: MouseEvent) {
  e.stopPropagation();
}

export function Pressable({
  children,
  onPress,
  selected,
  disabled,
  role,
  className,
  style,
  tabIndex = 0,
  id,
  ...ariaProps
}: PressableProps) {
  const combinedClass = [
    "tx-unstyled-button",
    "tx-card-action",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      id={id}
      type="button"
      role={role}
      className={combinedClass}
      style={{ width: "100%", ...style }}
      onClick={onPress ? (e) => { stopPropagation(e); onPress(); } : undefined}
      onKeyDown={handleKeyDown(onPress)}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-selected={selected ?? ariaProps["aria-selected"]}
      aria-current={ariaProps["aria-current"]}
      aria-label={ariaProps["aria-label"]}
      aria-expanded={ariaProps["aria-expanded"]}
    >
      {children}
    </button>
  );
}
