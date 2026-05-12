/**
 * DynamicBilliardBall.tsx
 *
 * Renders a single poolball as a photorealistic SVG sphere — numbers, stripes,
 * and a radial-gradient specular highlight all drawn procedurally.
 *
 * Usage:
 *   <DynamicBilliardBall number={8} size={40} rotation={ball.rotation} />
 *
 * Props:
 *   number   - 0 (cue) … 15.  0 = white cue ball, 8 = eight-ball.
 *   size     - diameter in dp (default 40)
 *   rotation - accumulated rolling angle in degrees from the physics engine.
 *              0 means number faces up; oscillates the stripe while rolling.
 *   dimmed   - optional 0-1 opacity override (for pocketed preview)
 */
import React from 'react';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  ClipPath,
  Rect,
  G,
  Text as SvgText,
  Ellipse,
} from 'react-native-svg';

// ─── Ball data ────────────────────────────────────────────────────────────────

export type BilliardBallNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface BilliardBallConfig {
  number: BilliardBallNumber;
  color: string;       // dominant ball color
  isStripe: boolean;
  type: 'cue' | 'solid' | 'stripe' | 'eight';
}

/** Canonical pool-ball color/type table (matches BilliardsGameScreen BALL_COLORS). */
export const BILLIARD_BALL_DATA: Record<BilliardBallNumber, BilliardBallConfig> = {
  0:  { number: 0,  color: '#FFFFFF', isStripe: false, type: 'cue'    },
  1:  { number: 1,  color: '#FFD700', isStripe: false, type: 'solid'  },
  2:  { number: 2,  color: '#1E40AF', isStripe: false, type: 'solid'  },
  3:  { number: 3,  color: '#DC2626', isStripe: false, type: 'solid'  },
  4:  { number: 4,  color: '#7C3AED', isStripe: false, type: 'solid'  },
  5:  { number: 5,  color: '#EA580C', isStripe: false, type: 'solid'  },
  6:  { number: 6,  color: '#15803D', isStripe: false, type: 'solid'  },
  7:  { number: 7,  color: '#7F1D1D', isStripe: false, type: 'solid'  },
  8:  { number: 8,  color: '#111111', isStripe: false, type: 'eight'  },
  9:  { number: 9,  color: '#FFD700', isStripe: true,  type: 'stripe' },
  10: { number: 10, color: '#1E40AF', isStripe: true,  type: 'stripe' },
  11: { number: 11, color: '#DC2626', isStripe: true,  type: 'stripe' },
  12: { number: 12, color: '#7C3AED', isStripe: true,  type: 'stripe' },
  13: { number: 13, color: '#EA580C', isStripe: true,  type: 'stripe' },
  14: { number: 14, color: '#15803D', isStripe: true,  type: 'stripe' },
  15: { number: 15, color: '#7F1D1D', isStripe: true,  type: 'stripe' },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface DynamicBilliardBallProps {
  number: BilliardBallNumber;
  size?: number;
  rotation?: number;  // degrees, accumulated rolling angle
  velAngle?: number;  // degrees, direction of motion (stripe orients perpendicular to this)
  dimmed?: number;    // 0-1 opacity (default 1)
}

const DynamicBilliardBall: React.FC<DynamicBilliardBallProps> = ({
  number,
  size = 40,
  rotation = 0,
  velAngle = 0,
  dimmed = 1,
}) => {
  const r = size / 2;                       // SVG radius
  const cx = r;                             // center x
  const cy = r;                             // center y

  const data = BILLIARD_BALL_DATA[number] ?? BILLIARD_BALL_DATA[0];
  const { color, isStripe, type } = data;

  // ── Stripe band rolling model (side-view convention) ───────────────────
  // Pool balls are rendered "side-view": stripe is a horizontal band across
  // the middle, label sits on the band. As the ball rolls forward, the band
  // and label scroll across the visible face of the ball — when one edge
  // disappears off the top, a second copy of the band wraps in from the
  // bottom, so the rolling looks continuous (no popping/recentering).
  //
  // The whole decal group (band + label) is rotated by `velAngle` so the
  // scrolling direction matches the actual motion direction. Once the ball
  // stops, both `velAngle` and `rotation` are preserved by the physics
  // engine, so the stripe rests in whatever orientation it landed.
  const stripeBandH = r * 0.78;             // band thickness
  // Convert rolling angle → linear travel along the ball surface, then to
  // the projected on-screen offset within the visible face. A full 360° of
  // roll moves the decal 2r down (one full circumference's worth) — but we
  // need the projected displacement, which is r * sin(rot). To make it
  // wrap seamlessly we use sin of the wrapped angle and render a second
  // band copy 2r away in the opposite direction.
  const rotRad = (rotation * Math.PI) / 180;
  const bandOffset = Math.sin(rotRad) * r;  // -r .. +r
  // The "front-of-ball" hemisphere is when cos(rot) > 0; that's when the
  // decal printed on the ball is currently facing the viewer. When we're
  // looking at the back hemisphere the label should not be drawn.
  const labelOnFront = Math.cos(rotRad) > 0;

  // Label circle size and font
  const labelR = r * 0.38;
  const fontSize = number < 10 ? r * 0.42 : r * 0.34;

  // Text color in label: dark on light balls, white on dark ones
  const textColor = (color === '#FFFFFF' || color === '#FFD700' || color === '#EA580C') ? '#111' : '#fff';
  // For stripe, label text is always dark (on white label circle)
  const labelTextColor = '#111';

  // ── Unique IDs (avoid collision when multiple balls rendered) ────────────
  const uid = `b${number}`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ opacity: dimmed }}>
      <Defs>
        {/* ── Ball body radial gradient (main 3D shading) ── */}
        <RadialGradient
          id={`${uid}_bodyGrad`}
          cx="38%"
          cy="35%"
          rx="60%"
          ry="60%"
          gradientUnits="objectBoundingBox">
          <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.45" />
          <Stop offset="40%"  stopColor={color}   stopOpacity="1"    />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
        </RadialGradient>

        {/* ── Solid/eight-ball base color ── */}
        <RadialGradient
          id={`${uid}_solidGrad`}
          cx="38%"
          cy="35%"
          rx="70%"
          ry="70%"
          gradientUnits="objectBoundingBox">
          <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.5"  />
          <Stop offset="35%"  stopColor={color}   stopOpacity="1"    />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0.6"  />
        </RadialGradient>

        {/* ── Stripe ball white base gradient ── */}
        <RadialGradient
          id={`${uid}_whiteGrad`}
          cx="38%"
          cy="35%"
          rx="70%"
          ry="70%"
          gradientUnits="objectBoundingBox">
          <Stop offset="0%"   stopColor="#ffffff" stopOpacity="1"   />
          <Stop offset="60%"  stopColor="#e8e8e8" stopOpacity="1"   />
          <Stop offset="100%" stopColor="#888888" stopOpacity="1"   />
        </RadialGradient>

        {/* ── Specular highlight (top-left) ── */}
        <RadialGradient
          id={`${uid}_specGrad`}
          cx="32%"
          cy="28%"
          rx="35%"
          ry="32%"
          gradientUnits="objectBoundingBox">
          <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.75" />
          <Stop offset="60%"  stopColor="#FFFFFF" stopOpacity="0.15" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"    />
        </RadialGradient>

        {/* ── Depth rim shadow (bottom-right darkening) ── */}
        <RadialGradient
          id={`${uid}_rimGrad`}
          cx="68%"
          cy="72%"
          rx="55%"
          ry="55%"
          gradientUnits="objectBoundingBox">
          <Stop offset="0%"   stopColor="#000000" stopOpacity="0.45" />
          <Stop offset="70%"  stopColor="#000000" stopOpacity="0"    />
        </RadialGradient>

        {/* ── Clip path to confine everything inside the sphere circle ── */}
        <ClipPath id={`${uid}_clip`}>
          <Circle cx={cx} cy={cy} r={r - 0.5} />
        </ClipPath>
      </Defs>

      {/* ─── BASE SPHERE BODY ─────────────────────────────────────────────── */}
      <G clipPath={`url(#${uid}_clip)`}>

        {/* Background fill */}
        {isStripe ? (
          // Stripe ball: white background
          <Circle cx={cx} cy={cy} r={r} fill={`url(#${uid}_whiteGrad)`} />
        ) : (
          // Solid / cue / eight: use ball color gradient
          <Circle cx={cx} cy={cy} r={r} fill={`url(#${uid}_solidGrad)`} />
        )}

        {/* ─── DECAL GROUP (stripe band + number label) ───
            Rotated by velAngle so "rolling forward" matches actual motion
            direction (e.g. ball moving right rolls along its X axis). When
            stationary, velAngle is whatever the ball was last moving at,
            so the stripe rests in a natural orientation. */}
        <G transform={`rotate(${velAngle - 90} ${cx} ${cy})`}>
          {/* Stripe band — drawn as full-width horizontal band, plus a
              second copy 2r away so it wraps seamlessly during rolling. */}
          {isStripe && (
            <>
              <Rect
                x={cx - r}
                y={cy + bandOffset - stripeBandH / 2}
                width={2 * r}
                height={stripeBandH}
                fill={`url(#${uid}_bodyGrad)`}
              />
              <Rect
                x={cx - r}
                y={cy + bandOffset + (bandOffset >= 0 ? -2 * r : 2 * r) - stripeBandH / 2}
                width={2 * r}
                height={stripeBandH}
                fill={`url(#${uid}_bodyGrad)`}
              />
            </>
          )}

          {/* Number label — sits on the band, scrolls with the ball, only
              visible while the decal is on the front-facing hemisphere. */}
          {type !== 'cue' && labelOnFront && (
            <G transform={`translate(${cx} ${cy + bandOffset}) rotate(${90 - velAngle})`}>
              <Circle cx={0} cy={0} r={labelR} fill="white" opacity={0.95} />
              <SvgText
                x={0}
                y={fontSize * 0.37}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
                fill={labelTextColor}>
                {number}
              </SvgText>
            </G>
          )}
        </G>

        {/* ─── CUE-BALL CENTER DOT ─── */}
        {type === 'cue' && (
          <Circle cx={cx} cy={cy} r={r * 0.08} fill="rgba(180,180,180,0.7)" />
        )}

        {/* ─── SPECULAR HIGHLIGHT LAYER ─── */}
        <Circle cx={cx} cy={cy} r={r} fill={`url(#${uid}_specGrad)`} />

        {/* ─── RIM SHADOW LAYER ─── */}
        <Circle cx={cx} cy={cy} r={r} fill={`url(#${uid}_rimGrad)`} />
      </G>

      {/* ─── OUTER EDGE STROKE ─────────────────────────────────────────────── */}
      <Circle
        cx={cx}
        cy={cy}
        r={r - 0.75}
        fill="none"
        stroke={type === 'cue' ? '#bbb' : '#1a1a1a'}
        strokeWidth={r * 0.035}
        opacity={0.6}
      />
    </Svg>
  );
};

export default DynamicBilliardBall;
