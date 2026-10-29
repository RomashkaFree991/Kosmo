// Промо-ролик Kosmo для TikTok, 1080×1920, 30 fps.
// Всё вычисляется из времени кадра (детерминированно): сцены и смены экранов
// привязаны к таймкодам слов озвучки (timeline.json). Звук сводится отдельно
// (scripts/mix.py), рендер — без звука.

import React from 'react';
import {
  AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import timeline from './timeline.json';
import { DISPLAY, TEXT } from './fonts';

export const FPS = 30;
export const DURATION = Math.round(40.5 * FPS);

const ACCENT = '#9c7feb';
const ACCENT_2 = '#5ec8ff';
const INK = '#06040d';

type Word = { text: string; start: number; end: number; scene: string };
const WORDS = timeline.words as Word[];
const SCENES = timeline.scenes as { id: string; start: number; voEnd: number }[];

// время начала слова сцены (по первым буквам)
const w = (scene: string, prefix: string): number => {
  const hit = WORDS.find((x) => x.scene === scene && x.text.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!hit) throw new Error(`no word ${prefix} in ${scene}`);
  return hit.start;
};
// визуальная сцена начинается чуть раньше голоса
const S = (id: string) => Math.max(0, (SCENES.find((s) => s.id === id)?.start ?? 0) - 0.2);

const T = {
  hook: 0,
  intro: S('intro'),
  design: S('design') + 0.25,          // дроп музыки на «Два дизайна»
  chat: S('chat'),
  calls: S('calls'),
  rooms: S('rooms'),
  feed: S('feed'),
  privacy: S('privacy'),
  cta: S('cta'),
  end: DURATION / FPS,
};
export const DROP_AT = w('design', 'Два');

/* ---------------------------------------------------------------------------
   Пружины и кривые (пресеты из motion-design-promo / remotion-animation)
   --------------------------------------------------------------------------- */
const SPR = {
  ui: { stiffness: 320, damping: 30, mass: 1 },
  box: { stiffness: 170, damping: 26, mass: 1 },
  heavy: { stiffness: 120, damping: 24, mass: 1 },
};
function sp(t: number, at: number, cfg = SPR.box) {
  if (t < at) return 0;
  return spring({ frame: (t - at) * FPS, fps: FPS, config: cfg });
}
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = (t: number, a: number, b: number, from = 0, to = 1, fn = Easing.bezier(0.2, 0, 0, 1)) =>
  interpolate(t, [a, b], [from, to], { ...clamp, easing: fn });

// детерминированный ГПСЧ (mulberry32) для звёзд
function prng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = prng(7);
const STARS = Array.from({ length: 90 }, () => ({ x: rnd() * 1080, y: rnd() * 1920, r: 0.6 + rnd() * 1.8, p: rnd() * 6.28, s: 0.4 + rnd() }));

/* ---------------------------------------------------------------------------
   Фон: глубокий космос, мягкие пятна акцента, мерцающие звёзды
   --------------------------------------------------------------------------- */
const Background: React.FC<{ t: number }> = ({ t }) => {
  const drop = Math.exp(-Math.max(0, t - DROP_AT) * 3) * (t >= DROP_AT ? 1 : 0);
  return (
    <AbsoluteFill style={{ background: INK, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: -200,
        background: `radial-gradient(60% 40% at ${50 + Math.sin(t * 0.25) * 12}% ${30 + Math.cos(t * 0.2) * 6}%, rgba(156,127,235,0.38), transparent 70%),
          radial-gradient(50% 35% at ${70 + Math.cos(t * 0.3) * 10}% ${78 + Math.sin(t * 0.22) * 6}%, rgba(94,200,255,0.20), transparent 70%),
          radial-gradient(45% 30% at ${18 + Math.sin(t * 0.18) * 8}% 65%, rgba(214,92,200,0.16), transparent 70%)`,
      }} />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={(s.y - t * 6 * s.s + 1920) % 1920} r={s.r}
            fill="#fff" opacity={0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6 * s.s + s.p))} />
        ))}
      </svg>
      {/* вспышка на дропе */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 52%, rgba(190,170,255,${0.55 * drop}), transparent 60%)` }} />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------------------
   Телефон с настоящими экранами Kosmo
   --------------------------------------------------------------------------- */
const PHONE_W = 600;
const PHONE_H = Math.round((PHONE_W * 2532) / 1170);
const BEZEL = 13;

type Screen = { src: string; at: number; fx?: 'slide' | 'wipe' | 'fade'; ox?: number; oy?: number };

const Phone: React.FC<{ t: number; screens: Screen[]; style?: React.CSSProperties; glow?: number }> = ({ t, screens, style, glow = 1 }) => {
  let idx = 0;
  screens.forEach((s, i) => { if (t >= s.at) idx = i; });
  const cur = screens[idx];
  const prev = idx > 0 ? screens[idx - 1] : null;
  const p = prev ? sp(t, cur.at, cur.fx === 'wipe' ? SPR.heavy : SPR.box) : 1;
  const layer = (s: Screen, extra: React.CSSProperties = {}) => (
    <Img src={staticFile(`shots/${s.src}.jpg`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...extra }} />
  );
  let top: React.ReactNode = layer(cur);
  let under: React.ReactNode = null;
  if (prev && p < 0.999) {
    if (cur.fx === 'wipe') {
      const r = p * 1.08 * Math.hypot(PHONE_W, PHONE_H);
      top = layer(cur, { clipPath: `circle(${r}px at ${cur.ox ?? PHONE_W / 2}px ${cur.oy ?? PHONE_H - 120}px)` });
      under = layer(prev);
    } else if (cur.fx === 'fade') {
      top = layer(cur, { opacity: p });
      under = layer(prev);
    } else {
      top = layer(cur, { transform: `translateY(${(1 - p) * 100}%)` });
      under = layer(prev, { transform: `translateY(${-p * 22}%)`, filter: `brightness(${1 - p * 0.5})` });
    }
  }
  return (
    <div style={{ position: 'absolute', width: PHONE_W + BEZEL * 2, height: PHONE_H + BEZEL * 2, ...style }}>
      <div style={{
        position: 'absolute', inset: -40, borderRadius: 120, filter: 'blur(50px)', opacity: 0.55 * glow,
        background: `linear-gradient(160deg, ${ACCENT}, transparent 45%, ${ACCENT_2})`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 86, background: 'linear-gradient(145deg, #3a3550, #0d0b14 40%, #1b1828)',
        boxShadow: '0 40px 90px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.10)',
      }} />
      <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: PHONE_W, height: PHONE_H, borderRadius: 74, overflow: 'hidden', background: '#000' }}>
        {under}
        {top}
        {/* блик стекла */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.10), transparent 30%, transparent 70%, rgba(255,255,255,0.04))', pointerEvents: 'none' }} />
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Заголовок: слова поднимаются из-под маски по очереди
   --------------------------------------------------------------------------- */
const Title: React.FC<{ t: number; text: string; at: number; out: number; size?: number; y?: number; accent?: string[] }> = ({
  t, text, at, out, size = 84, y = 150, accent = [],
}) => {
  if (t < at - 0.1 || t > out + 0.5) return null;
  const exit = ease(t, out, out + 0.32, 0, 1, Easing.bezier(0.4, 0, 1, 1));
  const lines = text.split('\n');
  let k = 0;
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: y, textAlign: 'center', opacity: 1 - exit, transform: `translateY(${-exit * 40}px)` }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
          {line.split(' ').map((word) => {
            const i = k++;
            const p = sp(t, at + i * 0.07, SPR.ui);
            const hot = accent.includes(word);
            return (
              <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.12em', margin: `0 ${size * 0.14}px` }}>
                <span style={{
                  display: 'inline-block', fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.02em',
                  transform: `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 6}deg)`,
                  color: hot ? 'transparent' : '#fff',
                  backgroundImage: hot ? `linear-gradient(90deg, ${ACCENT_2}, ${ACCENT}, #ff7ad9, ${ACCENT_2})` : undefined,
                  backgroundSize: hot ? '300% 100%' : undefined,
                  backgroundPosition: hot ? `${(t * 40) % 300}% 0` : undefined,
                  WebkitBackgroundClip: hot ? 'text' : undefined,
                  backgroundClip: hot ? 'text' : undefined,
                  textShadow: hot ? undefined : '0 6px 30px rgba(0,0,0,0.5)',
                }}>{word}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Субтитры: 1–3 слова, текущее слово подсвечено
   --------------------------------------------------------------------------- */
