// lib/fs.ts
import path from 'node:path';
import { promises as fsp } from 'node:fs';

const ROOT = process.cwd();

async function resolvePath(relative: string) {
  return path.join(ROOT, relative.replace(/^\/+/, ''));
}

export async function readJsonSafe<T>(relative: string, fallback: T): Promise<T> {
  try {
    const p = await resolvePath(relative);
    const b = await fsp.readFile(p, 'utf8');
    return JSON.parse(b) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonSafe(relative: string, data: any) {
  const p = await resolvePath(relative);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

// ✅ TS가 기대하는 타입으로 선언을 바꿔준다
export async function writeFile(
  relative: string,
  buffer: NodeJS.ArrayBufferView | ArrayBuffer | DataView | string,
) {
  const p = await resolvePath(relative);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, buffer);
}

export async function listFiles(relativeDir: string) {
  const p = await resolvePath(relativeDir);
  try {
    return await fsp.readdir(p);
  } catch {
    return [];
  }
}
