import React, {useState, useRef, useEffect} from 'react';
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
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from '../../../services/pushNotification.service';
import apiService from '../../../services/api.service';
import {colors} from '../../../theme/colors';
import {useAuth} from '../../../libs/hooks/useAuth';
import AVATARS, { resolveAvatar } from '../../../utils/avatars';
import AvatarPreview from '../../../components/AvatarPreview';
import {
  ALL_BASE_AVATARS,
  ALL_CLOTHING_ITEMS,
  getStarterShirtIdForAvatar,
  getStarterPantsIdForAvatar,
} from '../../../data/clothingItems';
import type { BaseAvatar } from '../../../types/avatar2d';

const BisetkaLogo = require('../../../../assets/imgs/bisetka-logo.png');

const {width: screenWidth} = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  description: string;
  emoji: string;
  gradient: [string, string];
  isNotificationSlide?: boolean;
  isUsernameSlide?: boolean;
  isGenderSlide?: boolean;
  isAvatarSlide?: boolean;
}

const BASE_SLIDES: Slide[] = [
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

const USERNAME_SLIDE: Slide = {
  id: '5',
  title: 'Choose Your Username',
  description: 'Pick a unique username so other players can find and challenge you.',
  emoji: '👤',
  gradient: ['#4facfe', '#00f2fe'],
  isUsernameSlide: true,
};

const GENDER_SLIDE: Slide = {
  id: '5b',
  title: 'Pick Your Gender',
  description: 'This locks the avatar set you can choose from. You can’t change it later.',
  emoji: '🚹',
  gradient: ['#a18cd1', '#fbc2eb'],
  isGenderSlide: true,
};

const AVATAR_SLIDE: Slide = {
  id: '6',
  title: 'Pick Your Avatar',
  description: 'Choose an avatar to represent you in the game.',
  emoji: '🎭',
  gradient: ['#fa709a', '#fee140'],
  isAvatarSlide: true,
};

const ONBOARDING_COMPLETE_KEY = '@bisetka_onboarding_complete';
const GENDER_KEY = '@bisetka_gender';
const SELECTED_AVATAR_KEY = 'selectedAvatarId';
const SELECTED_AVATAR_OBJ_KEY = '@bisetka_selected_avatar';

const OnboardingScreen: React.FC<{navigation: any; route?: any}> = ({navigation}) => {
  const {user, setUser} = useAuth();

  // Derive directly from the live user object — never stale, no param-timing issues
  const needsUsernameSelection: boolean = !!(
    user?.needsUsernameSelection ||
    !user?.username ||
    user?.username?.includes('null') ||
    user?.username?.includes('undefined') ||
    user?.username?.startsWith('user_')
  );
  const slides = needsUsernameSelection 
    ? [...BASE_SLIDES, USERNAME_SLIDE, GENDER_SLIDE, AVATAR_SLIDE] 
    : BASE_SLIDES;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState<'pending' | 'granted' | 'denied' | 'blocked'>('pending');

  // Username slide state
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Gender + avatar slide state
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Debounced username availability check
  useEffect(() => {
    if (!needsUsernameSelection) return;
    if (username.length < 3) {
      setAvailable(null);
      setUsernameMessage('');
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        setChecking(true);
        const result = await apiService.checkUsername(username);
        setAvailable(result.available);
        setUsernameMessage(result.message);
      } catch (error) {
        setUsernameMessage('Error checking availability');
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [username, needsUsernameSelection]);

  const handleNext = () => {
    // Block forward navigation when the current slide isn't satisfied.
    const currentSlide = slides[currentIndex];
    if (currentSlide?.isUsernameSlide && !available) {
      return;
    }
    if (currentSlide?.isGenderSlide && !selectedGender) {
      return;
    }
    
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
    if (needsUsernameSelection) {
      if (!available) return;
      if (!selectedGender) return; // Must pick gender
      if (!selectedAvatarId) return; // Must pick avatar
      try {
        setSubmitting(true);
        // Update username
        const response = await apiService.updateUsername(username);
        // Persist gender + avatar choice locally so the rest of the app picks it up.
        await AsyncStorage.setItem(GENDER_KEY, selectedGender);
        await AsyncStorage.setItem(SELECTED_AVATAR_KEY, selectedAvatarId);
        const chosen = ALL_BASE_AVATARS.find(a => a.id === selectedAvatarId);
        if (chosen) {
          await AsyncStorage.setItem(SELECTED_AVATAR_OBJ_KEY, JSON.stringify(chosen));
        }
        // Seed starter wardrobe: every player starts owning + wearing the
        // shirt-style-5 + pants-style-5 matching their avatar's gender/build.
        try {
          const build = (chosen as any)?.build as string | undefined;
          const shirtId = getStarterShirtIdForAvatar(selectedGender, build);
          const pantsId = getStarterPantsIdForAvatar(selectedGender, build);
          const shirt = ALL_CLOTHING_ITEMS.find(i => i.id === shirtId);
          const pants = ALL_CLOTHING_ITEMS.find(i => i.id === pantsId);
          const equipped: Record<string, any> = {};
          if (shirt) equipped[shirt.type] = shirt;
          if (pants) equipped[pants.type] = pants;
          await AsyncStorage.setItem(
            '@bisetka_equipped_clothing',
            JSON.stringify(equipped),
          );
          // Merge into the owned set so they show up in the wardrobe.
          const ownedStr = await AsyncStorage.getItem('ownedClothing');
          const owned: Set<string> = new Set(
            ownedStr ? JSON.parse(ownedStr) : [],
          );
          if (shirt) owned.add(shirt.id);
          if (pants) owned.add(pants.id);
          await AsyncStorage.setItem(
            'ownedClothing',
            JSON.stringify([...owned]),
          );
        } catch (seedErr) {
          console.warn('Failed to seed starter wardrobe:', seedErr);
        }
        // Mirror the avatar id to the user's avatar_url server-side so other
        // clients/devices can resolve the choice via UserAvatar.
        try {
          await apiService.updateAvatar(selectedAvatarId);
        } catch (avatarErr) {
          console.warn('Failed to persist avatar to server:', avatarErr);
        }
        const updatedUser = {...response.user, needsUsernameSelection: false, avatar_url: selectedAvatarId};
        setUser(updatedUser);
      } catch (error: any) {
        setUsernameMessage(error.message || 'Failed to save profile. Try again.');
        setAvailable(false);
        setSubmitting(false);
        return;
      } finally {
        setSubmitting(false);
      }
    }
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
    <KeyboardAvoidingView
      style={slideStyles.slide}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

        {/* Notification button on notification slide */}
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
            <Text style={slideStyles.notifStatusText}>✅ Notifications enabled!</Text>
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

        {/* Username input on username slide */}
        {item.isUsernameSlide && (
          <View style={slideStyles.usernameContainer}>
            <View style={slideStyles.usernameInputRow}>
              <TextInput
                style={slideStyles.usernameInput}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                autoFocus={false}
              />
              <Text style={slideStyles.usernameStatusIcon}>
                {checking ? '⏳' : available === true ? '✅' : available === false ? '❌' : '🔤'}
              </Text>
            </View>
            {username.length >= 3 && (
              <Text style={[slideStyles.usernameStatusText,
                {color: available === true ? '#38ef7d' : available === false ? '#f5576c' : colors.text.secondary}]}>
                {usernameMessage}
              </Text>
            )}
            <Text style={slideStyles.usernameHint}>
              3–20 characters · letters, numbers and underscores only
            </Text>
          </View>
        )}

        {/* Gender selection on gender slide */}
        {item.isGenderSlide && (
          <View style={slideStyles.genderContainer}>
            {(['male', 'female'] as const).map(g => (
              <TouchableOpacity
                key={g}
                style={[
                  slideStyles.genderCard,
                  selectedGender === g && slideStyles.genderCardSelected,
                ]}
                onPress={() => {
                  setSelectedGender(g);
                  // Reset any previously chosen avatar so it matches new gender.
                  setSelectedAvatarId(null);
                }}
                activeOpacity={0.85}>
                <Text style={slideStyles.genderEmoji}>{g === 'male' ? '👨' : '👩'}</Text>
                <Text style={slideStyles.genderLabel}>{g === 'male' ? 'Male' : 'Female'}</Text>
                {selectedGender === g && (
                  <View style={slideStyles.avatarCheckmark}>
                    <Text style={slideStyles.avatarCheckmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {!selectedGender && (
              <Text style={slideStyles.avatarHint}>Pick one to continue</Text>
            )}
          </View>
        )}

        {/* Avatar selection on avatar slide */}
        {item.isAvatarSlide && (
          <View style={slideStyles.avatarContainer}>
            <FlatList
              data={ALL_BASE_AVATARS.filter(a => a.gender === selectedGender)}
              numColumns={3}
              keyExtractor={(avatar) => avatar.id}
              contentContainerStyle={slideStyles.avatarGrid}
              columnWrapperStyle={slideStyles.avatarRow}
              renderItem={({item: avatar}) => (
                <TouchableOpacity
                  style={[
                    slideStyles.avatarOption,
                    selectedAvatarId === avatar.id && slideStyles.avatarOptionSelected,
                  ]}
                  onPress={() => setSelectedAvatarId(avatar.id)}
                  activeOpacity={0.7}>
                  <View style={slideStyles.avatarPreviewWrap}>
                    <AvatarPreview
                      baseAvatar={avatar}
                      equipped={{}}
                      size={Math.floor(((screenWidth - 80) / 3) * 1.4)}
                    />
                  </View>
                  {selectedAvatarId === avatar.id && (
                    <View style={slideStyles.avatarCheckmark}>
                      <Text style={slideStyles.avatarCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
            {!selectedAvatarId && (
              <Text style={slideStyles.avatarHint}>
                Choose an avatar to continue
              </Text>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
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
            {!isLastSlide && !needsUsernameSelection && (
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
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.8}
              disabled={submitting || (needsUsernameSelection && (!available || !selectedGender || !selectedAvatarId))}
              style={{opacity: submitting || (needsUsernameSelection && (!available || !selectedGender || !selectedAvatarId)) ? 0.5 : 1}}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={slideStyles.button}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={slideStyles.buttonText}>
                      {needsUsernameSelection ? 'Complete Profile' : 'Get Started'}
                    </Text>
                    <Text style={{fontSize: 18, color: '#fff'}}>→</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={handleNext} 
              activeOpacity={0.8} 
              style={{flex:1}}
              disabled={
                (slides[currentIndex]?.isUsernameSlide && !available) ||
                (slides[currentIndex]?.isGenderSlide && !selectedGender)
              }>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={[slideStyles.button,
                  ((slides[currentIndex]?.isUsernameSlide && !available) ||
                   (slides[currentIndex]?.isGenderSlide && !selectedGender)) && {opacity: 0.5}]}>
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
  usernameContainer: {
    marginTop: 28,
    width: '100%',
  },
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingRight: 12,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  usernameStatusIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  usernameStatusText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    marginLeft: 4,
  },
  usernameHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
    marginLeft: 4,
  },
  avatarContainer: {
    marginTop: 28,
    width: '100%',
    alignItems: 'center',
  },
  avatarGrid: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  avatarRow: {
    justifyContent: 'center',
  },
  avatarOption: {
    width: (screenWidth - 80) / 3,
    aspectRatio: 0.7,
    margin: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPreviewWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionSelected: {
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: 'rgba(79,172,254,0.2)',
  },
  avatarImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  avatarCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCheckmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  avatarHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 12,
    textAlign: 'center',
  },
  genderContainer: {
    marginTop: 28,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  genderCard: {
    width: (screenWidth - 80) / 2,
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderCardSelected: {
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: 'rgba(161,140,209,0.25)',
  },
  genderEmoji: {
    fontSize: 64,
  },
  genderLabel: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
});

export {ONBOARDING_COMPLETE_KEY, GENDER_KEY};
export default OnboardingScreen;
