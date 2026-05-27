alter table public.messages enable row level security;
alter table public.conversation_participants enable row level security;

drop policy if exists "Booking participants can read messages" on public.messages;
drop policy if exists "Booking participants can send messages" on public.messages;
drop policy if exists "Conversation participants can read participants" on public.conversation_participants;

create policy "Conversation participants can read participants"
on public.conversation_participants
for select
to authenticated
using (true);

create policy "Booking participants can read messages"
on public.messages
for select
to authenticated
using (
  (
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
