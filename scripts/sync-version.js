import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { versionFromCommitCount } from "./version-from-commits.js";

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

  // A versão sai inteira da contagem — o `package.json` anterior não entra na
  // conta. Enquanto o formato era `1.0.<contagem>`, o major e o minor eram lidos
  // de volta do próprio arquivo a cada commit, o que dava uma realimentação
  // silenciosa: bastava alguém editar o "1.0" à mão para o prefixo se perpetuar
  // sozinho, sem nada no repositório explicando de onde ele tinha vindo.
  return versionFromCommitCount(targetCount);
}

export function syncVersion() {
  const newVersion = getNextVersion();
  const pkgFiles = [
    path.resolve(workspaceRoot, "package.json"),
    path.resolve(workspaceRoot, "apps/admin/package.json"),
    path.resolve(workspaceRoot, "apps/loja/package.json"),
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
