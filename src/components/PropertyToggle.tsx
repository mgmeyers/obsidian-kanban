import { useCallback, useContext, useRef, useState } from 'preact/compat';
import { t } from 'src/lang/helpers';

import { Icon } from './Icon/Icon';
import { KanbanContext } from './context';
import { c } from './helpers';

interface PropertyToggleItem {
  key: 'show-created-date' | 'show-modified-date' | 'show-status-property' | 'show-tags-property';
  label: string;
}

const propertyItems: PropertyToggleItem[] = [
  { key: 'show-status-property', label: 'Show status' },
  { key: 'show-created-date', label: 'Show created date' },
  { key: 'show-modified-date', label: 'Show modified date' },
  { key: 'show-tags-property', label: 'Show tags' },
];

export function PropertyToggle() {
  const { stateManager } = useContext(KanbanContext);
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLAnchorElement>(null);

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleToggle = useCallback(
    (key: PropertyToggleItem['key']) => {
      const current = stateManager.getSetting(key) !== false;
      stateManager.setState((board) => {
        const settings = { ...board.data.settings, [key]: !current };
        return {
          ...board,
          data: { ...board.data, settings },
        };
      });
    },
    [stateManager]
  );

  return (
    <div className={c('property-toggle-wrapper')}>
      <a
        ref={buttonRef}
        className={`${c('property-toggle-button')} clickable-icon`}
        onClick={toggleDropdown}
        aria-label={t('Properties')}
      >
        <Icon name="lucide-sliders-horizontal" />
      </a>
      {isOpen && (
        <>
          <div className={c('property-toggle-backdrop')} onClick={() => setIsOpen(false)} />
          <div className={c('property-toggle-dropdown')}>
            <div className={c('property-toggle-header')}>{t('Properties')}</div>
            {propertyItems.map((item) => {
              const isChecked = stateManager.getSetting(item.key) !== false;
              return (
                <label key={item.key} className={c('property-toggle-item')}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(item.key)}
                  />
                  <span>{t(item.label as any)}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
