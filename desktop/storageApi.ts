import { ensureDir } from "jsr:@std/fs/ensure-dir";
import { exists } from "jsr:@std/fs/exists";
import { dirname, join } from "jsr:@std/path";

const API_PREFIX = "/__screendesc/storage";

export interface SavedProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  contentHash?: string;
}

/** Snapshot wire format used between the webview and this host. */
export interface StoredSnapshot {
  imageMimeType: string;
  imageBase64: string;
  imageWidth: number;
  imageHeight: number;
  sections: unknown[];
  annotations: unknown[];
  ocrLines: unknown[];
  defaultFontFamily: string;
  lineStyle: string;
  lineWidth: number;
  lineColor: string;
  dotColor: string;
  dotRadius: number;
  anchorStyle: string;
  lineHaloWidth: number;
  lineHaloColor: string;
  calloutFontSize: number;
  calloutFontWeight: number;
  calloutFontItalic: boolean;
  calloutBorderEnabled: boolean;
  calloutFillEnabled: boolean;
  calloutFillColor: string;
  calloutFillOpacity: number;
  pageBackgroundColor: string;
  showSections: boolean;
  activeNamedProjectId?: string | null;
  activeNamedProjectName?: string | null;
}

function documentsRoot(): string {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) throw new Error("Cannot resolve home directory for Documents/ScreenDesc");
  return join(home, "Documents", "ScreenDesc");
}

function autosaveDir(root: string): string {
  return join(root, "autosave");
}

function projectsDir(root: string): string {
  return join(root, "projects");
}

function projectDir(root: string, id: string): string {
  return join(projectsDir(root), id);
}

async function readJson<T>(path: string): Promise<T | null> {
  if (!(await exists(path))) return null;
  return JSON.parse(await Deno.readTextFile(path)) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await Deno.writeTextFile(path, JSON.stringify(value));
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function writeSnapshotFiles(dir: string, snapshot: StoredSnapshot): Promise<void> {
  await ensureDir(dir);
  const { imageBase64, imageMimeType, ...fields } = snapshot;
  await writeJson(join(dir, "data.json"), { ...fields, imageMimeType });
  await Deno.writeFile(join(dir, "image.bin"), base64ToBytes(imageBase64));
}

async function readSnapshotFiles(dir: string): Promise<StoredSnapshot | null> {
  const dataPath = join(dir, "data.json");
  const imagePath = join(dir, "image.bin");
  if (!(await exists(dataPath)) || !(await exists(imagePath))) return null;
  const data = await readJson<Omit<StoredSnapshot, "imageBase64"> & { imageMimeType: string }>(
    dataPath,
  );
  if (!data) return null;
  const imageBytes = await Deno.readFile(imagePath);
  return {
    ...data,
    imageBase64: bytesToBase64(imageBytes),
  };
}

async function listMetas(root: string): Promise<SavedProjectMeta[]> {
  const dir = projectsDir(root);
  if (!(await exists(dir))) return [];
  const metas: SavedProjectMeta[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isDirectory) continue;
    const meta = await readJson<SavedProjectMeta>(join(dir, entry.name, "meta.json"));
    if (meta?.id) metas.push(meta);
  }
  return metas.sort((left, right) => right.updatedAt - left.updatedAt);
}

