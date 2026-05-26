# GuideNextdoor — Master SEO, GEO & AI Content Generation Guidelines (v4)

This document is the official source of truth for:

* Engineering Team
* Product Team
* SEO Team
* Content Marketing Team
* AI Content Generation Systems
* Localization Workflows

Its purpose is to ensure GuideNextdoor achieves strong discoverability across:

* Google
* Bing
* Baidu
* ChatGPT
* Perplexity
* Gemini
* Claude
* future AI-powered search engines

This document defines:

* technical SEO standards
* GEO (Generative Engine Optimization) standards
* localization architecture
* entity consistency
* semantic SEO requirements
* AI article generation structures
* multilingual content scaling systems
* brand voice and lifestyle editorial direction

---

# 1. Official Platform Entity Definition

GuideNextdoor is a localized discovery platform that connects people with trusted local coaches, guides, instructors, and experience hosts for fitness, wellness, cultural exploration, lifestyle activities, and skill-based experiences.

GuideNextdoor helps users:

* discover trusted local experts
* explore cities more authentically
* learn from locals
* book coaching and experience services
* access local knowledge more safely and efficiently

---

# 2. Brand Personality & Editorial Direction

GuideNextdoor is NOT:

* a corporate booking platform
* a generic AI-content website
* a traditional travel agency
* a cold information directory

GuideNextdoor SHOULD feel:

* youthful
* lively
* adventurous
* stylish
* socially shareable
* emotionally warm
* locally authentic

The platform vibe should feel like:

> a well-connected local friend showing you the side of a city most travelers miss.

The writing style should blend:

* modern travel editorial
* insider recommendations
* local storytelling
* lifestyle magazine energy
* practical local expertise

---

# 3. Entity Positioning Rules (CRITICAL)

AI search engines rely heavily on entity consistency.

All content must consistently reinforce that GuideNextdoor is:

* a local discovery platform
* a place to find trusted local experts
* a community-driven experience platform
* a platform for authentic local experiences

---

# NEVER Position GuideNextdoor As:

* only a travel guide platform
* only a fitness platform
* only a booking engine
* only a directory website

GuideNextdoor spans:

* local expertise
* coaching
* wellness
* local culture
* community discovery
* lifestyle experiences
* skill-sharing

---

# 4. Core SEO + GEO Philosophy

Traditional SEO alone is no longer sufficient.

GuideNextdoor content must optimize for BOTH:

## Traditional Search Engines

Examples:

* Google
* Bing
* Baidu

AND

## AI Search & Answer Engines

Examples:

* ChatGPT
* Perplexity
* Gemini
* Claude

---

# GEO (Generative Engine Optimization) Principles

AI search engines prioritize content that is:

* extractable
* semantically rich
* factually clear
* directly answerable
* experience-driven
* highly structured
* easy to summarize

However:

IMPORTANT:
The SEO/GEO structure should feel INVISIBLE to readers.

Articles should never feel:

* over-engineered
* robotic
* keyword-stuffed
* SEO-generated

Readers should feel:

> “This sounds like real local advice.”

NOT:

> “This was written for search engines.”

---

# 5. Localization & URL Architecture

## Language Subdirectory Structure (MANDATORY)

Every language version must have unique URLs.

Examples:

```txt id="u4zjlwm"
/en/tokyo/freediving-guides
/zh-HK/tokyo/freediving-guides
/zh-CN/tokyo/freediving-guides
```

---

# Why This Matters

Benefits:

* localized indexing
* stronger regional SEO
* hreflang compatibility
* scalable multilingual SEO
* stronger AI regional relevance

---

# 6. Internationalization (i18n) Standards

## Recommended Frameworks

Use:

* next-intl (preferred)
  OR
* react-i18next

---

# Rules

## NEVER hardcode UI text.

Bad:

```jsx id="4gzcij"
<h1>Find Local Guides</h1>
```

Good:

```jsx id="l9qd94"
t("homepage.hero.title")
```

## Localize Authors and UI Elements
Author names, teams, and generic titles must be localized based on the language variant.
* English: GuideNextdoor Team | Local Experience Matching Platform
* Traditional Chinese: GuideNextdoor 團隊 | 在地體驗配對平台
* Simplified Chinese: GuideNextdoor 团队 | 在地体验配对平台

