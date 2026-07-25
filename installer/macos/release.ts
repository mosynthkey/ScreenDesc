import { copy } from "jsr:@std/fs/copy";
import { fromFileUrl, join } from "jsr:@std/path";
import { buildDesktopApp } from "../../desktop/pack.ts";

const here = fromFileUrl(new URL(".", import.meta.url));
const repoRoot = join(here, "..", "..");

const appName = "ScreenDesc";
const developerId = "Developer ID Application: Masaki Ono";
const keychainProfile = "Melissa";

const pkg = JSON.parse(await Deno.readTextFile(join(repoRoot, "package.json")));
const version = pkg.version as string;

const buildDir = join(here, "build");
const unsignedDmg = join(buildDir, `${appName}-unsigned.dmg`);
const mountDir = join(buildDir, "mount");
const stagingDir = join(buildDir, "staging");
const dmgPath = join(buildDir, `${appName}_v${version}.dmg`);

async function run(cmd: string, args: string[], cwd?: string) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const command = new Deno.Command(cmd, { args, cwd, stdout: "inherit", stderr: "inherit" });
  const { code } = await command.output();
  if (code !== 0) throw new Error(`${cmd} exited with code ${code}`);
}

async function removeIfExists(path: string) {
  await Deno.remove(path, { recursive: true }).catch((error) => {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  });
}

async function fixBundleDisplayName(appPath: string) {
  const plist = join(appPath, "Contents", "Info.plist");
  // Safety net if a future -o stem still leaks into the bundle display name.
  await run("plutil", ["-replace", "CFBundleName", "-string", appName, plist]);
}

async function build() {
  await Deno.mkdir(buildDir, { recursive: true });
  await run("npm", ["run", "build:desktop"], repoRoot);
  // Build as ScreenDesc.dmg so CFBundleName / window title stay "ScreenDesc",
  // then rename the artifact to *-unsigned.dmg for the pre-sign stage.
  const namedDmg = join(buildDir, `${appName}.dmg`);
  await removeIfExists(namedDmg);
  await removeIfExists(unsignedDmg);
  await buildDesktopApp(namedDmg);
  await Deno.rename(namedDmg, unsignedDmg);
}

async function sign() {
  await removeIfExists(mountDir);
  await removeIfExists(stagingDir);
  await Deno.mkdir(mountDir, { recursive: true });
  await Deno.mkdir(stagingDir, { recursive: true });

  await run("hdiutil", ["attach", unsignedDmg, "-mountpoint", mountDir, "-readonly", "-nobrowse"]);
  try {
    await copy(join(mountDir, `${appName}.app`), join(stagingDir, `${appName}.app`));
  } finally {
    await run("hdiutil", ["detach", mountDir]);
  }
  await Deno.symlink("/Applications", join(stagingDir, "Applications"));

  const appPath = join(stagingDir, `${appName}.app`);
  await fixBundleDisplayName(appPath);
  await run("codesign", [
    "--force",
    "--deep",
    "--options",
    "runtime",
    "--timestamp",
    "--entitlements",
    join(here, "entitlements.plist"),
    "--sign",
    developerId,
    appPath,
  ]);
  await run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
}

async function dmg() {
  await removeIfExists(dmgPath);
  await run("hdiutil", [
    "create",
    "-srcfolder",
    stagingDir,
    "-fs",
    "HFS+",
    "-format",
    "UDZO",
    "-volname",
    `${appName} v${version}`,
    dmgPath,
  ]);
  await run("codesign", ["--force", "--sign", developerId, "--options", "runtime", "--timestamp", dmgPath]);
}

async function notarize() {
  await run("xcrun", ["notarytool", "submit", dmgPath, "--keychain-profile", keychainProfile, "--wait"]);
}

async function staple() {
  await run("xcrun", ["stapler", "staple", dmgPath]);
}

async function verify() {
  await run("spctl", ["--assess", "--type", "open", "--context", "context:primary-signature", "-v", dmgPath]);
}

async function clean() {
  await removeIfExists(buildDir);
}

const steps: Record<string, () => Promise<void>> = { build, sign, dmg, notarize, staple, verify, clean };
const defaultSteps = ["build", "sign", "dmg", "notarize", "staple", "verify"];
const requested = Deno.args.length > 0 ? Deno.args : defaultSteps;

for (const stepName of requested) {
  const step = steps[stepName];
  if (!step) {
    console.error(`Unknown step: "${stepName}". Available: ${Object.keys(steps).join(", ")}`);
    Deno.exit(1);
  }
  await step();
}
