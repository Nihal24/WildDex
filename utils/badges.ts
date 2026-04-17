import { TaxonomyClass } from './taxonomy';

export const BADGE_NOTIFIED_KEY = 'wilddex_notified_badge_ids';

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  threshold: number;
  color: string;
  type: 'species' | 'category' | 'streak';
  category?: TaxonomyClass;
}

export const BADGES: Badge[] = [
  // ── Species count (total unique species discovered) ──
  { id: 'sprout', type: 'species',  emoji: '🌿', label: 'Sprout',  description: '1 species discovered',   threshold: 1,   color: '#4CAF50' },
  { id: 'spark',  type: 'species',  emoji: '⚡', label: 'Spark',   description: '10 species discovered',  threshold: 10,  color: '#FFC107' },
  { id: 'blaze',  type: 'species',  emoji: '🔥', label: 'Blaze',   description: '50 species discovered',  threshold: 50,  color: '#FF5722' },
  { id: 'summit', type: 'species',  emoji: '🏔️', label: 'Summit',  description: '100 species discovered', threshold: 100, color: '#FFD700' },
  { id: 'legend', type: 'species',  emoji: '🌟', label: 'Legend',  description: '250 species discovered', threshold: 250, color: '#00BCD4' },

  // ── Category (unique species per taxonomic class) ──
  { id: 'wing',  type: 'category', emoji: '🦅', label: 'Wing',  description: '5 bird species discovered',      threshold: 5, color: '#29B6F6', category: 'bird' },
  { id: 'roar',  type: 'category', emoji: '🦁', label: 'Roar',  description: '5 mammal species discovered',    threshold: 5, color: '#FF8F00', category: 'mammal' },
  { id: 'scale', type: 'category', emoji: '🦎', label: 'Scale', description: '5 reptile species discovered',   threshold: 5, color: '#66BB6A', category: 'reptile' },
  { id: 'wave',  type: 'category', emoji: '🌊', label: 'Wave',  description: '5 aquatic species discovered',   threshold: 5, color: '#0288D1', category: 'aquatic' },
  { id: 'buzz',  type: 'category', emoji: '🐝', label: 'Buzz',  description: '5 insect species discovered',    threshold: 5, color: '#F9A825', category: 'insect' },
  { id: 'leap',  type: 'category', emoji: '🐸', label: 'Leap',  description: '5 amphibian species discovered', threshold: 5, color: '#26A69A', category: 'amphibian' },

  // ── Streak (consecutive days with a sighting) ──
  { id: 'ember',   type: 'streak', emoji: '🔆', label: 'Ember',   description: '7-day sighting streak',  threshold: 7,  color: '#FF7043' },
  { id: 'inferno', type: 'streak', emoji: '💥', label: 'Inferno', description: '30-day sighting streak', threshold: 30, color: '#D32F2F' },
];

export type BadgeCounts = {
  species: number;
  byCategory: Partial<Record<TaxonomyClass, number>>;
  streak?: number;
};

export function isBadgeEarned(badge: Badge, counts: BadgeCounts): boolean {
  if (badge.type === 'species') return counts.species >= badge.threshold;
  if (badge.type === 'streak') return (counts.streak ?? 0) >= badge.threshold;
  return (counts.byCategory[badge.category!] ?? 0) >= badge.threshold;
}

export function getEarnedBadges(counts: BadgeCounts): Badge[] {
  return BADGES.filter((b) => isBadgeEarned(b, counts));
}

export function getNextBadge(counts: BadgeCounts): Badge | null {
  return BADGES.find((b) => !isBadgeEarned(b, counts)) ?? null;
}
