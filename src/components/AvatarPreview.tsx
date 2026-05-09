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
        return (
          <AssetImage
            key={slot}
            source={item.imageUrl}
            width="100%"
            height="100%"
            style={styles.layer}
          />
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
