import { useEffect, useState } from 'react';
import {
  CREDIT_REVEAL_DURATION_MS,
  CREDIT_REVEAL_INTERVAL_MS,
} from './credit';

export function useCreditReveal(enabled: boolean): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      return;
    }

    let revealTimeoutId: number | undefined;
    let hideTimeoutId: number | undefined;

    function scheduleReveal() {
      revealTimeoutId = window.setTimeout(() => {
        setIsVisible(true);
        hideTimeoutId = window.setTimeout(() => {
          setIsVisible(false);
          scheduleReveal();
        }, CREDIT_REVEAL_DURATION_MS);
      }, CREDIT_REVEAL_INTERVAL_MS);
    }

    scheduleReveal();

    return () => {
      if (revealTimeoutId) {
        window.clearTimeout(revealTimeoutId);
      }

      if (hideTimeoutId) {
        window.clearTimeout(hideTimeoutId);
      }
    };
  }, [enabled]);

  return enabled && isVisible;
}
