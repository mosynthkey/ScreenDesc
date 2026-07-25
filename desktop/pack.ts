import { fromFileUrl, isAbsolute, join } from "jsr:@std/path";

const repoRoot = fromFileUrl(new URL("..", import.meta.url));

// deno desktop embeds everything reachable from its cwd (following symlinks),
// not just what --include names. Building from the repo root risks sweeping in
// unrelated files, so build from an isolated temp dir containing only what the
// app actually needs.
export async function buildDesktopApp(outputPath?: string) {
  const sourceDir = await Deno.makeTempDir({ prefix: "screendesc-desktop-" });
  try {
    await Deno.mkdir(join(sourceDir, "desktop"), { recursive: true });
    await Deno.symlink(join(repoRoot, "desktop", "main.ts"), join(sourceDir, "desktop", "main.ts"));
    await Deno.symlink(join(repoRoot, "dist"), join(sourceDir, "dist"));
    await Deno.copyFile(join(repoRoot, "deno.json"), join(sourceDir, "deno.json"));
    await Deno.copyFile(join(repoRoot, "deno.lock"), join(sourceDir, "deno.lock"));
    await Deno.copyFile(join(repoRoot, "public", "icon.png"), join(sourceDir, "icon.png"));

    const args = ["desktop", "--include", "./dist", "--allow-read=dist", "--icon", "icon.png"];
    if (outputPath) args.push("-o", outputPath);
    args.push("desktop/main.ts");

    const command = new Deno.Command("deno", { args, cwd: sourceDir, stdout: "inherit", stderr: "inherit" });
    const { code } = await command.output();
    if (code !== 0) throw new Error(`deno desktop exited with code ${code}`);
  } finally {
    await Deno.remove(sourceDir, { recursive: true }).catch(() => {});
  }
}

if (import.meta.main) {
  const arg = Deno.args[0];
  const outputPath = arg ? (isAbsolute(arg) ? arg : join(Deno.cwd(), arg)) : undefined;
  await buildDesktopApp(outputPath);
}
