import { serveDir } from "jsr:@std/http/file-server";
import { fromFileUrl } from "jsr:@std/path/from-file-url";
import { handleStorageRequest } from "./storageApi.ts";

const fsRoot = fromFileUrl(new URL("../dist", import.meta.url));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const storageResponse = await handleStorageRequest(req, url);
  if (storageResponse) return storageResponse;
  return serveDir(req, { fsRoot });
});
