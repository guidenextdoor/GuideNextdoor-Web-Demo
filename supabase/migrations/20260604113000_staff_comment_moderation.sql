alter table public.post_comments
  add column if not exists moderation_reviewed_by_staff_member_id uuid references public.staff_members(id),
  add column if not exists moderation_reviewed_at timestamptz,
  add column if not exists removed_by_staff_member_id uuid references public.staff_members(id),
  add column if not exists removal_reason text,
  add column if not exists moderation_note text;

create index if not exists post_comments_staff_moderation_idx
on public.post_comments (status, updated_at desc, created_at desc);

drop policy if exists "staff_accounts_cannot_update_post_comments" on public.post_comments;
create policy "staff_accounts_cannot_update_post_comments"
  on public.post_comments
  as restrictive
  for update
  to authenticated
  using (public.current_staff_member_id() is null or public.staff_has_permission('user.block'))
  with check (public.current_staff_member_id() is null or public.staff_has_permission('user.block'));

drop policy if exists "staff moderators can update post comments" on public.post_comments;
create policy "staff moderators can update post comments"
on public.post_comments
for update
using (public.staff_has_permission('user.block'))
with check (public.staff_has_permission('user.block'));

create or replace function public.staff_remove_post_comment(
  p_comment_id uuid,
  p_reason text default null,
  p_note text default null
)
returns public.post_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_member_id uuid;
  v_comment public.post_comments;
begin
  if not public.staff_has_permission('user.block') then
    raise exception 'staff_permission_required';
  end if;

  v_staff_member_id := public.current_staff_member_id();

  update public.post_comments
  set
    status = 'deleted',
    deleted_at = coalesce(deleted_at, now()),
    moderation_reviewed_by_staff_member_id = v_staff_member_id,
    moderation_reviewed_at = now(),
    removed_by_staff_member_id = v_staff_member_id,
    removal_reason = nullif(p_reason, ''),
    moderation_note = nullif(p_note, '')
  where id = p_comment_id
  returning * into v_comment;

  if v_comment.id is null then
    raise exception 'comment_not_found';
  end if;

  return v_comment;
end;
$$;

grant execute on function public.staff_remove_post_comment(uuid, text, text) to authenticated;
