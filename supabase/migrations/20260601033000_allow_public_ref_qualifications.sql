alter table public.ref_qualifications enable row level security;

drop policy if exists "Anyone can read ref_qualifications" on public.ref_qualifications;
create policy "Anyone can read ref_qualifications"
on public.ref_qualifications
for select
to anon, authenticated
using (true);
