import { Composition } from 'remotion';
import { KosmoTikTok, DURATION } from './KosmoTikTok';

export const RemotionRoot = () => (
  <Composition
    id="KosmoTikTok"
    component={KosmoTikTok}
    durationInFrames={DURATION}
    fps={30}
    width={1080}
    height={1920}
  />
);
