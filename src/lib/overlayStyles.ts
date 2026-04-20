import type { OverlayStyle } from './types';

export interface OverlayStyleOption {
  value: OverlayStyle;
  label: string;
  description: string;
}

export const OVERLAY_STYLE_OPTIONS: OverlayStyleOption[] = [
  {
    value: 'broadcast',
    label: 'Broadcast',
    description: 'Modern TV scorebug with glossy rails and playoff footer.',
  },
  {
    value: 'classic',
    label: 'Classic',
    description: 'Squared-off network look with silver header and blue body.',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Clean compact bar for creators who want less visual weight.',
  },
  {
    value: 'arena',
    label: 'Arena',
    description: 'Bolder in-venue style with punchier colors and larger scores.',
  },
];

const STYLE_SET = new Set<OverlayStyle>(
  OVERLAY_STYLE_OPTIONS.map((option) => option.value),
);

export function isOverlayStyle(value: string): value is OverlayStyle {
  return STYLE_SET.has(value as OverlayStyle);
}

