# Bookings, Profile, And Settings

These account surfaces should be private and DB-backed.

## Bookings

Learners need:
- Upcoming booking requests.
- Past bookings.
- Booking status.
- Instructor/service summary.
- Link to chat.
- Review CTA after completion.

Instructors need:
- Incoming requests.
- Confirmed sessions.
- Completed sessions.
- Status controls where permitted.

Use:
- `bookings`
- `instructor_services`
- `instructor_profiles`
- `users`
- `messages`
- `reviews`

## Profile

Users should manage:
- Display name.
- Avatar.
- Preferred language.
- Basic contact/account fields.

Use:
- `users`

## Instructor Settings

Approved instructors should manage:
- Bio.
- Cover image.
- Qualifications.
- Service list.
- Pricing.
- Locations.

Use:
- `instructor_profiles`
- `instructor_services`
- `instructor_pricing`
- `locations`
- `ref_activities`

## Guardrails

Do not show private account pages to unauthenticated users. Do not expose admin-only fields or service role capabilities in the browser.
