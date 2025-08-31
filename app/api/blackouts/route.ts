import { readJsonSafe, writeJsonSafe } from '@/lib/fs';
import type { BlackoutMap } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

const BLACKOUTS_PATH = 'data/blackouts.json';

// GET /api/blackouts?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || '';
  const map = await readJsonSafe<BlackoutMap>(BLACKOUTS_PATH, {});
  if (date) {
    return NextResponse.json({ date, rooms: map[date] ?? {} });
  }
  return NextResponse.json(map);
}

// PATCH /api/blackouts  body: { date:string, roomId:number, closed:boolean }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { date, roomId, closed } = body || {};
  if (!date || typeof roomId !== 'number' || typeof closed !== 'boolean') {
    return NextResponse.json({ error: 'date/roomId/closed 누락' }, { status: 400 });
  }

  const map = await readJsonSafe<BlackoutMap>(BLACKOUTS_PATH, {});
  if (!map[date]) map[date] = {};
  map[date][String(roomId)] = closed;
  await writeJsonSafe(BLACKOUTS_PATH, map);
  return NextResponse.json({ ok: true, date, roomId, closed });
}
