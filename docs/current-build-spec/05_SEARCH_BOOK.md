# Search And Book

The Search/Book surface should come after Explore and instructor profile pages. Its job is to help learners find approved services and start a booking request.

## Route Direction

Candidate route:
- `/en/sessions`

Current placeholder:
- `WorkspaceView` is used for `/en/sessions`.

## Search Inputs

Search should support:
- Activity keyword.
- Location.
- Date or date range.
- Skill level.
- Group size.

Avoid non-DB-backed filters. If a filter appears in the UI, it must map to Supabase fields or a documented planned migration.

## Data Sources

Use:
- `instructor_services`
- `instructor_profiles`
- `users`
- `ref_activities`
- `instructor_pricing`
- `locations`

Only show instructor services where the service and instructor are approved.

## Results

Each result should show:
- Activity/service name.
- Instructor name and avatar.
- Location.
- Experience or qualification summary.
- Starting price when available.
- Rating when available.
- Primary CTA to request booking.
- Secondary CTA to view instructor profile.

No payment flow is required for the MVP.
