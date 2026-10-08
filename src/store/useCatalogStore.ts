import { create } from 'zustand';
import { getBadges, getCategories } from '../services/catalogService';
import type { Badge, SessionCategory } from '../types/models';

interface CatalogState {
  categories: SessionCategory[];
  badges: Badge[];
  load: () => Promise<void>;
}

// The fixed catalogs (8 themes, badge set) — loaded once at sign-in.
export const useCatalogStore = create<CatalogState>((set) => ({
  categories: [],
  badges: [],
  load: async () => {
    const [categories, badges] = await Promise.all([getCategories(), getBadges()]);
    set({ categories: categories.items, badges: badges.items });
  },
}));

export const getCategory = (categoryId: string | undefined) =>
  useCatalogStore.getState().categories.find((c) => c._id === categoryId);
