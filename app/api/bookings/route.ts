import { readJsonSafe, writeJsonSafe } from '@/lib/fs';
import type { ApiError, Booking } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const BOOKINGS_PATH = 'data/bookings.json';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || '';
  const list = await readJsonSafe<Booking[]>(BOOKINGS_PATH, []);
  if (date) {
    const filtered = list
      .filter((b) => b.date === date)
      .sort((a, b) => a.startIso.localeCompare(b.startIso));
    return NextResponse.json(filtered);
  }
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { roomId, date, startIso, endIso, name, phone, notes } = body || {};
  if (!roomId || !date || !startIso || !endIso || !name || !phone) {
    return NextResponse.json<ApiError>({ error: '필수 필드 누락' }, { status: 400 });
  }
  const list = await readJsonSafe<Booking[]>(BOOKINGS_PATH, []);
  const overlap = list.some(
    (b) =>
      b.roomId === roomId && b.date === date && !(endIso <= b.startIso || startIso >= b.endIso),
  );
  if (overlap) {
    return NextResponse.json<ApiError>({ error: '겹치는 예약이 있습니다' }, { status: 409 });
  }
  const now = new Date().toISOString();
  const booking: Booking = {
    id: uuidv4(),
    roomId,
    date,
    startIso,
    endIso,
    name,
    phone,
    notes,
    createdAt: now,
  };
  list.push(booking);
  await writeJsonSafe(BOOKINGS_PATH, list);
  return NextResponse.json(booking, { status: 201 });
}
