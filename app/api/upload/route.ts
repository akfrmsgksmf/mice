// app/api/upload/route.ts
import { writeFile } from '@/lib/fs';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// ✅ Node API를 쓰므로 런타임을 nodejs로 고정
export const runtime = 'nodejs';
// (선택) 빌드 캐시/정적 판단 방지
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll('file'); // input name="file" (여러 개 가능)

    const uploadDir = 'public/uploads'; // 공개 경로
    const urls: string[] = [];

    for (const item of files) {
      if (!(item instanceof File)) continue;

      // 브라우저 File → ArrayBuffer → Buffer
      const ab = await item.arrayBuffer();
      // 둘 중 하나 써도 됩니다. (TS 친화적으로 Uint8Array 추천)
      const u8 = new Uint8Array(ab);
      // const buffer = Buffer.from(ab);

      const orig = item.name || 'image';
      const ext = path.extname(orig) || '.jpg';
      const rand = crypto.randomUUID();
      const filename = `${Date.now()}-${rand}${ext}`;

      const dest = path.join(uploadDir, filename);
      await writeFile(dest, u8);

      urls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '업로드 실패' }, { status: 500 });
  }
}
