import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

function getNextVersion() {
  let commitCount = 0;
  try {
    const output = execSync("git rev-list --count HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      cwd: workspaceRoot,
    }).trim();
    commitCount = parseInt(output, 10) || 0;
  } catch {
    commitCount = 0;
  }

  // Quando executado pelo hook pre-commit, o próximo commit será commitCount + 1
  const isHook = process.argv.includes("--hook");
  const targetCount = isHook ? commitCount + 1 : Math.max(commitCount, 1);

  const rootPkgPath = path.resolve(workspaceRoot, "package.json");
  let baseMajorMinor = "1.0";
  if (fs.existsSync(rootPkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
      if (pkg.version && pkg.version !== "0.0.0") {
        const parts = pkg.version.split(".");
        baseMajorMinor = `${parts[0]}.${parts[1] || "0"}`;
      }
    } catch {
      // fallback
    }
  }

  return `${baseMajorMinor}.${targetCount}`;
}

export function syncVersion() {
  const newVersion = getNextVersion();
  const pkgFiles = [
    path.resolve(workspaceRoot, "package.json"),
    path.resolve(workspaceRoot, "apps/admin/package.json"),
    path.resolve(workspaceRoot, "apps/pdv/package.json"),
  ];

  for (const pkgPath of pkgFiles) {
    if (fs.existsSync(pkgPath)) {
      try {
        const content = fs.readFileSync(pkgPath, "utf-8");
        const pkg = JSON.parse(content);
        if (pkg.version !== newVersion) {
          pkg.version = newVersion;
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
          console.log(`Updated ${path.relative(workspaceRoot, pkgPath)} to version ${newVersion}`);
        }
      } catch (err) {
        console.error(`Failed to update ${pkgPath}:`, err);
      }
    }
  }

  return newVersion;
}

syncVersion();
