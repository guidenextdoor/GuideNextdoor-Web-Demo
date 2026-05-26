# Posts, Reviews, And Notifications

This spec covers social creation, review capture, and notification surfaces.

## Create Post

Instructors can create posts after authentication and instructor approval.

Write to:
- `posts`

Use:
- `instructor_id`
- `service_id`
- `location_id`
- `title`
- `caption`
- `media_url` or `image_urls`
- `hashtags`
- `approval_status`

New posts should default to pending moderation unless the admin policy changes.

Do not use old free-text `location_text`, `location_lat`, or `location_lng` fields unless a future migration reintroduces them.

## Post Moderation

Public Explore shows only:
- `approval_status = approved`

Internal moderation labels should not appear on public post cards.

## Reviews

Reviews are tied to completed bookings.

Write to:
- `reviews`

Use:
- `booking_id`
- `rating`
- `comment`

Only eligible learners should be able to review completed bookings.

## Notifications

Notification UI should wait for a DB-backed model. Expected events:
- Booking request created.
- Booking status changed.
- New message received.
- Post approved/rejected.
- Review received.

Do not ship static notification counters.
