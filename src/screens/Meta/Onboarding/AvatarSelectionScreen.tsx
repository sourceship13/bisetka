import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { BaseAvatar } from '../../../types/avatar2d';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = (width - 60) / 2;

// Real generated avatars matching the game's art style (16 total)
const MOCK_AVATARS: BaseAvatar[] = [
  // MALE AVATARS (8)
  {
    id: 'm1',
    name: 'Bald Beard',
    description: 'Strong & confident',
    imageUrl: require('../../../../assets/avatars/base/male-1-bald-beard.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm2',
    name: 'Curly Beard',
    description: 'Laid-back & friendly',
    imageUrl: require('../../../../assets/avatars/base/male-2-curly-beard.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm3',
    name: 'Athletic',
    description: 'Fit & active',
    imageUrl: require('../../../../assets/avatars/base/male-3-athletic-goatee.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm4',
    name: 'Skinny',
    description: 'Lean & quick',
    imageUrl: require('../../../../assets/avatars/base/male-4-skinny.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm5',
    name: 'Heavy',
    description: 'Big & strong',
    imageUrl: require('../../../../assets/avatars/base/male-5-heavy.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm6',
    name: 'Tall Blonde',
    description: 'Tall & cool',
    imageUrl: require('../../../../assets/avatars/base/male-6-tall-blonde.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 6,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm7',
    name: 'Short Red',
    description: 'Short & stocky',
    imageUrl: require('../../../../assets/avatars/base/male-7-short-red.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 7,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm8',
    name: 'Older Guy',
    description: 'Wise & experienced',
    imageUrl: require('../../../../assets/avatars/base/male-8-older.png'),
    gender: 'male',
    isActive: true,
    displayOrder: 8,
    createdAt: new Date().toISOString(),
  },
  
  // FEMALE AVATARS (8)
  {
    id: 'f1',
    name: 'Ponytail',
    description: 'Athletic & energetic',
    imageUrl: require('../../../../assets/avatars/base/female-1-ponytail.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 9,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'f2',
    name: 'Blonde Bob',
    description: 'Trendy & stylish',
    imageUrl: require('../../../../assets/avatars/base/female-2-blonde-bob.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'f3',
    name: 'Curvy',
    description: 'Confident & bold',
    imageUrl: require('../../../../assets/avatars/base/female-3-curvy.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 11,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'f4',
    name: 'Skinny',
    description: 'Slim & graceful',
    imageUrl: require('../../../../assets/avatars/base/female-4-skinny.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 12,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'f5',
    name: 'Plus Size',
    description: 'Beautiful & confident',
    imageUrl: require('../../../../assets/avatars/base/female-5-plus.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 13,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'f6',
    name: 'Tall Red',
    description: 'Tall & athletic',
    imageUrl: require('../../../../assets/avatars/base/female-6-tall-red.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 14,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'f7',
    name: 'Short Blonde',
    description: 'Petite & cute',
    imageUrl: require('../../../../assets/avatars/base/female-7-short-blonde.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 15,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'f8',
    name: 'Mature',
    description: 'Elegant & wise',
    imageUrl: require('../../../../assets/avatars/base/female-8-mature.png'),
    gender: 'female',
    isActive: true,
    displayOrder: 16,
    createdAt: new Date().toISOString(),
  },
];

export const AvatarSelectionScreen = ({ navigation }: any) => {
  const [avatars, setAvatars] = useState<BaseAvatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with real API call when backend is ready
      // const response = await apiService.get('/avatar/base-avatars');
      // setAvatars(response.data.avatars);
      
      // Using mock data for now
      setTimeout(() => {
        setAvatars(MOCK_AVATARS);
        setLoading(false);
      }, 500);
    } catch (error: any) {
      console.error('Failed to load avatars:', error);
      // Still show mock data on error
      setAvatars(MOCK_AVATARS);
      setLoading(false);
    }
  };

  const selectAvatar = async () => {
    if (!selectedAvatar) {
      BisetkaAlert({
        title: 'Select Avatar',
        message: 'Please choose an avatar to continue',
        type: 'warning',
      });
      return;
    }

    try {
      setSaving(true);
      
      // TODO: Replace with real API call when backend is ready
      // await apiService.post('/avatar/select-base', {
      //   baseAvatarId: selectedAvatar,
      // });
      
      // For now, just save to AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('selectedAvatarId', selectedAvatar);
      
      console.log('Avatar selected:', selectedAvatar);
      
      // Navigate back to home
      navigation.goBack();
    } catch (error: any) {
      BisetkaAlert({
        title: 'Error',
        message: error.message || 'Failed to save avatar',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Avatar</Text>
            <Text style={styles.subtitle}>
              Pick your character to get started
            </Text>
          </View>

          {/* Avatar Grid */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : (
            <View style={styles.avatarGrid}>
              {avatars.map((avatar) => {
                const isSelected = selectedAvatar === avatar.id;

                return (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.avatarCard,
                      isSelected && styles.avatarCardSelected,
                    ]}
                    onPress={() => setSelectedAvatar(avatar.id)}
                  >
                    <Image
                      source={{ uri: avatar.imageUrl }}
                      style={styles.avatarImage}
                      resizeMode="contain"
                    />
                    
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedText}>✓</Text>
                      </View>
                    )}

                    <View style={styles.avatarInfo}>
                      <Text style={styles.avatarName}>{avatar.name}</Text>
                      {avatar.description && (
                        <Text style={styles.avatarDescription}>
                          {avatar.description}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Info Text */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 You can customize your avatar with different outfits later!
            </Text>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedAvatar && styles.continueButtonDisabled,
            ]}
            onPress={selectAvatar}
            disabled={saving || !selectedAvatar}
          >
            <LinearGradient
              colors={
                selectedAvatar
                  ? ['#6366f1', '#8b5cf6']
                  : ['#4b5563', '#6b7280']
              }
              style={styles.continueGradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.continueText}>Continue</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 15,
  },
  avatarCard: {
    width: AVATAR_SIZE,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    padding: 15,
    borderWidth: 3,
    borderColor: 'transparent',
    marginBottom: 15,
  },
  avatarCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  avatarImage: {
    width: '100%',
    height: AVATAR_SIZE - 30,
    marginBottom: 10,
  },
  selectedBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  avatarInfo: {
    alignItems: 'center',
  },
  avatarName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  avatarDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  infoBox: {
    margin: 20,
    padding: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
  },
  continueButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AvatarSelectionScreen;
