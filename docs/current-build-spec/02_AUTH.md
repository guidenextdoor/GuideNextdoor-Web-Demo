# Auth

GuideNextdoor supports three user modes:

- Learner
- Instructor
- Both

The web MVP should keep public discovery accessible without login, especially Explore. Login becomes required when a user performs private actions such as like, save, message, booking request, profile edits, or instructor dashboard access.

## Public User

Can:
- View approved public posts on Explore.
- Open post detail modal.
- Search public Explore content.
- View approved instructor profiles once built.
- View approved instructor services once built.

Cannot:
- Like or save posts.
- Message instructors.
- Create booking requests.
- Create posts.
- Access dashboard pages.

## Authenticated Learner

Can:
- Like and save posts with rows in `post_likes` and `saved_posts`.
- Message instructors after the relevant flow is connected.
- Request sessions.
- Manage bookings and account settings.

## Authenticated Instructor

Can:
- Manage instructor profile data.
- Create and manage services.
- Create posts for moderation.
- Respond to messages and booking requests.

Instructor public visibility requires admin approval/verification.

## Implementation Notes

- Current app reads Supabase browser auth session from `localStorage` in `src/lib/database.js`.
- Browser requests must use `VITE_SUPABASE_ANON_KEY`.
- Service role keys are server/admin-only and must not be referenced from React code.
- Route protection should be added at the page level as the private flows are implemented.
