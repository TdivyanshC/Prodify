import { api } from '../api/client';
import type { BadgesResponse, CategoriesResponse } from '../api/types';

// Fixed catalogs: the 8 themes and the badge set (stable string ids).
export const getCategories = () => api.get<CategoriesResponse>('/categories');
export const getBadges = () => api.get<BadgesResponse>('/badges');
