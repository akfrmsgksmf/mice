import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll('files');
    if (!files || files.length === 0) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];

    for (const item of files) {
      if (!(item instanceof File)) continue;

      // ArrayBuffer -> Uint8Array (TS 타입 충돌 방지)
      const arrayBuffer = await item.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // 파일명/확장자
      const orig = item.name || 'image';
      const ext = path.extname(orig) || '.jpg';
      const rand = crypto.randomUUID();
      const filename = `${Date.now()}-${rand}${ext}`;

      // 저장
      const dest = path.join(uploadDir, filename);
      await writeFile(dest, bytes);

      // 접근 경로
      urls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '업로드 실패' }, { status: 500 });
  }
}
