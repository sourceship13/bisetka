import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#FF9FF3', '#54A0FF'];
const NUM_FLAKES = 45;

interface Flake {
  x: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rotateRange: string;
  translateY: Animated.Value;
  rotate: Animated.Value;
}

const createFlakes = (): Flake[] =>
  Array.from({ length: NUM_FLAKES }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    size: 7 + Math.random() * 9,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    duration: 2200 + Math.random() * 2000,
    delay: Math.random() * 1800,
    rotateRange: `${270 + Math.floor(Math.random() * 360)}deg`,
    translateY: new Animated.Value(-20),
    rotate: new Animated.Value(0),
  }));

const ConfettiRain: React.FC = () => {
  const flakesRef = useRef<Flake[]>(createFlakes());
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    animationsRef.current.forEach(a => a.stop());
    animationsRef.current = flakesRef.current.map(flake => {
      flake.translateY.setValue(-20);
      flake.rotate.setValue(0);
      const anim = Animated.loop(
        Animated.parallel([
          Animated.timing(flake.translateY, {
            toValue: SCREEN_HEIGHT + 20,
            duration: flake.duration,
            delay: flake.delay,
            useNativeDriver: true,
          }),
          Animated.timing(flake.rotate, {
            toValue: 1,
            duration: flake.duration,
            delay: flake.delay,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return anim;
    });
    return () => animationsRef.current.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flakesRef.current.map((flake, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: flake.x,
            top: 0,
            width: flake.size,
            height: flake.size,
            backgroundColor: flake.color,
            borderRadius: flake.size * 0.25,
            transform: [
              { translateY: flake.translateY },
              {
                rotate: flake.rotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', flake.rotateRange],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
};

export interface BisetkaModalButton {
  text: string;
  onPress: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'danger' | 'success';
}

interface BisetkaModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: BisetkaModalButton[];
  onClose?: () => void;
  type?: 'info' | 'success' | 'warning' | 'error';
}

const BisetkaModal: React.FC<BisetkaModalProps> = ({
  visible,
  title,
  message,
  buttons = [],
  onClose,
  type = 'info',
}) => {
  // Default button if none provided
  const defaultButtons: BisetkaModalButton[] = buttons.length > 0
    ? buttons
    : [{ text: 'OK', onPress: onClose || (() => {}), style: 'primary' }];

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✕';
      default: return 'ℹ';
    }
  };

  // Get gradient colors based on type
  const getGradientColors = (): [string, string] => {
    switch (type) {
      case 'success': return [colors.success.dark, colors.success.main];
      case 'warning': return [colors.warning.dark, colors.warning.main];
      case 'error': return [colors.error.dark, colors.error.main];
      default: return [colors.primaryDark, colors.primary];
    }
  };

  // Get button gradient based on style
  const getButtonGradient = (style?: string): [string, string] => {
    switch (style) {
      case 'secondary': return colors.gradients.secondary as [string, string];
      case 'danger': return colors.gradients.danger as [string, string];
      case 'success': return colors.gradients.success as [string, string];
      default: return colors.gradients.primary as [string, string];
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {type === 'success' && <ConfettiRain />}
        <View style={styles.modalContainer}>
          {/* Gradient header with icon */}
          <View
            style={[styles.header, { backgroundColor: getGradientColors()[0] }]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>{getIcon()}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {defaultButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                onPress={async () => {
                  await Promise.resolve(button.onPress());
                  onClose?.();
                }}
                style={[
                  styles.buttonWrapper,
                  defaultButtons.length === 1 && styles.singleButton,
                ]}
                activeOpacity={0.8}
              >
                <View
                  style={[styles.button, { backgroundColor: getButtonGradient(button.style)[0] }]}
                >
                  <Text style={styles.buttonText}>{button.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    minHeight:60
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 32,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  content: {
    flex:1,
  },
  message: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    minHeight:100
  },
  buttonWrapper: {
    flex: 1,
  },
  singleButton: {
    flex: 1,
  },
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight:60
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

export default BisetkaModal;
