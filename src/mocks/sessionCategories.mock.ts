import type { SessionCategory } from '../types/models';

// Themes are predefined by Prodify — users create sessions inside them,
// never new themes (architecture doc §14: "THEMES = predefined by
// Prodify, SESSIONS = created by users").
export const mockSessionCategories: SessionCategory[] = [
  { _id: 'cat_study', name: 'Study', icon: '📚', isCustom: false, createdBy: null },
  { _id: 'cat_coding', name: 'Coding & Tech', icon: '💻', isCustom: false, createdBy: null },
  { _id: 'cat_work', name: 'Work & Career', icon: '💼', isCustom: false, createdBy: null },
  { _id: 'cat_fitness', name: 'Fitness', icon: '🏋️', isCustom: false, createdBy: null },
  { _id: 'cat_move', name: 'Move & Outdoors', icon: '🚶', isCustom: false, createdBy: null },
  { _id: 'cat_wellness', name: 'Wellness', icon: '🧘', isCustom: false, createdBy: null },
  { _id: 'cat_creative', name: 'Creative', icon: '🎨', isCustom: false, createdBy: null },
  { _id: 'cat_growth', name: 'Personal Growth', icon: '🌱', isCustom: false, createdBy: null },
];
