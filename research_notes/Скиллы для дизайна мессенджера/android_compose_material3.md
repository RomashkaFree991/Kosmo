# Claude Code / Agent Skills for Android (Kotlin + Jetpack Compose, Material 3 / Material You / M3 Expressive, motion)

Method note: every repo below was shallow-cloned on 2026-10-28 and every listed raw SKILL.md URL returned HTTP 200 when checked. "Last update" is the date of the latest commit on the default branch at clone time. Star and fork counts come from the GitHub repo pages fetched the same day. Keyword counts ("mentions") come from grep over each skill's folder, including its references/. GitHub code search and the REST API were blocked in this environment, so discovery relied on web search, marketplace listings and known repos. Some smaller skills may have been missed.

## Which skills exist specifically for Jetpack Compose / Material 3 / Material You / M3 Expressive?

### Takeaway
Two community skills target Material 3 directly. **hamen/material-3-skill** (`material-3`) is the dedicated M3 / Material You skill. **ahmed3elshaer/everything-claude-code-mobile → `m3-expressive`** is the only skill that covers nothing but M3 Expressive. The broadest Compose skill is **aldefy/compose-skill** (`compose-expert`), which is grounded in androidx source and adds M3 theming, motion and Expressive. Anthropic's own anthropics/skills repo has no Android skill.

### Cited Findings

**Ranked shortlist (for a Kotlin/Compose messenger app):**

