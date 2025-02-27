import { useState, useEffect } from 'react';

/**
 * Hook to detect if the screen is smaller than a specified width
 * @param {number} breakpoint - The width in pixels below which a screen is considered small
 * @returns {boolean} - True if the screen width is less than or equal to the breakpoint
 */
export const useSmallScreen = (breakpoint = 1024) => {
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= breakpoint);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= breakpoint);
    };

    // Set initial value
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isSmallScreen;
};
