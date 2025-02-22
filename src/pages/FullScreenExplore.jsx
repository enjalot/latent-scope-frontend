import MobileExplore from './MobileExplore';
import DesktopExplore from './DesktopExplore';
import { ScopeProvider } from '../contexts/ScopeContext';
import { FilterProvider } from '../contexts/FilterContext';

import { isMobileDevice } from '../utils';

function FullScreenExplore() {
  const isMobile = isMobileDevice();

  return (
    <ScopeProvider>
      <FilterProvider>{isMobile ? <MobileExplore /> : <DesktopExplore />}</FilterProvider>
    </ScopeProvider>
  );
}

export default FullScreenExplore;
