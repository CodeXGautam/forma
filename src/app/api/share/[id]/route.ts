import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid share link." }, { status: 400 });
  }
  const config = getSupabaseConfig();
  if (!config) return NextResponse.json({ error: "Cloud sharing is not configured." }, { status: 503 });
  try {
    const response = await fetch(config.url + "/rest/v1/shared_schemas?id=eq." + id + "&select=sql", {
      headers: config.headers,
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Unable to load share link." }, { status: 502 });
    const rows = await response.json() as Array<{ sql: string }>;
    if (!rows.length) return NextResponse.json({ error: "Share link not found." }, { status: 404 });
    return NextResponse.json({ sql: rows[0].sql });
  } catch {
    return NextResponse.json({ error: "Unable to reach share storage." }, { status: 502 });
  }
}
