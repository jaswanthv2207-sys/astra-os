/**
 * Workspace sync over a **secret gist** — multi-device backup with real
 * version history and no backend of our own.
 *
 * The payload is byte-for-byte what `exportJson()` downloads (the same
 * schema `importJson()` restores), so a sync and a file backup are
 * interchangeable: pull a gist here or load the same file locally. The gist
 * id travels in the device settings store (it is *not* part of the payload),
 * and every operation is an explicit user action — no auto-merge, no silent
 * overwrite. Requires a token with the `gist` scope.
 */

/** Filename inside the gist — stable so later pulls find it. */
export const GIST_FILENAME = "astra-workspace.json";

const GIST_API = "https://api.github.com/gists";

function gistErrorDetail(response: Response): string {
  return `${response.status} ${response.statusText}`;
}

async function gistFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${GIST_API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-gitHub-api-version": "2022-11-28",
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!response.ok) {
    let detail = gistErrorDetail(response);
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep status line */
    }
    throw new Error(detail);
  }
  return response;
}

export interface UploadResult {
  /** The gist id — store it for future pushes and pulls. */
  id: string;
  /** True when a brand new gist was created. */
  created: boolean;
}

/**
 * Push the workspace. `gistId` present → update that gist; absent → create
 * a new secret gist and return its id.
 */
export async function uploadToGist(options: {
  token: string;
  gistId?: string | null;
  content: string;
  description?: string;
}): Promise<UploadResult> {
  const { token, gistId, content } = options;
  const description =
    options.description ?? "Astra OS — workspace sync (secret)";
  const payload = {
    description,
    public: false,
    files: { [GIST_FILENAME]: { content } },
  };

  if (gistId) {
    const response = await gistFetch(`/${gistId}`, token, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { id?: string };
    return { id: body.id ?? gistId, created: false };
  }

  const response = await gistFetch("", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Gist created without an id.");
  return { id: body.id, created: true };
}

export interface PullResult {
  /** The raw workspace JSON — feed straight to `importJson()`. */
  content: string;
  /** Gist's last-updated stamp (epoch ms). */
  updatedAt: number;
}

/** Pull the workspace JSON out of a gist. */
export async function pullFromGist(options: {
  token: string;
  gistId: string;
}): Promise<PullResult> {
  const { token, gistId } = options;
  const response = await gistFetch(`/${gistId}`, token);
  const body = (await response.json()) as {
    updated_at?: string;
    files?: Record<
      string,
      { content?: string; raw_url?: string; truncated?: boolean }
    >;
  };
  const file = body.files?.[GIST_FILENAME];
  if (!file) throw new Error("No workspace file in that gist.");

  let content = file.content ?? "";
  if (file.truncated && file.raw_url) {
    // Gists truncate over 1MB — fetch the raw copy.
    const raw = await fetch(file.raw_url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!raw.ok) throw new Error("Could not read the full gist file.");
    content = await raw.text();
  }

  const updatedAt = Date.parse(body.updated_at ?? "");
  return {
    content,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}
