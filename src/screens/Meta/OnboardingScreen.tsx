import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  Platform,
  Image,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from '../../services/pushNotification.service';
import apiService from '../../services/api.service';
import {colors} from '../../theme/colors';

const BisetkaLogo = require('../../../assets/imgs/bisetka-logo.png');

const {width: screenWidth} = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  description: string;
  emoji: string;
  gradient: [string, string];
  isNotificationSlide?: boolean;
}

const slides: Slide[] = [
  {
    id: '1',
    title: 'Play Classic Games',
    description:
      'Enjoy Nardi, Blot, Chess, Checkers, Poker and more — all in one place. Challenge the AI or play with friends.',
    emoji: '🎲',
    gradient: ['#667eea', '#764ba2'],
  },
  {
    id: '2',
    title: 'Compete & Climb',
    description:
      'Earn points, climb the leaderboard, and prove you\'re the best. Every game counts toward your ranking.',
    emoji: '🏆',
    gradient: ['#f093fb', '#f5576c'],
  },
  {
    id: '3',
    title: 'Chat & Connect',
    description:
      'Join the global chat, send direct messages, and find players to challenge in real-time matches.',
    emoji: '💬',
    gradient: ['#11998e', '#38ef7d'],
  },
  {
    id: '4',
    title: 'Stay in the Loop',
    description:
      'Get notified when friends challenge you, when it\'s your turn, and when new events drop. Never miss a game!',
    emoji: '🔔',
    gradient: ['#ee0979', '#ff6a00'],
    isNotificationSlide: true,
  },
];

const ONBOARDING_COMPLETE_KEY = '@bisetka_onboarding_complete';

const OnboardingScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState<'pending' | 'granted' | 'denied' | 'blocked'>('pending');
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleEnableNotifications = async () => {
    try {
      const result = await pushNotificationService.initialize();
      if (result === 'granted') {
        setNotificationStatus('granted');
      } else if (result === 'blocked') {
        setNotificationStatus('blocked');
      } else {
        setNotificationStatus('denied');
      }
    } catch (error: any) {
      console.error('Notification permission error:', error);
      setNotificationStatus('denied');
    }
  };

  const handleOpenSettings = () => {
    pushNotificationService.openNotificationSettings();
  };

  const handleGetStarted = async () => {
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
    // Persist to server so onboarding stays dismissed across reinstalls / devices
    try {
      await apiService.markOnboardingComplete();
    } catch (error) {
      console.warn('Failed to mark onboarding complete on server:', error);
    }
    navigation.replace('Home');
  };

  const handleScroll = Animated.event(
    [{nativeEvent: {contentOffset: {x: scrollX}}}],
    {useNativeDriver: false},
  );

  const handleMomentumScrollEnd = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setCurrentIndex(index);
  };

  const renderSlide = ({item}: {item: Slide}) => (
    <View style={slideStyles.slide}>
      <View style={slideStyles.slideContent}>
        {/* Emoji Icon */}
        <LinearGradient
          colors={item.gradient}
          style={slideStyles.iconContainer}>
          <Text style={slideStyles.emojiIcon}>{item.emoji}</Text>
        </LinearGradient>

        {/* Text */}
        <Text style={slideStyles.slideTitle}>{item.title}</Text>
        <Text style={slideStyles.slideDescription}>{item.description}</Text>

        {/* Notification button on last slide */}
        {item.isNotificationSlide && notificationStatus === 'pending' && (
          <TouchableOpacity
            style={slideStyles.notifButton}
            onPress={handleEnableNotifications}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#ee0979', '#ff6a00']}
              style={slideStyles.notifButtonGradient}>
              <Text style={slideStyles.notifButtonText}>
                🔔 Enable Notifications
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {item.isNotificationSlide && notificationStatus === 'granted' && (
          <View style={slideStyles.notifStatus}>
            <Text style={slideStyles.notifStatusText}>
              ✅ Notifications enabled!
            </Text>
          </View>
        )}
        {item.isNotificationSlide && notificationStatus === 'denied' && (
          <View style={slideStyles.notifStatus}>
            <Text style={[slideStyles.notifStatusText, {color: colors.text.tertiary}]}>
              You can enable notifications later in Settings
            </Text>
          </View>
        )}
        {item.isNotificationSlide && notificationStatus === 'blocked' && (
          <View style={{alignItems: 'center', marginTop: 16}}>
            <View style={[slideStyles.notifStatus, {backgroundColor: 'rgba(245,87,108,0.12)', marginBottom: 12}]}>
              <Text style={[slideStyles.notifStatusText, {color: '#f5576c'}]}>
                🚫 Notifications are blocked
              </Text>
              <Text style={{color: colors.text.tertiary, fontSize: 12, textAlign: 'center', marginTop: 4}}>
                Tap below to open Settings and enable them.
              </Text>
            </View>
            <TouchableOpacity
              style={slideStyles.notifButton}
              onPress={handleOpenSettings}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#ee0979', '#ff6a00']}
                style={slideStyles.notifButtonGradient}>
                <Text style={slideStyles.notifButtonText}>⚙️ Open Settings</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const dotPosition = Animated.divide(scrollX, screenWidth);
  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary, colors.background.tertiary]}
      style={slideStyles.container}>
      <SafeAreaView style={slideStyles.safeArea}>
        {/* Header: Skip + Logo */}
        <View style={slideStyles.header}>
          <View style={{width: 60}}>
            {!isLastSlide && (
              <TouchableOpacity onPress={handleSkip}>
                <Text style={slideStyles.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
          <Image
            source={BisetkaLogo}
            style={slideStyles.logo}
            resizeMode="contain"
          />
          <View style={{width: 60}} />
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
        />

        {/* Dots */}
        <View style={slideStyles.dotsContainer}>
          {slides.map((_, index) => {
            const opacity = dotPosition.interpolate({
              inputRange: [index - 1, index, index + 1],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            const width = dotPosition.interpolate({
              inputRange: [index - 1, index, index + 1],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={index}
                style={[
                  slideStyles.dot,
                  {opacity, width, backgroundColor: colors.primary},
                ]}
              />
            );
          })}
        </View>

        {/* Button */}
        <View style={slideStyles.buttonContainer}>
          {isLastSlide ? (
            <TouchableOpacity onPress={handleGetStarted} activeOpacity={0.8}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={slideStyles.button}>
                <Text style={slideStyles.buttonText}>Get Started</Text>
                <Text style={{fontSize: 18, color: '#fff'}}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleNext} activeOpacity={0.8} style={{flex:1}}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={slideStyles.button}>
                <Text style={slideStyles.buttonText}>Next</Text>
                <Text style={{fontSize: 18, color: '#fff'}}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const slideStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  logo: {
    width: 80,
    height: 80,
  },
  slide: {
    width: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  slideContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emojiIcon: {
    fontSize: 56,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  notifButton: {
    marginTop: 28,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#ee0979',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  notifButtonGradient: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    margin:20
  },
  notifStatus: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(56, 239, 125, 0.15)',
    borderRadius: 12,
  },
  notifStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.success.main,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  button: {
    height:44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    gap: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});

export {ONBOARDING_COMPLETE_KEY};
export default OnboardingScreen;
