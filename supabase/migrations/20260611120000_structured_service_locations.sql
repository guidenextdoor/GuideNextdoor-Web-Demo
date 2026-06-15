create extension if not exists pgcrypto;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ref_service_locations (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  country_code text not null,
  region text not null,
  district text not null,
  display_name text not null,
  slug text not null unique,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone text not null,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ref_service_locations_active_sort_idx
  on public.ref_service_locations (is_active, sort_order, country, region, district);

create index if not exists ref_service_locations_geo_idx
  on public.ref_service_locations (latitude, longitude);

drop trigger if exists trg_ref_service_locations_updated_at on public.ref_service_locations;
create trigger trg_ref_service_locations_updated_at
before update on public.ref_service_locations
for each row execute function public.update_updated_at_column();

create table if not exists public.service_location_areas (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.instructor_services(id) on delete cascade,
  location_id uuid not null references public.ref_service_locations(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (service_id, location_id)
);

create index if not exists service_location_areas_service_idx
  on public.service_location_areas (service_id);

create index if not exists service_location_areas_location_idx
  on public.service_location_areas (location_id);

insert into public.ref_service_locations
  (country, country_code, region, district, display_name, slug, latitude, longitude, timezone, sort_order)
values
  ('Hong Kong', 'HK', 'Hong Kong Island', 'Causeway Bay', 'Causeway Bay, Hong Kong', 'causeway-bay-hong-kong', 22.2803000, 114.1829000, 'Asia/Hong_Kong', 10),
  ('Hong Kong', 'HK', 'Hong Kong Island', 'Central', 'Central, Hong Kong', 'central-hong-kong', 22.2819000, 114.1589000, 'Asia/Hong_Kong', 11),
  ('Hong Kong', 'HK', 'Kowloon', 'Tsim Sha Tsui', 'Tsim Sha Tsui, Hong Kong', 'tsim-sha-tsui-hong-kong', 22.2988000, 114.1722000, 'Asia/Hong_Kong', 12),
  ('Hong Kong', 'HK', 'Kowloon', 'Mong Kok', 'Mong Kok, Hong Kong', 'mong-kok-hong-kong', 22.3193000, 114.1694000, 'Asia/Hong_Kong', 13),
  ('Hong Kong', 'HK', 'New Territories', 'Sai Kung', 'Sai Kung, Hong Kong', 'sai-kung-hong-kong', 22.3837000, 114.2708000, 'Asia/Hong_Kong', 14),
  ('Japan', 'JP', 'Tokyo', 'Shinjuku', 'Shinjuku, Tokyo, Japan', 'shinjuku-tokyo-japan', 35.6938000, 139.7034000, 'Asia/Tokyo', 30),
  ('Japan', 'JP', 'Tokyo', 'Shibuya', 'Shibuya, Tokyo, Japan', 'shibuya-tokyo-japan', 35.6618000, 139.7041000, 'Asia/Tokyo', 31),
  ('Japan', 'JP', 'Niseko', 'Hirafu', 'Hirafu, Niseko, Japan', 'hirafu-niseko-japan', 42.8621000, 140.7044000, 'Asia/Tokyo', 40),
  ('Japan', 'JP', 'Niseko', 'Annupuri', 'Annupuri, Niseko, Japan', 'annupuri-niseko-japan', 42.8483000, 140.6313000, 'Asia/Tokyo', 41),
  ('Japan', 'JP', 'Niseko', 'Niseko Village', 'Niseko Village, Niseko, Japan', 'niseko-village-niseko-japan', 42.8453000, 140.6782000, 'Asia/Tokyo', 42),
  ('Japan', 'JP', 'Hakuba', 'Happo', 'Happo, Hakuba, Japan', 'happo-hakuba-japan', 36.7021000, 137.8354000, 'Asia/Tokyo', 50),
  ('Japan', 'JP', 'Hakuba', 'Goryu', 'Goryu, Hakuba, Japan', 'goryu-hakuba-japan', 36.6625000, 137.8374000, 'Asia/Tokyo', 51),
  ('Japan', 'JP', 'Osaka', 'Namba', 'Namba, Osaka, Japan', 'namba-osaka-japan', 34.6654000, 135.5019000, 'Asia/Tokyo', 60),
  ('Japan', 'JP', 'Kyoto', 'Gion', 'Gion, Kyoto, Japan', 'gion-kyoto-japan', 35.0037000, 135.7786000, 'Asia/Tokyo', 70),
  ('Indonesia', 'ID', 'Bali', 'Canggu', 'Canggu, Bali, Indonesia', 'canggu-bali-indonesia', -8.6500000, 115.1383000, 'Asia/Makassar', 80),
  ('Indonesia', 'ID', 'Bali', 'Seminyak', 'Seminyak, Bali, Indonesia', 'seminyak-bali-indonesia', -8.6913000, 115.1682000, 'Asia/Makassar', 81),
  ('Indonesia', 'ID', 'Bali', 'Uluwatu', 'Uluwatu, Bali, Indonesia', 'uluwatu-bali-indonesia', -8.8291000, 115.0849000, 'Asia/Makassar', 82),
  ('South Korea', 'KR', 'Seoul', 'Hongdae', 'Hongdae, Seoul, South Korea', 'hongdae-seoul-south-korea', 37.5563000, 126.9220000, 'Asia/Seoul', 90),
  ('Taiwan', 'TW', 'Taipei', 'Xinyi', 'Xinyi, Taipei, Taiwan', 'xinyi-taipei-taiwan', 25.0330000, 121.5654000, 'Asia/Taipei', 100),
  ('Thailand', 'TH', 'Bangkok', 'Sukhumvit', 'Sukhumvit, Bangkok, Thailand', 'sukhumvit-bangkok-thailand', 13.7367000, 100.5600000, 'Asia/Bangkok', 110)
on conflict (slug) do update set
  country = excluded.country,
  country_code = excluded.country_code,
  region = excluded.region,
  district = excluded.district,
  display_name = excluded.display_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone,
  is_active = true,
  sort_order = excluded.sort_order;

alter table public.ref_service_locations enable row level security;
alter table public.service_location_areas enable row level security;

drop policy if exists "Public can read active service locations" on public.ref_service_locations;
create policy "Public can read active service locations"
on public.ref_service_locations for select
using (is_active = true);

drop policy if exists "Public can read service location areas" on public.service_location_areas;
create policy "Public can read service location areas"
on public.service_location_areas for select
using (true);

drop policy if exists "Instructors can manage own service location areas" on public.service_location_areas;
create policy "Instructors can manage own service location areas"
on public.service_location_areas for all
using (
  exists (
    select 1
    from public.instructor_services s
    join public.instructor_profiles p on p.id = s.instructor_id
    where s.id = service_location_areas.service_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.staff_members sm
    where sm.user_id = auth.uid()
      and sm.status in ('active', 'pending_first_login')
  )
)
with check (
  exists (
    select 1
    from public.instructor_services s
    join public.instructor_profiles p on p.id = s.instructor_id
    where s.id = service_location_areas.service_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.staff_members sm
    where sm.user_id = auth.uid()
      and sm.status in ('active', 'pending_first_login')
  )
);
