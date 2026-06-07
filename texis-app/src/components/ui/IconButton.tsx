import type { ReactNode } from "react";
import { VisuallyHidden } from "./VisuallyHidden";

interface IconButtonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: "sm" | "md";
  variant?: "ghost" | "default";
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  type?: "button" | "submit" | "reset";
  "aria-haspopup"?: boolean | "dialog" | "listbox" | "menu" | "tree" | "grid";
  "aria-expanded"?: boolean;
  "aria-pressed"?: boolean;
}

export function IconButton({
  label,
  icon,
  onClick,
  disabled,
  active,
  size = "md",
  variant = "ghost",
  title,
  className,
  style,
  type = "button",
  ...ariaProps
}: IconButtonProps) {
  const classes = [
    "btn",
    variant === "ghost" ? "btn-ghost" : "",
    size === "sm" ? "btn-sm" : "",
    "btn-icon",
    active ? "btn-active" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      style={style}
      aria-label={label}
      aria-pressed={active}
      {...ariaProps}
    >
      {icon}
      <VisuallyHidden>{label}</VisuallyHidden>
    </button>
  );
}
