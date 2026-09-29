---
name: Criticbox
description: A brutalist cinema terminal and architectural review archive for cinephiles.
colors:
  primary: "#ff9900"
  primary-hover: "#ffaa22"
  primary-dim: "rgba(255, 153, 0, 0.08)"
  primary-border: "rgba(255, 153, 0, 0.25)"
  bg-body: "#06070a"
  bg-card: "#0a0c11"
  bg-elevated: "#11141d"
  text-primary: "#ffffff"
  text-secondary: "#d1d5db"
  text-muted: "#9ca3af"
  text-dim: "#6b7280"
  border-subtle: "#1c202c"
  border-medium: "#2a2f3d"
  border-stark: "#ffffff"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 3.5rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  none: "0px"
  sm: "0px"
  md: "0px"
  lg: "0px"
  full: "0px"
spacing:
  "2xs": "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#000000"
    rounded: "{rounded.none}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.text-primary}"
    textColor: "#000000"
    rounded: "{rounded.none}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  score-badge:
    backgroundColor: "{colors.primary}"
    textColor: "#000000"
    rounded: "{rounded.none}"
    padding: "4px 8px"
  movie-card:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "0px"
---

# Design System: Criticbox

## Overview

**Creative North Star: "The Industrial Cinema Terminal"**

Criticbox is built as an uncompromising, high-density projection room and architectural archive for cinema criticism. It completely rejects the sterile, rounded, pastel-drenched tropes of contemporary consumer web design in favor of mechanical precision, razor-sharp geometric edges, deep noir blacks, and high-voltage cadmium amber accents. The interface feels less like a social network and more like an industrial terminal salvaged from a classic 35mm projection booth or a classified cinematic registry.

The spatial philosophy is unapologetically planar and structural. Content is organized inside stark frames with hairline grid rules, heavy monochromatic contrasting borders, and rigid monospaced data markers. Surfaces do not hide behind translucent blur gradients or soft floating drops; they declare their presence with solid, physical lines and hard offset shadow planes. The density is calibrated for cinephiles who demand information richness, clear hierarchy, and immediate access to community judgments without decorative friction.

**Key Characteristics:**
- **Absolute Zero-Radius Discipline:** Every single element across the system—posters, buttons, badges, chips, inputs, and avatars—is rigidly rectangular (0px radius).
- **Noir Void Contrast:** Deep pitch blacks (`#06070a`, `#0a0c11`) punctuated by stark white borders (`#ffffff`) and incandescent Cadmium Projector Amber (`#ff9900`).
- **Tactile Offset Shadows:** No blurred ambient light. Interactive elevation is rendered strictly through hard offset pixel steps (`2px 2px` to `10px 10px` solid shift).
- **Four-Tier Typographic Engine:** Outfit for heavyweight cinema titles, Space Grotesk for navigation and controls, JetBrains Mono for index scores and rankings, and Plus Jakarta Sans for reading long-form critical prose.

---

## Colors

The Criticbox palette operates on extreme dynamic range: total cinematic darkness punctuated by surgical monochrome dividers and a single, incandescent projection lamp accent.

### Primary
- **Cadmium Projector Amber** (`#ff9900`): The signature beacon. Used sparingly and decisively for active navigation links, primary action triggers, score callouts, ranking indicators, and the iconic terminal square logo glyph.
- **Amber Glow / Hover** (`#ffaa22`): Interactive state for primary actions and focused highlights.
- **Amber Translucent Fill** (`rgba(255, 153, 0, 0.08)`): Used for active tab badges and chip backgrounds to denote active state without visual noise.
- **Amber Translucent Border** (`rgba(255, 153, 0, 0.25)`): Hairline frame for active chips and selected items.

