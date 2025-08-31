// app/api/config/route.ts
import { readJsonSafe, writeJsonSafe } from '@/lib/fs';
import type { ApiError, Config, Room } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

const CONFIG_PATH = 'data/config.json';

export async function GET() {
  const cfg = await readJsonSafe<Config>(CONFIG_PATH, {
    openHour: 9,
    closeHour: 22,
    rooms: [],
    customerNotice: '',
  });
  return NextResponse.json(cfg);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Partial<Config>));

  const cur = await readJsonSafe<Config>(CONFIG_PATH, {
    openHour: 9,
    closeHour: 22,
    rooms: [],
    customerNotice: '',
  });

  // 부분 업데이트
  let next: Config = { ...cur };

  if ('openHour' in body && typeof body.openHour === 'number') next.openHour = body.openHour;
  if ('closeHour' in body && typeof body.closeHour === 'number') next.closeHour = body.closeHour;
  if ('customerNotice' in body && typeof body.customerNotice === 'string')
    next.customerNotice = body.customerNotice;

  // rooms 갱신
  if ('rooms' in body && Array.isArray(body.rooms)) {
    const rooms = body.rooms as Room[];

    // 간단 검증
    const ok = rooms.every(
      (r) =>
        typeof r.id === 'number' &&
        typeof r.name === 'string' &&
        typeof r.hourlyPrice === 'number' &&
        Array.isArray(r.photos),
    );
    if (!ok) {
      return NextResponse.json<ApiError>(
        { error: 'rooms 형식이 올바르지 않습니다.' },
        { status: 400 },
      );
    }

    // sanitize
    next.rooms = rooms.map((r) => ({
      id: r.id,
      name: r.name,
      hourlyPrice: r.hourlyPrice,
      photos: r.photos,
      capacity: typeof r.capacity === 'number' ? r.capacity : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
    }));
  }

  // 운영시간 검증
  if (
    typeof next.openHour !== 'number' ||
    typeof next.closeHour !== 'number' ||
    next.closeHour <= next.openHour
  ) {
    return NextResponse.json<ApiError>({ error: '운영시간이 올바르지 않습니다.' }, { status: 400 });
  }

  await writeJsonSafe(CONFIG_PATH, next);
  return NextResponse.json(next);
}
