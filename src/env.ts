import fs from "node:fs";
import path from "node:path";

export interface ClasseVivaEnvCredentials {
  username?: string;
  password?: string;
  schoolCode?: string;
  pin?: string;
  target?: string;
  baseUrl?: string;
  authUrl?: string;
  cdnUrl?: string;
}

/**
 * Lightweight, zero-dependency parser for .env file contents.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();

    // Remove wrapping single or double quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.substring(1, val.length - 1);
    }

    result[key] = val;
  }

  return result;
}

/**
 * Loads a .env file into process.env if present and returns detected ClasseViva settings.
 */
export function loadEnv(envPath?: string, override = false): ClasseVivaEnvCredentials {
  const filePath = envPath ? path.resolve(envPath) : path.resolve(process.cwd(), ".env");

  if (fs.existsSync(filePath)) {
    try {
      // If Node.js has built-in process.loadEnvFile (Node 20.6.0+)
      if (typeof (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile === "function") {
        try {
          (process as unknown as { loadEnvFile: (path?: string) => void }).loadEnvFile(filePath);
        } catch {
          // Fall back to manual parsing if loadEnvFile fails on syntax/permissions
          const content = fs.readFileSync(filePath, "utf-8");
          const parsed = parseEnvContent(content);
          for (const [key, val] of Object.entries(parsed)) {
            if (override || !(key in process.env)) {
              process.env[key] = val;
            }
          }
        }
      } else {
        const content = fs.readFileSync(filePath, "utf-8");
        const parsed = parseEnvContent(content);
        for (const [key, val] of Object.entries(parsed)) {
          if (override || !(key in process.env)) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // Ignore errors reading .env (e.g., access denied, file unreadable)
    }
  }

  return getEnvCredentials();
}

/**
 * Reads ClasseViva credentials from environment variables.
 */
export function getEnvCredentials(): ClasseVivaEnvCredentials {
  const env = process.env;

  const username =
    env.CLASSEVIVA_USERNAME ||
    env.CLASSEVIVA_USER ||
    env.CV_USERNAME ||
    env.CV_USER;

  const password =
    env.CLASSEVIVA_PASSWORD ||
    env.CLASSEVIVA_PASS ||
    env.CV_PASSWORD ||
    env.CV_PASS;

  const schoolCode =
    env.CLASSEVIVA_SCHOOL_CODE ||
    env.CLASSEVIVA_CID ||
    env.CV_SCHOOL_CODE ||
    env.CV_CID;

  const pin =
    env.CLASSEVIVA_PIN ||
    env.CV_PIN;

  const target =
    env.CLASSEVIVA_TARGET ||
    env.CV_TARGET;

  const baseUrl =
    env.CLASSEVIVA_BASE_URL ||
    env.CV_BASE_URL;

  const authUrl =
    env.CLASSEVIVA_AUTH_URL ||
    env.CV_AUTH_URL;

  const cdnUrl =
    env.CLASSEVIVA_CDN_URL ||
    env.CV_CDN_URL;

  return {
    username,
    password,
    schoolCode,
    pin,
    target,
    baseUrl,
    authUrl,
    cdnUrl,
  };
}
