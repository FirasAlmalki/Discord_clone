# MiniCord

A tiny Discord-style web app with servers, text channels, realtime messages, and display names.

## Run it

1. Open your Supabase project.
2. Go to the SQL editor and run `supabase-schema.sql`.
3. Start the local server:

```powershell
node server.mjs
```

4. Open `http://localhost:5173`.

## Deploy to Vercel

Import this repository in Vercel as a static project. No build command is needed.

## Notes

This is intentionally simple. It uses public Supabase row policies so anyone with the app can create servers, channels, and messages. For a private production app, add real authentication and stricter policies.
