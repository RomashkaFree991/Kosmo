---
name: glisse
description: Liquid Glass physics for the web, from the glisse React library (github.com/0kzh/glisse, MIT) — analytic damped springs, the press "rubber band" (glass grows under the finger and stretches toward a drag), selection indicators that slide between choices, follow a drag and lift into a refracting lens (tab bars, segmented controls), and menus that spring open from their trigger with a highlight plate you scrub with a finger. Use when building or tuning Liquid Glass motion, active indicators, tab bars, segmented controls, switches, sliders or menus on the web, in React or vanilla JS; when glass feels "stiff" or CSS-eased; or when porting iOS 26 control behaviour. In Kosmo the vanilla port lives in web/js/glisse.js + web/css/glisse.css.
---

# glisse — Liquid Glass physics

Source: `source/src/` is glisse @46be5ba (React 19, TypeScript, MIT — see `LICENSE`).
Kosmo is vanilla ES modules, so it uses a **port**: `web/js/glisse.js` and `web/css/glisse.css`.
Change motion there; read `source/` for the reference behaviour and constants.

## What to take from it

| Piece | glisse file | Kosmo port |
|---|---|---|
| Analytic spring (exact damped-oscillator step, one shared rAF loop, reduced motion → jump) | `internal/spring.ts` | `createSpring(value, k, d, paint)` |
| Press: grow `grow/max(w,h)`, rubber-band stretch + translate toward the drag, light at the finger (`--lg-x/--lg-y`) | `internal/press.ts` | `initPressSprings()` on `button.glass, .circle-btn, .icon-btn.glass` |
| Selection: springs between items, follows a drag (6px threshold, pointer capture), lifts into a lens while held, selects on release | `internal/segments.tsx` | `attachBar()` for `.tabbar`, `.seg`, `.segs` (auto-attached) |
| Lens refraction: rim displacement map, Snell-like profile, `backdrop-filter: url()` | `internal/refraction.ts`, `internal/lens.ts` | `lensFilter(w, h, radius)` (Chromium only) |
| Menu: morph-open spring (600/46 in, 900/57 out), content fades in from blur, highlight plate, press-and-slide to pick | `menu.tsx` | `openMenu()` + `menuGesture` for every `.menu` except the emoji picker |
| Hold before a touch claims the gesture | `internal/hold.ts` (150 ms) | drag claims after 6 px; menu slide claims after 8 px |

## Constants (keep them; they are measured against iOS 26)

```
press   mouse: grow 6,  press [417.6, 29.2], release [230, 23.7]
        touch: grow 15, press [515, 27.3],   release [250, 11.8]
select  rest  [slide 1024/58.9, lift 676/47.8]
        drag  [slide 2500/94,   lift 576/44.2]
        lens grow: tab bar +16×12 px, segmented +14×10, small segs +10×8
menu    open 600/46, close 900/57, scale 0.5 → 1, content blur 6 px → 0
lens    strength ≈ bezel × 1.1, bezel = clamp(h / 2.6, 6, 14) px
```

Stiffness/damping are per unit mass (k, d in `x'' = -k·x - d·x'`).

## Rules

- **Glass only.** Everything is gated on `html[data-theme="glass"]`; in Material You the
  indicators are handed back to CSS (inline styles cleared on theme switch).
- **Composite-only**: transform/scale/translate/opacity. Width/height of the indicator
  change only between items of different size.
- **Labels stay sharp at rest**: the indicator sits under labels (z 0); only while lifted does
  the lens rise above them (z 2) so its backdrop filter bends them.
- **Chromium only refracts** (`backdrop-filter: url(#…)`); Safari/Firefox get a clear lens with
  saturate/brightness. Don't add blur to the lifted lens — it would blur the labels there.
- **No RGB split in backdrop-filter**: glisse splits R/G/B at the rim, but in Chrome's
  backdrop-filter that chain greys out light backdrops. One displacement map only.
- **Clicks**: a drag that ends on another item clicks *that* item and swallows the native click
  of the start item; a plain tap keeps the browser's click.
- **Menus after long-press**: the press that opened a menu can slide over rows (touchmove is
  cancelled only while such a press is active) and release on a row = click.
- `prefers-reduced-motion` → springs jump; `prefers-reduced-transparency` → no lens filter.

## Adding a new control

- Segmented choice: render `<div class="segs">` with `<button class="seg-btn" role="radio" aria-checked>` —
  the indicator attaches itself (MutationObserver) and follows `aria-checked`.
- Menu: any `.menu` with `.menu-item` rows gets the spring and the plate when it is inserted
  or un-hidden; close it the usual way (`.is-closing` + CSS `menu-out`).
- Custom spring: `import { createSpring } from './glisse.js'`.
