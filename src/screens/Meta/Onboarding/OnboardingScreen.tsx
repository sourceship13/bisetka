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
  ImageBackground,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  DeviceEventEmitter,
} from 'react-native';
import { useI18n } from '../../../hooks/useI18n';
import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../../services/api.service';
import pushNotificationService from '../../../services/pushNotification.service';
import {colors} from '../../../theme/colors';
import {useAuth} from '../../../libs/hooks/useAuth';
import AVATARS, { resolveAvatar } from '../../../utils/avatars';
import AvatarPreview from '../../../components/AvatarPreview';
import {
  ALL_BASE_AVATARS,
  ALL_CLOTHING_ITEMS,
  getStarterShirtIdForAvatar,
  getStarterPantsIdForAvatar,
  getStarterHairIdForAvatar,
  getStarterShoeIdForAvatar,
} from '../../../data/clothingItems';
import type { BaseAvatar } from '../../../types/avatar2d';
import LogoWhite from '../../../../assets/logo/logo-white.svg';

const BisetkaLogo = require('../../../../assets/imgs/bisetka-logo.png');
const WelcomeBackground = require('../../../../assets/backgrounds/bisetka.png');

const {width: screenWidth} = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  description: string;
  emoji: string;
  gradient: [string, string];
  isWelcomeSlide?: boolean;
  isLanguageSlide?: boolean;
  isNotificationSlide?: boolean;
  isUsernameSlide?: boolean;
  isGenderSlide?: boolean;
  isAvatarSlide?: boolean;
  isCharacterSlide?: boolean;
}

const WELCOME_SLIDE: Slide = {
  id: '0',
  title: 'The Armenian Cultural Hub.',
  description: 'Play, connect, and explore our community.',
  emoji: '🏛️',
  gradient: ['#a78bfa', '#7c3aed'],
  isWelcomeSlide: true,
};

const LANGUAGE_SLIDE: Slide = {
  id: '1',
  title: 'Choose Your Language',
  description: 'Select your preferred language. You can change this anytime in Settings.',
  emoji: '🌐',
  gradient: ['#00d4ff', '#0099ff'],
  isLanguageSlide: true,
};

const LANGUAGE_OPTIONS = [
  { code: 'en', label: '🇺🇸 English', native: 'English' },
  { code: 'ru', label: '🇷🇺 Русский', native: 'Russian' },
  { code: 'hy', label: '🇦🇲 Հայերեն', native: 'Armenian (Native)' },
  { code: 'hy-latin', label: '🇦🇲 Hayeren', native: 'Armenian (Latin)' },
];

const BASE_SLIDES: Slide[] = [
  WELCOME_SLIDE,
  LANGUAGE_SLIDE,
  {
    id: '4',
    title: 'Never Miss a Game',
    description:
      'Enable notifications to get invites from friends and stay updated on community events.',
    emoji: '🔔',
    gradient: ['#ee0979', '#ff6a00'],
    isNotificationSlide: true,
  },
];

