# Layout And Header

The current app uses a public shell with language-prefixed routes and a cream/red GuideNextdoor visual system.

## Global Shell

- `App.jsx` redirects `/` to `/en`.
- Public routes are nested under `/:lang/*`.
- `supportedLangs` currently contains `en`.
- The app should keep `Navbar`, `main`, and `Footer` consistent across public pages.

## Header Priorities

The header should support:
- Brand link to `/en`.
- Explore link to `/en/explore`.
- Search/book or sessions entry points as those pages are built.
- Messages entry point for authenticated users.
- Become Guide / instructor entry point.
- Auth controls once authentication UI is implemented.

## Public Explore

Explore is public and social-first. The header must not make Explore feel like a coach directory or booking marketplace before the user engages with posts.

## Future Auth Header

Authenticated users should see:
- Message indicator.
- Notification indicator.
- Create post action for approved instructors.
- Account/profile menu.

Keep notification and create-post controls DB-backed. Do not ship static counters.
