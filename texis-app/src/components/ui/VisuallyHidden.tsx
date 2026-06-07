import type { ReactNode } from "react";

const S: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span style={S}>{children}</span>;
}
