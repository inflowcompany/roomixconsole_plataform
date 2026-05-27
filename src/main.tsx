// Roomix Platform Console — Vite entry point.
//
// We mount the App at the root and let it decide between LoginScreen
// and the dashboard based on the AuthProvider state. There is no
// shared bundle with the Roomix SaaS — this app loads its own React,
// its own Vite chunks, and the scoped Cloud Design CSS.

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("[platform-console] #root element missing from index.html");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
