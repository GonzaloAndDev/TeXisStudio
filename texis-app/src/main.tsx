import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./tokens.css";
import "./i18n/index.ts";

const savedTheme = localStorage.getItem("tx-theme") as "light" | "dark" | null;
if (savedTheme) {
  document.documentElement.dataset.theme = savedTheme;
}

const savedUiScale = localStorage.getItem("tx-ui-scale");
if (savedUiScale === "\"large\"" || savedUiScale === "\"xlarge\"") {
  document.documentElement.dataset.uiScale = JSON.parse(savedUiScale);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
