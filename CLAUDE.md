# Kosmo — мессенджер (Android на Kotlin + веб-сайт)

## Дизайн-направление
- Android: Kotlin + Jetpack Compose, Material 3 / Material You, M3 Expressive, динамические цвета (`dynamicLightColorScheme`/`dynamicDarkColorScheme` на Android 12+, фолбэк — схема из seed-цвета).
- Liquid Glass — только на «хроме» (top bar, tab bar, поле ввода, bottom sheets), не на пузырях сообщений: стекло над скроллящимся списком чата постоянно нагружает GPU.
- Анимации: пружинная физика (M3 MotionScheme), shared element transitions, predictive back; на вебе — composite-only свойства, `prefers-reduced-motion`, `prefers-reduced-transparency`.

## Установленные скиллы (`.claude/skills/`)
Скопированы из публичных репозиториев 2026-10-28; источники и лицензии — в `.claude/skills/SOURCES.md`.

### Android / Compose / Material 3
- `compose-expert` — главный скилл по Compose: M3 motion, shared elements, predictive back, производительность.
- `material-3` — Material 3 / Material You: токены, компоненты, динамические цвета, M3 Expressive, аудит UI.
- `m3-expressive` — каталог M3 Expressive (shape morphing, motion physics, 28 компонентов). Gradle-раздел в нём устарел для Kotlin 2.x — игнорировать.
- `navigation-event` (Google) — predictive back анимации.
- `edge-to-edge` (Google) — инсеты, клавиатура (IME) для поля ввода чата.
- `jetpack-compose-performance` (Google) — рекомпозиции, длинные списки сообщений.

### Liquid Glass
- `apple-liquid-glass` — основной: дизайн-правила + веб (SVG-рефракция, токены CSS) + Compose через Haze.
- `kmp-liquid-glass` — настоящая рефракция в Compose (библиотека `backdrop`, alpha; полный эффект с API 33, blur с API 31).
- `liquid-glass-design-guide` — дизайн и доступность стекла (в основном веб).

### Веб: дизайн и анимации
- `frontend-design` (Anthropic) — визуальное направление, типографика.
- `emil-design-eng`, `review-animations`, `animation-performance` — полировка UI и анимаций (Emil Kowalski).
- `web-design-guidelines` (Vercel) — аудит UI; скачивает правила из сети при запуске.
- `react-view-transitions` (Vercel) — View Transitions API в React.
- `motion` — Motion (Framer Motion) для React.
- `gsap-core` — GSAP. Скилл склонен навязывать GSAP: выбирать библиотеку осознанно.
- `ui-ux-pro-max` — база стилей, палитр, шрифтов и UX-правил.

Широкие Compose-скиллы пересекаются: при конфликте приоритет у `compose-expert` (код/анимации) и `material-3` (дизайн-система).
