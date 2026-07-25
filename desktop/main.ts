import { serveDir } from "jsr:@std/http/file-server";
import { fromFileUrl } from "jsr:@std/path/from-file-url";

const fsRoot = fromFileUrl(new URL("../dist", import.meta.url));

Deno.serve((req) => serveDir(req, { fsRoot }));
