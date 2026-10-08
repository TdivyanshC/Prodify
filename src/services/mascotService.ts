import { api } from '../api/client';
import type { MascotEvent, MascotEventType } from '../types/models';

// Which mascot message wins is decided server-side (CLAUDE.md §4) —
// GET /v1/mascot/next returns the top undelivered event plus a quote.

export interface MascotMessage {
  event: MascotEvent | null;
  eventType: MascotEventType;
  quote: string;
}

export const getNextMascotMessage = () => api.get<MascotMessage>('/mascot/next');
export const markMascotEventDelivered = (eventId: string) => api.post(`/mascot/events/${eventId}/delivered`);
