import { Config } from '@remotion/cli/config';

// Готовый Chromium песочницы вместо скачивания своего
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? null);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
