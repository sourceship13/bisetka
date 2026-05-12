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
  shoes:   { top: 0.88,  left: 0.24,    width: 0.52,    height: 0.12    },
  // Hair sits on head
  hair:    { top: 0.0,   left: 0.16,    width: 0.68,    height: 0.15    },
  // Hat sits above the hair
  hat:     { top: -0.02, left: 0.28,    width: 0.44,    height: 0.20    },
  // Jewelry around neckline
  jewelry: { top: 0.18,  left: 0.32,    width: 0.36,    height: 0.12    },
  // Other = full overlay (accessories, props)
  other:   { top: 0.0,   left: 0.0,     width: 1.0,     height: 1.0     },
};

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
        const region = SLOT_REGION[slot] ?? SLOT_REGION.other;
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
