create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  last_message_at timestamptz default now(),
  booking_id uuid null,
  merged_into_conversation_id uuid null references public.conversations(id)
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversations
  add column if not exists participant_one_id uuid references public.users(id),
  add column if not exists participant_two_id uuid references public.users(id);

alter table public.bookings
  add column if not exists conversation_id uuid references public.conversations(id);

alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id),
  add column if not exists message_type text default 'text',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists is_read boolean default false;

update public.conversations conversation
set
  participant_one_id = pair.participant_one_id,
  participant_two_id = pair.participant_two_id
from (
  select
    conversation_id,
    min(user_id::text)::uuid as participant_one_id,
    max(user_id::text)::uuid as participant_two_id
  from public.conversation_participants
  group by conversation_id
  having count(distinct user_id) = 2
) pair
where conversation.id = pair.conversation_id
  and (conversation.participant_one_id is null or conversation.participant_two_id is null);

with ranked as (
  select
    id,
    first_value(id) over (
      partition by participant_one_id, participant_two_id
      order by coalesce(last_message_at, created_at) desc nulls last, created_at desc nulls last, id
    ) as keeper_id,
    row_number() over (
      partition by participant_one_id, participant_two_id
      order by coalesce(last_message_at, created_at) desc nulls last, created_at desc nulls last, id
    ) as row_number
  from public.conversations
  where participant_one_id is not null
    and participant_two_id is not null
    and merged_into_conversation_id is null
)
update public.messages message
set conversation_id = ranked.keeper_id
from ranked
where message.conversation_id = ranked.id
  and ranked.row_number > 1;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by participant_one_id, participant_two_id
      order by coalesce(last_message_at, created_at) desc nulls last, created_at desc nulls last, id
    ) as keeper_id,
    row_number() over (
      partition by participant_one_id, participant_two_id
      order by coalesce(last_message_at, created_at) desc nulls last, created_at desc nulls last, id
    ) as row_number
  from public.conversations
  where participant_one_id is not null
    and participant_two_id is not null
    and merged_into_conversation_id is null
)
update public.conversations conversation
set merged_into_conversation_id = ranked.keeper_id
from ranked
where conversation.id = ranked.id
  and ranked.row_number > 1;

insert into public.conversations (id, participant_one_id, participant_two_id, last_message_at)
select
  gen_random_uuid(),
  case
    when booking.learner_id::text < profile.user_id::text then booking.learner_id
    else profile.user_id
  end,
  case
    when booking.learner_id::text < profile.user_id::text then profile.user_id
    else booking.learner_id
  end,
  coalesce(max(message.created_at), max(booking.created_at), now())
from public.bookings booking
join public.instructor_services service
  on service.id = booking.service_id
join public.instructor_profiles profile
  on profile.id = service.instructor_id
left join public.messages message
  on message.booking_id = booking.id
where booking.learner_id is not null
  and profile.user_id is not null
  and not exists (
    select 1
    from public.conversations existing
    where existing.participant_one_id = case
        when booking.learner_id::text < profile.user_id::text then booking.learner_id
        else profile.user_id
      end
      and existing.participant_two_id = case
        when booking.learner_id::text < profile.user_id::text then profile.user_id
        else booking.learner_id
      end
      and existing.merged_into_conversation_id is null
  )
group by booking.learner_id, profile.user_id;

insert into public.conversation_participants (conversation_id, user_id)
select conversation.id, conversation.participant_one_id
from public.conversations conversation
where conversation.participant_one_id is not null
on conflict do nothing;

insert into public.conversation_participants (conversation_id, user_id)
select conversation.id, conversation.participant_two_id
from public.conversations conversation
where conversation.participant_two_id is not null
on conflict do nothing;

update public.bookings booking
set conversation_id = conversation.id
from public.instructor_services service,
  public.instructor_profiles profile,
  public.conversations conversation
where service.id = booking.service_id
  and profile.id = service.instructor_id
  and conversation.participant_one_id = case
    when booking.learner_id::text < profile.user_id::text then booking.learner_id
    else profile.user_id
  end
  and conversation.participant_two_id = case
    when booking.learner_id::text < profile.user_id::text then profile.user_id
    else booking.learner_id
  end
  and conversation.merged_into_conversation_id is null
  and booking.conversation_id is null;

