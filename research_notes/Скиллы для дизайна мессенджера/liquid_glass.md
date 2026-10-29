# Liquid Glass / Glassmorphism Agent Skills (SKILL.md) for a Messenger (Android Compose + Web)

Method note: I fetched every SKILL.md listed below with HTTP 200 from raw.githubusercontent.com on 2026-10-28. Star, fork and license figures come from the GitHub repo pages via WebFetch. Commit dates come from the GitHub commits pages. The GitHub REST and code-search APIs were blocked in this environment, so I could not run an exhaustive GitHub code search. Discovery relied on web search and the skill directories instead.

## Which skills exist for liquid glass / glassmorphism UI?

### Takeaway
I verified at least 13 real SKILL.md-based skills, but all are small community projects. None comes from Anthropic's official skills repo. Two are the best fit for a Kotlin messenger plus a website. **xenitV1/liquid-glass-skill** covers web SVG refraction, Android Compose via Haze, and Apple HIG rules. **Kashif-E/KMPLiquidGlass `kmp-liquid-glass`** covers Compose and is built on a port of Kyant0's AndroidLiquidGlass. For web, **Armitanemati** (design reasoning) and **stormaref** (CSS + SVG refraction code) are good complements.

### Ranked shortlist (for Android Kotlin Compose + website messenger)

