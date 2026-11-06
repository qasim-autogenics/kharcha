import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

document.addEventListener("touchstart", () => {}, { passive: true }); // lets :active press styles work on iOS

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