update public.messages message
set conversation_id = booking.conversation_id
from public.bookings booking
where message.booking_id = booking.id
  and message.conversation_id is null
  and booking.conversation_id is not null;

create unique index if not exists conversations_unique_person_pair
on public.conversations (participant_one_id, participant_two_id)
where participant_one_id is not null
  and participant_two_id is not null
  and merged_into_conversation_id is null;

create index if not exists bookings_conversation_id_idx
on public.bookings (conversation_id);

create index if not exists messages_conversation_id_idx
on public.messages (conversation_id);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Conversation participants can read conversations" on public.conversations;
drop policy if exists "Authenticated users can create conversations" on public.conversations;
drop policy if exists "Conversation participants can update conversations" on public.conversations;
drop policy if exists "Conversation members can add participants" on public.conversation_participants;
drop policy if exists "Booking participants can attach conversations" on public.bookings;
drop policy if exists "Booking participants can read messages" on public.messages;
drop policy if exists "Booking participants can send messages" on public.messages;

create policy "Conversation participants can read conversations"
on public.conversations
for select
to authenticated
using (
  auth.uid() in (participant_one_id, participant_two_id)
  or exists (
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
with check (
  auth.uid() in (participant_one_id, participant_two_id)
  or (participant_one_id is null and participant_two_id is null)
);

create policy "Conversation participants can update conversations"
on public.conversations
for update
to authenticated
using (
  auth.uid() in (participant_one_id, participant_two_id)
  or exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = conversations.id
      and participant.user_id = auth.uid()
  )
)
with check (
  auth.uid() in (participant_one_id, participant_two_id)
  or exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = conversations.id
      and participant.user_id = auth.uid()
  )
);

create policy "Conversation members can add participants"
on public.conversation_participants
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_participants.conversation_id
      and auth.uid() in (conversation.participant_one_id, conversation.participant_two_id)
  )
  or exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = conversation_participants.conversation_id
      and participant.user_id = auth.uid()
  )
);

create policy "Booking participants can attach conversations"
on public.bookings
for update
to authenticated
using (
  learner_id = auth.uid()
  or exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile
      on profile.id = service.instructor_id
    where service.id = bookings.service_id
      and profile.user_id = auth.uid()
  )
)
with check (
  learner_id = auth.uid()
  or exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile
      on profile.id = service.instructor_id
    where service.id = bookings.service_id
      and profile.user_id = auth.uid()
  )
);

create policy "Booking participants can read messages"
on public.messages
for select
to authenticated
using (
  (
    messages.conversation_id is not null
    and exists (
      select 1
      from public.conversations conversation
      where conversation.id = messages.conversation_id
        and auth.uid() in (conversation.participant_one_id, conversation.participant_two_id)
    )
  )
  or (
    messages.conversation_id is not null
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = messages.conversation_id
        and participant.user_id = auth.uid()
    )
  )
  or (
    messages.booking_id is not null
    and exists (
      select 1
      from public.bookings booking
      left join public.instructor_services service
        on service.id = booking.service_id
      left join public.instructor_profiles profile
        on profile.id = service.instructor_id
      where booking.id = messages.booking_id
        and (
          booking.learner_id = auth.uid()
          or profile.user_id = auth.uid()
        )
    )
  )
);

create policy "Booking participants can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    (
      messages.conversation_id is not null
      and exists (
        select 1
        from public.conversations conversation
        where conversation.id = messages.conversation_id
          and auth.uid() in (conversation.participant_one_id, conversation.participant_two_id)
      )
    )
    or (
      messages.conversation_id is not null
      and exists (
        select 1
        from public.conversation_participants participant
        where participant.conversation_id = messages.conversation_id
          and participant.user_id = auth.uid()
      )
    )
    or (
      messages.booking_id is not null
      and exists (
        select 1
        from public.bookings booking
        left join public.instructor_services service
          on service.id = booking.service_id
        left join public.instructor_profiles profile
          on profile.id = service.instructor_id
        where booking.id = messages.booking_id
          and (
            booking.learner_id = auth.uid()
            or profile.user_id = auth.uid()
          )
      )
    )
  )
);
