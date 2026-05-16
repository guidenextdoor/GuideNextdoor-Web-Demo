-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA public;

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    email text UNIQUE NOT NULL,
    username text,
    gender text,
    age integer,
    avatar_url text,
    legal_first_name text,
    legal_last_name text,
    terms_accepted_at timestamptz,
    last_login_at timestamptz,
    account_status text DEFAULT 'Active'::text,
    device_id text,
    push_token text,
    push_notifications_enabled boolean DEFAULT true,
    language_preference text DEFAULT 'TC'::text
);

-- Reference Activities
CREATE TABLE IF NOT EXISTS public.ref_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    translation_key text NOT NULL,
    icon_name text NOT NULL,
    is_active boolean DEFAULT true,
    category_key text
);

-- Reference Qualifications
CREATE TABLE IF NOT EXISTS public.ref_qualifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid REFERENCES public.ref_activities(id),
    qualification_name text NOT NULL
);

-- Instructor Profiles
CREATE TABLE IF NOT EXISTS public.instructor_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id),
    bio_description text,
    raw_id_url text,
    id_verification_status text DEFAULT 'Pending'::text,
    average_rating numeric DEFAULT 0.0
);

-- Instructor Services
CREATE TABLE IF NOT EXISTS public.instructor_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id uuid REFERENCES public.instructor_profiles(id),
    activity_id uuid REFERENCES public.ref_activities(id),
    qualification_id uuid REFERENCES public.ref_qualifications(id),
    years_of_experience integer,
    tags text[],
    service_description text,
    raw_cert_url text,
    masked_cert_url text,
    service_approval_status text DEFAULT 'Pending'::text
);

-- Instructor Pricing
CREATE TABLE IF NOT EXISTS public.instructor_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid REFERENCES public.instructor_services(id),
    skill_level text NOT NULL,
    price_1_pax integer,
    price_2_pax integer,
    price_3_pax integer,
    price_4_pax integer
);

-- Locations
CREATE TABLE IF NOT EXISTS public.locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id text UNIQUE,
    formatted_address text NOT NULL,
    country text,
    city_or_region text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    geom geography(POINT, 4326),
    created_at timestamptz DEFAULT now()
);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    learner_id uuid REFERENCES public.users(id),
    service_id uuid REFERENCES public.instructor_services(id),
    lesson_date date NOT NULL,
    start_time_utc time NOT NULL,
    duration_hours integer NOT NULL,
    group_size integer NOT NULL,
    skill_level_booked text NOT NULL,
    total_price integer NOT NULL,
    status text DEFAULT 'Pending'::text,
    cancelled_at timestamptz
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid REFERENCES public.bookings(id),
    sender_id uuid REFERENCES public.users(id),
    text_content text,
    image_url text,
    created_at timestamptz DEFAULT now()
);

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id uuid REFERENCES public.instructor_profiles(id),
    service_id uuid REFERENCES public.instructor_services(id),
    activity_id uuid REFERENCES public.ref_activities(id),
    media_url text NOT NULL,
    caption text,
    created_at timestamptz DEFAULT now(),
    aspect_ratio double precision,
    hashtags text[] DEFAULT '{}'::text[],
    approval_status text DEFAULT 'pending'::text,
    title text,
    likes_count integer DEFAULT 0,
    image_urls text[] DEFAULT '{}'::text[]
);

-- Saved Posts
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    post_id uuid NOT NULL REFERENCES public.posts(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, post_id)
);

-- Service Coverage Areas
CREATE TABLE IF NOT EXISTS public.service_coverage_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid REFERENCES public.instructor_services(id),
    location_id uuid REFERENCES public.locations(id)
);

-- Service Media
CREATE TABLE IF NOT EXISTS public.service_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid REFERENCES public.instructor_services(id),
    media_url text NOT NULL,
    created_at timestamptz DEFAULT now()
);
