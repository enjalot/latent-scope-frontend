import MobileExplore from './MobileExplore';
import DesktopExplore from './DesktopExplore';
import { ScopeProvider } from '../contexts/ScopeContext';
import { FilterProvider } from '../contexts/FilterContext';
import { useSmallScreen } from '../hooks/useSmallScreen';

function FullScreenExplore() {
  const isSmallScreen = useSmallScreen();

  return (
    <ScopeProvider>
      <FilterProvider>{isSmallScreen ? <MobileExplore /> : <DesktopExplore />}</FilterProvider>
    </ScopeProvider>
  );
}

export default FullScreenExplore;
