import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';

// Deterministic ObjectId from a readable key ("user:simran"), so seeded ids
// are stable across runs — tests and manual API calls can hardcode them.
export function oid(key: string): ObjectId {
  return new ObjectId(createHash('md5').update(key).digest('hex').slice(0, 24));
}

// Small stable hash, for deterministic picks (e.g. which copy variant).
export function hashInt(key: string): number {
  return parseInt(createHash('md5').update(key).digest('hex').slice(0, 8), 16);
}
