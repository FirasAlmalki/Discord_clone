# MiniCord

A tiny Discord-style web app with servers, text channels, realtime messages, and display names.

## Run it

1. Open your Supabase project.
2. Go to the SQL editor and run `supabase-schema.sql`.
3. Deploy this folder to Vercel.

## Deploy to Vercel

Import this repository in Vercel as a static project.

- Build command: leave empty
- Output directory: leave empty or use `.`
- Install command: leave empty

## Notes

This is intentionally simple. It uses public Supabase row policies so anyone with the app can create servers, channels, and messages. For a private production app, add real authentication and stricter policies.