### Neutral
- **Noir Void (Background Body)** (`#06070a`): The canvas base. Deep absorbing black evoking the darkness of a cinema auditorium.
- **Terminal Charcoal (Card Base)** (`#0a0c11`): The surface for resting movie cards, lists, and secondary panels.
- **Elevated Steel (Card Hover / Elevated Surface)** (`#11141d`): Hover state for interactive tiles and active dialog containers.
- **Stark White (Text & Structural Borders)** (`#ffffff`): Pure high-contrast white. Applied to display titles, active button frames, and the bottom rule of the main navigation bar.
- **Muted Slate (Secondary Text)** (`#9ca3af`): Body summaries, synopses, and default link text.
- **Dim Ash (Tertiary & Placeholders)** (`#6b7280`): Sub-labels, inactive star outlines, and input placeholders.
- **Border Charcoal (Structural Grid Rules)** (`#2a2f3d`): The universal grid border separating sections, card frames, and table cells.
- **Border Subtle (Internal Dividers)** (`#1c202c`): Low-contrast hairline dividers inside complex cards.

### Named Rules
**The Cadmium Beacon Rule.** Cadmium Amber (`#ff9900`) must never cover more than 10% of any viewport. Its power comes from solitary contrast against total darkness; flooding the page in amber breaks the cinema projection illusion.

**The Pure Void Rule.** Never introduce colored or multi-hue gradient backgrounds. Gradients are permitted only as linear fade-to-black masks (`linear-gradient(180deg, rgba(6,7,10,0) to #06070a)`) to blend movie backdrops into the canvas.

---

## Typography

The typographic system utilizes four specialized typefaces, each assigned to a strictly defined cognitive layer.

**Display Font:** Outfit (Weights 800, 900)  
**Control & UI Font:** Space Grotesk (Weights 600, 700, 800)  
**Technical & Monospace Font:** JetBrains Mono (Weights 500, 700)  
**Prose & Body Font:** Plus Jakarta Sans (Weights 400, 500, 600)  

**Character:** A collision of monumental 1970s film poster titling (Outfit), mid-century European modernist signage (Space Grotesk), raw mainframe terminal telemetry (JetBrains Mono), and editorial clarity (Plus Jakarta Sans).

### Hierarchy
- **Display** (Outfit, 900, `clamp(2.4rem, 5vw, 3.5rem)`, Line-height: 1.05, Tracking: `-0.03em`, Uppercase): Hero title banners, cinema marquee headlines.
- **Headline** (Outfit, 800, `1.45rem`, Line-height: 1.15, Tracking: `-0.01em`, Uppercase): Section headings (e.g., "EM CARTAZ", "EM ALTA", "ÚLTIMAS CRÍTICAS").
- **Title** (Space Grotesk, 700, `1.05rem`–`1.15rem`, Line-height: 1.25, Tracking: `0.02em`): Film titles in cards, modal header titles, reviewer usernames.
- **Body** (Plus Jakarta Sans, 400–500, `0.88rem`–`0.92rem`, Line-height: 1.65): Critical reviews, synopsis paragraphs, user comments (max reading measure: 65–75ch).
- **Label / Control** (Space Grotesk, 700, `0.75rem`–`0.82rem`, Line-height: 1, Tracking: `0.04em`, Uppercase): Buttons, navigation links, eyebrow badges, filter chips.
- **Metric / Monospace** (JetBrains Mono, 700, `0.65rem`–`1.0rem`): Numerical scores, year dates, runtime timestamps, rank numbers (`#01`).

### Named Rules
**The Case Doctrine Rule.** All headings, buttons, chips, and section headers are strictly uppercase. Body copy, reviews, and synopses remain sentence case for reading comfort.

**The Numeric Mono Rule.** Every numerical rating, rank badge, timestamp, and runtime must be set in `JetBrains Mono` with tabular numbers to preserve alignment and mechanical feeling.

---

## Layout

The spatial architecture is grounded in a rigid, structural grid with stark hairline separators.

