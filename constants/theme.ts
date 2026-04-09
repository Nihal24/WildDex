export const DARK_COLORS = {
  background: '#0F0A06',
  card: '#1A1208',
  cardBorder: '#3D2E1E',
  primary: '#A83220',
  yellow: '#FFCB05',
  amber: '#F5A623',
  white: '#F5ECD7',
  grey: '#8A7560',
  darkGrey: '#3D2E1E',
  undiscovered: '#0A0703',
};

export const POKEDEX_COLORS = {
  background: '#0D0505',
  card: '#1A0808',
  cardBorder: '#6B1515',
  primary: '#CC0000',
  yellow: '#FFCB05',
  amber: '#F5A623',
  white: '#F5ECD7',
  grey: '#8A6060',
  darkGrey: '#3D1818',
  undiscovered: '#080303',
};

export const LIGHT_COLORS = {
  background: '#E8E0D8',
  card: '#F2EDE8',
  cardBorder: '#C8BAB0',
  primary: '#CC2200',
  yellow: '#B8860B',
  amber: '#C8820A',
  white: '#1A1008',
  grey: '#6B5C4E',
  darkGrey: '#9A8878',
  undiscovered: '#D4CBC0',
};

export type ColorScheme = typeof DARK_COLORS;

// Static fallback for module-level use — prefer useTheme() in components
export const COLORS = DARK_COLORS;

export const FONTS = {
  title: { fontSize: 24, fontWeight: '800' as const, color: DARK_COLORS.white, letterSpacing: 1 },
  label: { fontSize: 13, fontWeight: '600' as const, color: DARK_COLORS.white },
  sub: { fontSize: 11, color: DARK_COLORS.grey },
};

export const HEADER_FONT = 'PlayfairDisplay_900Black';
