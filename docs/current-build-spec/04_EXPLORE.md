# Explore

Explore is the first rebuilt product surface and should feel like a social post wall, not an instructor directory.

## Current Route

- `/en/explore`
- Implementation: `src/views/ExploreView.jsx`

## Page Layout

Required:
- One centered search field.
- Uniform image-dominant post grid.
- No "post wall" heading.
- No post count.
- No role/category pill filters on the main page.
- No "Find a local coach" card.

Cards should stay visually consistent even when optional post location is missing. Creator name must not move based on whether the post has a location.

## Post Card

Show:
- Main image.
- Creator avatar.
- Creator name.
- Location under creator name when `posts.location_id` resolves to a location; show nothing when missing.
- One-line caption/content preview.
- Creation date in `DD-MM-YYYY`.
- Like count and heart state.
- Comment icon/count from `posts.comments_count`.
- Save icon state.

Do not show internal moderation labels such as `approved`.

## Post Detail Modal

Clicking a post opens a modal, not a new page.

Modal should follow an Instagram-like layout:
- Media on the left/top.
- Creator header.
- Like/comment/save controls before the caption.
- Caption and date after controls.
- Message and View sessions buttons in the same row.

`View sessions` does not need to connect until instructor profile/service pages are built.

## Data Contract

Fetch:
- `posts`
- `instructor_profiles`
- nested `users`
- optional `locations`

Filter:
- `approval_status = approved`

Interactions:
- Likes use `post_likes`.
- Saves use `saved_posts`.
- Comments use `post_comments` and increment `posts.comments_count`.
- Heart is hollow when not liked and filled when liked.
- Bookmark is hollow when not saved and filled when saved.
- State must stay consistent between grid card and modal.

Unauthenticated users can view posts but must be prompted to log in before like/save changes are written.