type Chunk = { words: Word[]; start: number; end: number };
const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  WORDS.forEach((wd, i) => {
    cur.push(wd);
    const next = WORDS[i + 1];
    const stop = /[.,!?:]$/.test(wd.text) || cur.length >= 3 || !next || next.scene !== wd.scene;
    if (stop) {
      out.push({ words: cur, start: cur[0].start - 0.04, end: next && next.scene === wd.scene ? next.start - 0.04 : wd.end + 0.35 });
      cur = [];
    }
  });
  return out;
})();

const Captions: React.FC<{ t: number }> = ({ t }) => {
  const c = CHUNKS.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  const p = sp(t, c.start, SPR.ui);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: 1452, display: 'flex', justifyContent: 'center' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', padding: '16px 30px', borderRadius: 30,
        background: 'rgba(12,10,22,0.62)', backdropFilter: 'blur(18px)', boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.10)',
        transform: `scale(${0.86 + 0.14 * p}) translateY(${(1 - p) * 18}px)`, opacity: Math.min(1, p * 1.6),
      }}>
        {c.words.map((wd, i) => {
          const on = t >= wd.start - 0.03;
          return (
            <span key={i} style={{
              fontFamily: TEXT, fontWeight: 800, fontSize: 54, lineHeight: 1.15, letterSpacing: '-0.01em',
              color: on ? '#fff' : 'rgba(255,255,255,0.45)', textShadow: on ? `0 0 22px ${ACCENT}` : undefined,
              transform: `scale(${on && t < wd.end ? 1.06 : 1})`, display: 'inline-block', margin: '0 8px',
            }}>{wd.text.replace(/[.,!?:]$/, '')}</span>
          );
        })}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Чипы-возможности рядом с телефоном
   --------------------------------------------------------------------------- */
