# Database Schema

This spec follows the current GuideNextdoor Supabase shape used by the Vite app. Do not use the older `profiles`, `services`, or `post_interactions` names unless a future migration explicitly introduces them.

## Core Tables

### `users`

Auth-linked user record and public identity fields.

Important fields:
- `id`
- `email`
- `username`
- `display_name` when present
- `avatar_url`
- `language_preference`
- `created_at`

### `instructor_profiles`

Instructor-specific profile and verification state.

Important fields:
- `id`
- `user_id` references `users.id`
- `bio_description`
- `average_rating`
- `id_verification_status`
- `cover_photo_url`

Public instructor visibility must depend on admin verification/approval.

### `ref_activities`

Canonical activity taxonomy.

Important fields:
- `id`
- `translation_key`
- `icon_name`
- `category_key`
- `is_active`

### `instructor_services`

Approved activities offered by instructors.

Important fields:
- `id`
- `instructor_id` references `instructor_profiles.id`
- `activity_id` references `ref_activities.id`
- `qualification_id`
- `years_of_experience`
- `tags`
- `service_approval_status`

### `instructor_pricing`

Pricing tiers connected to an instructor service.

Important fields:
- `id`
- `service_id` references `instructor_services.id`
- `skill_level`
- `price_1_pax`
- `price_4_pax`

### `locations`

Canonical location records for services, posts, and future search.

Important fields:
- `id`
- `name`
- `city`
- `country`
- `formatted_address`
- `latitude`
- `longitude`
- `geom`

Posts should use `posts.location_id` rather than free-text location columns.

### `posts`

Social feed content, currently the first product surface.

Important fields:
- `id`
- `instructor_id` references `instructor_profiles.id`
- `service_id`
- `location_id` references `locations.id`
- `title`
- `caption`
- `media_url`
- `image_urls`
- `hashtags`
- `likes_count`
- `comments_count`
- `approval_status`
- `created_at`

Public Explore must fetch only `approval_status = approved`.

### `post_likes`

DB-backed post likes.

Important fields:
- `user_id`
- `post_id`
- `created_at`

Expected contract: one row per `(user_id, post_id)`.

### `post_comments`

DB-backed comments for public posts.

Important fields:
- `id`
- `post_id` references `posts.id`
- `user_id` references `users.id`
- `parent_comment_id` references `post_comments.id`
- `body`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Comments should be stored as child rows, not embedded in `posts`, so each comment can have its own author, timestamp, moderation state, RLS policy, and deletion behavior.

### `saved_posts`

DB-backed saved-post state.

Important fields:
- `user_id`
- `post_id`
- `created_at`

Expected contract: one row per `(user_id, post_id)`.

### `bookings`

Lesson/session request and scheduling record.

Important fields:
- `id`
- `learner_id` references `users.id`
- `service_id` references `instructor_services.id`
- `lesson_date`
- `total_price`
- `status`

No in-app payment is required for the current MVP.

### `messages`

Chat messages, initially connected to bookings.

Important fields:
- `id`
- `booking_id`
- `sender_id`
- `text_content`
- `created_at`

### `reviews`

Post-session review content.

Important fields:
- `id`
- `booking_id`
- `rating`
- `comment`
- `created_at`

## Frontend Data Rule

All user-visible production data should come from Supabase. Temporary local fallback content is allowed only for empty/loading states or resilience while a table/RLS policy is being finished.
