# Marketing & SEO Guidelines: GuideNextdoor

This document outlines the standard practices for maintaining high consistency and SEO performance across the GuideNextdoor platform as it scales to multiple languages and regions.

---

## 1. Architectural Strategy: Language Subdirectories
For optimal SEO, every supported language MUST have its own unique URL structure.
- **Rule:** Use `/{lang}/path` (e.g., `/en/explore`, `/zh-HK/explore`).
- **Why:** This allows search engines to index each language version independently, helping us rank for local keywords in specific regions.

## 2. Maintenance & Scalability: `react-i18next`
We use a **Single Codebase** approach. Never duplicate a page to translate it.
- **Source of Truth:** All text must live in `src/i18n/locales/{lang}.json`.
- **Component Logic:** Use the `useTranslation()` hook. Avoid hardcoding strings in JSX.
- **Consistency:** Changing a UI component (e.g., a button color) in one file automatically updates it across all 10+ languages.

### How to add a new language:
1. Create a new JSON file: `src/i18n/locales/ja.json`.
2. Add the language to the `supportedLangs` array in `App.jsx`.
3. Register the new resource in `src/i18n/config.js`.

---

## 3. SEO & Metadata Standards
### Hreflang Tags (Critical)
Every page must include `hreflang` tags in the `<head>` to tell Google about the relationship between different language versions.
- **Implementation:** Managed in `App.jsx` via `react-helmet-async`.
- **Default:** Always set `hreflang="x-default"` to the English version.

### Dynamic Meta Tags
Each view should use `Helmet` to set unique titles and descriptions that are translated.
- **Rule:** "Tokyo Local Guides | GuideNextdoor" vs "東京當地嚮導 | GuideNextdoor".

---

## 4. GEO & Language Detection
- **Auto-Detection:** We use `i18next-browser-languagedetector` to suggest the best language based on the user's browser settings.
- **Path Priority:** The URL path (`/en/`, `/zh-HK/`) always overrides browser settings once a user has navigated.
- **Location-Aware Content:** While the UI is translated, some data (like specific local events) may remain regional. Clearly label these as "Local Experience".

---

## 5. Tone & Voice Guidelines
To maintain consistency, follow these linguistic "vibes":
- **English (Global):** Adventurous, friendly, professional yet "local friend" vibe. Use active verbs.
- **Traditional Chinese (Hong Kong/Taiwan):** Warm, inviting, using local slang where appropriate (e.g., "在地", "好去處") to build trust.
- **General Rule:** Avoid robotic translations. Prioritize **transcreation** (translating the meaning and emotion) over literal word-for-word translation.

---

## 6. Checklist for New Subpages
When creating a new page (e.g., `/safety`):
1. [ ] Create the view in `src/views/`.
2. [ ] Add the route in `App.jsx` inside the `LanguageWrapper`.
3. [ ] Add all text strings to `en.json`.
4. [ ] Send the strings for translation to other `.json` files.
5. [ ] Use `<Link to={\`/\${i18n.language}/safety\`}>` for internal navigation.
6. [ ] Verify `hreflang` tags are appearing correctly in the browser inspector.
