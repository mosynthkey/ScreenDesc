import { fromFileUrl, isAbsolute, join } from "jsr:@std/path";

const repoRoot = fromFileUrl(new URL("..", import.meta.url));
const defaultRunOutput = join(repoRoot, "dist-desktop", "ScreenDesc");

// deno desktop embeds everything reachable from its cwd (following symlinks),
// not just what --include names. Building from the repo root risks sweeping in
// unrelated files, so build from an isolated temp dir containing only what the
// app actually needs.
export async function buildDesktopApp(outputPath: string) {
  const sourceDir = await Deno.makeTempDir({ prefix: "screendesc-desktop-" });
  try {
    await Deno.mkdir(join(sourceDir, "desktop"), { recursive: true });
    // Real copies, not symlinks: on Windows, `deno desktop` bakes the
    // symlink's resolved absolute path into the compiled binary instead of
    // embedding the file contents, so the shipped .exe tries to re-read the
    // (long-gone) build-time temp directory at runtime and fails to launch.
    await Deno.copyFile(join(repoRoot, "desktop", "main.ts"), join(sourceDir, "desktop", "main.ts"));
    await Deno.copyFile(
      join(repoRoot, "desktop", "storageApi.ts"),
      join(sourceDir, "desktop", "storageApi.ts"),
    );
    await Deno.symlink(join(repoRoot, "dist"), join(sourceDir, "dist"));
    await Deno.copyFile(join(repoRoot, "deno.json"), join(sourceDir, "deno.json"));
    await Deno.copyFile(join(repoRoot, "deno.lock"), join(sourceDir, "deno.lock"));
    await Deno.copyFile(join(repoRoot, "public", "icon.png"), join(sourceDir, "icon.png"));

    // Documents/ScreenDesc persistence needs home-dir read/write.
    // Do not combine `--allow-read=dist` with bare `--allow-read`: deno desktop
    // keeps the scoped grant and then denies ~/Documents/ScreenDesc.
    // Reveal uses `open -R` (macOS) or Explorer (Windows).
    const allowRun = Deno.build.os === "windows" ? "explorer" : "open";
    // Diagnostic-only: DESKTOP_BACKEND lets CI try an alternate deno desktop
    // backend (webview/cef/raw) while tracking down a Windows-only "Module
    // not found" crash at launch. Remove once resolved.
    const backend = Deno.env.get("DESKTOP_BACKEND");
    const args = [
      "desktop",
      ...(backend ? ["--backend", backend] : []),
      "--include",
      "./dist",
      "--include",
      "./desktop",
      "--allow-read",
      "--allow-write",
      "--allow-env=HOME,USERPROFILE",
      // node:os.homedir() — .app launches often have no HOME in the environment.
      "--allow-sys=homedir",
      `--allow-run=${allowRun}`,
      "--icon",
      "icon.png",
      "-o",
      outputPath,
      "desktop/main.ts",
    ];

    const command = new Deno.Command("deno", {
      args,
      cwd: sourceDir,
      stdout: "inherit",
      stderr: "inherit",
    });
    const { code } = await command.output();
    if (code !== 0) throw new Error(`deno desktop exited with code ${code}`);
  } finally {
    await Deno.remove(sourceDir, { recursive: true }).catch(() => {});
  }
}

/** Resolve the platform path that `deno desktop -o <stem>` actually wrote. */
export function resolveDesktopBundlePath(outputStem: string): string {
  if (Deno.build.os === "darwin") {
    if (outputStem.endsWith(".app") || outputStem.endsWith(".dmg")) return outputStem;
    return `${outputStem}.app`;
  }
  if (Deno.build.os === "windows") {
    if (outputStem.endsWith(".exe")) return outputStem;
    return `${outputStem}.exe`;
  }
  return outputStem;
}

export async function launchDesktopApp(outputStem: string): Promise<void> {
  const bundlePath = resolveDesktopBundlePath(outputStem);
  if (!(await Deno.stat(bundlePath).catch(() => null))) {
    throw new Error(`Desktop bundle not found: ${bundlePath}`);
  }

  if (Deno.build.os === "darwin") {
    const command = new Deno.Command("open", {
      args: [bundlePath],
      stdout: "inherit",
      stderr: "inherit",
    });
    const { code } = await command.output();
    if (code !== 0) throw new Error(`open exited with code ${code}`);
    return;
  }

  if (Deno.build.os === "windows") {
    const command = new Deno.Command(bundlePath, {
      stdout: "inherit",
      stderr: "inherit",
    });
    // Detach: do not wait for the GUI process to exit.
    command.spawn();
    return;
  }

  const command = new Deno.Command(bundlePath, {
    stdout: "inherit",
    stderr: "inherit",
  });
  command.spawn();
}

if (import.meta.main) {
  const arg = Deno.args[0];
  if (arg) {
    const outputPath = isAbsolute(arg) ? arg : join(Deno.cwd(), arg);
    await buildDesktopApp(outputPath);
  } else {
    // desktop:run — compile to dist-desktop/ then launch (deno desktop itself only builds).
    await Deno.mkdir(join(repoRoot, "dist-desktop"), { recursive: true });
    await buildDesktopApp(defaultRunOutput);
    await launchDesktopApp(defaultRunOutput);
    console.log(`Launched ${resolveDesktopBundlePath(defaultRunOutput)}`);
  }
}
