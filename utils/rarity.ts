export type RarityTier = 'common' | 'uncommon' | 'rare' | 'ultra_rare' | 'legendary' | 'mythical';

export interface RarityInfo {
  tier: RarityTier;
  label: string;
  color: string;
  emoji: string;
}

export function getRarityFromConservationStatus(status: string): RarityInfo {
  const s = status.toLowerCase();

  if (s.includes('extinct in the wild'))  return { tier: 'mythical',   label: 'Mythical',   color: '#FF1744', emoji: '🔴' };
  if (s.includes('critically endangered')) return { tier: 'legendary',  label: 'Legendary',  color: '#FFD700', emoji: '⭐' };
  if (s.includes('endangered'))            return { tier: 'ultra_rare', label: 'Ultra Rare', color: '#FF6D00', emoji: '🟠' };
  if (s.includes('vulnerable'))            return { tier: 'rare',       label: 'Rare',       color: '#9C27B0', emoji: '🟣' };
  if (s.includes('near threatened'))       return { tier: 'uncommon',   label: 'Uncommon',   color: '#2196F3', emoji: '🔵' };

  // Least Concern, Domesticated, or unknown
  return { tier: 'common', label: 'Common', color: '#4CAF50', emoji: '🟢' };
}
