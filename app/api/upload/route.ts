// app/api/upload/route.ts
import { writeFile } from '@/lib/fs';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import path from 'node:path';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll('file');

    const uploadDir = 'public/uploads'; // 공개 경로
    const urls: string[] = [];

    for (const item of files) {
      if (!(item instanceof File)) continue;

      // 파일 → Buffer
      const arrayBuffer = await item.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 이름/확장자
      const orig = item.name || 'image';
      const ext = path.extname(orig) || '.jpg';
      const rand = crypto.randomUUID();
      const filename = `${Date.now()}-${rand}${ext}`;

      // 실제 저장
      const dest = path.join(uploadDir, filename);
      await writeFile(dest, buffer); // <-- writeFile 시그니처와 타입 일치

      // 브라우저 접근 경로
      urls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '업로드 실패' }, { status: 500 });
  }
}
