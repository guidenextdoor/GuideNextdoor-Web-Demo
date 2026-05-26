# AI Prompt Guide

Use these prompts when asking an AI coding agent to continue the rebuild.

## Ground Rules

Always tell the agent:

```text
This is the current GuideNextdoor Vite React app. Do not assume Next.js App Router.
All user-visible production data must be Supabase-backed.
Use existing repo patterns before adding new abstractions.
All interface copy must go through src/i18n/locales/en.json first.
The browser app must use only VITE_SUPABASE_ANON_KEY, never the service role key.
```

## Explore Prompt

```text
Continue the GuideNextdoor Explore page as a public social post wall.
Keep the page simple: one search field, uniform image grid, and an Instagram-like post detail modal.
Use Supabase posts joined to instructor_profiles, users, and locations.
Use post_likes and saved_posts for DB-backed like/save state.
Do not show approval labels, role filter pills, post counts, or coach-directory cards.
```

## Instructor Profile Prompt

```text
Build the instructor profile page for /en/guide/:id.
Use instructor_profiles, users, instructor_services, ref_activities, instructor_pricing, locations, posts, and reviews.
Only approved/verified instructors should be publicly visible.
Connect the Explore modal View sessions CTA to the profile services section when ready.
```

## Search And Book Prompt

```text
Build the learner search/book flow using approved instructor_services.
Filters must map to real Supabase fields.
No payment flow is required for the MVP.
Booking requests should write to bookings and create an initial message when useful.
```

## Dashboard Prompt

```text
Build a private instructor dashboard for approved instructors.
Include bookings, messages, services, posts, and profile management.
Every list and count must come from Supabase.
New posts should remain pending until approved.
```

## Localization Prompt

```text
Implement the English UI first through src/i18n/locales/en.json.
Do not hardcode user interface strings in JSX.
Prepare keys so zh-HK and zh-CN can be added by translating JSON later.
User-generated content should remain in its original language unless an explicit translation feature is built.
```
