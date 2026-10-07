"use client";

import * as React from "react";

/**
 * Registers the service worker — production only (a SW in dev fights the
 * HMR pipeline), silently no-ops where unsupported (older Safari, insecure
 * contexts). Registration is the whole component: everything else the SW
 * does is declarative in `public/sw.js`.
 */
export function PwaRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline shell unavailable — the app works online regardless */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
