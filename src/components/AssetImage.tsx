import React from 'react';
import { Image, ImageStyle, StyleProp, ViewStyle } from 'react-native';

interface Props {
  source: any; // require()/URL/SVG component
  width?: number | string;
  height?: number | string;
  style?: StyleProp<ImageStyle | ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

/**
 * Renders an asset that may be either a static image source (require(), URI)
 * or a React component (e.g. SVG imported via react-native-svg-transformer).
 */
export const AssetImage: React.FC<Props> = ({
  source,
  width,
  height,
  style,
  resizeMode = 'contain',
}) => {
  if (!source) return null;
  if (typeof source === 'function') {
    const SvgComp: any = source;
    return <SvgComp width={width} height={height} style={style as any} />;
  }
  if (typeof source === 'object' && (source as any).render) {
    const SvgComp: any = source;
    return <SvgComp width={width} height={height} style={style as any} />;
  }
  const imgSource = typeof source === 'string' ? { uri: source } : source;
  return (
    <Image
      source={imgSource}
      style={[{ width: width as any, height: height as any }, style as any]}
      resizeMode={resizeMode}
    />
  );
};

export default AssetImage;
