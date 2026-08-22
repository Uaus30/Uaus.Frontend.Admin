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

function getPackageVersion(workspaceRoot: string): string {
  try {
    const pkgPath = path.resolve(workspaceRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version?: string };
      if (pkg.version && pkg.version !== "0.0.0") {
        return pkg.version;
      }
    }
  } catch {
    // fallback
  }
  return "1.0.0";
}

/**
 * Obtém os metadados de build e versionamento da aplicação.
 *
 * Deriva a versão a partir do número de commits git (`git rev-list --count HEAD`)
 * quando o histórico completo estiver disponível.
 * Em builds superficiais (shallow clone no Vercel/CI onde depth=1) ou sem git,
 * utiliza a versão registrada e commitada no package.json.
 */
export function getBuildInfo(workspaceRoot: string = path.resolve(__dirname, "..")): BuildInfo {
  const commitCountStr = getCommitCount(workspaceRoot);
  const commitCount = parseInt(commitCountStr, 10);
  const commitHash = getCommitHash(workspaceRoot);
  const pkgVersion = getPackageVersion(workspaceRoot);

  let version = process.env.VITE_APP_VERSION;
  if (!version) {
    // Quando o clone do repositório for completo (mais de 1 commit no histórico):
    if (!Number.isNaN(commitCount) && commitCount > 1) {
      const parts = pkgVersion.split(".");
      const major = parts[0] || "1";
      const minor = parts[1] || "0";
      version = `${major}.${minor}.${commitCount}`;
    } else {
      // No Vercel ou CI com clone superficial (depth=1), recorre à versão do package.json
      version = pkgVersion;
    }
  }

  const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString();

  return {
    version,
    commitHash,
    buildTime,
  };
}
