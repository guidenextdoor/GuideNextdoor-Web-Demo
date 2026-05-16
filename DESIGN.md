# GuideNextdoor — Website Implementation Brief

## 1. Project Overview
**Brand Name:** GuideNextdoor
**Brand Positioning:** A modern platform helping users discover local coaches, tour guides, and travel companions.
**Emotional Goal:** Excited, Curious, Safe, Connected.
**Vibe:** Young, Energetic, Social, Trustworthy, Travel-focused, Community-driven.
**Avoid:** Corporate, overly luxury, aggressive animations, excessive gradients.

## 2. Primary Target Audience
- **Initial Markets:** Hong Kong, Mainland China.
- **Initial Languages:** Traditional Chinese (zh-HK), Simplified Chinese (zh-CN).
- **Future Expansion:** English, Japanese, Korean, Thai.
- **Mandate:** Localization (i18n) architecture MUST be implemented from day 1.

## 3. Recommended Tech Stack
- **Framework:** React + Next.js (App Router) / TypeScript.
- **Styling:** Tailwind CSS + shadcn/ui.
- **Animation:** Framer Motion (Smooth, Soft, Purposeful).
- **Internationalization:** `next-intl`.
  - Structure: `/app/[locale]/page.tsx`
  - Messages: `/messages/{locale}.json`
- **Mandate:** DO NOT hardcode strings. Use `t("key")`.

## 4. Brand Direction
### Suggested Final Brand Palette
#### Core Brand Colors
| Role | Hex |
| :--- | :--- |
| **Primary Red** | `#7A1E1E` |
| **Coral Accent** | `#FF6B57` |
| **Soft Cream** | `#FAF7F4` |
| **Warm Gray** | `#6E6259` |
| **Dark Text** | `#1F1F1F` |

#### Recommended Usage Ratio
**IMPORTANT: Do NOT overuse dark red.**
- **65% neutral/cream** (Backgrounds, large empty spaces)
- **20% dark text/gray** (Body text, secondary headings, UI borders)
- **10% dark red** (Primary buttons, logos, highlighted active states)
- **5% coral highlights** (Hover states, notifications, call-to-action accents)

This keeps the UI: **premium**, **breathable**, and **modern** instead of visually “heavy.”

#### UI Styling Direction
- **Icons & Symbols**
  - **No Emojis:** Strictly avoid standard system emojis (e.g., 🌍, ✨, 📍). Use professional SVG icons (e.g., Lucide) instead.
  - **No Arrows:** Avoid standard arrow icons for navigation/CTAs (e.g., →, ➡️, ArrowRight). Use descriptive text, subtle motion, or other directional cues.
- **Buttons**
  - Primary: Dark red fill.
  - Hover: Coral tint.
- **Cards**
  - Cream background.
  - Subtle shadows.
  - Coral hover highlights.
- **Animations**
  - Coral is great for: hover glow, active tabs, loading states, progress indicators.

#### Additional Recommendation
For younger audiences (18–30 especially), avoid:
- Overly dark backgrounds.
- Fully saturated red UI.
- Old-school China-style red/gold palettes.

Instead:
- Keep the interface airy.
- Use red as emotional accent.
- Rely on photography + whitespace.

#### Suggested Photography Color Treatment
Images should emphasize:
- Warm sunlight, street life, food, candid human interactions, natural skin tones.
- **Avoid:** Ultra blue/cold travel imagery, over-filtered Instagram looks.

## 5. Homepage Structure
- **Hero:** "Explore the world like a local friend." Interactive collage, floating cards.
- **How It Works:** 3-step cards (Destination -> Expert -> Explore).
- **Featured Guides:** Card grid/slider with high-quality imagery, ratings, and language tags.
- **Experience Categories:** Food, Hiking, Photography, Fitness, etc.
- **Social Proof:** Testimonials and user photos.
- **Onboarding:** "Become a Guide" section.

## 6. Navigation & UX
- **Desktop:** Logo (Left), Explore/Destinations/About (Center), Language/Auth (Right).
- **Mobile:** Bottom sheet / slide menu.
- **Animation:** Soft staggers, gentle hovers, minimal parallax.

## 7. Technical Requirements
- **SEO:** Dynamic metadata, OG tags, JSON-LD, hreflang.
- **Performance:** Next.js Image optimization, lazy loading, Lighthouse 90+ score.
- **Accessibility:** Semantic HTML, keyboard navigation, ARIA labels.
- **Mobile-First:** Priority design for mobile/tablet.

## 8. Development Phases
- **Phase 1:** Responsive homepage, localization setup, shared components, nav/footer.
- **Phase 2:** Guide listing, profile pages, search/filter system.
- **Phase 3:** Auth, booking flow, CMS integration.

## 9. Folder Structure (Standard)
```text
/src
  /app        # Next.js App Router
  /components # Reusable UI atoms/molecules
  /features   # Domain-specific logic
  /lib        # Utils and shared configs
  /hooks      # Custom hooks
  /styles     # Global CSS
  /messages   # i18n JSON files
```

## 10. Implementation Notes for Demo
- Connect to existing landing page components.
- Ensure seamless transitions between "Explore" and "Guide Profiles".
- Implement localized routing mockups.
