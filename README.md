# Forma

A local-first SQL schema visualizer built with Next.js, TypeScript, Tailwind CSS, and React Flow. Paste SQL DDL to see tables, columns, keys, indexes, and column-level relationships. Select a table to inspect its structure. The current schema and its name are saved in browser localStorage.

## Run locally

Node.js 20.9 or newer is required.

1. Run npm install
2. Run npm run dev
3. Open http://localhost:3000

No separate backend server or account is required. Next.js route handlers provide the optional sharing API.

## Sharing

The Share schema button first tries to create a short, persistent link in Supabase. Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor, then copy [.env.example](.env.example) to .env.local and set SUPABASE_URL and SUPABASE_SECRET_KEY to your project's URL and secret key (the one beginning with sb_secret_). Keep the secret key server-side; do not use NEXT_PUBLIC_ for it. Restart the Next.js server after changing environment variables. Legacy SUPABASE_SERVICE_ROLE_KEY is also accepted if your project still uses one.

Without Supabase, sharing still works through a compressed, self-contained URL. Those links can get long for large schemas; configure Supabase for short links. Anyone holding a share link can read the SQL. There is no login or editing of an existing shared record.

## SQL support

The parser recognizes common PostgreSQL, MySQL, and SQLite-style CREATE TABLE definitions, including inline and table-level primary keys, unique constraints, foreign keys, CREATE INDEX, and ALTER TABLE ADD constraints. It handles comments and quoted text. Unrecognized statements are ignored, so vendor-specific DDL may need a small cleanup before it can be diagrammed.

## Checks

Run npm run typecheck and npm run build.