**1. xenitV1/liquid-glass-skill — `apple-liquid-glass`. Best all-round fit (web + Compose).**
- Repo: https://github.com/xenitV1/liquid-glass-skill
- SKILL.md (381 lines): https://raw.githubusercontent.com/xenitV1/liquid-glass-skill/main/SKILL.md
- Coverage: Apple HIG rules (content/chrome two-layer model, regular vs clear glass, fallbacks for Reduce Motion, Reduce Transparency and Increase Contrast). The web part ships `assets/tokens.css` and `assets/refraction.js`, an SVG displacement filter. It bends the live page in Chromium (Chrome, Edge, Android WebView, Electron) and uses a "mirror mode" in Safari and Firefox. It also covers SwiftUI/UIKit `glassEffect`/`UIGlassEffect`, an **Android Compose Haze `haze-glass` recipe** taken from a shipped app (Spiralens), and Flutter, Electron, Tauri, Windows and Linux. — [repo page](https://github.com/xenitv1/liquid-glass-skill)
- Its `references/platforms.md` pins `dev.chrisbanes.haze:haze:2.0.1` and `haze-glass:2.0.1` (an experimental API that needs Android 13+). It shows `rememberHazeState()`/`hazeSource()`, `hazeGlass(input = HazeInput.Sources(...), performanceMode = HazePerformanceMode.Quality)`, the rule that "the source must be opaque", and APIs "checked on 2026-10-12". — [platforms.md](https://raw.githubusercontent.com/xenitV1/liquid-glass-skill/main/references/platforms.md)
- Author: xenitV1. Stars: 11, forks: 2. License: MIT. Commits: 4–5, all dated Oct 12, 2026. The latest is "Bend in Safari and Firefox too (mirror mode)". — [repo](https://github.com/xenitv1/liquid-glass-skill), [commits](https://github.com/xenitV1/liquid-glass-skill/commits/main)
- Quality: it is the most current, cites dated sources, and spans both of the user's platforms. It is very new and has little community validation.

**2. Kashif-E/KMPLiquidGlass — `kmp-liquid-glass`. Best Compose-specific skill (refraction, lens, vibrancy).**
- Repo: https://github.com/Kashif-E/KMPLiquidGlass
- SKILL.md (402 lines): https://raw.githubusercontent.com/Kashif-E/KMPLiquidGlass/master/plugins/kmp-liquid-glass/skills/kmp-liquid-glass/SKILL.md
- Coverage: it teaches the agent the `backdrop` library API. That covers the two-layer model (`Modifier.layerBackdrop` as the source, `drawBackdrop`/`drawPlainBackdrop` for glass), effect ordering, blur, lens refraction, vibrancy, progressive blur and SDF glass. Reference files: `references/effects.md`, `components.md`, `advanced.md` and `platform.md`. It includes recipes for cards, dialogs and tab bars. Platform table: Android API 31+ gets blur and color controls through `RenderEffect`. API 33+ gets the full library through AGSL `RuntimeShader`. Below API 31 the effects "degrade silently". — [SKILL.md](https://raw.githubusercontent.com/Kashif-E/KMPLiquidGlass/master/plugins/kmp-liquid-glass/skills/kmp-liquid-glass/SKILL.md), [repo](https://github.com/Kashif-E/KMPLiquidGlass)
- Dependency: `io.github.kashif-mehmood-km:backdrop:0.0.1-alpha02`. This is the Compose Multiplatform port of Kyant0's AndroidLiquidGlass, not Kyant's own artifact. — [SKILL.md](https://raw.githubusercontent.com/Kashif-E/KMPLiquidGlass/master/plugins/kmp-liquid-glass/skills/kmp-liquid-glass/SKILL.md)
- Author: Kashif Mehmood (Kashif-E). Library repo: 138 stars, 8 forks, 296 commits. License: Apache-2.0, copyright Kyant (original) and Kashif Mehmood (KMP port). The skill and plugin marketplace were added May 8, 2026, recipes were rewritten May 10, 2026, and the latest repo commit is Jun 19, 2026. Install with `/plugin marketplace add Kashif-E/KMPLiquidGlass`. — [repo](https://github.com/Kashif-E/KMPLiquidGlass), [commits](https://github.com/Kashif-E/KMPLiquidGlass/commits/master)
- Quality: it is written by the library maintainer and is detailed, covering pitfalls and GPU-cost warnings. The library is still alpha. For an Android-only app the user may prefer Kyant0's original library. The concepts carry over, but package names differ.

**3. Armitanemati/liquid-glass-claude-skill — design reasoning system (web-first, platform-agnostic).**
- Repo: https://github.com/Armitanemati/liquid-glass-claude-skill
- SKILL.md (538 lines, single file): https://raw.githubusercontent.com/Armitanemati/liquid-glass-claude-skill/main/SKILL.md
- Coverage: brand-agnostic Liquid Glass and glassmorphism guidance. Topics include material tiers (thin, regular, thick, scrim, rare clear), contrast checked against the worst-case backdrop, and fallbacks (`@supports`, `prefers-reduced-transparency`, higher contrast, forced colors). Section 17, "production field notes", covers Figma-to-CSS mapping, edge lensing via `feImage` inside `backdrop-filter`, engine bugs and performance measurements. It has an `examples/example-media-app.html` demo. — [repo](https://github.com/Armitanemati/liquid-glass-claude-skill)
- Android note in the skill: "there is no general in-app backdrop blur. `RenderEffect` (API 31+) blurs a view's own content, not what is behind it". It does not give a Haze or Kyant recipe. — [SKILL.md](https://raw.githubusercontent.com/Armitanemati/liquid-glass-claude-skill/main/SKILL.md)
- Author: Armitanemati. Stars: 3, forks: 0. License: MIT. 12 commits from Sep 11 to Sep 17, 2026. — [commits](https://github.com/Armitanemati/liquid-glass-claude-skill/commits/main)
- Quality: the deepest design and accessibility reasoning of the set, and well suited to the website. Popularity is very low.

**4. stormaref/LiquidGlassSkill — `liquid-glass`. Compact web recipe with drop-in CSS + SVG refraction.**
- Repo: https://github.com/stormaref/LiquidGlassSkill
- SKILL.md (91 lines): https://raw.githubusercontent.com/stormaref/LiquidGlassSkill/main/plugins/liquid-glass/skills/liquid-glass/SKILL.md
- Coverage: a two-layer model, with CSS for tint and rim plus an SVG displacement filter that refracts the backdrop at panel edges. It gives four rules and a tier table for avoiding a "gray box". Assets: `liquid-glass.css` (light and dark, no dependencies), `liquid-glass.directive.ts` (Angular, Chromium-only refraction that stays inert elsewhere) and `demo.html`. References: `refraction.md` (formulas for porting) and `recipes.md` (cards, FABs, modals, dropdowns, circular controls). The directive ports liquid-glass-js (MIT) by Armagan Amcalar. It is packaged as a Claude Code plugin marketplace. — [repo](https://github.com/stormaref/LiquidGlassSkill)
- Author: stormaref. Stars: 14, forks: 1. License: MIT. 8 commits, all dated Aug 15, 2026. — [commits](https://github.com/stormaref/LiquidGlassSkill/commits/main)
- Quality: practical and small. The Angular directive would need porting to React or Vue. Web only.

**5. loftusadam067-svg/Skills — `universal-liquid-glass`. Broad, cross-stack, AGSL-aware.**
- SKILL.md (254 lines): https://raw.githubusercontent.com/loftusadam067-svg/Skills/main/universal-liquid-glass/SKILL.md
- Coverage: SwiftUI/UIKit/AppKit, HTML/CSS/JS, React Native/Expo, Flutter, Android/Compose, Electron/Tauri, Qt/QML and .NET. It routes Android Views, Compose and CMP to `references/android.md`, which covers AGSL `RuntimeShader` (API 33+), backdrop capture, warnings that AGSL cannot sample arbitrary pixels behind an unrelated view, fallbacks and a GPU/refresh-rate test matrix. Frontmatter says `license: MIT` and lists compatibility with "Kimi Agent, Kimi Code, and Agent Skills-compatible coding agents". — [SKILL.md](https://raw.githubusercontent.com/loftusadam067-svg/Skills/main/universal-liquid-glass/SKILL.md), [android.md](https://raw.githubusercontent.com/loftusadam067-svg/Skills/main/universal-liquid-glass/references/android.md)
- Quality: good conceptual Android material, but it names no Haze or Kyant library. Stars and last-update date were not retrieved.

**6. sickn33/antigravity-awesome-skills — `glassmorphism` (sub-skill of `design-it`). Generic, in a very popular collection.**
- SKILL.md (272 lines): https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/design-it/glassmorphism/SKILL.md
- Coverage: classic glassmorphism (blur, semi-transparent fill, light border), with snippets for CSS `backdrop-filter`, SwiftUI `.ultraThinMaterial`, Flutter `BackdropFilter`, React Native blur and Compose. For Compose it says to "use the `haze` library (`dev.chrisbanes.haze`)" and notes that `Modifier.blur()`/`RenderEffect` need API 31+. It is a child reference that is not triggered directly. `date_added: 2026-06-17`. — [SKILL.md](https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/design-it/glassmorphism/SKILL.md)
- Popularity: the skillsdirectory listing shows 46,327 stars for the collection, security grade A. — [skillsdirectory](https://www.skillsdirectory.com/skills/sickn33-glassmorphism-agentic-awesome-skills)
- Quality: shallow 2021-style glassmorphism with no refraction and no Liquid Glass specifics. Useful only as a baseline.

**7. ShiotanNeco/android-liquid-glass — `android-liquid-glass`. Compose-only, Japanese, very new.**
- SKILL.md (33 lines + references + `assets/glass/` Compose starter): https://raw.githubusercontent.com/ShiotanNeco/android-liquid-glass/main/SKILL.md
- Coverage: `GlassBackdrop`/`rememberGlassBackdrop()`/`GlassSurface` starter code that uses public APIs (`RuntimeShader`, render layers). It gives Regular/Clear guidance and accessibility rules, and warns that `Modifier.blur` or `renderEffect` on an empty Box does not blur the backdrop. The starter targets **API 36+**. Written in Japanese. — [SKILL.md](https://raw.githubusercontent.com/ShiotanNeco/android-liquid-glass/main/SKILL.md), [repo](https://github.com/ShiotanNeco/android-liquid-glass)
- Stars: 0, 1 commit, no license shown. It is a Codex skill, but the format is compatible.
- Quality: interesting, but the API 36+ floor and the lack of a license make it unsuitable for a production messenger.

**8. Aks-4125/kmp-glassmorphism-skill — `kmp-glassmorphism-ui`.**
- SKILL.md (202 lines, UTF-8 with BOM): https://raw.githubusercontent.com/Aks-4125/kmp-glassmorphism-skill/master/SKILL.md
- Coverage: a glassmorphism design system for Compose Multiplatform, version 1.0.0. Blur appears only "where supported by the rendering engine", and the file mentions neither Haze nor Kyant. — [SKILL.md](https://raw.githubusercontent.com/Aks-4125/kmp-glassmorphism-skill/master/SKILL.md)
- Quality: weak. It is essentially a tinted-surface token system. Stars and date were not retrieved.

### Cited Findings: verified skills that do not fit this project (Apple-only or desktop-only)
- haider-nawaz/liquid-glass-skill `liquid-glass` (SwiftUI, iOS/macOS 26+, 5-phase migration). 71 stars, 7 forks, MIT. SKILL.md: https://raw.githubusercontent.com/haider-nawaz/liquid-glass-skill/main/plugins/liquid-glass/skills/liquid-glass/SKILL.md. An identical 215-line file exists at https://raw.githubusercontent.com/iammayron/liquid-glass-skill/main/plugins/liquid-glass/skills/liquid-glass/SKILL.md (iammayron is the original, per search snippets). — [repo](https://github.com/haider-nawaz/liquid-glass-skill)
- affaan-m/everything-claude-code `liquid-glass-design` (iOS 26 SwiftUI/UIKit/WidgetKit, 279 lines). SKILL.md: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/liquid-glass-design/SKILL.md. A registry describes it as the most-installed liquid glass skill. — [Skillselion](https://skillselion.com/skills/affaan-m/ecc/liquid-glass-design)
- zakisheriff/Claude-Liquid-Glass-Skill `claude-liquid-glass` (native iOS 26 only: SwiftUI, UIKit, React Native/Expo `expo-glass-effect`, plus a mandatory-haptics rule). 2 stars, MIT. SKILL.md: https://raw.githubusercontent.com/zakisheriff/Claude-Liquid-Glass-Skill/main/claude-liquid-glass/SKILL.md — [repo](https://github.com/zakisheriff/Claude-Liquid-Glass-Skill)
- Na2H2P2O7/liquid-glass-skill `liquid-glass`: transparent desktop windows (pywebview/Electron-like) with WebGL refraction of the real wallpaper. It ships `glass.js` and `glass_backdrop.py` and says not to use CSS backdrop-filter. SKILL.md: https://raw.githubusercontent.com/Na2H2P2O7/liquid-glass-skill/main/SKILL.md

### Inferences
- For this messenger, the recommended combination is xenitV1 (shared design rules, web refraction, Haze route for Compose) plus Kashif-E `kmp-liquid-glass` (true lens and refraction on Compose API 33+). Armitanemati's skill can serve as the web design and accessibility checker.
- None of the skills is a turnkey Android-only Kyant0 skill. If the user picks Kyant0's original backdrop library, a custom skill adapted from Kashif-E's skill is the most direct path.

### Gaps
- No skill for Liquid Glass or glassmorphism was found in anthropics/skills. I could not run GitHub code search (`filename:SKILL.md "liquid glass"`) because the API was blocked, so other small repos may exist.
- I did not find a SKILL.md published by Kyant0/AndroidLiquidGlass (raw `SKILL.md` returned 404 on main and master) or by chrisbanes/haze.
- Missing metadata: stars and dates for loftusadam067-svg/Skills and Aks-4125, the stars count for affaan-m/everything-claude-code, and skills.sh install counts (the search page returned no data).

## Which target web vs SwiftUI vs Compose?

### Takeaway
Most Liquid Glass skills target SwiftUI. Web coverage is good: xenitV1, Armitanemati, stormaref and loftus. Compose coverage is thin and comes down to three practical options: xenitV1 (Haze), Kashif-E (Kyant-port backdrop) and ShiotanNeco (custom AGSL, API 36+).

### Cited Findings
- Web: xenitV1 (SVG displacement + tokens), Armitanemati (backdrop-filter + `feImage` lensing, fallbacks), stormaref (CSS + SVG, Angular directive), loftus (feDisplacementMap/WebGL), sickn33 (basic backdrop-filter). — sources as listed above
- SwiftUI only: haider-nawaz / iammayron, affaan-m ECC, zakisheriff (also RN/Expo). — sources above
- Compose: xenitV1 → Haze 2.0.1 `haze-glass` ([platforms.md](https://raw.githubusercontent.com/xenitV1/liquid-glass-skill/main/references/platforms.md)). Kashif-E → `io.github.kashif-mehmood-km:backdrop` with AGSL on API 33+ ([SKILL.md](https://raw.githubusercontent.com/Kashif-E/KMPLiquidGlass/master/plugins/kmp-liquid-glass/skills/kmp-liquid-glass/SKILL.md)). ShiotanNeco → custom RuntimeShader starter, API 36+ ([SKILL.md](https://raw.githubusercontent.com/ShiotanNeco/android-liquid-glass/main/SKILL.md)). sickn33 → mentions Haze only.
- An Android View-system alternative exists: QWEA0/Liquid-Glass-Android, with SDF refraction for XML layouts at API 24+. Per the search snippet, its README points Compose-first projects to Kyant0's library. — [QWEA0 repo](https://github.com/QWEA0/Liquid-Glass-Android) (snippet only, not fetched)

### Inferences
- **Key libraries and techniques a messenger skill should reference:**
  - Android: `dev.chrisbanes.haze` (blur/frost via `hazeSource`/`hazeEffect`, plus `haze-glass` on Android 13+) for broad device support. Kyant0 AndroidLiquidGlass `backdrop` (AGSL lens and refraction, API 33+; blur via `RenderEffect` on API 31+) for true Liquid Glass. Plan solid or tinted fallbacks below API 31. Remember that `Modifier.blur`/`RenderEffect` blur a layer's own content, not what is behind it.
  - Web: `backdrop-filter: blur() saturate()` with `@supports` fallbacks, an SVG `feDisplacementMap`/`feImage` displacement filter for edge refraction (works on the live page in Chromium only), `prefers-reduced-transparency`/`prefers-contrast`/`forced-colors` fallbacks, and liquid-glass-js (Armagan Amcalar, MIT) as reference code.
  - Messenger-specific: glass belongs on chrome (top bar, tab bar, composer, sheets), not on message content. Haze and other sources must be opaque. Scrolling chat lists make glass a continuous GPU cost (the Kashif-E and xenitV1 performance notes).

### Gaps
- I did not independently fetch the Kyant0/AndroidLiquidGlass or chrisbanes/haze READMEs. The current versions and API levels above come from the skills' own text (Haze 2.0.1 as of 2026-10-12, Kashif port 0.0.1-alpha02).

## Which are good quality and maintained in 2025-2026?

### Takeaway
Every relevant skill was created in 2026 and none has a long track record. xenitV1 (Oct 2026), Armitanemati (Sep 2026) and stormaref (Aug 2026) are the freshest. Kashif-E rests on the most active underlying library (138 stars, 296 commits, Jun 2026).

### Cited Findings
- xenitV1: latest commit Oct 12, 2026; MIT; 11★. — [commits](https://github.com/xenitV1/liquid-glass-skill/commits/main)
- Armitanemati: Sep 11–17, 2026; MIT; 3★; 12 commits. — [commits](https://github.com/Armitanemati/liquid-glass-claude-skill/commits/main)
- stormaref: Aug 15, 2026; MIT; 14★. — [commits](https://github.com/stormaref/LiquidGlassSkill/commits/main)
- Kashif-E: skill added May 8, 2026; repo active to Jun 19, 2026; Apache-2.0; 138★. — [commits](https://github.com/Kashif-E/KMPLiquidGlass/commits/master)
- haider-nawaz (SwiftUI): 71★, the most-starred dedicated Liquid Glass skill repo, but Apple-only. — [repo](https://github.com/haider-nawaz/liquid-glass-skill)
- sickn33 glassmorphism: collection shows about 46k★, skill added 2026-06-17, security grade A, content is generic. — [skillsdirectory](https://www.skillsdirectory.com/skills/sickn33-glassmorphism-agentic-awesome-skills)

### Inferences
- Star counts are low across the board (0–138). Code quality and recency are better signals than popularity. Skills should be vendored (copied into the repo's `.claude/skills/`) rather than tracked live, given single-author maintenance.
- The Kashif-E skill pins an alpha library, so expect API churn.

### Gaps
- No usage or install metrics from skills.sh or the Claude plugin marketplaces could be retrieved for these specific skills.