1. **compose-expert (aldefy/compose-skill)**
   - Repo: https://github.com/aldefy/compose-skill
   - SKILL.md: https://raw.githubusercontent.com/aldefy/compose-skill/master/skills/compose-expert/SKILL.md
   - Author: Adit Lal (aldefy). License: MIT. 598 stars, 39 forks. Last commit 2026-07-08 (CHANGELOG v2.4.0, 2026-07-08).
   - Coverage: Compose and Compose Multiplatform. SKILL.md is 301 lines with 27 reference files, including:
     - animation.md, material3-motion.md (MotionScheme, duration/easing tokens, AnimatedVisibility, updateTransition, shared element transitions, a section on expressive motion)
     - theming-material3.md, navigation.md, navigation-migration.md, performance.md, state-management.md, side-effects.md, lists-scrolling.md, accessibility.md, design-to-compose.md, pr-review.md, deprecated-patterns.md
     - source-code/ excerpts from androidx
   - Keyword mentions:

     | Topic | Mentions |
     |---|---|
     | MotionScheme / ExperimentalMaterial3ExpressiveApi | 213 |
     | predictive back | 93 |
     | spring() / Spring. | 40 |
     | SharedTransitionLayout / sharedElement / sharedBounds | 30 |
     | MaterialShapes / morph | 14 |
     | dynamic*ColorScheme | 4 |

   - Quality: its CI compiles ` ```kotlin compile ` doc snippets and runs Robolectric tests on layout claims, which catches stale or hallucinated APIs (CHANGELOG 2.4.0). v2.4.0 added M3 Expressive coverage (`MaterialExpressiveTheme`, motion-scheme guidance).
   - Install in Claude Code: `/plugin marketplace add aldefy/compose-skill` → `/plugin install compose-expert`
   - Sources: [repo](https://github.com/aldefy/compose-skill), [SKILL.md](https://raw.githubusercontent.com/aldefy/compose-skill/master/skills/compose-expert/SKILL.md)

2. **material-3 (hamen/material-3-skill)**
   - Repo: https://github.com/hamen/material-3-skill
   - SKILL.md: https://raw.githubusercontent.com/hamen/material-3-skill/master/skills/material-3/SKILL.md
   - Author: Ivan Morgillo / CWTI Ltd (LICENSE copyright "CWTI Ltd"). License: MIT. 1.5k stars, 78 forks. Latest release v1.1.1 (2026-06-29). Last commit 2026-07-16.
   - Coverage: "Implement Google's Material Design 3 (Material You) UI system. Primary: Jetpack Compose Material3", plus Flutter and limited web. Covers tokens, 30+ components, layout, theming, M3 Expressive (platform matrix) and accessibility. SKILL.md is 667 lines with 6 references: color-system, theming-and-dynamic-color, component-catalog, typography-and-shape, layout-and-responsive, navigation-patterns.
   - It has a "Google I/O 2026" update section (Compose-first Material, expressive layout scaffold, 8dp spacing, refreshed expressive lists/menus/search) and an Expressive shape scale (large-increased, extra-large-increased, extra-extra-large). It notes that MD3 Expressive (May 2025) introduced spring-based motion physics.
   - It accepts `[component|theme|layout|scaffold|audit]` arguments, so it can also audit UI.
   - Gaps for this project: 0 shared-element mentions and 1 predictive-back mention, so it does not cover animation implementation.
   - Install: `npx --yes skills add hamen/material-3-skill --skill material-3 -y`, or `/plugin marketplace add hamen/material-3-skill` + `/plugin install material-3@material-3-skill`
   - Sources: [repo/README](https://github.com/hamen/material-3-skill), [SKILL.md](https://raw.githubusercontent.com/hamen/material-3-skill/master/skills/material-3/SKILL.md)

3. **Google official Android skills (android/skills)**
   - Repo: https://github.com/android/skills
   - Author: Google / Android. License: Apache-2.0 (LICENSE.txt). About 10.0k stars, 644 forks, 90 commits. Last commit 2026-10-26. Plugin version 1.0.18.
   - The repo ships `.claude-plugin/marketplace.json` ("Google's official Android skills for agentic Android development"). It contains 36 skills. None of them is a dedicated phone M3, dynamic-color or animation skill; `wear-compose-m3` covers Wear OS only.
   - Most relevant for a messenger:
     - **navigation-event**: "Intercept back gestures and run Predictive Back animations using the NavigationEvent (androidx.navigationevent) library in Compose", including migration from legacy `BackHandler` on SDK 36+ (last-updated 2026-10-07; 23 predictive-back mentions). https://raw.githubusercontent.com/android/skills/main/navigation/navigation-event/SKILL.md
     - **edge-to-edge**: fixes for IME insets and system bars (last-updated 2026-08-24). This matters for a chat input field. https://raw.githubusercontent.com/android/skills/main/system/edge-to-edge/SKILL.md
     - **jetpack-compose-performance**: has an animation.md and a lazy-layouts reference, and mentions shared elements (last-updated 2026-10-22). https://raw.githubusercontent.com/android/skills/main/jetpack-compose/jetpack-compose-performance/SKILL.md
     - **adaptive**: covers window sizes, Navigation3 scenes and nav rail/bar. https://raw.githubusercontent.com/android/skills/main/jetpack-compose/adaptive/SKILL.md
     - **navigation-3**: https://raw.githubusercontent.com/android/skills/main/navigation/navigation-3/SKILL.md
   - Install: Google documents the Android CLI (`android skills add <name> --project=.` or `android skills add --all`). The repo also has a Claude plugin marketplace manifest.
   - Sources: [repo](https://github.com/android/skills), [Android skills overview](https://developer.android.com/tools/agents/android-skills)

4. **m3-expressive (ahmed3elshaer/everything-claude-code-mobile)**
   - SKILL.md: https://raw.githubusercontent.com/ahmed3elshaer/everything-claude-code-mobile/main/skills/m3-expressive/SKILL.md
   - Author: ahmed3elshaer. License: MIT. 66 stars, 18 forks. Last commit 2026-06-14.
   - Coverage: "Material 3 Expressive design patterns for Jetpack Compose - expressive theming, motion physics, shape morphing, typography emphasis, color emphasis, and all 28 expressive components." It is a single 2,008-line file. It starts from `MaterialExpressiveTheme` and says every API needs `@OptIn(ExperimentalMaterial3ExpressiveApi::class)`. Mentions: MotionScheme/Expressive 66, spring 10, morph/MaterialShapes 8.
   - Quality caveat: its Gradle snippet uses Compose BOM `2025.05.00` and the old `composeOptions { kotlinCompilerExtensionVersion = "1.5.14" }`. That setup is outdated for Kotlin 2.x, which uses the Compose Compiler Gradle plugin. The API content may also predate later material3 releases.
   - The same plugin includes `jetpack-compose` (219 lines): https://raw.githubusercontent.com/ahmed3elshaer/everything-claude-code-mobile/main/skills/jetpack-compose/SKILL.md
   - Install: the whole plugin, via `/plugin marketplace add ahmed3elshaer/everything-claude-code-mobile` → `/plugin install everything-claude-code-mobile@everything-claude-code-mobile`. It brings about 40 skills, including iOS ones, so copying only the `m3-expressive` folder to `.claude/skills/` may be cleaner.
   - Sources: [repo](https://github.com/ahmed3elshaer/everything-claude-code-mobile)

5. **claude-android-ninja (Drjacky/claude-android-ninja)**
   - SKILL.md: https://raw.githubusercontent.com/Drjacky/claude-android-ninja/master/SKILL.md
   - Author: DrJacky. License: Apache-2.0. 129 stars, 16 forks. Last commit 2026-09-29.
   - Coverage: a full-stack Android skill: Kotlin, Compose, MVVM, Hilt, Room 3, Navigation3, multi-module Gradle, API 37 / targetSdk migration, offline-first sync. SKILL.md is 120 lines and routes to 40 reference files, including android-theming.md and compose-patterns.md.
   - Mentions: dynamic*ColorScheme 22 (the most of any skill checked), predictive back 11, shared element 9, MotionScheme/Expressive 9, spring 10.
   - Good as an architecture backbone for a messenger app; less deep on design.
   - Install: `npx skills add drjacky/claude-android-ninja`
   - Sources: [repo](https://github.com/Drjacky/claude-android-ninja)

6. **modern-jetpack-compose (anhvt52/jetpack-compose-skills)**
   - SKILL.md: https://raw.githubusercontent.com/anhvt52/jetpack-compose-skills/master/modern-jetpack-compose/SKILL.md
   - Author: Anh Vu. License: MIT. 100 stars, 4 forks. Last commit 2026-03-12.
   - Coverage: writing and reviewing Compose: state, side effects, recomposition, navigation, M3, accessibility, performance. 132 lines plus 11 references. Light on motion: 0 shared-element and 0 spring mentions.
   - Sources: [repo](https://github.com/anhvt52/jetpack-compose-skills)

7. **mobile-android-design (wshobson/agents, ui-design plugin)**
   - SKILL.md: https://raw.githubusercontent.com/wshobson/agents/main/plugins/ui-design/skills/mobile-android-design/SKILL.md
   - Author: Seth Hobson. License: MIT. The parent repo is very popular: 41.9k stars, 4.4k forks; last commit 2026-10-17.
   - Coverage: "Master Material Design 3 and Jetpack Compose patterns". 101 lines plus 4 references, including material3-theming.md (5 dynamic color mentions). No MotionScheme, shared element or predictive back mentions, so it is generic.
   - Sources: [repo](https://github.com/wshobson/agents)

8. **compose-ui and others (new-silvermoon/awesome-android-agent-skills)**
   - SKILL.md: https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/.github/skills/ui/compose-ui/SKILL.md
   - License: Apache-2.0. 992 stars, 98 forks. Last commit 2026-07-27.
   - 17 skills in `.github/skills/` (Copilot layout), including compose-ui (only 49 lines), compose-navigation, coil-compose, android-accessibility, compose-performance-audit and xml-to-compose-migration. Popular, but the skills are short and have no Expressive, dynamic color or motion coverage.
   - Sources: [repo](https://github.com/new-silvermoon/awesome-android-agent-skills)

- anthropics/skills has 19 skills (algorithmic-art, frontend-design, theme-factory, etc.) and none for Android, Kotlin or Compose — [anthropics/skills](https://github.com/anthropics/skills)

### Inferences
- For a messenger app, a sensible stack is:
  - aldefy `compose-expert` for Compose, motion, shared elements and predictive back
  - hamen `material-3` for the M3 / Material You design system, dynamic color and audits
  - Google `android/skills`, selectively: navigation-event, edge-to-edge (keyboard/IME insets for the chat composer), jetpack-compose-performance (long LazyColumn chat lists) and navigation-3
  - optionally `m3-expressive`, as an Expressive component catalog only, with its Gradle setup ignored
- Installing several broad Compose skills at once (compose-expert, modern-jetpack-compose, android-ninja, mobile-android-design) will overlap and compete for activation. Choose one general Compose skill.

### Gaps
- Exact per-skill (per-folder) last-modified dates weren't determined because the clones were shallow; repo-level dates are given instead.
- skills.sh install counts were not retrieved.

## Which cover dynamic color and Compose animation/motion?

### Takeaway
For dynamic color (Monet), the best coverage is in hamen `material-3` (dedicated theming-and-dynamic-color.md) and Drjacky `claude-android-ninja` (most mentions). For motion, aldefy `compose-expert` is clearly the strongest: MotionScheme, springs, shared element transitions and predictive back. Google's `navigation-event` is the authoritative source for predictive back.

### Cited Findings
- hamen material-3 has dedicated `references/theming-and-dynamic-color.md` and `color-system.md` files (9 dynamic*ColorScheme mentions) — [hamen/material-3-skill](https://github.com/hamen/material-3-skill)
- Drjacky references android-theming.md and compose-patterns.md: 22 dynamic*ColorScheme, 11 predictive-back and 9 shared-element mentions — [Drjacky/claude-android-ninja](https://github.com/Drjacky/claude-android-ninja)
- aldefy material3-motion.md covers the MotionScheme API (preferred for components), duration and easing tokens, AnimatedVisibility with asymmetric enter/exit, updateTransition, shared element transitions, a decision tree and expressive motion. A separate animation.md and navigation.md cover SharedTransitionLayout and predictive back — [aldefy/compose-skill](https://github.com/aldefy/compose-skill)
- Google's navigation-event skill covers Predictive Back animations with `NavigationBackHandler` and migration off `BackHandler` on SDK 36+ — [android/skills navigation-event](https://raw.githubusercontent.com/android/skills/main/navigation/navigation-event/SKILL.md)
- ahmed3elshaer m3-expressive covers spring motion physics, shape morphing and 28 expressive components, but has only 1 shared-element mention — [SKILL.md](https://raw.githubusercontent.com/ahmed3elshaer/everything-claude-code-mobile/main/skills/m3-expressive/SKILL.md)

### Inferences
- No single skill covers all four areas (M3 Expressive, dynamic color, shared elements and predictive back) in depth, so combining aldefy and hamen covers the most ground.

### Gaps
- No skill was found that is dedicated purely to Compose shared element transitions or motion physics.

## Which are highest quality and maintained (2025-2026)?

### Takeaway
All 8 repos had commits in 2026. The most recently maintained are Google android/skills (2026-10-26), wshobson/agents (2026-10-17) and Drjacky (2026-09-29). The best quality signal is aldefy's CI-verified code snippets.

### Cited Findings
- android/skills: last commit 2026-10-26, skill metadata `last-updated` dates from 2026-08 to 2026-10, about 10.0k stars — [repo](https://github.com/android/skills)
- aldefy/compose-skill: v2.4.0 on 2026-07-08, CI compiles doc snippets and verifies layout claims with Robolectric — [CHANGELOG](https://github.com/aldefy/compose-skill)
- hamen/material-3-skill: v1.1.1 on 2026-06-29 fixed Claude Code installation by adding a marketplace manifest; 1.5k stars — [repo](https://github.com/hamen/material-3-skill)
- Commit dates for the other repos: Drjacky 2026-09-29, new-silvermoon 2026-07-27, ahmed3elshaer 2026-06-14, anhvt52 2026-03-12 — the GitHub pages for each repo, linked above

### Inferences
- anhvt52 (last commit March 2026) and ahmed3elshaer (outdated Gradle setup) are less current.

### Gaps
- Issue and PR activity was not checked because the GitHub API was blocked.

## Are there Android-specific skills from Google or reputable authors?

### Takeaway
Yes. Google publishes official Android skills at github.com/android/skills (Apache-2.0, about 10k stars), installable through the Android CLI or as a Claude Code plugin marketplace. They focus on knowledge gaps (navigation-event/predictive back, edge-to-edge, Navigation 3, adaptive, Compose performance, AGP 9, XML-to-Compose migration) rather than M3 design or dynamic color.

### Cited Findings
- Google describes Android skills as "AI-optimized instructions" following Android best practices, installed with the Android CLI or imported in Android Studio — [developer.android.com](https://developer.android.com/tools/agents/android-skills)
- The repo's marketplace.json is named "android-skills", owned by "Google / Android", and is Apache-2.0 — [android/skills](https://github.com/android/skills)
- The 36 skills include jetpack-compose/{adaptive, jetpack-compose-performance, migration/migrate-xml-views-to-jetpack-compose, ink}, navigation/{navigation-3, navigation-event}, system/edge-to-edge, wear/wear-compose-m3, camera/camerax, security/android-permissions-security and testing/testing-setup — [android/skills](https://github.com/android/skills)
- Seth Hobson's wshobson/agents (41.9k stars) is the most popular community source, but its Android design skill is generic — [wshobson/agents](https://github.com/wshobson/agents)

### Inferences
- Google's skills complement community M3 and motion skills rather than replacing them.

### Gaps
- No official Google skill for phone Material 3 or Material 3 Expressive (outside Wear OS) was found as of 2026-10-28.
