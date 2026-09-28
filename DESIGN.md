---
name: lumpat-design
description: Design tokens for lumpat.co.id — marketing site, event pages, and checkout flow
tokens:
  colors:
    bg: "#ffffff"
    surface: "#f5f5f4" # stone-100
    surface_subtle: "#fafaf9" # stone-50
    border: "#e7e5e4" # stone-200
    text_primary: "#1c1917" # stone-900
    text_secondary: "#78716c" # stone-500
    primary: "#0c0a09" # stone-950 — buttons, always neutral black
    success: "#059669" # emerald-600
    danger: "#dc2626" # red-600
  typography:
    family: system-ui stack (Tailwind default)
    label: "text-[10px] font-black uppercase tracking-widest text-stone-500"
    heading: "font-black uppercase tracking-tighter"
    price: "text-2xl font-bold tabular-nums"
  radius:
    input: rounded-xl
    button: rounded-xl
    card: rounded-2xl
    pill: rounded-full
  layout:
    checkout_max: max-w-6xl
    checkout_grid: "lg:grid-cols-[1fr_380px]"
    status_max: max-w-md
  components:
    button_primary: "bg-stone-950 text-white rounded-xl h-12 font-bold hover:bg-stone-800 disabled:opacity-40"
    button_ghost: "border-2 border-stone-200 rounded-xl h-12 font-bold hover:border-stone-400 bg-white"
    input: "border-2 border-stone-200 rounded-xl h-12 focus:border-stone-800 focus:ring-0 bg-white"
    section_card: "bg-white border border-stone-200 rounded-2xl"
    summary_card: "bg-stone-50 border border-stone-200 rounded-2xl p-6 lg:sticky lg:top-8"
---

# Lumpat Design

## Rationale

**Neutral-first, black as the accent.** Lumpat's brand is editorial and
athletic (see event pages: stone palette, uppercase labels, tight tracking).
The checkout keeps that DNA but flattens to a clean e-commerce pattern —
white canvas, stone surfaces, hairline borders — so the page reads as a
trusted payment flow, not a marketing page. The single strongest color on
any checkout surface is the black pay button (Shopify convention).

**Checkout layout** (Stanley/id.stanley1913.com reference): two columns —
accordion form on the left, sticky order summary on the right. Mobile
collapses the summary into a `<details>` accordion above the form. Progress
is expressed by section state (numbered → done-check → edit), not a wizard
modal.

**Status page**: single centered card, one large state icon (emerald check /
red X / spinner), order details, and one primary action. No navigation
chrome — users arrive here mid-payment from a Midtrans redirect.

**Existing pages** (landing, event, admin) are unchanged by this document;
tokens above describe the checkout + status surface and match the stone
palette already used across the app.
