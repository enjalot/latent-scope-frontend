import { ScopeProvider } from '../../../contexts/ScopeContext';
import { FilterProvider } from '../../../contexts/FilterContext';
import DesktopExplore from '../../../pages/DesktopExplore';
import { useSmallScreen } from '../../../hooks/useSmallScreen';

function Components({ initialSearchTerm, initialClusterId = null }) {
  const isSmallScreen = useSmallScreen();

  return (
    <ScopeProvider userParam="jzhang621" datasetParam="ls-founders-1" scopeParam="scopes-003">
      <FilterProvider>
        {isSmallScreen ? (
          <MobileExplore />
        ) : (
          <DesktopExplore
            showVizConfig={false}
            initialClusterId={initialClusterId}
            updateUrlParams={false}
          />
        )}
      </FilterProvider>
    </ScopeProvider>
  );
}

export default Components;
