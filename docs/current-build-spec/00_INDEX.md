# GuideNextdoor Current Build Spec

This folder is the implementation-aligned rebuild spec for the current GuideNextdoor web app. It replaces the older downloaded draft specs where they conflict with the current app and live Supabase model.

## Current Source Of Truth

- Frontend: Vite React SPA in `guide-demo/src`.
- Routing: `react-router-dom`, with language-prefixed routes such as `/en/explore`.
- Styling: Tailwind utility classes plus the GuideNextdoor cream/red visual system.
- Localization: all interface copy starts in `src/i18n/locales/en.json`; later languages are added by translating the JSON files.
- Backend: Supabase REST from `src/lib/database.js` using the public anon key in browser code.
- Private database work: local scripts and admin tasks may use the service role key from `.env`, but it must never be exposed through the frontend bundle.

## Rebuild Order

1. Stabilize the public Explore post wall.
2. Build post detail modal behavior and DB-backed interactions.
3. Build instructor profile pages and connect Explore CTAs.
4. Build search/book flows around approved instructors and services.
5. Build messaging, booking, profile, and instructor dashboard flows.
6. Add admin moderation and notification surfaces.
7. Expand from English to additional languages by translating locale JSON.

## Spec Files

- `01_DATABASE_SCHEMA.md`: current Supabase table contract.
- `02_AUTH.md`: learner/instructor/both roles and auth rules.
- `03_LAYOUT_HEADER.md`: navigation and public/auth shell.
- `04_EXPLORE.md`: social-first public post wall.
- `05_SEARCH_BOOK.md`: search and booking discovery flow.
- `06_INSTRUCTOR_PROFILE.md`: instructor profile requirements.
- `07_BOOKING_FORM.md`: booking request modal requirements.
- `08_CHATROOM.md`: message and booking negotiation flow.
- `09_10_11_BOOKING_PROFILE.md`: bookings, account, and settings flows.
- `12_17_INSTRUCTOR_DASHBOARD.md`: instructor workspace.
- `18_19_20_POST_REVIEW_NOTIF.md`: posting, reviews, moderation, and notifications.
- `21_AI_PROMPT_GUIDE.md`: implementation prompts aligned to this repo.
