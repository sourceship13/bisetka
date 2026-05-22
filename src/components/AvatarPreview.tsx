import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BaseAvatar, AvatarClothing } from '../types/avatar2d';
import AssetImage from './AssetImage';

interface AvatarPreviewProps {
  baseAvatar: BaseAvatar;
  equipped: Record<string, AvatarClothing>;
  size?: number;
  onChangeAvatar?: () => void;
}

// Render order back-to-front. Bottom of list = top-most layer.
const LAYER_ORDER = [
  'bottom',
  'shorts',
  'shoes',
  'top',
  'jacket',
  'hair',
  'hat',
  'jewelry',
  'other',
];

// Per-slot anchor box on the avatar canvas, expressed as fractions of the
// square container. Each clothing SVG preserves its own aspect ratio inside
// this box, so the visible item sizes itself to the body landmark.
// Avatar bodies fill ~full container height and are horizontally centered.
const SLOT_REGION: Record<
  string,
  { top: number; left: number; width: number; height: number }
> = {
  // Shirt / top: torso area
  top:     { top: 0.145, left: 0.22,    width: 0.56,    height: 0.50    },
  // Jacket: slightly larger than shirt to wrap arms
  jacket:  { top: 0.21,  left: 0.18,    width: 0.64,    height: 0.38    },
  // Pants (3% smaller than the original 44%×44% box, re-centered)
  bottom:  { top: 0.5066,left: 0.2866,  width: 0.42,  height: 0.426  },
  // Shorts
  shorts:  { top: 0.52,  left: 0.28,    width: 0.44,    height: 0.24    },
  // Shoes
  shoes:   { top: 0.88,  left: 0.22,    width: 0.52,    height: 0.12    },
  // Hair sits on head
  hair:    { top: 0.0,   left: 0.16,    width: 0.67,    height: 0.145    },
  // Hat sits above the hair
  hat:     { top: -0.02, left: 0.28,    width: 0.44,    height: 0.20    },
  // Jewelry around neckline
  jewelry: { top: 0.18,  left: 0.32,    width: 0.36,    height: 0.12    },
  // Other = full overlay (accessories, props)
  other:   { top: 0.0,   left: 0.0,     width: 1.0,     height: 1.0     },
};

// ---------------------------------------------------------------------------
// Per-build overrides
// ---------------------------------------------------------------------------
// Muscle and fat avatars have wider torsos / hips / planted feet than the
// default (athletic / slim / old) bodies, so clothing slots need to widen
// and re-center for those builds. Each entry below merges on top of the
// default `SLOT_REGION` for that slot — only override the fields you want
// to change. Tune these numbers freely; changes only apply to the build
// they're keyed under.
//
// Keys: `${gender}-${build}` (e.g. 'male-muscle', 'female-fat'). Builds not
// listed here fall back to the shared `SLOT_REGION` defaults.
type SlotRegion = { top: number; left: number; width: number; height: number };
type BuildOverrides = Record<string, Partial<SlotRegion>>;

