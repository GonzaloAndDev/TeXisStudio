// Browser-safe stubs for Node.js builtins. Used by Vite when bundling
// TeXisStudio-Plugins — the actual fs/path code never runs in the WebView
// (FigureStore is never instantiated without an explicit project root).
export function mkdirSync(): void { throw new Error("mkdirSync: not available in browser"); }
export function writeFileSync(): void { throw new Error("writeFileSync: not available in browser"); }
export function readFileSync(): string { throw new Error("readFileSync: not available in browser"); }
export function existsSync(): boolean { return false; }
export function join(...parts: string[]): string { return parts.join("/"); }
export function resolve(...parts: string[]): string { return parts.join("/"); }
export default {};
