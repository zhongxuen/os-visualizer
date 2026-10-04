import { ImageResponse } from 'next/og';

import { SITE_NAME } from '@/lib/site';

/**
 * The card a shared link unfurls into: the site's dark surface, its accent, a title and a
 * line of description. One per module (each route's `opengraph-image.tsx`) and one for
 * everything else (the root's). Colours are the dark theme's tokens from
 * src/styles/tokens.css, written out because Satori cannot read a CSS variable.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const BG = '#07090d';
const RAISED = '#161d2b';
const ACCENT = '#4cc2f1';
const TEXT = '#e8eff8';
const MUTED = '#b6c4d6';

/** A strip of ticks, like a Gantt chart: the one picture every module shares. */
const STRIP = [3, 2, 4, 1, 3, 2, 5, 2];
const STRIP_COLOURS = ['#4cc2f1', '#f59e5b', '#5fd08b', '#f2d45c'];

export function ogCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: BG,
        backgroundImage: `radial-gradient(900px 500px at 8% -10%, ${RAISED} 0%, ${BG} 70%)`,
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {STRIP.map((width, i) => (
          <div
            key={i}
            style={{
              width: width * 40,
              height: 36,
              borderRadius: 6,
              backgroundColor: STRIP_COLOURS[i % STRIP_COLOURS.length],
              opacity: 0.9,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ color: ACCENT, fontSize: 30, fontWeight: 600 }}>{eyebrow}</div>
        <div style={{ color: TEXT, fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ color: MUTED, fontSize: 32, lineHeight: 1.35, maxWidth: 1000 }}>
          {description}
        </div>
      </div>
      <div style={{ color: MUTED, fontSize: 24 }}>
        {`${SITE_NAME} · textbook algorithms, step by step`}
      </div>
    </div>,
    OG_SIZE,
  );
}
