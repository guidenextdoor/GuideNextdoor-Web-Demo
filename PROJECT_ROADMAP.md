# GuideNextdoor v4.0 Project Roadmap & Technical Specification

This document outlines the development plan for **GuideNextdoor**, a premium sports-learning marketplace.

## 🎯 Project Overview
- **Vibe:** Social-First, Dark Aesthetic (#000000).
- **Model:** Two-sided marketplace (Learners & Instructors).
- **Core Pivot:** Guest-first discovery with soft-auth gates.

---

## 🛠 Tech Stack & Cost Efficiency Strategy

### Tech Stack
- **Frontend:** React Native (Expo SDK 51+), TypeScript, NativeWind v4 (Tailwind).
- **Backend:** Supabase (PostgreSQL 15, PostGIS, Realtime, Edge Functions).
- **State:** Zustand (Global) + TanStack React Query (Server Cache).
- **Performance:** `@shopify/flash-list` for all lists; `expo-image` for optimized rendering.
- **i18n:** `react-i18next` (EN, ZH-HK, ZH-CN).

### 💰 Cost Efficiency (API & Infrastructure)
1. **Google Places API:**
   - **Strategy:** Only trigger Autocomplete on user input.
   - **Optimization:** Implement a `locations` table in Supabase. When a user selects a place, UPSERT it into the DB. Subsequent searches for the same area pull from our DB first or use the cached `place_id`.
   - **Session Tokens:** Use Google Autocomplete session tokens to group multiple keystrokes into a single billing event.
2. **Supabase Edge Functions:**
   - Use for heavy lifting (CRON jobs for reminders/penalties) to keep the mobile client light and reduce redundant database hits.
3. **Image Optimization:**
   - Use `expo-image-manipulator` to compress/resize images locally *before* uploading to Supabase Storage to minimize bandwidth and storage costs.

---

## 📋 Phase 1: Foundation & Design System
*Goal: Establish the dark aesthetic and database schema.*

- [ ] **1.1 Supabase Schema Design**
  - Initialize tables: `profiles`, `instructor_profiles`, `posts`, `bookings`, `conversations`, `messages`, `reviews`.
  - Enable PostGIS for geospatial queries.
  - Implement RLS (Row Level Security) policies for Guest/Learner/Instructor roles.
- [ ] **1.2 Design System Implementation**
  - Define `tailwind.config.js` with tokens: `bg-black` (#000000), `bg-surface` (#1A1A1A), `gndRed` (#D92D20).
  - Build atomic components: `Button`, `Input`, `Card`, `Badge`, `Bottom Sheet` (Dark Aesthetic).
- [ ] **1.3 i18n Infrastructure**
  - Configure `i18next` with `en`, `zh-HK`, and `zh-CN`.
  - Setup local-first detection and persistence.

## 📋 Phase 2: Passive Discovery (The "Social" Feed)
*Goal: Allow guests to browse the platform without friction.*

- [ ] **2.1 Home Tab: Masonry Feed**
  - Implement 2-column masonry grid using `FlashList`.
  - Category filter bar (Water, Winter, Fitness, etc.).
- [ ] **2.2 Post Detail Screen**
  - Multi-image horizontal pager.
  - Social interactions (Likes/Saves) with soft-auth redirect.
- [ ] **2.3 Instructor Public Profile (View Only)**
  - Hero section with cover photo and verification badges.
  - Qualifications, Pricing Matrix, and Media Wall.

## 📋 Phase 3: Active Discovery (Explore & Search)
*Goal: Implement location and time-based search.*

- [ ] **3.1 Explore Tab: Geospatial Search**
  - Google Places Autocomplete integration (with caching logic).
  - Trending Hubs zero-state (Niseko, Bali, etc.).
  - PostGIS-powered "Near Me" results.
- [ ] **3.2 Book Class Tab: Time-First Search**
  - OpenTable-style search (Location + Date + Time + Activity).
  - Instructor "Request Time" lead generation logic.

## 📋 Phase 4: Booking & Lead Generation
*Goal: Convert interest into pending bookings.*

- [ ] **4.1 Booking Bottom Sheet**
  - 5-field inline modal (Date, Time, Duration, Level, Group Size).
  - Dynamic total price calculation based on instructor's pricing matrix.
- [ ] **4.2 Checkout & Confirmation**
  - Non-payment "Request Sent" flow (Offline/Cash model).
  - Auto-creation of conversation thread upon booking request.

## 📋 Phase 5: Interaction & Inbox
*Goal: Real-time communication between users.*

- [ ] **5.1 Unified Inbox**
  - Two-tab view: [Chats] and [Alerts].
  - Unread indicators and real-time updates via Supabase.
- [ ] **5.2 Real-time Chat Room**
  - Support for text, images, and "Booking Cards" (actionable cards within chat).
  - Instructor "Confirm/Decline" actions within the bubble.

## 📋 Phase 6: Instructor Tools & Dashboard
*Goal: Empower instructors to manage their business.*

- [ ] **6.1 Instructor Dashboard**
  - Earnings stats (This Month / All Time), Avg Rating, Upcoming Sessions.
- [ ] **6.2 Service Management**
  - 3-step service creation with certificate upload and multi-location coverage.
  - Complex pricing matrix management.
- [ ] **6.3 Post Composer**
  - Instructor-only multi-image post creation with image compression.

## 📋 Phase 7: Automation & Compliance
*Goal: Backend logic and App Store readiness.*

- [ ] **7.1 Supabase Edge Functions**
  - `send-reminders`: 48h and 24h push notifications.
  - `process-completions`: Auto-set bookings to 'completed' after time elapsed.
  - `enforce-penalties`: Suspension logic for late cancellations.
- [ ] **7.2 Compliance & Polish**
  - Account Deletion flow.
  - Deep linking (`gnd://post/[id]`).
  - "Share to Story" Profile Snapshot Card generator.

---

## 🚀 Enhancements & Clarifications Needed

1. **Google Maps vs. List View:** The playbook mentions "list-only (no map toggle)" for Explore in Stage 1. I recommend keeping this to save on Google Maps API costs (Map Loads are more expensive than Autocomplete).
2. **Payment Model:** Since it's an "offline/cash model" for MVP, we should clarify the "Service Fee" strategy. If GuideNextdoor isn't taking a cut in-app, how are leads being monetized? (e.g., Lead fee? Subscription?).
3. **Verification Process:** The "ID upload" for instructors needs a clear manual/auto review process. For Stage 1, we can push these to a Supabase bucket for manual admin approval.
4. **Hreflang for Web:** If we ever port this to Web, the subdirectory structure we just implemented for the current project is the perfect blueprint for the mobile app expansion.
