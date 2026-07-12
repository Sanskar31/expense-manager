import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => void;
}

const PULL_THRESHOLD = 80;

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [pullingDistance, setPullingDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0 || isRefreshing) return;

      const y = e.touches[0].clientY;
      const distance = y - startY;

      // Only allow pull down
      if (distance > 0 && window.scrollY === 0) {
        // Prevent default browser refresh action
        if (e.cancelable) {
          e.preventDefault();
        }
        
        // Add resistance factor
        const pullDistance = Math.min(distance * 0.4, PULL_THRESHOLD + 20);
        setPullingDistance(pullDistance);
      }
    };

    const handleTouchEnd = () => {
      if (startY === 0) return;

      if (pullingDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullingDistance(PULL_THRESHOLD);
        onRefresh();
        
        // Fake timeout to hide refresh indicator if onRefresh doesn't reload page
        setTimeout(() => {
          setIsRefreshing(false);
          setPullingDistance(0);
        }, 1500);
      } else {
        setPullingDistance(0);
      }

      setStartY(0);
    };

    const element = containerRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });
      
      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [startY, pullingDistance, isRefreshing, onRefresh]);

  return (
    <div ref={containerRef} className="relative min-h-screen">
      <div 
        className="absolute top-0 left-0 w-full flex justify-center items-center overflow-hidden transition-all duration-300"
        style={{ 
          height: `${pullingDistance}px`,
          opacity: pullingDistance / PULL_THRESHOLD
        }}
      >
        <div 
          className="bg-white dark:bg-zinc-800 p-2 rounded-full shadow-md flex items-center justify-center transition-transform"
          style={{ transform: `rotate(${pullingDistance * 2}deg)` }}
        >
          <Loader2 
            className={`w-6 h-6 text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`} 
          />
        </div>
      </div>
      <div 
        className="transition-transform duration-300 min-h-screen"
        style={{ transform: `translateY(${pullingDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
