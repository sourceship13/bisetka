import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface BisetkaModalButton {
  text: string;
  onPress: () => void;
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
        <View style={styles.modalContainer}>
          {/* Gradient header with icon */}
          <LinearGradient
            colors={getGradientColors()}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>{getIcon()}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {defaultButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  button.onPress();
                  onClose?.();
                }}
                style={[
                  styles.buttonWrapper,
                  defaultButtons.length === 1 && styles.singleButton,
                ]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={getButtonGradient(button.style)}
                  style={styles.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buttonText}>{button.text}</Text>
                </LinearGradient>
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
