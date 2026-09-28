import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "release-manifest.json"), "utf8"));
if (manifest.schema !== 1
  || manifest.sourceRepository !== "libertypandaa/cristal-front-2"
  || manifest.releaseRepository !== "libertypandaa/crystal-front-demo"
  || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit ?? "")
  || !Array.isArray(manifest.files)) {
  throw new Error("Invalid release manifest header");
}

const expected = new Set(manifest.files.map((entry) => entry.path));
if (expected.size !== manifest.files.length || !expected.has("index.html")) {
  throw new Error("Incomplete or duplicate release paths");
}

for (const entry of manifest.files) {
  if (!/^(?:index\.html$|src\/|assets\/runtime\/|assets\/generated\/audio\/core-sfx-kits-v1\/|tests\/core-smoke\.mjs$|scripts\/verify-demo-release\.mjs$)/.test(entry.path)
    || entry.path.includes("..") || entry.path.includes("\\")) {
    throw new Error(`Unexpected release path: ${entry.path}`);
  }
  const file = path.join(root, entry.path);
  if (!(await lstat(file)).isFile()) throw new Error(`Missing release file: ${entry.path}`);
  const data = await readFile(file);
  const gitBlobSha = createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (entry.bytes !== data.length || entry.gitBlobSha !== gitBlobSha || entry.sha256 !== sha256) {
    throw new Error(`Release file changed: ${entry.path}`);
  }
}

async function walk(relative) {
  const absolute = path.join(root, relative);
  const stat = await lstat(absolute);
  if (stat.isSymbolicLink()) throw new Error(`Symlink in release: ${relative}`);
  if (stat.isFile()) return [relative.replaceAll("\\", "/")];
  if (!stat.isDirectory()) throw new Error(`Unexpected path in release: ${relative}`);
  const children = await readdir(absolute);
  return (await Promise.all(children.map((child) => walk(path.join(relative, child))))).flat();
}
for (const directory of ["src", "assets/runtime", "assets/generated/audio/core-sfx-kits-v1"]) {
  for (const file of await walk(directory)) {
    if (!expected.has(file)) throw new Error(`Unlisted runtime file: ${file}`);
  }
}
console.log(`Verified ${manifest.files.length} files from ${manifest.sourceCommit}`);
