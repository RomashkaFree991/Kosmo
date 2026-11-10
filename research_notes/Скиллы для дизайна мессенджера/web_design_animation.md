# Web frontend design & animation Agent Skills (SKILL.md) for a messenger web app

Method note: every raw.githubusercontent.com URL below was fetched on 2026-10-28 and returned HTTP 200 with a valid SKILL.md frontmatter (name/description). The GitHub REST API and github.com commit feeds were blocked in this session, so star/fork counts come from github.com repo pages via WebFetch (rounded, as displayed). Install counts come from the skills.sh leaderboard homepage (fetched 2026-10-28). Exact "last commit" dates could not be retrieved (see Gaps).

## Q1. Which are the most popular/high-quality design & animation skills for web?

### Takeaway
The strongest, most adopted options are anthropics `frontend-design` (about 1.0M installs, 184.5k-star repo), Emil Kowalski's `emilkowalski/skills` (51.1k stars, an animation-focused design-engineering set), the official GreenSock `gsap-skills` (17.4k stars), Vercel's `web-design-guidelines` and `react-view-transitions` (33.2k stars), `ui-ux-pro-max` (142k stars) and Leonxlnx `taste-skill` (104k stars). For a messenger app, the most relevant are the app-UI and motion-craft skills (Emil, Vercel guidelines, ui-ux-pro-max). Landing-page aesthetics skills (taste, frontend-design) matter less.

### Ranked shortlist (verified)