const BUILD_OVERRIDES: Record<string, BuildOverrides> = {
  // ───── MALE MUSCLE ─────────────────────────────────────────────────────
  'male-muscle': {
    top:    { left: 0.3, width: 0.4, top: 0.150 },
    jacket: { left: 0.14, width: 0.72, top: 0.205 },
    bottom: { left: 0.231, width: 0.5, top: 0.5066 },
    shorts: { left: 0.265, width: 0.47 },
    shoes:  { left: 0.11,  width: 0.7, top: 0.878 },    
    hair:    { left: -0.031, width: 1, top: 0.0, height: 0.14 },
    jewelry: { left: 0.30, width: 0.40, top: 0.175, height: 0.13 },  },
  // ───── MALE FAT ────────────────────────────────────────────────────────
  'male-fat': {
    top:    { left: 0.31, width: 0.4, top: 0.150, height: 0.52 },
    jacket: { left: 0.12, width: 0.76, top: 0.215 },
    bottom: { left: 0.25, width: 0.45, top: 0.518,  height: 0.42 },
    shorts: { left: 0.24, width: 0.52, top: 0.525 },
    shoes:  { left: 0.009, width: 0.9, top: 0.885, height: 0.15 },
    hair:    { left: 0.14, width: 0.72, top: 0.0,   height: 0.155 },
    jewelry: { left: 0.28, width: 0.44, top: 0.185, height: 0.13 },
  },
  // ───── FEMALE MUSCLE ───────────────────────────────────────────────────
  'female-muscle': {
    top:    { left: 0.389, width: 0.2, top: 0.08 },
    jacket: { left: 0.16, width: 0.68, top: 0.210 },
    bottom: { left: 0.28, width: 0.44, top: 0.46, height:0.5 },
    shorts: { left: 0.27, width: 0.46 },
    shoes:  { left: 0.21, width: 0.54, top: 0.93, height: 0.10 },
    hair:    { left: 0.145, width: 0.70, top: -0.031,   height: 0.24 },
    jewelry: { left: 0.31,  width: 0.38, top: 0.180, height: 0.12 },
  },
  // ───── FEMALE FAT ──────────────────────────────────────────────────────
  'female-fat': {
    top:    { left: 0.326, width: 0.32, top: -0.06, height: 0.8 },
    jacket: { left: 0.13, width: 0.74, top: 0.215 },
    bottom: { left: -0.012, width: 1, top: 0.51, height: 0.42 },
    shorts: { left: 0.245, width: 0.51, top: 0.525 },
    shoes:  { left: 0.28, width: 0.4, top: 0.92 },
    hair:    { left: 0.06, width: 0.9, top: -0.03,   height: 0.23 },
    jewelry: { left: 0.295, width: 0.41, top: 0.185, height: 0.13 },
  },
  // ───── FEMALE ATHLETIC / SLIM / OLD ────────────────────────────────────
  // The non-muscle / non-fat female bodies are noticeably narrower than the
  // default male body the shared SLOT_REGION was tuned for. Without these
  // overrides, the shirt + pants render way too wide and the shirt also
  // sits too tall (covering the head), and the pants top doesn't line up
  // with the waistline. Numbers below are tightened versions of the
  // defaults — adjust freely if any single build needs a nudge.
  'female-athletic': {
    top:    { left: 0.39, width: 0.19, top: 0.17, height: 0.32 },
    jacket: { left: 0.245, width: 0.51, top: 0.225, height: 0.30 },
    bottom: { left: 0.071, width: 0.85, top: 0.456,  height: 0.48 },
    shorts: { left: 0.30,  width: 0.45, top: 0.495, height: 0.22 },
    shoes:  { left: 0.36,  width: 0.25, top: 0.919,  height: 0.10 },
    hair:   { left: 0.09, width: 0.8, top: -0.03,   height: 0.23 },
    jewelry:{ left: 0.34,  width: 0.32, top: 0.20,  height: 0.10 },
  },
  'female-slim': {
    top:    { left: 0.30, width: 0.40, top: 0.180, height: 0.30 },
    jacket: { left: 0.265, width: 0.47, top: 0.230, height: 0.28 },
    bottom: { left: 0.32,  width: 0.36, top: 0.475, height: 0.40 },
    shorts: { left: 0.315, width: 0.37, top: 0.49,  height: 0.22 },
    shoes:  { left: 0.295, width: 0.41, top: 0.88,  height: 0.10 },
    hair:   { left: 0.215, width: 0.57, top: 0.0,   height: 0.13 },
    jewelry:{ left: 0.35,  width: 0.30, top: 0.20,  height: 0.10 },
  },
  'female-old': {
    top:    { left: 0.27, width: 0.46, top: 0.180, height: 0.32 },
    jacket: { left: 0.235, width: 0.53, top: 0.230, height: 0.30 },
    bottom: { left: 0.30,  width: 0.40, top: 0.48,  height: 0.40 },
    shorts: { left: 0.295, width: 0.41, top: 0.495, height: 0.22 },
    shoes:  { left: 0.275, width: 0.45, top: 0.88,  height: 0.10 },
    hair:   { left: 0.195, width: 0.61, top: 0.0,   height: 0.13 },
    jewelry:{ left: 0.335, width: 0.33, top: 0.205, height: 0.10 },
  },
};

function getSlotRegion(slot: string, baseAvatar: BaseAvatar): SlotRegion {
  const base = SLOT_REGION[slot] ?? SLOT_REGION.other;
  // baseAvatar.id is shaped like 'avatar-{gender}-{build}' (see avatarsNew.ts)
  const parts = baseAvatar.id?.split('-') ?? [];
  const gender = parts[1];
  const build = parts[2];
  const key = `${gender}-${build}`;
  const override = BUILD_OVERRIDES[key]?.[slot];
  return override ? { ...base, ...override } : base;
}

export const AvatarPreview: React.FC<AvatarPreviewProps> = ({
  baseAvatar,
  equipped,
  size = 200,
}) => {
  const containerStyle: StyleProp<ViewStyle> = {
    width: size,
    height: size,
  };
  return (
    <View style={[styles.container, containerStyle]}>
      <AssetImage
        source={baseAvatar.imageUrl}
        width={size}
        height={size}
        style={styles.layer}
      />
      {LAYER_ORDER.map(slot => {
        const item = equipped[slot];
        if (!item) return null;
        const region = getSlotRegion(slot, baseAvatar);
        const w = Math.round(size * region.width);
        const h = Math.round(size * region.height);
        const top = Math.round(size * region.top);
        const left = Math.round(size * region.left);
        return (
          <View
            key={slot}
            style={{
              position: 'absolute',
              top,
              left,
              width: w,
              height: h,
            }}
            pointerEvents="none"
          >
            <AssetImage
              source={item.imageUrl}
              width={w}
              height={h}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },
});

export default AvatarPreview;
