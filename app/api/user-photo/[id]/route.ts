// app/api/user-photo/[id]/route.ts

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";

const GRAPH_API_PHOTO = (userId: string) =>
  `https://graph.microsoft.com/v1.0/users/${userId}/photo/$value`;

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ must await params in App Router
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const photoRes = await fetch(GRAPH_API_PHOTO(id), {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!photoRes.ok) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: photoRes.status }
      );
    }

    const buffer = await photoRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const photo = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({ id, photo });
  } catch (err) {
    console.error("Error fetching photo:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
