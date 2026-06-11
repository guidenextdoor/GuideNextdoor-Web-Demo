alter table public.instructor_services
  add column if not exists activity_image_urls text[] not null default '{}'::text[];
