// Old PNG clothing assets have been replaced with the new SVG-based catalog
// from `bisetka/assets/avatars_new/`. This file just re-exports the new data
// so all existing imports of `ALL_CLOTHING_ITEMS` keep working.
import { NEW_CLOTHING_ITEMS, NEW_BASE_AVATARS } from './avatarsNew';
import { AvatarClothing, BaseAvatar } from '../types/avatar2d';

export const ALL_CLOTHING_ITEMS: AvatarClothing[] = NEW_CLOTHING_ITEMS;
export const ALL_BASE_AVATARS: BaseAvatar[] = NEW_BASE_AVATARS;
