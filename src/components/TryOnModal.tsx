import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image } from 'react-native';
import { BaseAvatar, AvatarClothing } from '../types/avatar2d';
import AvatarPreview from './AvatarPreview';

interface TryOnModalProps {
  visible: boolean;
  onClose: () => void;
  onEquip?: () => void;
  baseAvatar: BaseAvatar | null;
  currentEquipped: Record<string, AvatarClothing>;
  tryingOnItem: AvatarClothing | null;
  isOwned?: boolean;
}

export const TryOnModal: React.FC<TryOnModalProps> = ({
  visible,
  onClose,
  onEquip,
  baseAvatar,
  currentEquipped,
  tryingOnItem,
  isOwned = true,
}) => {
  if (!baseAvatar || !tryingOnItem) return null;

  // Create preview with the new item equipped
  const previewEquipped = {
    ...currentEquipped,
    [tryingOnItem.type]: tryingOnItem,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Try On Preview</Text>
          
          <View style={styles.previewContainer}>
            <View style={styles.comparisonRow}>
              {/* Before */}
              <View style={styles.avatarColumn}>
                <Text style={styles.label}>Before</Text>
                <View style={styles.avatarBox}>
                  <AvatarPreview
                    baseAvatar={baseAvatar}
                    equipped={currentEquipped}
                    size={130}
                  />
                </View>
              </View>

              <Text style={styles.arrow}>→</Text>

              {/* After */}
              <View style={styles.avatarColumn}>
                <Text style={styles.label}>After</Text>
                <View style={styles.avatarBox}>
                  <AvatarPreview
                    baseAvatar={baseAvatar}
                    equipped={previewEquipped}
                    size={130}
                  />
                </View>
              </View>
            </View>

            {/* Item Info */}
            <View style={styles.itemInfo}>
              <Image source={tryingOnItem.imageUrl} style={styles.itemImage} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{tryingOnItem.name}</Text>
                <Text style={styles.itemDesc}>{tryingOnItem.description}</Text>
                <Text style={styles.itemRarity}>{tryingOnItem.rarity.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonRow}>
            {isOwned && onEquip && (
              <TouchableOpacity style={styles.equipButton} onPress={onEquip}>
                <Text style={styles.equipText}>Equip Now</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.closeButton, isOwned && styles.closeButtonSmall]} 
              onPress={onClose}
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  previewContainer: {
    marginBottom: 24,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  avatarColumn: {
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    fontWeight: '600',
  },
  avatarBox: {
    width: 150,
    height: 220,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  arrow: {
    fontSize: 32,
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2d3a',
    borderRadius: 12,
    padding: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#2a2d3a',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  itemRarity: {
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  equipButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  equipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonSmall: {
    flex: 0,
    paddingHorizontal: 32,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TryOnModal;
