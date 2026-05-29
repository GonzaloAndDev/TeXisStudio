import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useProjectStore } from "./stores/project";
import type { ProjectModel } from "./types";

const AboutView = lazy(() => import("./views/AboutView"));
const CompileView = lazy(() => import("./views/CompileView"));
const EditorView = lazy(() => import("./views/EditorView"));
const HomeView = lazy(() => import("./views/HomeView"));
const LibraryView = lazy(() => import("./views/LibraryView"));
const ProfileWizardView = lazy(() => import("./views/ProfileWizardView"));
const ProgressView = lazy(() => import("./views/ProgressView"));
const SetupLatexView = lazy(() => import("./views/SetupLatexView"));
const SettingsView = lazy(() => import("./views/SettingsView"));
const WizardView = lazy(() => import("./views/WizardView"));

// Proyecto demo para previsualizar el editor en dev-browser sin Tauri
const DEMO_PROJECT: ProjectModel = {
  id: "demo-001",
  schema_version: "0.1.0",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  metadata: {
    title: "Análisis de redes neuronales en clasificación de imágenes médicas",
    subtitle: undefined,
    document_kind: "tesis",
    academic_level: "maestria",
    language: "es",
    city: "Ciudad de México",
    year: 2026,
    keywords: ["redes neuronales", "clasificación de imágenes", "medicina"],
  },
  institution: {
    name: "Universidad Nacional Autónoma de México",
    faculty: "Facultad de Ingeniería",
    country: "México",
  },
  student: {
    full_name: "Ana García López",
    student_id: "317456123",
    advisor: "Dr. Carlos Méndez",
  },
  profile_id: "generic.thesis",
  sections: [
    {
      id: "title_page",
      element_id: "title_page",
      title: undefined,
      placement: "front_matter",
      required: true,
      enabled: true,
      blocks: [],
      fields: {},
      children: [],
    },
    {
      id: "introduction",
      element_id: "introduction",
      title: "Introducción",
      placement: "body",
      required: true,
      enabled: true,
      blocks: [
        {
          type: "paragraph",
          id: "p1",
          content: "Las redes neuronales convolucionales han transformado el diagnóstico médico en los últimos años, permitiendo detectar patologías con una precisión comparable o superior a la de especialistas clínicos.",
        },
        {
          type: "heading",
          id: "h1",
          level: "section",
          content: "Motivación",
        },
        {
          type: "paragraph",
          id: "p2",
          content: "El diagnóstico tardío de enfermedades como el cáncer de mama impacta directamente en la tasa de supervivencia. Los sistemas de aprendizaje profundo ofrecen una alternativa escalable y reproducible.",
        },
      ],
      fields: {},
      children: [],
    },
    {
      id: "methodology",
      element_id: "methodology",
      title: "Metodología",
      placement: "body",
      required: true,
      enabled: true,
      blocks: [
        {
          type: "paragraph",
          id: "m1",
          content: "Se utilizó un conjunto de datos de 10,000 imágenes histológicas etiquetadas por patólogos certificados.",
        },
        {
          type: "list",
          id: "l1",
          list_type: "enumerate",
          items: [
            "Preprocesamiento: normalización y aumento de datos",
            "Arquitectura: ResNet-50 con capas de atención",
            "Entrenamiento: 100 épocas con early stopping",
            "Evaluación: validación cruzada 5-fold",
          ],
        },
        {
          type: "equation",
          id: "e1",
          latex_content: "\\mathcal{L} = -\\frac{1}{N}\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)",
          numbered: true,
          label: "eq:loss",
        },
      ],
      fields: {},
      children: [],
    },
    {
      id: "results",
      element_id: "results",
      title: "Resultados",
      placement: "body",
      required: true,
      enabled: true,
      blocks: [],
      fields: {},
      children: [],
    },
    {
      id: "conclusions",
      element_id: "conclusions",
      title: "Conclusiones",
      placement: "body",
      required: true,
      enabled: true,
      blocks: [],
      fields: {},
      children: [],
    },
    {
      id: "references",
      element_id: "references",
      title: "Referencias",
      placement: "back_matter",
      required: true,
      enabled: true,
      blocks: [],
      fields: {},
      children: [],
    },
  ],
};

// Carga el proyecto demo al navegar a /demo
function DemoLoader() {
  const navigate = useNavigate();
  const { openProject } = useProjectStore();
  useEffect(() => {
    openProject(DEMO_PROJECT, "/demo/redes-neuronales");
    navigate("/project/demo");
  }, []);
  return null;
}


export default function App() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense
          fallback={
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-app)", color: "var(--fg-muted)", fontSize: "var(--fs-sm)",
            }}>
              Cargando vista…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/new" element={<WizardView />} />
            <Route path="/demo" element={<DemoLoader />} />
            <Route path="/project/:id" element={<EditorView />} />
            <Route path="/project/:id/compile" element={<CompileView />} />
            <Route path="/project/:id/progress" element={<ProgressView />} />
            <Route path="/library" element={<LibraryView />} />
            <Route path="/new-profile" element={<ProfileWizardView />} />
            <Route path="/new-profile/:id" element={<ProfileWizardView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="/setup-latex" element={<SetupLatexView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/settings/:section" element={<SettingsView />} />
            <Route path="*" element={<HomeView />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </div>
  );
}
