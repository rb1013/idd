import { useEffect, useRef } from 'react';

/**
 * Calls `onComplete(code)` once as soon as `code` reaches `length` characters (e.g. a 6-digit PIN),
 * so the user doesn't have to tap a Verify button.
 *
 * - Fires once per completed code; it won't re-fire for the same value on re-render.
 * - If the code becomes shorter (user deletes, or the screen clears it after a wrong PIN), it's
 *   re-armed, so typing the full code again submits again.
 * - Pass `enabled = false` while a check is already running, or while the input is hidden.
 */
export function useAutoSubmitCode(
  code: string,
  length: number,
  onComplete: (code: string) => void,
  enabled = true,
) {
  const lastSubmitted = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (code.length < length) { lastSubmitted.current = null; return; }
    if (!enabled || code.length !== length || lastSubmitted.current === code) return;
    lastSubmitted.current = code;
    onCompleteRef.current(code);
  }, [code, length, enabled]);
}
