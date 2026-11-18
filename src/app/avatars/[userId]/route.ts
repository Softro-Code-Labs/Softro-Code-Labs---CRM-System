import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /avatars/<userId>?v=…: a team member's profile photo. Only for signed-in people. */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await getCurrentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const { userId } = await params;
  const avatar = await db.userAvatar.findUnique({ where: { userId }, select: { data: true, updatedAt: true } });
  if (!avatar) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(avatar.data.byteLength),
      // The URL carries a version, so a new photo gets a new URL. Private: never cached by shared proxies.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Last-Modified": avatar.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
