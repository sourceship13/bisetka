import colors from './colors';
import spacing from './spacing';
import typography from './typography';

export const theme = {
  colors,
  spacing,
  typography,
  
  // Border radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    round: 9999,
  },
  
  // Shadows
  shadows: {
    sm: {
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 6},
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    xl: {
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export { colors, spacing, typography };
export default theme;