---

# Translation Structure

```txt id="m3nv3h"
/src/i18n/locales/
  en.json
  zh-HK.json
  zh-CN.json
```

---

# 7. Technical SEO Standards

# A. Hreflang Tags

Every localized page MUST include:

```html id="az0u13"
<link rel="alternate" hreflang="en" />
<link rel="alternate" hreflang="zh-HK" />
<link rel="alternate" hreflang="zh-CN" />
<link rel="alternate" hreflang="x-default" />
```

---

# B. Canonical Tags

Every page must define canonical URLs correctly.

---

# C. Dynamic Metadata

Every page must dynamically generate:

* title
* meta description
* OG tags
* Twitter/X cards

Metadata must:

* be localized
* contain natural keywords
* remain human-readable
* avoid duplication

---

# 8. Structured Data Requirements

All major pages should implement JSON-LD.

---

# Recommended Schema Types

## Platform Pages

* Organization
* WebSite
* BreadcrumbList

## Directory Pages

* ItemList
* LocalBusiness

## Profile Pages

* Person
* Review

## Articles

* Article
* FAQPage

---

# 9. Semantic SEO Standards

Modern SEO is semantic-first.

Do NOT optimize only for exact-match keywords.

---

# Content Must Include:

* related entities
* adjacent terminology
* contextual concepts
* semantic variations

---

# Example

For:

```txt id="2m4cxq"
Koh Tao freediving spots
```

Also naturally include:

* apnea
* equalization
* buoy lines
* visibility
* reef conditions
* currents
* beginner-friendly bays
* marine life
* depth training

---

# Goal

Build:

* topical authority
* semantic relevance
* AI retrieval strength

---

# 10. GEO (Generative Engine Optimization) Standards

# A. Direct Answer Formatting

AI systems prioritize:

* concise answers
* extractable summaries
* structured knowledge

---

# IMPORTANT

The structure should feel NATURAL.

Do NOT write robotic headings like:

* Structured Breakdown
* Local Context
* Spot Comparison

---

# Instead Use Human Editorial Headings

Prefer:

* Where Locals Actually Go
* Places Worth Waking Up Early For
* Why Most Visitors Miss These Spots
* Which Spot Fits Your Style?
* The Quiet Side of Koh Tao

---

# B. Information Density

Every article should include:

* local knowledge
* practical details
* safety tips
* recommendations
* specifics
* trust signals

Avoid:

* vague filler
* generic storytelling
* repetitive descriptions

---

# C. AI Retrieval Optimization

AI engines prefer:

* scannable formatting
* concise factual summaries
* comparison tables
* FAQ sections
* direct recommendations

Use:

* bullets
* summaries
* structured sections
* concise recommendations

BUT:
The article must still feel human-first.

---

# 11. Original Insight & Human Experience Standards

CRITICAL FOR GEO.

Every article must include at least ONE:

* firsthand observation
* local nuance
* cultural insight
* practical recommendation
* behavioral trend
* real-world example
* guide/instructor perspective

---

# GOOD Example

> By 8am, most of the large dive boats still haven’t arrived. Around Aow Leuk, the water is calmer, visibility is clearer, and you’ll usually only see a few local instructors quietly setting up buoy lines offshore.

---

# BAD Example

> Aow Leuk provides ideal beginner conditions due to shallow depth profiles.

Too robotic.

---

# 12. Programmatic SEO Architecture

GuideNextdoor should support scalable landing pages.

---

# Examples

```txt id="oblk1f"
/zh-HK/koh-tao/freediving-guides
/zh-CN/bangkok/muay-thai-coaches
/en/taipei/photography-guides
```

---

# Required Landing Page Blocks

Every landing page should include:

* localized intro
* local insights
* neighborhood recommendations
* FAQs
* internal links
* trust signals
* booking CTA

---

# 13. China-Focused Search Optimization

GuideNextdoor targets:

* Mainland China
* Hong Kong
* Taiwan

Optimization should account for:

* Baidu
* Xiaohongshu reading behavior
* mobile-first scanning

---

# Simplified Chinese Rules

Content should:

* use concise paragraphs
* avoid overly academic tone
* front-load important keywords
* optimize for mobile reading

---