- **Canvas Container:** Max width `1200px` centered with `32px` to `40px` horizontal padding on desktop.
- **Section Rhythm:** Sections are vertically spaced with `60px` top and bottom margins, anchored by a bottom border in `--gray-700` (`#2a2f3d`) and an indexed section number (`01`, `02`, etc.) in Cadmium Amber.
- **Movie Catalog Grid:** Fixed 5-column grid (`grid-template-columns: repeat(5, 1fr)`) with a strict `16px` gap. On mobile viewports, adapts to 2 columns (`repeat(2, 1fr)`) with `12px` gap.
- **Poster Ratio:** Strictly enforced `2:3` aspect ratio for all cinematic artwork with `object-fit: cover`.
- **Top Navigation Bar:** Height `56px`, sticky positioned at top (`z-index: 1000`), backed by dark glass (`rgba(6, 7, 10, 0.95)`, `backdrop-filter: blur(12px)`), bounded on the bottom by a solid `2px solid #ffffff` line.

---

## Elevation & Depth

Criticbox avoids soft, blurry shadows completely. The system is tactile and flat at rest, expressing elevation through hard physical offsets and contrasting border frames.

### Shadow Vocabulary
- **Hard Primary Offset** (`box-shadow: 2px 2px 0px 0px rgba(255, 255, 255, 0.3)`): Default tactile base on primary action buttons.
- **Hard Amber Shift** (`box-shadow: 2px 2px 0px 0px var(--accent)` / `3px 3px 0px 0px var(--accent)`): Applied on button hover, active tabs, and focused cards. Simulates physical mechanical displacement.
- **Poster Monolith Offset** (`box-shadow: 10px 10px 0px 0px var(--accent)`): Used for signature showcase hero cards and featured movie showcases.
- **Deep Void Ambient** (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65)`): Reserved exclusively for poster frames layered over complex photographic backdrops.

### Named Rules
**The Zero-Blur Doctrine.** No box-shadow on interactive elements may have a blur radius greater than 0px. Elevation is a hard step, never a fuzzy cloud.

**The Physical Hop Rule.** Buttons and cards that receive hover states physically shift position (`transform: translateY(-2px)`) accompanied by a corresponding hard offset shadow drop.

---

## Shapes

The form language is defined by total rectangular purity.

- **Universal Radius:** Exactly `0px`. Rounding of any degree is prohibited (`* { border-radius: 0 !important; }`).
- **Framing & Strokes:**
  - Standard container border: `1px solid #2a2f3d`
  - High-impact / active border: `2px solid #ffffff` or `1px solid #ff9900`
  - Sub-divider: `1px solid #1c202c`
- **Signature Glyphs:**
  - The Brand Mark Square: The `nav-logo` terminates in a filled amber square (`.nav-logo::after { content: '■'; color: var(--accent); }`).
  - Pinned Rank Badges: Rank indicators (`#01`, `#02`) sit squarely in the upper-left corner of poster frames with right and bottom borders matching the accent theme.

---

## Components

### 1. Buttons

#### Primary Button (`.hero-btn-primary`, `.btn-primary`)
- **Shape:** Rectangular (`border-radius: 0px`).
- **Typography:** Space Grotesk, 700, `0.82rem`, uppercase, `0.04em` tracking.
- **Resting:** Background `#ff9900`, color `#000000`, border `1px solid #ff9900`, shadow `2px 2px 0px 0px rgba(255, 255, 255, 0.3)`.
- **Hover:** Background `#ffffff`, color `#000000`, border `1px solid #ffffff`, shadow `3px 3px 0px 0px #ff9900`, transform `translateY(-1px)`.
- **Padding:** `12px 28px`.

#### Ghost / Outline Button (`.nav-btn-ghost`, `.btn-ghost`)
- **Shape:** Rectangular (`border-radius: 0px`).
- **Typography:** Space Grotesk, 700, `0.78rem`, uppercase.
- **Resting:** Background `transparent`, color `#9ca3af`, border `1px solid #2a2f3d`.
- **Hover:** Background `#ffffff`, color `#000000`, border `1px solid #ffffff`.
- **Padding:** `8px 16px`.

#### Accent Button (`.nav-btn-accent`)
- **Shape:** Rectangular (`border-radius: 0px`).
- **Typography:** Space Grotesk, 700, `0.78rem`, uppercase.
- **Resting:** Background `#ff9900`, color `#000000`, border `1px solid #ff9900`.
- **Hover:** Background `#ffffff`, color `#000000`, border `1px solid #ffffff`, shadow `2px 2px 0px 0px #ff9900`.
- **Padding:** `8px 16px`.

