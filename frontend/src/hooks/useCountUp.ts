import { useEffect, useRef, useState } from 'react';

export function useCountUp(end: number, duration: number = 1000) {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const startTime = Date.now();
    let lastValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.floor(progress * end);

      if (value !== lastValue) {
        setCurrent(value);
        lastValue = value;
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current!);
  }, [end, duration]);

  return current;
}
