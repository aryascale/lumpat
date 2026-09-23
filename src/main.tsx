import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import "leaflet/dist/leaflet.css";
import { ReactLenis } from 'lenis/react';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReactLenis
      root
      options={{
        // antd modals/dropdowns scroll natively — without this Lenis
        // hijacks wheel/touch and nested lists (e.g. category Select) can't scroll
        prevent: (node) =>
          node.classList.contains("ant-modal") ||
          node.classList.contains("ant-drawer") ||
          node.classList.contains("ant-select-dropdown") ||
          node.classList.contains("ant-dropdown") ||
          node.classList.contains("ant-popover") ||
          node.classList.contains("ant-picker-dropdown"),
      }}
    >
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ReactLenis>
  </React.StrictMode>
);
