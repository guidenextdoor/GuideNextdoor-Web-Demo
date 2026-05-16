# Database Schema - GuideNextdoor

This document serves as the "Golden Source" for the GuideNextdoor database structure. It mirrors the schema replicated from the Kakko project to the `guidenextdoor` project.

## Overview
The database is built on **PostgreSQL** (Supabase) and utilizes the following extensions:
- `uuid-ossp`: For UUID generation.
- `postgis`: For spatial and geographic data (locations).

---

## Tables Reference

### 1. `users`
Core user account information.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `email` | `text` | NO | - | Unique |
| `username` | `text` | YES | - | |
| `legal_first_name` | `text` | YES | - | |
| `legal_last_name` | `text` | YES | - | |
| `gender` | `text` | YES | - | |
| `age` | `integer` | YES | - | |
| `avatar_url` | `text` | YES | - | |
| `account_status` | `text` | YES | `'Active'` | |
| `language_preference`| `text` | YES | `'TC'` | |
| `push_token` | `text` | YES | - | |
| `created_at` | `timestamptz`| YES | `now()` | |

### 2. `instructor_profiles`
Extended profile for users who are instructors/guides.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `user_id` | `uuid` | YES | - | FK -> `users.id` |
| `bio_description` | `text` | YES | - | |
| `average_rating` | `numeric` | YES | `0.0` | |
| `id_verification_status`| `text`| YES | `'Pending'` | |

### 3. `ref_activities`
Reference list of activities (e.g., Skiing, Diving).
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `translation_key` | `text` | NO | - | For i18n |
| `icon_name` | `text` | NO | - | |
| `category_key` | `text` | YES | - | |
| `is_active` | `boolean` | YES | `true` | |

### 4. `instructor_services`
Services offered by instructors linked to specific activities.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `instructor_id` | `uuid` | YES | - | FK -> `instructor_profiles.id` |
| `activity_id` | `uuid` | YES | - | FK -> `ref_activities.id` |
| `qualification_id` | `uuid` | YES | - | FK -> `ref_qualifications.id` |
| `years_of_experience`| `integer` | YES | - | |
| `tags` | `text[]` | YES | - | |
| `service_approval_status`| `text`| YES | `'Pending'` | |

### 5. `instructor_pricing`
Pricing tiers based on skill level and group size.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `service_id` | `uuid` | YES | - | FK -> `instructor_services.id` |
| `skill_level` | `text` | NO | - | |
| `price_1_pax` | `integer` | YES | - | |
| `price_4_pax` | `integer` | YES | - | |

### 6. `locations`
Geospatial data for service areas or meeting points.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `place_id` | `text` | YES | - | Unique (Google Place ID) |
| `formatted_address` | `text` | NO | - | |
| `latitude` | `double` | NO | - | |
| `longitude` | `double` | NO | - | |
| `geom` | `geography`| YES | - | PostGIS Point (4326) |

### 7. `bookings`
Transaction records for scheduled lessons.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `learner_id` | `uuid` | YES | - | FK -> `users.id` |
| `service_id` | `uuid` | YES | - | FK -> `instructor_services.id` |
| `lesson_date` | `date` | NO | - | |
| `total_price` | `integer` | NO | - | |
| `status` | `text` | YES | `'Pending'` | |

### 8. `posts`
Social feed content created by instructors.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `instructor_id` | `uuid` | YES | - | FK -> `instructor_profiles.id` |
| `media_url` | `text` | NO | - | Main image/video |
| `likes_count` | `integer` | YES | `0` | |
| `approval_status` | `text` | YES | `'pending'` | |

### 9. `messages`
In-app communication linked to bookings.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `booking_id` | `uuid` | YES | - | FK -> `bookings.id` |
| `sender_id` | `uuid` | YES | - | FK -> `users.id` |
| `text_content` | `text` | YES | - | |

### 10. `reviews`
User feedback for completed bookings.
| Column | Type | Nullable | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `booking_id` | `uuid` | YES | - | FK -> `bookings.id` |
| `rating` | `integer` | YES | - | |
| `comment` | `text` | YES | - | |

---

## Entity Relationship Summary
- **Users** can be **Instructors**.
- **Instructors** offer **Services** (linked to **Activities**).
- **Services** have multiple **Pricing** tiers and **Media**.
- **Learners** (Users) create **Bookings** for **Services**.
- **Bookings** generate **Messages** and **Reviews**.
- **Instructors** create **Posts** which can be **Saved** by **Users**.
