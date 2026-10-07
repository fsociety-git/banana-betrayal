import type { ThemeId } from '../../levels/types';

export interface ThemePalette {
  id: ThemeId;
  skyTop: number; skyBottom: number;
  farHills: number; midHills: number; nearTrees: number;
  ground: number; groundDark: number; groundLight: number; grass: number; grassDark: number; outline: number;
  plank: number; plankDark: number;
  water: number; waterLight: number;
  haze: number; hazeAlpha: number;
  particle: number;
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  test: {
    id: 'test', skyTop: 0x4b6b8c, skyBottom: 0xa9c8d8, farHills: 0x6c8aa3, midHills: 0x587a66, nearTrees: 0x3d5e49,
    ground: 0x7a5236, groundDark: 0x5a3a26, groundLight: 0x946a48, grass: 0x6fbf4a, grassDark: 0x4c9a33, outline: 0x2d1b10,
    plank: 0xc98a4b, plankDark: 0x8a5a2b, water: 0x2f6fb5, waterLight: 0x8fc9f0, haze: 0xa9c8d8, hazeAlpha: 0.25, particle: 0xffffff,
  },
  jungle: {
    id: 'jungle', skyTop: 0x3aa0d8, skyBottom: 0xcdefe4, farHills: 0x7fc7b9, midHills: 0x3f9b6a, nearTrees: 0x256b45,
    ground: 0x8a5a36, groundDark: 0x5e3b22, groundLight: 0xa8744a, grass: 0x7ed957, grassDark: 0x4faa3a, outline: 0x2c1a0e,
    plank: 0xd59a55, plankDark: 0x8f5f2e, water: 0x2d8bc7, waterLight: 0x9fe3ff, haze: 0xcdefe4, hazeAlpha: 0.3, particle: 0xf6ffb0,
  },
  swamp: {
    id: 'swamp', skyTop: 0x1d2a3a, skyBottom: 0x5f8a6a, farHills: 0x2f5a4a, midHills: 0x2a6b48, nearTrees: 0x163b2a,
    ground: 0x5b4a33, groundDark: 0x3b3022, groundLight: 0x7a6546, grass: 0x8cc63f, grassDark: 0x5d9129, outline: 0x1b140c,
    plank: 0x9c7a4a, plankDark: 0x624a28, water: 0x4d9d3a, waterLight: 0xb9ff6a, haze: 0x7fd36a, hazeAlpha: 0.35, particle: 0xc8ff7a,
  },
  factory: {
    id: 'factory', skyTop: 0x2b2f4a, skyBottom: 0xd9a066, farHills: 0x4b4f6d, midHills: 0x6f5a4a, nearTrees: 0x3a2f2a,
    ground: 0x6b6f7a, groundDark: 0x474a54, groundLight: 0x8c919e, grass: 0xf2c94c, grassDark: 0xc79a1f, outline: 0x1f2026,
    plank: 0xb8894d, plankDark: 0x7c5a2e, water: 0x3f3f5a, waterLight: 0x7f7fb0, haze: 0xd9a066, hazeAlpha: 0.25, particle: 0xffd27a,
  },
  sky: {
    id: 'sky', skyTop: 0x4f8fe0, skyBottom: 0xe9f3ff, farHills: 0xbcd6f7, midHills: 0x9ec2ef, nearTrees: 0xffffff,
    ground: 0xc9b89a, groundDark: 0x9a8a6e, groundLight: 0xe6d8bb, grass: 0xffffff, grassDark: 0xd7e6fb, outline: 0x4a5a7a,
    plank: 0xe2cfa6, plankDark: 0xa58f69, water: 0x6fb2ff, waterLight: 0xd4ecff, haze: 0xffffff, hazeAlpha: 0.4, particle: 0xffffff,
  },
  hq: {
    id: 'hq', skyTop: 0x1a1024, skyBottom: 0x6a2a44, farHills: 0x3a1a3a, midHills: 0x6b3a2a, nearTrees: 0x2a1a1a,
    ground: 0x6a5a3a, groundDark: 0x443a22, groundLight: 0x9a8a4a, grass: 0xf7c948, grassDark: 0xc49a1a, outline: 0x1a1008,
    plank: 0xd4a84a, plankDark: 0x8a6a1e, water: 0x8a1a2a, waterLight: 0xff6a7a, haze: 0xf7c948, hazeAlpha: 0.2, particle: 0xfff1a8,
  },
};
