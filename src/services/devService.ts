import { api } from '../api/client';
import type { DevAccount } from '../api/types';

// Dev-only: the seeded test accounts the sign-in screen offers (server
// AUTH_MODE=dev). Production has no such endpoint — real Google sign-in.
export const getDevAccounts = () => api.get<{ items: DevAccount[] }>('/dev/accounts');
