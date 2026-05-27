# GuideNextdoor: High-Fidelity Design System
**Version:** 2.0 (Social-First Platform Ethos)
**Design Direction:** "Premium Editorial Social"
**Inspiration:** Instagram (Minimalism), RedNote (Information Density), TikTok (Active Feedback)

---

## 1. Core Design Philosophy: "The Window"
At Instagram and RedNote, we treat the UI as a **frame**, not the content itself. The interface must disappear to let the imagery (the "Window") shine. Every pixel of UI that doesn't help the user *connect* or *decide* is "slop."

### Pillars of the Ethos:
- **Optical Precision:** We don't just use centers; we use optical alignment.
- **Intentional Friction:** High-value actions (Booking) have distinct weights; social actions (Liking) are frictionless.
- **Contextual Vibe:** The platform feels "Alive." It responds to touch, scroll, and hover with organic easing.

---

## 2. Atomic Visual Language

### A. The "Premium Neutral" Palette
We use a **60-30-10** distribution to ensure the primary "GND Red" feels like an event, not a background.

| Layer | Color Name | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Foundation** | Paper White | `#FFFFFF` | Primary backgrounds, clean space. |
| **Surface** | Soft Cream | `#FAF7F4` | Secondary cards, subtle sectioning. |
| **Text (H1-H2)** | Carbon Black | `#1F1F1F` | High-contrast readability. |
| **Text (Body)** | Earth Gray | `#6E6259` | Secondary info, captions, timestamps. |
| **Brand** | GND Red | `#7A1E1E` | High-intensity CTAs, active states. |
| **Accent** | Living Coral | `#FF6B57` | Micro-interactions, notifications, hover sparks. |

### B. Typography: "The Editorial Voice"
We use a high-contrast type scale to mimic premium lifestyle magazines.
- **Headlines:** Bold, tight letter-spacing (-0.02em), high weight.
- **Captions:** RedNote-style density. Slightly smaller, higher line-height (1.6) for readability.
- **Labels:** All-caps, tracked-out (0.1em), 9px-10px. This adds "Professional Polish."

---

## 3. The 8px Rhythm (Spacing & Grid)
Following the Instagram standard, all margins/padding must be multiples of **8**.
- **Container Padding:** 16px (Mobile), 24px-32px (Desktop).
- **Element Gap:** 8px (Tight), 12px (Standard), 24px (Sectional).
- **Corner Radius:**
  - `8px`: Buttons, Small Cards (Precision).
  - `12px`: Standard Grid Cards (Social Feel).
  - `24px`: Bottom Sheets, Modals (Organic/TikTok feel).

---

## 4. Component Spec: The "Social Card"
The card is our most important unit. It must feel like a "Physical Object."

1.  **Imagery:** 4:5 aspect ratio (The Instagram "Golden Ratio" for vertical scrolling).
2.  **Interaction Layer:**
    *   **Double-Tap to Like:** Must trigger a `scale` animation on the heart icon.
    *   **Glassmorphism:** Use `backdrop-filter: blur(8px)` on any overlay (Captions, Tags) to maintain premium feel.
3.  **Signals:** Like/Comment/Save counts are always visible but low-contrast (`Earth Gray`) until interacted with.

---

## 5. Motion & Interaction (The "Soul")
Inspired by TikTok's responsiveness:
- **Button Press:** `scale(0.96)` with `spring` physics (Stiffness: 400, Damping: 25).
- **Page Transitions:** Soft horizontal "Slide-In" on mobile; "Fade-Scale" on desktop.
- **Hover States:** No "Instant" color changes. Use `duration-300` transitions for all color shifts.

---

## 6. Globalization (i18n) Layout Rules
Since we support CJK (Chinese, Japanese, Korean) and Latin scripts:
1.  **Line Height:** Always use `leading-relaxed` (1.625) for Chinese characters to prevent "clumping."
2.  **Dynamic Widths:** Buttons must never have fixed widths; they must expand to accommodate longer German/English strings.
3.  **Font Fallbacks:** `Inter` for Latin, `Noto Sans TC/SC` for Chinese.

---

## 7. Prohibited Patterns (The "Anti-Slop" List)
- **NO System Emojis:** Use `Lucide-React` (Weight: 1.5 - 2.0).
- **NO Standard Arrows:** Directional intent is signaled by layout, not `->`.
- **NO Harsh Shadows:** Use "Layered Shadows" (Soft, multi-level `rgba`) to avoid that "2010s Web" look.
- **NO Over-Saturation:** Do not use full-screen GND Red. It is for **Blood (Action)**, not **Skin (Surface)**.

---

## 8. Final Vibe Check: "The RedNote Test"
If you take a screenshot of the app and put it next to a premium lifestyle magazine, does it look like it belongs?
- If yes: It is **GuideNextdoor.**
- If no: Add more whitespace, tighten the typography, and soften the shadows.
