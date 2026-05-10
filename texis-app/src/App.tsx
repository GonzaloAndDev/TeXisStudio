import { BrowserRouter, Route, Routes } from "react-router-dom";
import CompileView from "./views/CompileView";
import EditorView from "./views/EditorView";
import HomeView from "./views/HomeView";
import WizardView from "./views/WizardView";

function StubView({ title }: { title: string }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-app)", color: "var(--fg-muted)", flexDirection: "column", gap: 8,
    }}>
      <span style={{ fontSize: "var(--fs-2xl)", fontFamily: "var(--font-display)" }}>{title}</span>
      <span style={{ fontSize: "var(--fs-sm)" }}>Disponible en el próximo release</span>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/new" element={<WizardView />} />
          <Route path="/project/:id" element={<EditorView />} />
          <Route path="/project/:id/compile" element={<CompileView />} />
          <Route path="/library" element={<StubView title="Biblioteca" />} />
          <Route path="/about" element={<StubView title="Acerca de TeXisStudio" />} />
          <Route path="*" element={<HomeView />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
