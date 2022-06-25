import { setIcon } from 'obsidian';

import { c } from '../helpers';

interface IconProps {
  name: string;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <span
      data-icon={name}
      className={`${c('icon')} ${className || ''}`}
      ref={(c) => {
        if (c) {
          setIcon(c, name);
        }
      }}
    />
  );
}
