import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BuildInfo {
  version: string;
  commitHash: string;
  buildTime: string;
}

function getCommitCount(cwd: string): string {
  try {
    return execSync("git rev-list --count HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      cwd,
    }).trim();
  } catch {
    return "";
  }
}

function getCommitHash(cwd: string): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      cwd,
    }).trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "";
  }
}

function getBaseVersion(workspaceRoot: string): string {
  try {
    const pkgPath = path.resolve(workspaceRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version?: string };
      if (pkg.version && pkg.version !== "0.0.0") {
        const parts = pkg.version.split(".");
        return `${parts[0]}.${parts[1] ?? "0"}`;
      }
    }
  } catch {
    // fallback
  }
  return "1.0";
}

/**
 * Obtém os metadados de build e versionamento da aplicação.
 *
 * Deriva a versão a partir do número de commits git (`git rev-list --count HEAD`)
 * gerando um versionamento incremental automático `1.0.<commits>`.
 * Em builds sem repositório git completo (ex: CI superficial), recorre a
 * variáveis de ambiente (`VITE_APP_VERSION`, `VERCEL_GIT_COMMIT_SHA`) ou package.json.
 */
export function getBuildInfo(workspaceRoot: string = path.resolve(__dirname, "..")): BuildInfo {
  const commitCount = getCommitCount(workspaceRoot);
  const commitHash = getCommitHash(workspaceRoot);
  const baseVersion = getBaseVersion(workspaceRoot);

  const version =
    process.env.VITE_APP_VERSION ||
    (commitCount ? `${baseVersion}.${commitCount}` : `${baseVersion}.0`);

  const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString();

  return {
    version,
    commitHash,
    buildTime,
  };
}
