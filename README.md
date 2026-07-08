# MiniCord

A tiny Discord-style web app with accounts, friends, DMs, group chats, realtime messages, and browser voice calls.

## Run it

1. Open your Supabase project.
2. Go to the SQL editor and run `supabase-schema.sql`.
3. Deploy this folder to Vercel.

## Deploy to Vercel

Import this repository in Vercel. It builds into a static `dist` folder.

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Notes

Voice calls use browser microphone access and WebRTC. They need HTTPS, so they work best on the Vercel deployment. Supabase is used for auth, data, realtime messages, and voice-call signaling.
