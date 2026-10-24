import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.json({ error: "Cloud sharing is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const sql = (body as { sql?: unknown })?.sql;
  if (typeof sql !== "string" || !sql.trim() || sql.length > 200_000) {
    return NextResponse.json({ error: "SQL must be between 1 and 200,000 characters." }, { status: 400 });
  }
  try {
    const response = await fetch(config.url + "/rest/v1/shared_schemas?select=id", {
      method: "POST",
      headers: { ...config.headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ sql }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Unable to create share link." }, { status: 502 });
    const rows = await response.json() as Array<{ id: string }>;
    return NextResponse.json({ id: rows[0]?.id });
  } catch {
    return NextResponse.json({ error: "Unable to reach share storage." }, { status: 502 });
  }
}
