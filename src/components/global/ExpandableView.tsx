import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';

interface ExpandableViewProps {
  isExpanded: SharedValue<boolean>;
  children: React.ReactNode;
  viewKey?: string;
  style?: ViewStyle;
  duration?: number;
}

const ExpandableView: React.FC<ExpandableViewProps> = ({
  isExpanded,
  children,
  viewKey,
  style,
  duration = 500,
}) => {
  const height = useSharedValue(0);

  const derivedHeight = useDerivedValue(() =>
    withTiming(height.value * Number(isExpanded.value), { duration }),
  );

  const bodyStyle = useAnimatedStyle(() => ({
    height: derivedHeight.value,
  }));

  return (
    <Animated.View
      key={viewKey ? `expandableView_${viewKey}` : undefined}
      style={[styles.animatedView, bodyStyle, style]}>
      <View
        onLayout={e => {
          height.value = e.nativeEvent.layout.height;
        }}
        style={styles.wrapper}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedView: {
    overflow: 'hidden',
  },
  wrapper: {
    position: 'absolute',
    width: '100%',
  },
});

export default ExpandableView;
