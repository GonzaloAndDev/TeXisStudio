import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./tokens.css";

// Aplicar tema guardado
const savedTheme = localStorage.getItem("tx-theme") as "light" | "dark" | null;
if (savedTheme) {
  document.documentElement.dataset.theme = savedTheme;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