async function revealPath(targetPath: string): Promise<void> {
  if (Deno.build.os === "darwin") {
    const command = new Deno.Command("open", { args: ["-R", targetPath] });
    const { code, stderr } = await command.output();
    if (code !== 0) {
      throw new Error(new TextDecoder().decode(stderr) || `open -R failed (${code})`);
    }
    return;
  }
  if (Deno.build.os === "windows") {
    const command = new Deno.Command("explorer", { args: [`/select,${targetPath}`] });
    const { code, stderr } = await command.output();
    if (code !== 0) {
      throw new Error(new TextDecoder().decode(stderr) || `explorer failed (${code})`);
    }
    return;
  }
  const command = new Deno.Command("xdg-open", { args: [dirname(targetPath)] });
  const { code, stderr } = await command.output();
  if (code !== 0) {
    throw new Error(new TextDecoder().decode(stderr) || `xdg-open failed (${code})`);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

async function readBodySnapshot(req: Request): Promise<StoredSnapshot> {
  return (await req.json()) as StoredSnapshot;
}

export async function handleStorageRequest(req: Request, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith(API_PREFIX)) return null;

  const root = documentsRoot();
  await ensureDir(root);
  const path = url.pathname.slice(API_PREFIX.length); // e.g. /autosave, /projects, /projects/:id

  try {
    if (path === "/autosave" && req.method === "GET") {
      const snapshot = await readSnapshotFiles(autosaveDir(root));
      return snapshot ? jsonResponse(snapshot) : emptyResponse(404);
    }
    if (path === "/autosave" && req.method === "PUT") {
      const snapshot = await readBodySnapshot(req);
      await writeSnapshotFiles(autosaveDir(root), snapshot);
      return emptyResponse(204);
    }
    if (path === "/autosave" && req.method === "DELETE") {
      try {
        await Deno.remove(autosaveDir(root), { recursive: true });
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      }
      return emptyResponse(204);
    }

    if (path === "/projects" && req.method === "GET") {
      return jsonResponse(await listMetas(root));
    }

    if (path === "/projects" && req.method === "PUT") {
      const body = (await req.json()) as {
        id?: string;
        name: string;
        contentHash?: string;
        snapshot: StoredSnapshot;
      };
      const projectId = body.id ?? crypto.randomUUID();
      const dir = projectDir(root, projectId);
      const meta: SavedProjectMeta = {
        id: projectId,
        name: body.name,
        updatedAt: Date.now(),
        contentHash: body.contentHash,
      };
      await writeSnapshotFiles(dir, body.snapshot);
      await writeJson(join(dir, "meta.json"), meta);
      return jsonResponse({ id: projectId });
    }

    const projectMatch = path.match(/^\/projects\/([^/]+)(\/(image|reveal))?$/);
    if (projectMatch) {
      const projectId = decodeURIComponent(projectMatch[1]!);
      const subResource = projectMatch[3] ?? null;
      const dir = projectDir(root, projectId);

      if (subResource === "image" && req.method === "GET") {
        const imagePath = join(dir, "image.bin");
        const data = await readJson<{ imageMimeType?: string }>(join(dir, "data.json"));
        if (!(await exists(imagePath))) return emptyResponse(404);
        const bytes = await Deno.readFile(imagePath);
        return new Response(bytes, {
          headers: {
            "content-type": data?.imageMimeType || "application/octet-stream",
          },
        });
      }

      if (subResource === "reveal" && req.method === "POST") {
        const metaPath = join(dir, "meta.json");
        if (!(await exists(metaPath))) return emptyResponse(404);
        await revealPath(metaPath);
        return emptyResponse(204);
      }

      if (!subResource && req.method === "GET") {
        const snapshot = await readSnapshotFiles(dir);
        return snapshot ? jsonResponse(snapshot) : emptyResponse(404);
      }

      if (!subResource && req.method === "PATCH") {
        const patch = (await req.json()) as Partial<Pick<SavedProjectMeta, "name" | "contentHash">>;
        const existing = await readJson<SavedProjectMeta>(join(dir, "meta.json"));
        if (!existing) return emptyResponse(404);
        const next: SavedProjectMeta = {
          ...existing,
          ...patch,
          name: typeof patch.name === "string" && patch.name.trim() ? patch.name.trim() : existing.name,
          updatedAt: typeof patch.name === "string" ? Date.now() : existing.updatedAt,
        };
        await writeJson(join(dir, "meta.json"), next);
        return jsonResponse(next);
      }

      if (!subResource && req.method === "DELETE") {
        try {
          await Deno.remove(dir, { recursive: true });
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        }
        return emptyResponse(204);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    console.error("[ScreenDesc desktop storage]", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
}
