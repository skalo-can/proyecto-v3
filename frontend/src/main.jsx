import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./App.css";   // ←🔥 IMPORTANTE: CSS GLOBAL
import App from "./App.jsx";

import { initCornerstone } from "./cornerstoneInit.js";
import { AuthProvider } from "./AuthContext";

async function bootstrap() {
  await initCornerstone();

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
}

bootstrap();