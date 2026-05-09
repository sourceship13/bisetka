// 2D Avatar System Types

export type ClothingType =
  | 'hair'
  | 'top'
  | 'jacket'
  | 'bottom'
  | 'shorts'
  | 'shoes'
  | 'jewelry'
  | 'hat'
  | 'other';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type AvatarBuild =
  | 'standard'
  | 'slim'
  | 'athletic'
  | 'muscle'
  | 'fat'
  | 'old';

export interface BaseAvatar {
  id: string;
  name: string;
  description?: string;
  imageUrl: any; // require() result, URL string, or SVG component
  gender: 'male' | 'female';
  build?: AvatarBuild;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface AvatarClothing {
  id: string;
  name: string;
  type: ClothingType;
  description?: string;
  price: number; // in cents
  imageUrl: any; // require() result, URL string, or SVG component
  thumbnailUrl?: string; // Optional thumbnail
  rarity: Rarity;
  isDefault: boolean;
  gender?: 'male' | 'female' | 'unisex';
  build?: AvatarBuild;
  createdAt: string;
}

// Alias for backward compatibility
export type ClothingItem = AvatarClothing;

export interface UserAvatar {
  userId: string;
  baseAvatarId: string;
  selectedAt: string;
}

export interface UserClothingInventory {
  id: string;
  userId: string;
  clothingId: string;
  purchasedAt: string;
}

export interface UserEquippedClothing {
  userId: string;
  hairId?: string;
  topId?: string;
  bottomId?: string;
  shoesId?: string;
  jewelryId?: string;
  hatId?: string;
  otherId?: string;
  updatedAt: string;
}

export interface CompleteAvatar {
  base: BaseAvatar;
  equipped: {
    hair?: AvatarClothing;
    top?: AvatarClothing;
    bottom?: AvatarClothing;
    shoes?: AvatarClothing;
    jewelry?: AvatarClothing;
    hat?: AvatarClothing;
    other?: AvatarClothing;
  };
}