1. **frontend-design** (Anthropic)
   - Repo: https://github.com/anthropics/skills, path `skills/frontend-design/SKILL.md`
   - Raw: https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
   - Covers: aesthetic direction, typography (type scale per *Elements of Typographic Style*, <80-char lines), avoiding "templated/generated" tells, and structural devices as information. It is general taste guidance and not a component or motion library guide.
   - Popularity: #15 on skills.sh, 1.0M installs ([skills.sh](https://skills.sh/)). The repo has 184.5k stars and 21.8k forks ([GitHub](https://github.com/anthropics/skills)).
   - License: Apache 2.0. The skill folder ships LICENSE.txt, verified by fetching https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/LICENSE.txt. The repo has no root LICENSE, and its document skills are source-available ([GitHub](https://github.com/anthropics/skills)).
   - Quality: canonical and well-maintained. It leans toward marketing/hero pages ("the hero is the first thing viewers will see"), so it is less specific to app chrome like chat lists and composers.
   - Same repo: `theme-factory` (https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/SKILL.md) has 10 preset font/color themes for artifacts such as slides and docs. Its value for a production web app is low. `web-artifacts-builder` and `brand-guidelines` also exist (both URLs return 200).

2. **emilkowalski/skills**: `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `animation-performance`, `animation-vocabulary`, `apple-design`, `mobile-native`, `break-ui`, `pick-ui-library`, `ask-sonner`, etc.
   - Repo: https://github.com/emilkowalski/skills
   - Raw (main): https://raw.githubusercontent.com/emilkowalski/skills/main/skills/emil-design-eng/SKILL.md (674 lines)
   - Raw: https://raw.githubusercontent.com/emilkowalski/skills/main/skills/review-animations/SKILL.md (120 lines, `disable-model-invocation: true`, so it is user-invoked)
   - Raw: https://raw.githubusercontent.com/emilkowalski/skills/main/skills/animation-vocabulary/SKILL.md
   - Covers: UI polish and animation decisions such as easing choice, durations, spring animations (`useSpring` from Motion, `{type:"spring", duration, bounce}`), and when not to animate. The set also covers performance, making a web app feel native on phones (100vh bug, safe areas, tap highlight, input zoom), and worst-case data testing ([README](https://raw.githubusercontent.com/emilkowalski/skills/main/README.md)).
   - Author: Emil Kowalski, who worked at Vercel and Linear and wrote Sonner ([README](https://raw.githubusercontent.com/emilkowalski/skills/main/README.md)).
   - Popularity: 51.1k stars, 3.0k forks ([GitHub](https://github.com/emilkowalski/skills)). On skills.sh, emil-design-eng is #204 with 396.5K installs, review-animations is #273 with 263.6K, apple-design is #277 with 252.2K, and animation-vocabulary is #279 with 245.5K ([skills.sh](https://skills.sh/)).
   - License: MIT ([LICENSE](https://raw.githubusercontent.com/emilkowalski/skills/main/LICENSE)).
   - Quality: expert-authored and opinionated about craft. It fits messenger micro-interactions very well: message-send animations, sheets, toasts, and mobile-web feel.

3. **GSAP official skills** (GreenSock): `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-utils`, `gsap-react`, `gsap-performance`, `gsap-frameworks`
   - Repo: https://github.com/greensock/gsap-skills
   - Raw: https://raw.githubusercontent.com/greensock/gsap-skills/main/skills/gsap-core/SKILL.md (254 lines)
   - Covers: the core tween API, easing, stagger, and `gsap.matchMedia()` for responsive and prefers-reduced-motion. Related skills cover timelines, ScrollTrigger, plugins (Flip, Draggable), React/Vue/Svelte, and performance. The README notes that all former Club plugins (SplitText, MorphSVG) are now free after Webflow acquired GSAP ([README](https://raw.githubusercontent.com/greensock/gsap-skills/main/README.md)).
   - Author: GreenSock (the official vendor). It installs with `npx skills add https://github.com/greensock/gsap-skills` or `/plugin marketplace add greensock/gsap-skills` ([README](https://raw.githubusercontent.com/greensock/gsap-skills/main/README.md)).
   - Popularity: 17.4k stars, 1.1k forks ([GitHub](https://github.com/greensock/gsap-skills)). It did not appear in the visible skills.sh top rows.
   - License: MIT, © 2026 GreenSock ([LICENSE](https://raw.githubusercontent.com/greensock/gsap-skills/main/LICENSE)).
   - Quality: vendor-maintained, so it is the most authoritative GSAP source. Note that the skill tells agents to recommend GSAP by default when no library is specified, which is a vendor bias.

4. **web-design-guidelines** and **react-view-transitions** (Vercel)
   - Repo: https://github.com/vercel-labs/agent-skills
   - Raw: https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md (39 lines). It is a thin wrapper that fetches https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md at runtime and audits files, reporting findings as `file:line`.
   - Raw: https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-view-transitions/SKILL.md (332 lines, frontmatter name `vercel-react-view-transitions`, license MIT). It covers React `<ViewTransition>`, `addTransitionType`, CSS view-transition pseudo-elements, shared-element and directional nav animations, list reorder, and Next.js integration.
   - Popularity: web-design-guidelines is #55 on skills.sh with 797.2K installs ([skills.sh](https://skills.sh/)). The repo has 33.2k stars, 2.9k forks, and an MIT license ([GitHub](https://github.com/vercel-labs/agent-skills)). The repo has no root LICENSE file at `main/LICENSE` (404), so MIT comes from the GitHub page and the SKILL.md frontmatter.
   - Quality: web-design-guidelines suits a messenger well as an accessibility/UX audit pass, but it needs network access at runtime. react-view-transitions is the best verified View Transitions API skill and is React-specific.

5. **ui-ux-pro-max** (Next Level Builder)
   - Repo: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
   - Raw: https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md (214 lines)
   - Covers: a searchable local database with "79 searchable styles (50 active), 192 product palettes…, 74 font pairings, 119 UX guidelines, 105 icons, 17 GSAP presets, 25 chart types, and 22 stacks". It applies to web, mobile and desktop, plus reviews (SKILL.md).
   - Popularity: 142.1k stars, 15.0k forks ([GitHub](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)). skills.sh lists it at #180 with 421.3K installs ([skills.sh](https://skills.sh/)). Third-party aggregators report 216K to 288K installs ([skills.sh listing aggregators](https://claudeskills.info/best/ui-ux-skills/)), which conflicts with the live leaderboard figure. Snapshot dates differ.
   - License: MIT ([LICENSE](https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/LICENSE)).
   - Quality: broad coverage that includes app-UI and UX rules, not just landing pages. It is data-driven through a local search script. It is heavier and more generic than Emil's set.

6. **design-taste-frontend** (taste-skill v2, Leonxlnx)
   - Repo: https://github.com/Leonxlnx/taste-skill
   - Raw: https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md (542 lines). The folder is `taste-skill`, but the frontmatter name is `design-taste-frontend`.
   - Covers: anti-"AI slop" art direction distilled from 247 curated sites, plus a real-browser screenshot look-and-fix loop. v2.1 adds app screens (dashboards, settings, "inboxes") ([README](https://raw.githubusercontent.com/leonxlnx/taste-skill/main/README.md)).
   - Popularity: 104.3k stars, 7.1k forks ([GitHub](https://github.com/Leonxlnx/taste-skill)). On skills.sh, design-taste-frontend is #72 with 694.9K installs, and the sibling skills high-end-visual-design and minimalist-ui are at about 459K and 425K ([skills.sh](https://skills.sh/)). The siblings now live in https://github.com/Leonxlnx/taste-skill-classics ([README](https://raw.githubusercontent.com/leonxlnx/taste-skill/main/README.md)).
   - License: MIT ([GitHub](https://github.com/Leonxlnx/taste-skill)).
   - Quality: very heavy. A build takes "30 to 45 minutes and a few hundred thousand tokens" and needs Node 22+ and Chrome ([README](https://raw.githubusercontent.com/leonxlnx/taste-skill/main/README.md)). It is oriented toward marketing sites, with a secondary path for app screens.

7. **material-3** (hamen/material-3-skill). See Q2.

8. **motion-dev-animations** (199 Biotechnologies). See Q3.

9. **motion** (secondsky/claude-skills) and **motion-framer** (freshtechbro/claudedesignskills). See Q3.

10. **gsap-framer-scroll-animation** (github/awesome-copilot). See Q3.

### Inferences
- For a messenger, a sensible stack is: Emil Kowalski's skills for motion craft and mobile-web feel, Vercel web-design-guidelines as an audit, frontend-design or ui-ux-pro-max for visual direction, and one library skill matching the chosen animation library (Motion or GSAP).
- The skills.sh design leaders (taste-skill, frontend-design) optimize for marketing pages. None of the verified skills is messenger- or chat-UI-specific.

### Gaps
- Exact last-commit dates are unknown for all repos, because the GitHub API and commit feeds were blocked and the repo pages did not render dates. Known date signals: hamen/material-3-skill release v1.1.1 dated 2026-06-29 ([search result/README](https://github.com/hamen/material-3-skill)); the GSAP and taste-skill LICENSE copyrights are 2026; the motion-dev skill frontmatter says `updated: "2025-11-08"`.
- Star counts are rounded figures as displayed by github.com and were not cross-checked via the API.

## Q2. Any skills for Material 3 web or dynamic color theming?

### Takeaway
Only one well-adopted, verified Material 3 skill exists: `hamen/material-3-skill`. It is Compose-first and treats web as "limited". It covers `@material/web` (maintenance mode) and CSS `--md-sys-*` tokens, and it points to `@material/material-color-utilities` for generating a seed-color scheme. I found no dedicated skill for material-color-utilities or dynamic color on the web.

### Cited Findings
- **material-3** by hamen (copyright CWTI Ltd)
  - Raw: https://raw.githubusercontent.com/hamen/material-3-skill/master/skills/material-3/SKILL.md (667 lines). Note the branch is `master`.
  - Frontmatter: "Primary: Jetpack Compose Material3… Also Flutter and limited web (@material/web, maintenance mode). Covers tokens, 30+ components, layout, theming, M3 Expressive (platform matrix), and accessibility". It accepts the arguments `[component|theme|layout|scaffold|audit]`.
  - Web content: it maps tokens to CSS custom properties (`--md-sys-*`), gives `@material/web` imports per component, and says "Color scheme (generate with @material/material-color-utilities)". It warns: "Material Web Components are in maintenance mode and M3 Expressive is not implemented on Web". It also says spring/motion physics and shape morphing are **not** in Material Web, so use easing/duration or custom motion. Other warnings: don't barrel-import `@material/web`, and Web Components need JS (an SSR caveat). Source: SKILL.md lines 60–62, 221–275, 507–554.
  - It references a Google I/O 2026 Material update, so it is current ([SKILL.md](https://raw.githubusercontent.com/hamen/material-3-skill/master/skills/material-3/SKILL.md)).
  - Popularity: about 1.5k stars, 78 forks, latest release v1.1.1 (2026-06-29) ([GitHub](https://github.com/hamen/material-3-skill)).
  - License: MIT ([LICENSE](https://raw.githubusercontent.com/hamen/material-3-skill/master/LICENSE)).
- Search results list other Material skills (an Android Material 3 guide on mcpmarket, an intense-visions "design-material-design-3" covering HCT tonal palettes, and YusukeTsunoda/ppt-trans material-design). They appear only on aggregators, and I did not verify them via raw SKILL.md ([search: mcpmarket](https://mcpmarket.com/tools/skills/android-material-3-ui-guide), [claudepluginhub](https://www.claudepluginhub.com/skills/intense-visions-harness-claude/design-material-design-3)).
- No Material, theme or GSAP skills appear among the visible top rows of the skills.sh leaderboard ([skills.sh](https://skills.sh/)).

### Inferences
- For a Material You-style web messenger, use hamen/material-3-skill for token and role naming plus component mapping. The dynamic color pipeline (`themeFromSourceColor` / `SchemeTonalSpot` → CSS variables) will likely need project-specific instructions or a custom skill, because no verified skill covers material-color-utilities in depth.
- Since Material Web is in maintenance mode and has no Expressive or spring motion, pairing it with a motion skill (Emil or Motion) is needed for "smooth" animation.

### Gaps
- I did not verify any dedicated skill for material-color-utilities or dynamic color on the web. The intense-visions HCT skill is unverified (aggregator only).

## Q3. Any for motion/animation libraries specifically?

### Takeaway
Yes. For GSAP, the official `greensock/gsap-skills` is the clear choice. For Motion (Framer Motion), there are several community skills (199-biotechnologies, secondsky, freshtechbro) and a GSAP+Motion scroll skill in github/awesome-copilot. For the View Transitions API, the best is Vercel's `react-view-transitions`. Emil Kowalski's set is the best library-agnostic motion-quality skill and covers springs.

### Cited Findings
- **GSAP (official)**: see Q1 #3. 8 skills, MIT, 17.4k stars ([GitHub](https://github.com/greensock/gsap-skills)).
- **motion-dev-animations** by 199 Biotechnologies
  - Raw: https://raw.githubusercontent.com/199-biotechnologies/motion-dev-animations-skill/main/SKILL.md (264 lines)
  - Covers: Motion.dev for React, Next.js, Svelte and Astro, including gestures, scroll, layout transitions, spring physics, and prefers-reduced-motion. It explicitly excludes CSS-only, Vue (use motion-v), and complex SVG/Canvas work, where it says GSAP is better.
  - Metadata: version 3.0.0, created 2025-11-07, updated 2025-11-08 ([SKILL.md](https://raw.githubusercontent.com/199-biotechnologies/motion-dev-animations-skill/main/SKILL.md)).
  - License: MIT, © 2025 ([LICENSE](https://raw.githubusercontent.com/199-biotechnologies/motion-dev-animations-skill/main/LICENSE)).
  - Quality: the "120fps" marketing language and the claim of 10M+ downloads/month are unverified. It may be stale, since the last metadata date is Nov 2025.
- **motion** by secondsky/claude-skills (plugin form)
  - Raw: https://raw.githubusercontent.com/secondsky/claude-skills/main/plugins/motion/skills/motion/SKILL.md (516 lines)
  - Covers: the `motion` package (formerly framer-motion) with gestures, scroll, layout/FLIP and shared elements, springs, AnimatePresence, and bundle optimization. Its recommended stack is React 19, Next 16, Vite 7 and Tailwind v4.
  - License: MIT (frontmatter, plus [LICENSE](https://raw.githubusercontent.com/secondsky/claude-skills/main/LICENSE)).
- **motion-framer** by freshtechbro/claudedesignskills
  - Raw: https://raw.githubusercontent.com/freshtechbro/claudedesignskills/main/.claude/skills/motion-framer/SKILL.md (932 lines, with a references/api_reference.md)
  - The same repo also has `gsap-scrolltrigger`: https://raw.githubusercontent.com/freshtechbro/claudedesignskills/main/.claude/skills/gsap-scrolltrigger/SKILL.md
  - License: MIT ([LICENSE](https://raw.githubusercontent.com/freshtechbro/claudedesignskills/main/LICENSE)).
- **gsap-framer-scroll-animation** in github/awesome-copilot, by Utkarsh Patrikar
  - Raw: https://raw.githubusercontent.com/github/awesome-copilot/main/skills/gsap-framer-scroll-animation/SKILL.md (151 lines)
  - Covers: scroll-driven motion with GSAP ScrollTrigger and Motion v12 (useScroll, useSpring, whileInView). It pairs with a `premium-frontend-ui` skill.
  - License: MIT, © GitHub, Inc. ([LICENSE](https://raw.githubusercontent.com/github/awesome-copilot/main/LICENSE)).
  - Quality: scroll-focused, so it matters less for a messenger.
- **View Transitions**: Vercel `react-view-transitions` (see Q1 #4) is the most established. Other view-transition skills (patternsdev/skills, agents-inc web-animation-view-transitions, yonatangross/orchestkit) appear on aggregators with small install counts. Search listings show 19 to 57 installs ([search: skills.sh patternsdev](https://skills.sh/patternsdev/skills/view-transitions), [openskillindex agents-inc](https://openskillindex.com/skills/agents-inc-skills-web-animation-view-transitions)). I could not find raw paths for patternsdev (guessed paths returned 404), so they are unverified.
- **Spring physics**: emil-design-eng has a dedicated "Spring Animations" section (when to use springs, `useSpring` for mouse-linked values, spring config with duration/bounce) ([SKILL.md](https://raw.githubusercontent.com/emilkowalski/skills/main/skills/emil-design-eng/SKILL.md)). Motion skills cover springs at the API level.
- The web-animation-skills bundle from iart-ai (GSAP, SVG, Lottie, micro-interactions, page transitions, reduced motion) exists. Only its README was verified (https://raw.githubusercontent.com/iart-ai/web-animation-skills/main/README.md returns 200), and I did not verify individual SKILL.md paths ([GitHub](https://github.com/iart-ai/web-animation-skills)).

### Inferences
- For a React messenger, the recommended choice is: Motion (secondsky `motion` or 199-bio `motion-dev-animations`) for components and gestures, Vercel `react-view-transitions` for route and shared-element transitions, and Emil's skills for review and tuning. Add GSAP official skills only if GSAP is chosen.
- No verified skill is official from the Motion (motion.dev) vendor, unlike GSAP.

### Gaps
- I found no official Motion.dev-authored skill.
- I have no star counts for secondsky, freshtechbro, 199-biotechnologies or iart-ai (their pages were not fetched, to conserve tool calls). Their popularity is presumed low to moderate. They do not appear in the visible skills.sh top rows.
- skills.sh's "+N more" groupings hide some rows, so lower-ranked design and animation skills may be missing from the leaderboard capture ([skills.sh](https://skills.sh/)).