const ICONS: Record<string, string> = {
  album: 'M3.5 5.5h17v13h-17zM4 16l5-4.5 3.5 3 3.5-3.5 4.5 4.5',
  round: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  voice: 'M4 12v0M8 8v8M12 5v14M16 9v6M20 11v2',
  sticker: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  lock: 'M5 10.5h14V20H5zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
  timer: 'M12 5.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 9v4l2.5 2M9.5 3h5',
  poll: 'M5 20V10M12 20V4M19 20v-7',
  channel: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  comment: 'M20 11.5a7.5 7 0 0 1-10.9 6.2L4 19l1.4-4A7 7 0 0 1 4.5 11.5 7.5 7 0 0 1 20 11.5z',
};
const Chip: React.FC<{ t: number; at: number; out: number; icon: string; label: string; x: number; y: number; side: 'l' | 'r' }> = ({ t, at, out, icon, label, x, y, side }) => {
  if (t < at || t > out + 0.4) return null;
  const p = sp(t, at, SPR.ui);
  const e = ease(t, out, out + 0.25);
  const drift = Math.sin((t - at) * 1.3) * 6;
  return (
    <div style={{
      position: 'absolute', left: x, top: y + drift, display: 'flex', alignItems: 'center', padding: '16px 26px 16px 16px', borderRadius: 999,
      background: 'rgba(24,20,40,0.72)', backdropFilter: 'blur(16px)', boxShadow: `0 16px 40px rgba(0,0,0,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.12)`,
      transform: `translateX(${(side === 'l' ? -1 : 1) * (1 - p) * 120}px) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5) * (1 - e),
      transformOrigin: side === 'l' ? '100% 50%' : '0 50%',
    }}>
      <span style={{ width: 54, height: 54, borderRadius: 999, display: 'grid', placeItems: 'center', marginRight: 14, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})` }}>
        <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[icon]} /></svg>
      </span>
      <span style={{ fontFamily: TEXT, fontWeight: 800, fontSize: 40, color: '#fff' }}>{label}</span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Логотип-планета (с экрана входа Kosmo)
   --------------------------------------------------------------------------- */
const Logo: React.FC<{ size: number; style?: React.CSSProperties; spin?: number }> = ({ size, style, spin = 0 }) => (
  <Img src={staticFile('logo.png')} style={{ position: 'absolute', width: size, height: size, transform: `rotate(${spin}deg)`, ...style }} />
);

/* ---------------------------------------------------------------------------
   Композиция
   --------------------------------------------------------------------------- */
export const KosmoTikTok: React.FC = () => {
  const frame = useCurrentFrame();
  useVideoConfig();
  const t = frame / FPS;

  // лёгкий «удар» камеры на дропе и медленный наезд
  const punch = t >= DROP_AT ? Math.exp(-(t - DROP_AT) * 4) * 0.035 : 0;
  const push = 1 + ((t % 9) / 9) * 0.01;

  /* ---------- главный телефон ---------- */
  const phoneX = 540 - (PHONE_W + BEZEL * 2) / 2;
  const phoneY = 372;
  // появление в хуке, уход в интро, возвращение на дропе, звонки, уход на CTA
  const inHook = sp(t, 0.05, SPR.box);
  const outIntro = ease(t, T.intro + 0.05, T.intro + 0.5, 0, 1, Easing.bezier(0.4, 0, 1, 1));
  const inDesign = sp(t, T.design - 0.15, SPR.box);
  const toCalls = sp(t, T.calls, SPR.box) - sp(t, T.rooms, SPR.box);
  const outCta = ease(t, T.cta, T.cta + 0.45, 0, 1, Easing.bezier(0.4, 0, 1, 1));
  let ty = 0; let rot = 0; let sc = 1; let op = 1; let tx = 0;
  if (t < T.intro + 0.6) {
    ty = 130 + (1 - inHook) * 900 + outIntro * 1100; rot = -6 + inHook * 4 + outIntro * 10; sc = 0.86 + inHook * 0.06;
  } else if (t < T.design - 0.15) {
    op = 0;
  } else {
    sc = 0.55 + 0.45 * inDesign; op = Math.min(1, inDesign * 2); rot = (1 - inDesign) * 8;
    tx = -toCalls * 215; sc *= 1 - toCalls * 0.2; rot += -toCalls * 6;
    ty = outCta * 1700; rot += outCta * -8; op *= 1 - ease(t, T.cta + 0.2, T.cta + 0.5);
  }
  const mainScreens: Screen[] = [
    { src: 'chat-react-fly', at: 0 },
    { src: 'list-glass', at: T.design - 0.2, fx: 'fade' },
    { src: 'list-material-teal', at: w('design', 'Material'), fx: 'wipe', ox: 470, oy: 160 },
    { src: 'list-material-pink', at: w('design', 'цветами'), fx: 'wipe', ox: 100, oy: 1100 },
    { src: 'chat-album', at: T.chat },
    { src: 'chat-bottom', at: w('chat', 'кружки') },
    { src: 'chat-stickers', at: w('chat', 'стикеры'), fx: 'fade' },
    { src: 'chat-react-menu', at: w('chat', 'реакции'), fx: 'fade' },
    { src: 'call-out', at: T.calls, fx: 'fade' },
    { src: 'channel', at: T.rooms },
    { src: 'comments', at: w('rooms', 'группы') },
    { src: 'group-polls', at: w('rooms', 'опросы') },
    { src: 'feed', at: T.feed },
    { src: 'story', at: w('feed', 'истории'), fx: 'wipe', ox: 300, oy: 120 },
    { src: 'secret', at: T.privacy },
    { src: 'lock', at: w('privacy', 'вход'), fx: 'wipe', ox: 300, oy: 640 },
  ];

  /* ---------- второй телефон: входящий звонок ---------- */
  const inCall2 = sp(t, T.calls + 0.12, SPR.box) - sp(t, T.rooms, SPR.box);

  /* ---------- интро: логотип ---------- */
  const logoIn = sp(t, T.intro + 0.25, SPR.heavy);
  const logoDive = ease(t, T.design - 0.55, T.design - 0.05, 0, 1, Easing.bezier(0.5, 0, 0.9, 0.4));
  const showIntroLogo = t >= T.intro && t < T.design + 0.1;

  /* ---------- CTA ---------- */
  const ctaLogo = sp(t, T.cta + 0.3, SPR.heavy);
  const apkChip = sp(t, w('cta', 'Android'), SPR.ui);
  const tgCard = sp(t, w('cta', 'Подписывайся'), SPR.box);
  const handle = sp(t, w('cta', 'Kosmo'), SPR.ui);
  const pulse = t > w('cta', 'Telegram') ? 1 + 0.035 * Math.sin((t - w('cta', 'Telegram')) * 6) : 1;
  const arrow = t > w('cta', 'Telegram') + 0.3 ? sp(t, w('cta', 'Telegram') + 0.3, SPR.ui) : 0;

  return (
    <AbsoluteFill style={{ background: INK }}>
      <Background t={t} />
      <AbsoluteFill style={{ transform: `scale(${push + punch})` }}>

        {/* Интро: планета и название */}
        {showIntroLogo && (
          <>
            <Logo size={620} spin={(t - T.intro) * 4} style={{
              left: 540 - 310, top: 560 - 310,
              opacity: logoIn * (1 - logoDive),
              transform: `scale(${(0.4 + 0.6 * logoIn) * (1 + logoDive * 2.6)}) rotate(${(t - T.intro) * 4}deg)`,
              filter: `blur(${logoDive * 12}px)`,
            }} />
            <Title t={t} text="Kosmo" at={w('intro', 'Kosmo')} out={T.design - 0.6} size={150} y={930} accent={['Kosmo']} />
            <Title t={t} text={'мессенджер,\nкоторый выглядит\nкак будущее'} at={w('intro', 'Мессенджер')} out={T.design - 0.6} size={58} y={1150} accent={['будущее']} />
          </>
        )}

        {/* Второй телефон в сцене звонков */}
        {inCall2 > 0.001 && (
          <Phone t={t} screens={[{ src: 'call-in', at: 0 }]} glow={0.8} style={{
            left: phoneX + 215, top: phoneY + 40,
            transform: `translateX(${(1 - inCall2) * 700}px) rotate(${6 * inCall2}deg) scale(0.8)`, opacity: Math.min(1, inCall2 * 1.5),
          }} />
        )}

        {/* Главный телефон */}
        {op > 0.001 && (
          <Phone t={t} screens={mainScreens} style={{
            left: phoneX, top: phoneY, opacity: op,
            transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sc})`,
          }} />
        )}

        {/* Заголовки сцен */}
        <Title t={t} text={'Твой мессенджер\nтак умеет?'} at={0.15} out={T.intro - 0.05} size={86} y={120} accent={['умеет?']} />
        <Title t={t} text="Liquid Glass" at={w('design', 'Liquid')} out={w('design', 'Material') - 0.3} size={96} y={150} accent={['Glass']} />
        <Title t={t} text="Material You" at={w('design', 'Material')} out={T.chat - 0.3} size={96} y={150} accent={['You']} />
        <Title t={t} text="Всё в одном чате" at={T.chat + 0.1} out={T.calls - 0.3} size={80} y={160} accent={['чате']} />
        <Title t={t} text="Звонки" at={T.calls + 0.1} out={T.rooms - 0.3} size={110} y={150} accent={['Звонки']} />
        <Title t={t} text={'Каналы\nи группы'} at={T.rooms + 0.1} out={T.feed - 0.3} size={80} y={120} accent={['группы']} />
        <Title t={t} text={'Лента\nи истории'} at={T.feed + 0.1} out={T.privacy - 0.3} size={80} y={120} accent={['истории']} />
        <Title t={t} text="Приватность" at={T.privacy + 0.1} out={T.cta - 0.3} size={92} y={160} accent={['Приватность']} />

        {/* Чипы в сцене чата и приватности */}
        <Chip t={t} at={w('chat', 'Альбомы')} out={T.calls - 0.3} icon="album" label="Альбомы" x={40} y={560} side="l" />
        <Chip t={t} at={w('chat', 'кружки')} out={T.calls - 0.3} icon="round" label="Кружки" x={690} y={720} side="r" />
        <Chip t={t} at={w('chat', 'голосовые')} out={T.calls - 0.3} icon="voice" label="Голосовые" x={40} y={900} side="l" />
        <Chip t={t} at={w('chat', 'стикеры')} out={T.calls - 0.3} icon="sticker" label="Стикеры" x={680} y={1080} side="r" />
        <Chip t={t} at={w('chat', 'реакции')} out={T.calls - 0.3} icon="heart" label="Реакции" x={40} y={1240} side="l" />
        <Chip t={t} at={w('rooms', 'Каналы')} out={T.feed - 0.3} icon="channel" label="Каналы" x={40} y={640} side="l" />
        <Chip t={t} at={w('rooms', 'комментариями')} out={T.feed - 0.3} icon="comment" label="Комментарии" x={600} y={860} side="r" />
        <Chip t={t} at={w('rooms', 'опросы')} out={T.feed - 0.3} icon="poll" label="Опросы" x={40} y={1120} side="l" />
        <Chip t={t} at={w('privacy', 'Секретные')} out={T.cta - 0.3} icon="lock" label="Секретные чаты" x={40} y={620} side="l" />
        <Chip t={t} at={w('privacy', 'исчезающие')} out={T.cta - 0.3} icon="timer" label="Автоудаление" x={620} y={880} side="r" />
        <Chip t={t} at={w('privacy', 'коду')} out={T.cta - 0.3} icon="lock" label="Вход по коду" x={40} y={1160} side="l" />

        {/* Финал: логотип, APK, Telegram */}
        {t >= T.cta && (
          <>
            <Logo size={360} style={{
              left: 540 - 180, top: 170,
              opacity: ctaLogo, transform: `scale(${0.5 + 0.5 * ctaLogo}) rotate(${(t - T.cta) * 5}deg)`,
            }} />
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 112, letterSpacing: '-0.03em', color: '#fff',
              opacity: ctaLogo, transform: `translateY(${(1 - ctaLogo) * 60}px)`, textShadow: `0 0 40px ${ACCENT}`,
            }}>Kosmo</div>
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', justifyContent: 'center',
              opacity: apkChip, transform: `scale(${0.7 + 0.3 * apkChip})`,
            }}>
              <div style={{ padding: '18px 34px', borderRadius: 999, background: 'rgba(52,199,89,0.16)', boxShadow: 'inset 0 0 0 2px rgba(52,199,89,0.55)', fontFamily: TEXT, fontWeight: 800, fontSize: 44, color: '#7ef0a0' }}>
                Скоро · APK для Android
              </div>
            </div>
            <div style={{
              position: 'absolute', left: 90, right: 90, top: 880, padding: '46px 40px', borderRadius: 56,
              background: 'linear-gradient(160deg, rgba(42,171,238,0.30), rgba(24,20,40,0.85) 60%)', backdropFilter: 'blur(20px)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.14)',
              opacity: Math.min(1, tgCard * 1.4), transform: `translateY(${(1 - tgCard) * 160}px) scale(${(0.9 + 0.1 * tgCard) * pulse})`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
                <span style={{ width: 96, height: 96, borderRadius: 999, background: 'linear-gradient(160deg, #37bbfe, #1e96d8)', display: 'grid', placeItems: 'center', marginRight: 22 }}>
                  <svg width={56} height={56} viewBox="0 0 24 24"><path d="M3.2 11.4l15.6-6c.8-.3 1.5.2 1.2 1.4l-2.7 12.6c-.2.9-.8 1.1-1.5.7l-4-3-2 1.9c-.2.2-.4.4-.8.4l.3-4.1 7.4-6.7c.3-.3-.1-.5-.5-.2L7 13.7l-3.9-1.2c-.9-.3-.9-.9.1-1.1z" fill="#fff" /></svg>
                </span>
                <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 44, color: 'rgba(255,255,255,0.85)' }}>Telegram-канал</span>
              </div>
              <div style={{
                fontFamily: DISPLAY, fontWeight: 800, fontSize: 62, color: '#fff', letterSpacing: '-0.02em', marginBottom: 18, whiteSpace: 'nowrap',
                opacity: handle, transform: `translateY(${(1 - handle) * 30}px)`,
              }}>@KosmoMessenger</div>
              <div style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 38, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                APK, новости и ранний доступ
              </div>
            </div>
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 1300, display: 'flex', flexDirection: 'column', alignItems: 'center',
              opacity: arrow,
            }}>
              <div style={{
                padding: '22px 54px', borderRadius: 999, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
                fontFamily: TEXT, fontWeight: 800, fontSize: 52, color: '#fff', boxShadow: `0 18px 50px ${ACCENT}66`,
                transform: `scale(${0.8 + 0.2 * arrow})`,
              }}>Подписывайся →</div>
              <div style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 38, color: 'rgba(255,255,255,0.7)', marginTop: 14 }}>
                ищи в Telegram: <b style={{ color: '#fff' }}>@KosmoMessenger</b>
              </div>
            </div>
          </>
        )}
      </AbsoluteFill>

      {/* субтитры поверх всего, кроме финала с карточкой */}
      {t < T.cta + 0.2 || t > T.end ? <Captions t={t} /> : null}
    </AbsoluteFill>
  );
};
