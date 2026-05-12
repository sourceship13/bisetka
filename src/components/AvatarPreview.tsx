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

// Per-slot anchor box on the avatar canvas, expressed as percentages of the
// square container. Each clothing SVG preserves its own aspect ratio inside
// this box, so the visible item sizes itself to the body landmark.
// Avatar bodies fill ~full container height and are horizontally centered.
const SLOT_REGION: Record<
  string,
  { top: string; left: string; width: string; height: string }
> = {
  // Shirt / top: torso area
  top:     { top: '14.5%', left: '22%', width: '56%', height: '50%' },
  // Jacket: slightly larger than shirt to wrap arms
  jacket:  { top: '21%', left: '18%', width: '64%', height: '38%' },
  // Pants
  bottom:  { top: '52%', left: '28%', width: '44%', height: '44%' },
  // Shorts
  shorts:  { top: '52%', left: '28%', width: '44%', height: '24%' },
  // Shoes
  shoes:   { top: '88%', left: '24%', width: '52%', height: '12%' },
  // Hair sits on head
  hair:    { top: '0%',  left: '28%', width: '44%', height: '24%' },
  // Hat sits above the hair
  hat:     { top: '-2%', left: '28%', width: '44%', height: '20%' },
  // Jewelry around neckline
  jewelry: { top: '18%', left: '32%', width: '36%', height: '12%' },
  // Other = full overlay (accessories, props)
  other:   { top: '0%',  left: '0%',  width: '100%', height: '100%' },
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
        width="100%"
        height="100%"
        style={styles.layer}
      />
      {LAYER_ORDER.map(slot => {
        const item = equipped[slot];
        if (!item) return null;
        const region = SLOT_REGION[slot] ?? SLOT_REGION.other;
        return (
          <View
            key={slot}
            style={[
              styles.layer,
              {
                top: region.top as any,
                left: region.left as any,
                width: region.width as any,
                height: region.height as any,
              },
            ]}
            pointerEvents="none"
          >
            <AssetImage
              source={item.imageUrl}
              width="100%"
              height="100%"
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
