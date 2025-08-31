import { readJsonSafe } from '@/lib/fs';
import { generateHalfHourLabels, toLocalOffsetISO } from '@/lib/time';
import type { Avail, BlackoutMap, Booking, Config } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

const CONFIG_PATH = 'data/config.json';
const BOOKINGS_PATH = 'data/bookings.json';
const BLACKOUTS_PATH = 'data/blackouts.json';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = Number(searchParams.get('roomId'));
  const date = String(searchParams.get('date') ?? '');

  if (!roomId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'roomId/date 파라미터 오류' }, { status: 400 });
  }

  const cfg = await readJsonSafe<Config>(CONFIG_PATH, { openHour: 9, closeHour: 22, rooms: [] });
  const bookings = await readJsonSafe<Booking[]>(BOOKINGS_PATH, []);
  const blackouts = await readJsonSafe<BlackoutMap>(BLACKOUTS_PATH, {});
  const closedToday = !!blackouts[date]?.[String(roomId)];

  const dayBookings = bookings
    .filter((b) => b.roomId === roomId && b.date === date)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const labels = generateHalfHourLabels(cfg.openHour, cfg.closeHour);

  const slots: Avail['slots'] = labels.map((time) => {
    const startIso = toLocalOffsetISO(new Date(`${date}T${time}:00`));
    const [hh, mm] = time.split(':').map(Number);
    const endMinutes = hh * 60 + mm + 30;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');
    const endIso = toLocalOffsetISO(new Date(`${date}T${endH}:${endM}:00`));

    if (closedToday) {
      return { time, isoStart: startIso, isoEnd: endIso, status: 'booked' as const };
    }

    const start = new Date(startIso);
    const end = new Date(endIso);
    const booked = dayBookings.some((b) => {
      const bs = new Date(b.startIso);
      const be = new Date(b.endIso);
      return start < be && bs < end;
    });

    return { time, isoStart: startIso, isoEnd: endIso, status: booked ? 'booked' : 'free' };
  });

  const av: Avail = {
    date,
    roomId,
    openHour: cfg.openHour,
    closeHour: cfg.closeHour,
    slots,
    closed: closedToday,
  };
  return NextResponse.json(av);
}
