export interface StageTheme {
  id: string;
  name: string;
  banner: string;
  backdrop: string;
  floor: string;
  accent: string;
  light: string;
  crowdDensity: number;
  props: string[];
}
export const themes: Record<string, StageTheme> = {
  festival: {
    id: 'festival',
    name: 'Thiruvizha Night',
    banner: 'வாங்க பாடலாம் · VANGA PAADALAAM',
    backdrop: '#10103e',
    floor: '#21184c',
    accent: '#ffb52e',
    light: '#ff39a8',
    crowdDensity: 240,
    props: ['kolam', 'bulbs', 'speakers', 'garlands'],
  },
  theatre: {
    id: 'theatre',
    name: 'FDFS Theatre',
    banner: 'FIRST DAY · FIRST SHOW',
    backdrop: '#260f20',
    floor: '#32121d',
    accent: '#efc14b',
    light: '#ef354f',
    crowdDensity: 190,
    props: ['screen', 'spotlights', 'fan-banners', 'confetti'],
  },
};
export const playerTokens = [
  { color: '#ff4f94', shape: 'circle' },
  { color: '#42d9ce', shape: 'triangle' },
  { color: '#ffc247', shape: 'square' },
  { color: '#9e89ff', shape: 'diamond' },
  { color: '#7ee26a', shape: 'star' },
];