# Traditional Chinese Rules

Content should feel:

* warm
* conversational
* localized
* culturally natural

Avoid:

* machine-translated phrasing
* stiff Mandarin-style wording for HK audiences
* overly colloquial spoken Cantonese characters (e.g., 嘅, 喺, 唔, 咁). Use written Traditional Chinese instead.

---

# Formatting Technical Terms
* Do not italicize technical terms.
* Do not include the English translation in parentheses for localized Chinese content (e.g., use 閉氣 instead of 閉氣 (apnea)). It disrupts the natural reading flow.

---

# 14. Internal Linking Standards

Every article MUST include:

* minimum 3 internal links
* related experiences
* nearby cities
* relevant guides/coaches

---

# 15. E-E-A-T Standards

GuideNextdoor content must reinforce:

* Experience
* Expertise
* Authoritativeness
* Trustworthiness

---

# Required Trust Signals

Include:

* vetting systems
* certifications
* reviews
* safety practices
* local expertise
* community recommendations

---

# 16. AI Content Quality Standards

Avoid:

* repetitive phrasing
* robotic transitions
* generic introductions
* keyword stuffing
* corporate-sounding copy
* encyclopedia-style tone

---

# Every Article Must:

* feel localized
* provide practical value
* contain unique observations
* vary sentence rhythm
* feel emotionally alive
* remain socially shareable

---

# 17. Human-Lifestyle Tone Optimization (CRITICAL)

GuideNextdoor articles should feel like:

> a stylish local sharing insider knowledge after years of living there.

NOT:

> an SEO landing page written by AI.

---

# Preferred Writing Style

Blend:

* modern travel editorial
* Xiaohongshu energy
* lifestyle magazine storytelling
* insider recommendations
* practical local expertise

---

# Writing Should Feel:

* youthful
* energetic
* socially readable
* visually immersive
* emotionally engaging

---

# Use:

* sensory details
* atmosphere
* local habits
* emotional contrast
* vivid observations

---

# Example

GOOD:

> The best sessions usually start early. Before the island fully wakes up, the water around Shark Island feels almost unreal — calm surface, clear visibility, and barely another boat in sight.

BAD:

> Shark Island provides excellent visibility conditions.

---

# 18. Invisible SEO Principle

SEO/GEO optimization should feel invisible.

Readers should NEVER feel:

* headings were engineered for keywords
* FAQs were inserted artificially
* content was written primarily for algorithms

The article must always feel:

* natural
* human
* emotionally readable

---

# 19. Natural Brand Mention Rules

Avoid robotic phrases like:

* trusted local discovery platform
* coach and guide marketplace
* local expertise ecosystem

---

# Instead Integrate Naturally

Bad:

> GuideNextdoor is a trusted local discovery platform.

Good:

> Many travelers now use GuideNextdoor to find smaller independent instructors instead of joining crowded group tours.

---

# 20. AI Article Generation Structure Requirements (CRITICAL)

Every AI-generated article MUST follow this structure.

---

# 1. SEO-Friendly Human Title

The title should:

* contain target keyword naturally
* sound emotionally appealing
* feel human-written

---

# GOOD Example

```txt id="mjlwm5"
Best Freediving Spots in Koh Tao for Beginners and Deep Divers (2026 Local Guide)
```

---

# BAD Example

```txt id="c0sl0o"
Ultimate Koh Tao Freediving Secret Guide
```

---

# 2. Quick Answer Section (MANDATORY)

Within first 150 words:

* directly answer the search query
* summarize recommendations clearly
* include natural keyword usage

BUT:
The tone should still feel conversational.

---

# GOOD Example

> If you’re new to freediving, most local instructors will point you toward Aow Leuk first. The water is calmer, visibility is usually great in the morning, and the gradual depth makes it much less intimidating than some of Koh Tao’s deeper sites.

---

# 3. Human Introduction

After the quick answer:

* create atmosphere
* explain local context
* make readers feel emotionally immersed

Avoid:

* textbook-style explanations

---

# 4. Natural Editorial Sections

Sections should feel:

* magazine-like
* curiosity-driven
* socially readable

---

# GOOD Examples

* Where Locals Usually Go Instead
* Spots Worth Getting Up Early For
* Places Beginners Actually Enjoy
* Which Area Matches Your Style?
* The Side of Koh Tao Most Tourists Miss

