import { serveDir } from "jsr:@std/http/file-server";
import { fromFileUrl } from "jsr:@std/path/from-file-url";
import { handleStorageRequest, revealProjectById } from "./storageApi.ts";

const fsRoot = fromFileUrl(new URL("../dist", import.meta.url));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const storageResponse = await handleStorageRequest(req, url);
  if (storageResponse) return storageResponse;
  return serveDir(req, { fsRoot });
});

/**
 * CEF's default page menu (Reload / Inspect / …) is native — the webview often
 * does not forward `contextmenu`, so page-level preventDefault cannot stop it.
 * Adopt the startup window and replace that menu via showContextMenu.
 * @see https://docs.deno.com/runtime/desktop/menus/
 *
 * Typed loosely: `Deno.BrowserWindow` exists only in the desktop runtime, not
 * in the default `deno check` lib.
 */
type DesktopBrowserWindow = {
  executeJs: (code: string) => Promise<unknown>;
  showContextMenu: (
    x: number,
    y: number,
    menu: Array<
      | "separator"
      | { item: { label: string; id?: string; enabled: boolean } }
    >,
  ) => void;
  addEventListener: (
    type: "mousedown" | "contextmenuclick",
    listener: (event: DesktopWindowMouseEvent) => void,
  ) => void;
};

type DesktopWindowMouseEvent = {
  button?: number;
  clientX: number;
  clientY: number;
  detail?: { id: string };
};

function installNativeWindowChrome(): void {
  const DenoDesktop = Deno as typeof Deno & {
    BrowserWindow?: new (options?: { title?: string }) => DesktopBrowserWindow;
  };
  if (typeof DenoDesktop.BrowserWindow !== "function") return;

  const win = new DenoDesktop.BrowserWindow({ title: "ScreenDesc" });

  win.addEventListener("mousedown", (event) => {
    if (event.button !== 2) return;
    // Replace CEF's Reload/Inspect menu immediately (awaiting executeJs is too late).
    win.showContextMenu(event.clientX, event.clientY, []);
    void (async () => {
      try {
        const info = await win.executeJs(`(() => {
          const el = document.elementFromPoint(${event.clientX}, ${event.clientY});
          const item = el && el.closest("[data-project-id]");
          const lang = document.documentElement.lang || "";
          return {
            projectId: item ? item.getAttribute("data-project-id") : null,
            ja: lang.toLowerCase().startsWith("ja"),
          };
        })()`) as { projectId: string | null; ja: boolean } | null;

        if (!info?.projectId) return;
        win.showContextMenu(event.clientX, event.clientY, [
          {
            item: {
              label: info.ja ? "ファイルの場所を開く" : "Show in Finder",
              id: `reveal:${info.projectId}`,
              enabled: true,
            },
          },
        ]);
      } catch (error) {
        console.error("[ScreenDesc] context menu probe failed", error);
      }
    })();
  });

  win.addEventListener("contextmenuclick", (event) => {
    const menuId = event.detail?.id;
    if (!menuId?.startsWith("reveal:")) return;
    const projectId = menuId.slice("reveal:".length);
    void revealProjectById(projectId).catch((error) => {
      console.error("[ScreenDesc] reveal failed", error);
    });
  });
}

installNativeWindowChrome();
