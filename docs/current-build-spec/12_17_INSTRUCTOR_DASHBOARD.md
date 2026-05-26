# Instructor Dashboard

The instructor dashboard is the private workspace for approved instructors.

## Route Direction

Use private routes under the language prefix, for example:
- `/en/instructor`
- `/en/instructor/bookings`
- `/en/instructor/messages`
- `/en/instructor/services`
- `/en/instructor/posts`
- `/en/instructor/profile`

Exact routing can be decided when the dashboard shell is implemented.

## Sections

Overview:
- Upcoming sessions.
- Pending booking requests.
- Recent messages.
- Post/service moderation state.

Bookings:
- Request queue.
- Confirmed sessions.
- Completed sessions.

Schedule:
- Monthly calendar view with previous/next month navigation.
- Weekly recurring availability editor backed by `instructor_availability`.
- Date-specific override editor backed by `instructor_availability_overrides`.
- Confirmed and pending bookings shown as blocked ranges.
- Conflict checks should use `lesson_date`, `start_time_utc`, and `duration_hours` from `bookings`.
- Updating availability should affect learner booking calendars immediately on next data fetch.

Inbox:
- Booking-linked conversations.

Services:
- Create/edit instructor services.
- Activity, qualification, tags, experience.
- Pricing tiers.
- Location coverage.

Posts:
- Create/edit posts.
- Upload/select media URL.
- Caption, hashtags, linked service, linked location.
- Approval status.

Profile:
- Bio.
- Cover image.
- Verification state.
- Public profile preview.

## Data Rules

Every list and count must come from Supabase. Avoid mock dashboard metrics unless clearly labeled as placeholder during implementation.

Availability should be computed, not stored as static monthly slots unless a future scale issue requires materialized slot tables. The canonical sources are weekly availability, date overrides, and booking records.