const USERNAME_SLIDE: Slide = {
  id: '5',
  title: "What's your username?",
  description:
    'Choose a unique username that will be visible to other players in the hub.',
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

// Combined gender + avatar selection — the third onboarding screen, matching
// the "Create Your Avatar" mockup. Replaces the legacy split GENDER + AVATAR
// slides; we keep those constants around because other code paths still use
// the type flags.
const CHARACTER_SLIDE: Slide = {
  id: '5c',
  title: 'Create Your Avatar',
  description:
    'Select your character and pick your first outfit to start your journey.',
  emoji: '🎭',
  gradient: ['#a78bfa', '#7c3aed'],
  isCharacterSlide: true,
};

const ONBOARDING_COMPLETE_KEY = '@bisetka_onboarding_complete';
const GENDER_KEY = '@bisetka_gender';
const SELECTED_AVATAR_KEY = 'selectedAvatarId';
const SELECTED_AVATAR_OBJ_KEY = '@bisetka_selected_avatar';

const OnboardingScreen: React.FC<{navigation: any; route?: any}> = ({navigation}) => {
  const { translate, setLanguage } = useI18n();
  const {user, setUser} = useAuth();
  // apiService available for language preference API calls

  // Derive directly from the live user object — never stale, no param-timing issues
  const needsUsernameSelection: boolean = !!(
    user?.needsUsernameSelection ||
    !user?.username ||
    user?.username?.includes('null') ||
    user?.username?.includes('undefined') ||
    user?.username?.startsWith('user_')
  );
  const slides = needsUsernameSelection 
    ? [BASE_SLIDES[0], USERNAME_SLIDE, CHARACTER_SLIDE, ...BASE_SLIDES.slice(1)] 
    : BASE_SLIDES;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState<'pending' | 'granted' | 'denied' | 'blocked'>('pending');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');

  const handleLanguageSelect = async (langCode: string) => {
    setSelectedLanguage(langCode);
    
    // Update locally (instant)
    await setLanguage(langCode as any);
    
    // Save to database (async, non-blocking)
    if (user?.id) {
      try {
        const [language, script] = langCode === 'hy-latin' 
          ? ['hy', 'latin'] 
          : [langCode, undefined];
        
        await apiService.updateLanguage(language, script);
        console.log('✓ Language preference saved to database');
      } catch (error) {
        // Fail gracefully - local AsyncStorage copy persists
        console.warn('Failed to save language to database (local copy persists):', error);
      }
    }
  };

  // Username slide state
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Gender + avatar slide state. Default to male and preselect the first
  // male avatar so the user lands on a valid selection without tapping.
  const firstMaleAvatarId = ALL_BASE_AVATARS.find(a => a.gender === 'male')?.id ?? null;
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>('male');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(firstMaleAvatarId);

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
    if (currentSlide?.isCharacterSlide && (!selectedGender || !selectedAvatarId)) {
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
          const hairId = getStarterHairIdForAvatar(selectedGender);
          const shoeId = getStarterShoeIdForAvatar(selectedGender);
          const shirt = ALL_CLOTHING_ITEMS.find(i => i.id === shirtId);
          const pants = ALL_CLOTHING_ITEMS.find(i => i.id === pantsId);
          const hair = ALL_CLOTHING_ITEMS.find(i => i.id === hairId);
          const shoes = ALL_CLOTHING_ITEMS.find(i => i.id === shoeId);
          const equipped: Record<string, any> = {};
          if (shirt) equipped[shirt.type] = shirt;
          if (pants) equipped[pants.type] = pants;
          if (hair) equipped[hair.type] = hair;
          if (shoes) equipped[shoes.type] = shoes;
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
          if (hair) owned.add(hair.id);
          if (shoes) owned.add(shoes.id);
          await AsyncStorage.setItem(
            'ownedClothing',
            JSON.stringify([...owned]),
          );
          // Notify UserAvatar / avatarSync so the new wardrobe is picked up
          // by every screen and pushed to the backend immediately.
          DeviceEventEmitter.emit('bisetka:avatarUpdated');
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

  const renderSlide = ({item}: {item: Slide}) => {
    // Language selection slide
    if (item.isLanguageSlide) {
      return (
        <ImageBackground
          source={WelcomeBackground}
          resizeMode="cover"
          style={slideStyles.welcomeBg}>
          <View style={slideStyles.welcomeOverlay} />
          <SafeAreaView style={slideStyles.usernameSafe} edges={['top', 'bottom', 'left', 'right']}>
            <View style={slideStyles.usernameMiddle}>
              <Text style={slideStyles.slideEmoji}>{item.emoji}</Text>
              <Text style={slideStyles.slideTitle}>{item.title}</Text>
              <Text style={slideStyles.slideDescription}>{item.description}</Text>

              {/* Language Selection Grid */}
              <View style={slideStyles.languageGrid}>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      slideStyles.languageButton,
                      selectedLanguage === lang.code && slideStyles.languageButtonActive,
                    ]}
                    onPress={() => handleLanguageSelect(lang.code)}
                  >
                    <Text style={slideStyles.languageLabel}>{lang.label}</Text>
                    {selectedLanguage === lang.code && (
                      <View style={slideStyles.checkmark}>
                        <Text style={slideStyles.checkmarkText}>{'\u2713'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={slideStyles.languageHint}>
                You can change this anytime in Settings.
              </Text>
            </View>

            <View style={slideStyles.usernameBottomRow}>
              <View style={slideStyles.usernameDotsRow}>
                {slides.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      slideStyles.usernameDot,
                      index === currentIndex && slideStyles.usernameDotActive,
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleNext}
                style={slideStyles.usernameContinue}>
                <Text style={slideStyles.usernameContinueText}>CONTINUE</Text>
                <Text style={slideStyles.usernameContinueArrow}>{'›'}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ImageBackground>
      );
    }

    // First slide is a full-bleed welcome splash (Bisetka background, logo,
    // tagline, single purple "Get Started" CTA that advances to slide 2).
    if (item.isWelcomeSlide) {
      return (
        <ImageBackground
          source={WelcomeBackground}
          resizeMode="cover"
          style={slideStyles.welcomeBg}>
          <View style={slideStyles.welcomeOverlay} />
          <SafeAreaView style={slideStyles.welcomeSafe} edges={['top', 'bottom', 'left', 'right']}>
            <View style={slideStyles.welcomeContent}>
              <LogoWhite width={260} height={120} style={slideStyles.welcomeLogo} />
              <Text style={slideStyles.welcomeTitle}>{item.title}</Text>
              <Text style={slideStyles.welcomeSubtitle}>{item.description}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleNext}
              style={slideStyles.welcomeCta}>
              <Text style={slideStyles.welcomeCtaText}>Get Started</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </ImageBackground>
      );
    }

    // Username slide — second screen in the flow. Full-bleed Bisetka background,
    // framed logo at the top, glass card with the username input, and a
    // dots-left / Continue-right footer that mirrors the mockup exactly.
    if (item.isUsernameSlide) {
      const canContinue = !!available && !submitting;
      return (
        <ImageBackground
          source={WelcomeBackground}
          resizeMode="cover"
          style={slideStyles.welcomeBg}>
          <View style={slideStyles.welcomeOverlay} />
          <SafeAreaView style={slideStyles.usernameSafe} edges={['top', 'bottom', 'left', 'right']}>
            <KeyboardAvoidingView
              style={{flex: 1}}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={slideStyles.usernameTop}>
                <LogoWhite width={140} height={64} />
              </View>

              <View style={slideStyles.usernameMiddle}>
                <Text style={slideStyles.usernameTitle}>{item.title}</Text>
                <Text style={slideStyles.usernameSubtitle}>{item.description}</Text>

                <View style={slideStyles.usernameCard}>
                  <View style={slideStyles.usernameInputWrap}>
                    <TextInput
                      style={slideStyles.usernameInputV2}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Enter your username"
                      placeholderTextColor="rgba(60,40,80,0.55)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                    />
                    {checking && (
                      <ActivityIndicator
                        size="small"
                        color="#7c3aed"
                        style={slideStyles.usernameSpinner}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      slideStyles.usernameHelper,
                      available === true && {color: '#22c55e'},
                      available === false && {color: '#ef4444'},
                    ]}>
                    {username.length >= 3 && usernameMessage
                      ? usernameMessage
                      : '3–20 characters. letters, numbers and underscores only'}
                  </Text>
                </View>
              </View>

              <View style={slideStyles.usernameBottomRow}>
                <View style={slideStyles.usernameDotsRow}>
                  {slides.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        slideStyles.usernameDot,
                        index === currentIndex && slideStyles.usernameDotActive,
                      ]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!canContinue}
                  onPress={handleNext}
                  style={[
                    slideStyles.usernameContinue,
                    !canContinue && {opacity: 0.5},
                  ]}>
                  <Text style={slideStyles.usernameContinueText}>CONTINUE</Text>
                  <Text style={slideStyles.usernameContinueArrow}>{'›'}</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </ImageBackground>
      );
    }

    // Character creator — third onboarding screen. Combined gender toggle +
    // 3-column avatar grid using the SVG "yellow" avatars from
    // assets/avatars_new/Avatars (delivered via NEW_BASE_AVATARS).
    if (item.isCharacterSlide) {
      const activeGender: 'male' | 'female' = selectedGender ?? 'male';
      const charAvatars = ALL_BASE_AVATARS.filter(a => a.gender === activeGender);
      const cellSize = Math.floor((screenWidth - 24 * 2 - 12 * 2) / 3);
      const canContinue = !!selectedGender && !!selectedAvatarId;
      return (
        <ImageBackground
          source={WelcomeBackground}
          resizeMode="cover"
          style={slideStyles.welcomeBg}>
          <View style={slideStyles.welcomeOverlay} />
          <SafeAreaView style={slideStyles.charSafe} edges={['top', 'bottom', 'left', 'right']}>
            <View style={slideStyles.charHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (currentIndex > 0) {
                    flatListRef.current?.scrollToIndex({index: currentIndex - 1, animated: true});
                  }
                }}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
                style={slideStyles.charBack}>
                <Text style={slideStyles.charBackArrow}>{'‹'}</Text>
              </TouchableOpacity>
              <LogoWhite width={140} height={64} />
              <View style={{width: 32}} />
            </View>

            <Text style={slideStyles.charTitle}>{item.title}</Text>
            <Text style={slideStyles.charSubtitle}>{item.description}</Text>

            <View style={slideStyles.genderToggle}>
              {(['male', 'female'] as const).map(g => {
                const active = activeGender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedGender(g);
                      const firstForGender = ALL_BASE_AVATARS.find(a => a.gender === g)?.id ?? null;
                      setSelectedAvatarId(firstForGender);
                    }}
                    style={[
                      slideStyles.genderToggleItem,
                      active && slideStyles.genderToggleItemActive,
                    ]}>
                    {active && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          { backgroundColor: '#a78bfa' },
                        ]}
                      />
                    )}
                    <Text style={slideStyles.genderToggleText}>
                      {g === 'female' ? 'Female' : 'Male'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FlatList
              data={charAvatars}
              numColumns={3}
              keyExtractor={a => a.id}
              contentContainerStyle={slideStyles.charGridContent}
              columnWrapperStyle={slideStyles.charGridRow}
              showsVerticalScrollIndicator={false}
              style={{flex: 1}}
              renderItem={({item: avatar}) => {
                const selected = selectedAvatarId === avatar.id;
                // Show each avatar wearing their starter outfit so the grid
                // matches what the user actually begins the game with.
                // Derive gender + build from the avatar itself (not the
                // screen-level `selectedGender`, which can be stale/null on
                // first paint and would fall back to male clothing).
                const avatarGender = (avatar as any)?.gender as string | undefined;
                const build = (avatar as any)?.build as string | undefined;
                const shirtId = getStarterShirtIdForAvatar(avatarGender, build);
                const pantsId = getStarterPantsIdForAvatar(avatarGender, build);
                const hairId = getStarterHairIdForAvatar(avatarGender);
                const shoeId = getStarterShoeIdForAvatar(avatarGender);
                const equipped: Record<string, any> = {};
                const shirt = ALL_CLOTHING_ITEMS.find(i => i.id === shirtId);
                const pants = ALL_CLOTHING_ITEMS.find(i => i.id === pantsId);
                const hair = ALL_CLOTHING_ITEMS.find(i => i.id === hairId);
                const shoes = ALL_CLOTHING_ITEMS.find(i => i.id === shoeId);
                if (shirt) equipped[shirt.type] = shirt;
                if (pants) equipped[pants.type] = pants;
                if (hair) equipped[hair.type] = hair;
                if (shoes) equipped[shoes.type] = shoes;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSelectedAvatarId(avatar.id)}
                    style={[
                      slideStyles.charCell,
                      {width: cellSize, height: cellSize},
                      selected && slideStyles.charCellSelected,
                    ]}>
                    <AvatarPreview
                      baseAvatar={avatar}
                      equipped={equipped}
                      size={cellSize - 12}
                    />
                  </TouchableOpacity>
                );
              }}
            />

            <View style={slideStyles.usernameBottomRow}>
              <View style={slideStyles.usernameDotsRow}>
                {slides.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      slideStyles.usernameDot,
                      index === currentIndex && slideStyles.usernameDotActive,
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!canContinue}
                onPress={handleNext}
                style={[
                  slideStyles.usernameContinue,
                  !canContinue && {opacity: 0.5},
                ]}>
                <Text style={slideStyles.usernameContinueText}>CONTINUE</Text>
                <Text style={slideStyles.usernameContinueArrow}>{'›'}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ImageBackground>
      );
    }

    // Notifications splash — fourth and final onboarding screen. Mock iOS
    // banner, gradient "Enable Notifications" CTA, and "Get Started!" pill
    // that completes onboarding.
    if (item.isNotificationSlide) {
      const submittingDisabled =
        submitting ||
        (needsUsernameSelection && (!available || !selectedGender || !selectedAvatarId));
      return (
        <ImageBackground
          source={WelcomeBackground}
          resizeMode="cover"
          style={slideStyles.welcomeBg}>
          <View style={slideStyles.welcomeOverlay} />
          <SafeAreaView style={slideStyles.notifSafe} edges={['top', 'bottom', 'left', 'right']}>
            <View style={slideStyles.notifHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (currentIndex > 0) {
                    flatListRef.current?.scrollToIndex({
                      index: currentIndex - 1,
                      animated: true,
                    });
                  }
                }}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
                style={slideStyles.charBack}>
                <Text style={slideStyles.charBackArrow}>{'‹'}</Text>
              </TouchableOpacity>
              <LogoWhite width={140} height={64} />
              <TouchableOpacity
                onPress={handleSkip}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                <Text style={slideStyles.notifSkip}>Skip</Text>
              </TouchableOpacity>
            </View>

            <View style={slideStyles.notifMiddle}>
              <Text style={slideStyles.notifTitle}>{item.title}</Text>
              <Text style={slideStyles.notifSubtitle}>{item.description}</Text>

              {/* Mock iOS notification banner */}
              <View style={slideStyles.notifBanner}>
                <View style={slideStyles.notifBannerIcon}>
                  <LogoWhite width={36} height={36} />
                </View>
                <View style={{flex: 1}}>
                  <View style={slideStyles.notifBannerTopRow}>
                    <Text style={slideStyles.notifBannerApp}>Bisetka</Text>
                    <Text style={slideStyles.notifBannerTime}>9:41 AM</Text>
                  </View>
                  <Text style={slideStyles.notifBannerBody}>
                    Aram invited you to Blot! 🃏
                  </Text>
                </View>
              </View>

              {notificationStatus === 'pending' && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleEnableNotifications}
                  style={slideStyles.notifEnableWrap}>
                  <View style={slideStyles.notifEnable}>
                    <Text style={slideStyles.notifEnableText}>ENABLE NOTIFICATIONS</Text>
                  </View>
                </TouchableOpacity>
              )}
              {notificationStatus === 'granted' && (
                <View style={slideStyles.notifStatusPill}>
                  <Text style={slideStyles.notifStatusPillText}>✅ Notifications enabled!</Text>
                </View>
              )}
              {notificationStatus === 'denied' && (
                <View style={slideStyles.notifStatusPill}>
                  <Text style={[slideStyles.notifStatusPillText, {color: 'rgba(255,255,255,0.8)'}]}>
                    You can enable notifications later in Settings
                  </Text>
                </View>
              )}
              {notificationStatus === 'blocked' && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleOpenSettings}
                  style={slideStyles.notifEnableWrap}>
                  <View
                    style={[
                      slideStyles.notifEnable,
                      { backgroundColor: '#ff8a00' },
                    ]}>
                    <Text style={slideStyles.notifEnableText}>⚙️ OPEN SETTINGS</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            <View style={slideStyles.usernameBottomRow}>
              <View style={slideStyles.usernameDotsRow}>
                {slides.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      slideStyles.usernameDot,
                      index === currentIndex && slideStyles.usernameDotActive,
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={submittingDisabled}
                onPress={handleGetStarted}
                style={[
                  slideStyles.usernameContinue,
                  submittingDisabled && {opacity: 0.5},
                ]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={slideStyles.usernameContinueText}>GET STARTED!</Text>
                    <Text style={slideStyles.usernameContinueArrow}>{'›'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ImageBackground>
      );
    }

    return (
    <KeyboardAvoidingView
      style={slideStyles.slide}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={slideStyles.slideContent}>
        {/* Emoji Icon */}
        <View
          style={[
            slideStyles.iconContainer,
            { backgroundColor: item.gradient?.[0] },
          ]}>
          <Text style={slideStyles.emojiIcon}>{item.emoji}</Text>
        </View>

        {/* Text */}
        <Text style={slideStyles.slideTitle}>{item.title}</Text>
        <Text style={slideStyles.slideDescription}>{item.description}</Text>

        {/* Notification button on notification slide */}
        {item.isNotificationSlide && notificationStatus === 'pending' && (
          <TouchableOpacity
            style={slideStyles.notifButton}
            onPress={handleEnableNotifications}
            activeOpacity={0.8}>
            <View
              style={[
                slideStyles.notifButtonGradient,
                { backgroundColor: '#ee0979' },
              ]}>
              <Text style={slideStyles.notifButtonText}>
                🔔 Enable Notifications
              </Text>
            </View>
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
              <View
                style={[
                  slideStyles.notifButtonGradient,
                  { backgroundColor: '#ee0979' },
                ]}>
                <Text style={slideStyles.notifButtonText}>⚙️ Open Settings</Text>
              </View>
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
              renderItem={({item: avatar}) => {
                // Render each avatar wearing their starter outfit (matches
                // what's auto-equipped on Continue). Use the avatar's own
                // gender/build so each tile is correct.
                const avatarGender = (avatar as any)?.gender as string | undefined;
                const build = (avatar as any)?.build as string | undefined;
                const shirtId = getStarterShirtIdForAvatar(avatarGender, build);
                const pantsId = getStarterPantsIdForAvatar(avatarGender, build);
                const hairId = getStarterHairIdForAvatar(avatarGender);
                const shoeId = getStarterShoeIdForAvatar(avatarGender);
                const equipped: Record<string, any> = {};
                const shirt = ALL_CLOTHING_ITEMS.find(i => i.id === shirtId);
                const pants = ALL_CLOTHING_ITEMS.find(i => i.id === pantsId);
                const hair = ALL_CLOTHING_ITEMS.find(i => i.id === hairId);
                const shoes = ALL_CLOTHING_ITEMS.find(i => i.id === shoeId);
                if (shirt) equipped[shirt.type] = shirt;
                if (pants) equipped[pants.type] = pants;
                if (hair) equipped[hair.type] = hair;
                if (shoes) equipped[shoes.type] = shoes;
                return (
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
                        equipped={equipped}
                        size={Math.floor(((screenWidth - 80) / 3) * 1.4)}
                      />
                    </View>
                    {selectedAvatarId === avatar.id && (
                      <View style={slideStyles.avatarCheckmark}>
                        <Text style={slideStyles.avatarCheckmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
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
  };

  const dotPosition = Animated.divide(scrollX, screenWidth);
  const isLastSlide = currentIndex === slides.length - 1;
  const isWelcome = slides[currentIndex]?.isWelcomeSlide;
  const isUsernameStep = slides[currentIndex]?.isUsernameSlide;
  const isCharacterStep = slides[currentIndex]?.isCharacterSlide;
  const isNotificationStep = slides[currentIndex]?.isNotificationSlide;
  const hidesGlobalChrome = isWelcome || isUsernameStep || isCharacterStep || isNotificationStep;

  return (
    <View
      style={[
        slideStyles.container,
        { backgroundColor: colors.background.primary },
      ]}>
      {/* Slides render full-screen behind any chrome so background images
          extend edge-to-edge under notches and home indicators. */}
      <FlatList
        ref={flatListRef}
        style={StyleSheet.absoluteFill}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        // Force visible slides to re-render when these external state values
        // change (otherwise FlatList memoizes rows and the Continue button on
        // the character slide stays disabled after the user picks an avatar).
        extraData={[
          selectedGender,
          selectedAvatarId,
          available,
          username,
          currentIndex,
          notificationStatus,
        ]}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
      />
      <SafeAreaView style={slideStyles.safeArea} pointerEvents="box-none">
        {/* Header: Skip + Logo. Hidden on full-bleed slides (welcome / username)
            so the design matches the mockup. */}
        {!hidesGlobalChrome && (
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
        )}

        {/* Slides */}
      </SafeAreaView>
    </View>
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
  slideEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  languageGrid: {
    flexDirection: 'column',
    gap: 12,
    marginVertical: 24,
    paddingHorizontal: 16,
    width: '100%',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  languageButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  languageHint: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 16,
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
  // Welcome splash (first onboarding slide)
  welcomeBg: {
    width: screenWidth,
    flex: 1,
    backgroundColor: '#000',
  },
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  welcomeSafe: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeLogo: {
    marginBottom: 28,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  welcomeCta: {
    backgroundColor: '#7c3aed',
    borderRadius: 28,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  welcomeCtaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Username splash (second onboarding slide)
  usernameSafe: {
    flex: 1,
    width: screenWidth,
    paddingHorizontal: 24,
  },
  usernameTop: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  usernameMiddle: {
    flex: 1,
    justifyContent: 'center',
  },
  usernameTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  usernameSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    marginBottom: 28,
  },
  usernameCard: {
    backgroundColor: 'rgba(20,10,30,0.55)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  usernameInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  usernameInputV2: {
    backgroundColor: '#e9def8',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#7c3aed',
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a0b2e',
    fontWeight: '600',
  },
  usernameSpinner: {
    position: 'absolute',
    right: 14,
  },
  usernameHelper: {
    marginTop: 12,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontWeight: '600',
  },
  usernameBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  usernameDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginRight: 6,
  },
  usernameDotActive: {
    width: 22,
    backgroundColor: '#a78bfa',
  },
  usernameContinue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingVertical: 14,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  usernameContinueText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    marginRight: 8,
  },
  usernameContinueArrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  // Character creator splash (third onboarding slide)
  charSafe: {
    flex: 1,
    width: screenWidth,
    paddingHorizontal: 24,
  },
  charHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 12,
  },
  charBack: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charBackArrow: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
  charTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  charSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  genderToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  genderToggleItem: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  genderToggleItemActive: {},
  genderToggleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  charGridContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  charGridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  charCell: {
    backgroundColor: 'rgba(20,10,30,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  charCellSelected: {
    borderColor: '#a78bfa',
    borderWidth: 2,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  // Notifications splash (fourth onboarding slide)
  notifSafe: {
    flex: 1,
    width: screenWidth,
    paddingHorizontal: 24,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 12,
  },
  notifSkip: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notifMiddle: {
    flex: 1,
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  notifSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    marginBottom: 28,
  },
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40,30,55,0.85)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  notifBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifBannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifBannerApp: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  notifBannerTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  notifBannerBody: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    marginTop: 2,
  },
  notifEnableWrap: {
    backgroundColor: '#ff8a00',
    alignSelf: 'center',
    marginTop: 24,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#ff8a00',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  notifEnable: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifEnableText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  notifStatusPill: {
    alignSelf: 'center',
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(56,239,125,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56,239,125,0.35)',
  },
  notifStatusPillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export {ONBOARDING_COMPLETE_KEY, GENDER_KEY};
export default OnboardingScreen;
