alter table public.posts
add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists posts_location_id_idx
on public.posts(location_id);
