# Chatroom

Chat supports learner/instructor coordination before and after booking requests.

## Route Direction

Current route:
- `/en/messages`

Current placeholder:
- `WorkspaceView` is used for `/en/messages`.

## Conversation Model

Current schema has `messages` connected to `bookings`. If free-form pre-booking chat is needed, add a dedicated conversation table before building UI that assumes standalone threads.

## Message Data

Use:
- `messages.id`
- `messages.booking_id`
- `messages.sender_id`
- `messages.text_content`
- `messages.created_at`

Join:
- `bookings`
- `users`
- `instructor_services`
- `instructor_profiles`

## UI Requirements

- Conversation list.
- Message pane.
- Composer.
- Booking context summary.
- Empty state for no conversations.

Realtime can be added after the basic DB-backed read/write flow is stable.
