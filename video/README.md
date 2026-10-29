# Kosmo — промо-ролик для TikTok

Вертикальный ролик 1080×1920, 30 fps, 40.5 с: мужской голос, субтитры, музыка
и финальный призыв перейти в Telegram-канал **@KosmoMessenger**.
Сценарий и тайминги — в [SPEC.md](SPEC.md) (формат скилла `motion-designer`).

## Как собран
- **Экраны** — настоящие снимки веб-версии Kosmo (Playwright, 3×, демо-данные), `public/shots/`.
- **Голос** — нейроголос ru-RU Dmitry (Microsoft Edge TTS через `edge-tts`), `public/audio/voiceover.mp3`.
  Таймкоды слов — в `src/timeline.json`: по ним меняются сцены, экраны и субтитры.
- **Видео** — Remotion (`src/KosmoTikTok.tsx`), всё вычисляется из номера кадра.
- **Звук** — `scripts/mix.py`: музыка Mixkit «Digital Clouds» (дроп песни ровно на «Два дизайна»),
  приглушение под голосом, SFX синтезируются в коде, итог −14 LUFS.

## Пересобрать
```bash
npm install --ignore-scripts
export REMOTION_CHROME=/путь/к/chrome-headless-shell   # необязательно: иначе Remotion скачает свой
npm run studio                                        # предпросмотр
npx remotion render KosmoTikTok out/video.mp4 --muted # картинка
python3 scripts/mix.py                                # звук → out/mix.wav (скачает музыку Mixkit)
python3 scripts/mix.py mux out/video.mp4 out/kosmo-tiktok.mp4
```

## Лицензии
- Музыка: Mixkit, Free License (можно в роликах для соцсетей; файл в репозиторий не кладём — скрипт скачивает его).
- Фото в демо-чатах: Unsplash через picsum.photos (лицензия Unsplash).
- Шрифты: Unbounded и Inter (SIL OFL) из `@fontsource`.
- Remotion: бесплатен для частных лиц и команд до 3 человек.
