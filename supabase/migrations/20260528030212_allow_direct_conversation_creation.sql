alter table public.conversations enable row level security;

drop policy if exists "Conversation participants can read conversations" on public.conversations;
drop policy if exists "Authenticated users can create conversations" on public.conversations;
drop policy if exists "Conversation members can add participants" on public.conversation_participants;

create policy "Conversation participants can read conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = conversations.id
      and participant.user_id = auth.uid()
  )
);

create policy "Authenticated users can create conversations"
on public.conversations
for insert
to authenticated
with check (true);

create policy "Conversation members can add participants"
on public.conversation_participants
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = conversation_participants.conversation_id
      and participant.user_id = auth.uid()
  )
);
