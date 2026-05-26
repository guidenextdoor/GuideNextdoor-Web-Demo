# Booking Form

The booking form should be a monthly availability modal or panel launched from a service or instructor profile.

## MVP Scope

The MVP captures a booking request. It does not process payment.

## Required Inputs

- Selected service.
- Preferred date.
- Preferred start time.
- Group size.
- Skill level.
- Address or location details.
- Learner note/message.
- Contact confirmation if needed.

## Data Sources

Read from:
- `instructor_services`
- `instructor_pricing`
- `instructor_availability`
- `instructor_availability_overrides`
- `bookings`
- `ref_activities`
- `locations`
- `users`

Write to:
- `bookings`
- `messages` for the initial learner note when appropriate.

## Validation

Require:
- Authenticated learner.
- Existing approved service.
- Valid date.
- Valid group size.

The form should show clear error states from Supabase writes instead of pretending a booking succeeded.

## Availability Logic

The learner calendar should be computed from:
- Weekly recurring instructor windows from `instructor_availability`.
- Date-specific availability changes from `instructor_availability_overrides`.
- Existing `bookings` for all services owned by the same instructor.

Pending and confirmed bookings should block overlapping time ranges on the learner calendar. Completed/cancelled bookings should not block future slot selection.
