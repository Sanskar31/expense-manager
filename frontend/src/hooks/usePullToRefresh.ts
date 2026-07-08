import { useEffect, useState } from 'react';

export function usePullToRefresh(onRefresh: () => void) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY);
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      const y = e.touches[0].clientY;
      setCurrentY(y);
    };

    const handleTouchEnd = () => {
      if (!isPulling) return;
      
      const distance = currentY - startY;
      if (distance > 150 && window.scrollY === 0) {
        onRefresh();
      }
      
      setIsPulling(false);
      setStartY(0);
      setCurrentY(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, currentY, isPulling, onRefresh]);
}
