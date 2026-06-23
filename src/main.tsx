import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {},
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
