/**
 * Install prompt capture — a tiny module singleton.
 *
 * Chromium fires `beforeinstallprompt` at an arbitrary moment; whichever
 * component happens to be mounted must be able to accept it, so the
 * listener lives at module scope (client-only, guarded) and exposes a
 * promise-based `promptInstall()`. When no prompt is available (Safari,
 * already installed) callers fall back to pointing at the browser menu.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let hooked = false;

function hook(): void {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("astra:installable"));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    window.dispatchEvent(new Event("astra:installable"));
  });
  if (window.matchMedia?.("(display-mode: standalone)").matches) {
    installed = true;
  }
}

/** Is the app already running installed? */
export function isInstalled(): boolean {
  hook();
  return installed;
}

/** Can we show a native install prompt right now? */
export function canInstall(): boolean {
  hook();
  return deferred !== null;
}

/**
 * Ask the browser to install. Returns `"unavailable"` when there is no
 * prompt (caller should explain the manual route instead).
 */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  hook();
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "dismissed";
  }
}