### 2. Rating & Score Badges

#### Definitive Score Badge (`.review-card-score-badge`, `.score-badge`)
- **Philosophy:** High-contrast brutalist rating presentation (Pitchfork / Metacritic aesthetic).
- **Typography:** JetBrains Mono, 700, `0.75rem`–`0.85rem`.
- **Resting:** Background `#ff9900`, color `#000000`, border `1px solid #ffffff`, padding `3px 7px`.
- **Format:** Displayed with single decimal precision (e.g., `9.0`, `7.5`, `10.0`).

### 3. Movie Cards (`.movie-card`)
- **Structure:** Solid vertical container comprising a `2:3` poster image on top, pinned rank chip at `[0,0]`, and structured metadata box below.
- **Borders:** `1px solid #2a2f3d`.
- **Resting Background:** `#0a0c11`.
- **Hover State:** Background `#11141d`, border-color `#ff9900`, transform `translateY(-2px)`. Poster image slightly zooms (`scale(1.04)`).
- **Padding:** Poster border bottom `1px solid #2a2f3d`; text padding `12px 14px`.

### 4. Input & Search Fields (`.nav-search`, `input[type="text"]`)
- **Style:** Background `#090b10`, border `1px solid #2a2f3d`, color `#ffffff`.
- **Typography:** Plus Jakarta Sans, `0.82rem`.
- **Focus:** Border color shifts decisively to `#ff9900`. No outer glowing halo; just a sharp 1px color transition.
- **Placeholder:** `#6b7280`.

### 5. Chips & Eyebrow Badges (`.hero-eyebrow-chip`, `.review-scope-chip`)
- **Orange Active Chip:** Background `rgba(255, 153, 0, 0.08)`, border `1px solid rgba(255, 153, 0, 0.25)`, color `#ff9900`.
- **Neutral Outline Chip:** Border `1px solid #2a2f3d`, color `#9ca3af`.
- **Typography:** Space Grotesk, 700, `0.70rem`, uppercase.
- **Padding:** `3px 8px`.

### 6. Review Modal & Sheets (`.review-modal`)
- **Frame:** Solid `2px solid #ffffff`, background `#07080c`, hard drop shadow.
- **Overlay:** `rgba(0, 0, 0, 0.85)` with `backdrop-filter: blur(6px)`.
- **Form Controls:** Textareas and inputs retain 0px radius with `1px solid #2a2f3d` border.

---

## Do's and Don'ts

### Do:
- **Do** enforce `border-radius: 0 !important` on every newly authored component, dialog, avatar, badge, or container.
- **Do** use `JetBrains Mono` for any data-driven value: scores, ratings, episode codes (e.g. `T01E04`), years, runtimes, and ranks.
- **Do** keep display headings in `Outfit` (all-caps) and interactive UI controls in `Space Grotesk` (all-caps).
- **Do** use hard-edged, solid offset drop shadows (`2px 2px 0 0 ...`) without blur on button or card hover states.
- **Do** keep background surfaces rooted in dark noir tones (`#06070a`, `#0a0c11`, `#11141d`).
- **Do** frame high-prominence headers, hero posters, and modals with solid high-contrast borders (`2px solid #ffffff`).

### Don't:
- **Don't** use pill buttons, rounded card corners, circular avatars, or any `border-radius > 0px`.
- **Don't** apply blurry, multi-stop ambient drop shadows (`box-shadow: 0 10px 30px rgba(...)`).
- **Don't** introduce colorful decorative gradients (purple-to-blue, sunset gradients, or SaaS glass bubbles).
- **Don't** use lowercase or camelCase on button labels, section headings, or filter tags.
- **Don't** replace the high-voltage Cadmium Amber (`#ff9900`) with generic web blues, greens, or pastels.
- **Don't** hide critical movie metadata inside hidden tooltips; prioritize dense, scannable brutalist layouts.
