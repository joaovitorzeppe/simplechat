import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "@components/ErrorBoundary";
import "@i18n/i18n";
import "@libs/theme";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";
import { registerPwa } from "@libs/pwa";
import { startVercelObserve } from "@libs/observe";
import { settleSpaPath } from "@libs/spa-path";

settleSpaPath();
startVercelObserve();
registerPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
