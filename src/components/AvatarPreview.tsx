import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { BaseAvatar, AvatarClothing } from '../types/avatar2d';

interface AvatarPreviewProps {
  baseAvatar: BaseAvatar;
  equipped: Record<string, AvatarClothing>;
  size?: number;
  onChangeAvatar?: () => void;
}

export const AvatarPreview: React.FC<AvatarPreviewProps> = ({
  baseAvatar,
  equipped,
  size = 200,
}) => {
  console.log('AvatarPreview rendering:', { baseAvatar: baseAvatar?.name, equipped: Object.keys(equipped) });
  
  // Images are 2816x1536 (landscape, ~1.83:1 ratio)
  // Display with proper aspect ratio
  const aspectRatio = 2816 / 1536; // width / height
  const containerHeight = size;
  const containerWidth = size * aspectRatio;
  
  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight }]}>
      {/* Base avatar (in underwear) */}
      <Image
        source={baseAvatar.imageUrl}
        style={[styles.layer]}
        resizeMode="contain"
      />
      
      {/* Clothing layers (rendered in correct order) */}
      {equipped.bottom && (
        <Image
          source={equipped.bottom.imageUrl}
          style={styles.layer}
          resizeMode="contain"
        />
      )}
      
      {equipped.shoes && (
        <Image
          source={equipped.shoes.imageUrl}
          style={styles.layer}
          resizeMode="contain"
        />
      )}
      
      {equipped.top && (
        <Image
          source={equipped.top.imageUrl}
          style={styles.layer}
          resizeMode="contain"
        />
      )}
      
      {equipped.hair && (
        <Image
          source={equipped.hair.imageUrl}
          style={[styles.layer, styles.hairLayer]}
          resizeMode="contain"
        />
      )}
      
      {equipped.hat && (
        <Image
          source={equipped.hat.imageUrl}
          style={styles.layer}
          resizeMode="contain"
        />
      )}
      
      {equipped.jewelry && (
        <Image
          source={equipped.jewelry.imageUrl}
          style={styles.layer}
          resizeMode="contain"
        />
      )}
      
      {equipped.other && (
        <Image
          source={equipped.other.imageUrl}
          style={styles.layer}
          resizeMode="contain"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  layer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },
  hairLayer: {
    top: -25, // adjust this value to move the hair up/down
  },
});

export default AvatarPreview;