---

# BAD Examples

* Structured Breakdown
* Technical Overview
* Spot Comparison Analysis

---

# 5. Comparison Table (MANDATORY)

Every major article must contain at least ONE table.

BUT:
Table titles should feel natural.

---

# GOOD

* Quick Comparison
* Which Spot Fits Your Style?
* Where to Go Depending on Your Level

---

# BAD

* Structured Spot Comparison Table

---

# 6. FAQ Section (MANDATORY)

Every article must include:

* minimum 3 FAQs

BUT:
FAQs should sound conversational.

---

# GOOD

* Never Freedived Before? Start Here
* Is Koh Tao Beginner-Friendly?
* What Time of Year Has the Clearest Water?

---

# BAD

* Is Koh Tao Suitable for Beginner Freedivers?

---

# 7. Semantic Entity Expansion

Each article should naturally include:

* nearby locations
* local terminology
* seasonal insights
* safety considerations
* related activities
* practical details

---

# 8. AI Extractability Rules

Content must still contain:

* concise factual summaries
* direct recommendations
* scannable insights
* practical advice

BUT:
Avoid sounding robotic.

---

# 9. Emotional Experience Layer

Every article should evoke:

* curiosity
* excitement
* discovery
* local atmosphere
* “I want to experience this”

This improves:

* engagement
* dwell time
* memorability
* sharing potential

---

# 10. Social Readability Rules

Content should feel:

* screenshot-worthy
* quote-worthy
* shareable on Xiaohongshu/Threads/Instagram

Use:

* punchy observations
* vivid descriptions
* emotionally memorable lines

---

# 11. Internal Links (MANDATORY)

Every article must include:

* related destinations
* related experiences
* relevant guide listings

---

# 12. Localized CTA

End naturally.

Avoid aggressive sales tone.

---

# GOOD Example

> Looking for a quieter way to experience Koh Tao? Explore local freediving instructors on GuideNextdoor and discover spots most visitors never hear about.

---

# 21. Recommended Content Depth

## Pillar Articles

```txt id="c83l6d"
1200–2500 words
```

## Local Landing Pages

```txt id="y65po1"
600–1200 words
```

---

# 22. Image SEO Standards

All images must:

* use descriptive filenames
* include localized alt text
* support lazy loading
* use WebP when possible

---

# 23. Performance Standards

Target Lighthouse Scores:

| Category      | Target |
| ------------- | ------ |
| Performance   | 90+    |
| Accessibility | 90+    |
| SEO           | 95+    |

---

# 24. Mobile-First Requirements

GuideNextdoor is mobile-first.

Content should optimize for:

* short attention spans
* mobile scanning
* social traffic behavior

---

# Recommended Formatting

* short paragraphs
* strong visual hierarchy
* clean spacing
* punchy headings

---

# 25. Entity Consistency Rules

Always refer to:

* GuideNextdoor

Preferred descriptors:

* local discovery platform
* local experience platform
* place to discover local experts
* community-driven experience platform

---

# 26. Master Publishing Checklist

# Technical Checklist

* [ ] Localized route exists
* [ ] hreflang tags verified
* [ ] canonical tags verified
* [ ] metadata localized
* [ ] JSON-LD implemented
* [ ] images optimized
* [ ] internal links working

---

# Content & SEO/GEO Checklist

* [ ] Search intent properly matched
* [ ] Quick Answer section included
* [ ] FAQ section included
* [ ] Comparison table included
* [ ] Semantic entities included
* [ ] Local insights included
* [ ] Trust signals included
* [ ] Internal links included
* [ ] Localized CTA included
* [ ] Tone feels human and lively
* [ ] Avoids robotic SEO wording
* [ ] Content feels socially shareable
* [ ] Content is AI-extractable

---

# 27. Final Strategic Principle

GuideNextdoor content should consistently feel like:

> discovering a city through people who genuinely know and love it.

The content should combine:

* local expertise
* emotional storytelling
* practical recommendations
* socially shareable energy
* invisible SEO/GEO optimization

The best GuideNextdoor articles should feel:

* useful enough for Google
* extractable enough for AI
* engaging enough for social media
* authentic enough for humans to trust.
