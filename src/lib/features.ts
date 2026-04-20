export function isTwitchGateEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_TWITCH_GATE === 'true';
}

