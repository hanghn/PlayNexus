import "./reset.css";
import "./main.css";
import { StrictMode } from "react";
import App from "./App.tsx";
import { createRoot } from "react-dom/client";
import AccessibilityProvider from "./components/AccessibilityProvider.tsx";

// non-nullish assertion is okay here: index.html defines a div with id #root
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AccessibilityProvider>
      <App />
    </AccessibilityProvider>
  </StrictMode>,
);
