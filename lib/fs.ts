// lib/fs.ts
import { promises as fsp } from 'fs';
import * as path from 'path';

async function resolvePath(relative: string) {
  return path.join(process.cwd(), relative);
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

// ⬇️ 버퍼 저장 (Node가 기대하는 타입으로 고정)
export async function writeFile(relative: string, buffer: Buffer | Uint8Array) {
  const p = await resolvePath(relative);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, buffer as any);
}

export async function listFiles(relativeDir: string): Promise<string[]> {
  const p = await resolvePath(relativeDir);
  try {
    return await fsp.readdir(p);
  } catch {
    return [];
  }
}
