import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

const MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    const extension = MIME_EXTENSIONS[file.type];
    if (!extension) return NextResponse.json({ error: "Only JPEG, PNG and WebP images are allowed." }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be smaller than 5 MB." }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const directory = path.join(process.cwd(), "public", "uploads", "designs");
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
    return NextResponse.json({ url: `/uploads/designs/${filename}` });
  } catch {
    return NextResponse.json({ error: "Image upload is unavailable." }, { status: 500 });
  }
}
