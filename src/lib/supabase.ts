export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return {
    url: url.replace(/\/$/, ""),
    headers: {
      apikey: key,
      ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key }),
    },
  };
}
