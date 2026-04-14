/**
 * useRepeatButton — press-and-hold repeat for +/- buttons
 * Fires the callback immediately on press, then repeats after a delay.
 */
import { useCallback, useRef } from "react";

const INITIAL_DELAY = 500; // ms before repeat starts
const REPEAT_INTERVAL = 80; // ms between repeats

export function useRepeatButton(callback: () => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      callback();
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(callback, REPEAT_INTERVAL);
      }, INITIAL_DELAY);
    },
    [callback]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      callback();
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(callback, REPEAT_INTERVAL);
      }, INITIAL_DELAY);
    },
    [callback]
  );

  return {
    onMouseDown,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart,
    onTouchEnd: clear,
  };
}
