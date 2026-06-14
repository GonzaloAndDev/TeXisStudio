import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Fallback content shown when the wrapped subtree throws. */
  fallback: ReactNode;
  /** Optional callback for telemetry / logging. */
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Small, reusable error boundary for UI subtrees that may throw on malformed
 * input (e.g., visual editors fed a corrupted document). Lets the rest of the
 * surrounding view keep working instead of bubbling the crash up to the
 * top-level AppErrorBoundary which paints the whole screen.
 *
 * The boundary deliberately does NOT auto-retry — once a child has thrown,
 * we assume the input is bad and show the fallback until the parent
 * remounts the boundary (typically by changing its key). Without that
 * constraint, a render loop with the same bad input would spin forever.
 */
export class UiErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[UiErrorBoundary] caught:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
