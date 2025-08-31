import { promises as fsp } from "fs";
import path from "path";

export async function readJsonSafe<T>(relPath: string, fallback: T): Promise<T> {
  const p = path.join(process.cwd(), relPath);
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
export async function writeJsonSafe<T>(relPath: string, data: T): Promise<void> {
  const p = path.join(process.cwd(), relPath);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}
