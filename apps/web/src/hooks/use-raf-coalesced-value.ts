import { useEffect, useRef, useState } from "react";
import { RafValueCoalescer } from "@/lib/raf-coalesced-value";

/**
 * While `enabled`, propagates `value` at most once per animation frame.
 * When disabled, returns `value` immediately (catch-up on stream end).
 */
export function useRafCoalescedValue<T>(value: T, enabled: boolean): T {
  const [display, setDisplay] = useState(value);
  const coalescerRef = useRef<RafValueCoalescer<T> | null>(null);

  if (coalescerRef.current === null) {
    coalescerRef.current = new RafValueCoalescer(value, setDisplay);
  }

  useEffect(() => {
    const coalescer = coalescerRef.current!;
    if (!enabled) {
      coalescer.sync(value);
      return;
    }
    coalescer.set(value);
  }, [value, enabled]);

  useEffect(() => {
    return () => {
      coalescerRef.current?.cancel();
    };
  }, []);

  return enabled ? display : value;
}
