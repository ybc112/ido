import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Toast from "./components/Toast";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toast />
  </StrictMode>,
);
