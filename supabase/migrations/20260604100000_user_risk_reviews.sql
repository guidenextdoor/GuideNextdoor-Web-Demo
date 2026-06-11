create table if not exists public.user_risk_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reviewed_by_staff_member_id uuid references public.staff_members(id),
  reviewed_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists user_risk_reviews_user_reviewed_idx
on public.user_risk_reviews (user_id, reviewed_at desc);

alter table public.user_risk_reviews enable row level security;

drop policy if exists "staff can read user risk reviews" on public.user_risk_reviews;
create policy "staff can read user risk reviews"
on public.user_risk_reviews for select
using (public.staff_has_permission('user.block') or public.staff_has_permission('audit.view'));

drop policy if exists "staff can create user risk reviews" on public.user_risk_reviews;
create policy "staff can create user risk reviews"
on public.user_risk_reviews for insert
with check (public.staff_has_permission('user.block'));
