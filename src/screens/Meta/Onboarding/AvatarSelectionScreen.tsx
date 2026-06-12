import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useI18n } from '../../../hooks/useI18n';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseAvatar } from '../../../types/avatar2d';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import AssetImage from '../../../components/AssetImage';
import { ALL_BASE_AVATARS } from '../../../data/clothingItems';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = (width - 60) / 2;

// Realistic Cartoon Avatars (5 body types)
const MOCK_AVATARS: BaseAvatar[] = [
  // {
  //   id: 'muscular',
  //   name: 'Muscular',
  //   description: 'Strong & powerful',
  //   imageUrl: require('../../../../assets/avatars/base/male-muscular-bald-style6.png'),
  //   gender: 'male',
  //   isActive: true,
  //   displayOrder: 1,
  //   createdAt: new Date().toISOString(),
  // },
  // {
  //   id: 'athletic',
  //   name: 'Athletic',
  //   description: 'Fit & toned',
  //   imageUrl: require('../../../../assets/avatars/base/male-athletic-bald-style6.png'),
  //   gender: 'male',
  //   isActive: true,
  //   displayOrder: 2,
  //   createdAt: new Date().toISOString(),
  // },
  // {
  //   id: 'average',
  //   name: 'Average',
  //   description: 'Balanced build',
  //   imageUrl: require('../../../../assets/avatars/base/male-average-bald-style6.png'),
  //   gender: 'male',
  //   isActive: true,
  //   displayOrder: 3,
  //   createdAt: new Date().toISOString(),
  // },
  // {
  //   id: 'slim',
  //   name: 'Slim',
  //   description: 'Lean & quick',
  //   imageUrl: require('../../../../assets/avatars/base/male-slim-bald-style6.png'),
  //   gender: 'male',
  //   isActive: true,
  //   displayOrder: 4,
  //   createdAt: new Date().toISOString(),
  // },
  // {
  //   id: 'heavy',
  //   name: 'Heavy',
  //   description: 'Big & bold',
  //   imageUrl: require('../../../../assets/avatars/base/male-fat-bald-style6.png'),
  //   gender: 'male',
  //   isActive: true,
  //   displayOrder: 5,
  //   createdAt: new Date().toISOString(),
  // },
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
      
      // Using bundled SVG avatars for now
      setTimeout(() => {
        setAvatars(ALL_BASE_AVATARS);
        setLoading(false);
      }, 200);
    } catch (error: any) {
      console.error('Failed to load avatars:', error);
      // Still show bundled avatars on error
      setAvatars(ALL_BASE_AVATARS);
      setLoading(false);
    }
  };

  const selectAvatar = async () => {
    if (!selectedAvatar) {
      BisetkaAlert.warning('Select Avatar', 'Please choose an avatar to continue');
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
      BisetkaAlert.error('Error', error.message || 'Failed to save avatar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[styles.gradient, { backgroundColor: '#1a1a2e' }]}
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
                    <AssetImage
                      source={avatar.imageUrl}
                      width={AVATAR_SIZE - 20}
                      height={AVATAR_SIZE - 20}
                      style={styles.avatarImage}
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
            <View
              style={[
                styles.continueGradient,
                { backgroundColor: selectedAvatar ? '#6366f1' : '#4b5563' },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.continueText}>Continue</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
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
    height: AVATAR_SIZE + 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 15,
    borderWidth: 3,
    borderColor: 'transparent',
    marginBottom: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  avatarImage: {
    width: 123,
    height: 280,
    marginBottom: 10,
    alignSelf: 'center',
    resizeMode: 'contain',
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
