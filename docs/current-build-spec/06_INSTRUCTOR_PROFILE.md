# Instructor Profile

Instructor profile pages connect the social Explore wall to the booking marketplace.

## Route

Current route:
- `/en/guide/:id`

Current implementation:
- `src/views/GuideProfileView.jsx`

## Public Visibility

Only approved/verified instructors should have public profiles.

## Required Sections

Profile header:
- Cover image when available.
- Avatar.
- Display name.
- Location.
- Rating.
- Verification state if user-facing.
- Bio.

Tabs or sections:
- Posts.
- Sessions/services.
- Reviews.
- About/qualifications.

## Data Sources

Use:
- `instructor_profiles`
- `users`
- `instructor_services`
- `ref_activities`
- `instructor_pricing`
- `locations`
- `posts`
- `reviews`

Current live schema supports service/pricing display and weekly recurring availability through `instructor_availability`, with date-specific changes through `instructor_availability_overrides`. The Sessions tab should show approved services, pricing, service locations, availability windows, and request-session CTAs. Exact booking confirmation still happens through the booking request workflow.

## Explore Integration

From the Explore modal:
- Message opens or starts the chat flow once available.
- View sessions should point to this profile's services section once built.

Do not make `View sessions` a disconnected marketing CTA once the profile is available.
