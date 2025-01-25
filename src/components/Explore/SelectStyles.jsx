export const selectStyles = {
  control: (baseStyles, state) => ({
    ...baseStyles,
    backgroundColor: 'var(--neutrals-color-neutral-0)',
    borderColor: state.isFocused
      ? 'var(--interactions---primary-color-interaction-primary)'
      : 'var(--borders-color-border-1)',
    '&:hover': {
      borderColor: 'var(--interactions---primary-color-interaction-primary-hover)',
    },
    boxShadow: state.isFocused
      ? '0 0 0 1px var(--interactions---primary-color-interaction-primary)'
      : 'none',
  }),
  menu: (baseStyles) => ({
    ...baseStyles,
    backgroundColor: 'var(--neutrals-color-neutral-0)',
    border: '1px solid var(--borders-color-border-1)',
    boxShadow: '0 2px 12px 0 rgba(0, 0, 0, 0.05)',
  }),
  option: (baseStyles, { isFocused, isSelected }) => ({
    ...baseStyles,
    backgroundColor: isSelected
      ? 'var(--interactions---primary-color-interaction-primary)'
      : isFocused
        ? 'var(--neutrals-color-neutral-1)'
        : 'var(--neutrals-color-neutral-0)',
    color: isSelected ? 'var(--text-color-text-reverse)' : 'var(--text-color-text-main)',
    '&:active': {
      backgroundColor: 'var(--interactions---primary-color-interaction-primary-active)',
    },
  }),
  singleValue: (baseStyles) => ({
    ...baseStyles,
    color: 'var(--text-color-text-main)',
  }),
  input: (baseStyles) => ({
    ...baseStyles,
    color: 'var(--text-color-text-main)',
  }),
  placeholder: (baseStyles) => ({
    ...baseStyles,
    color: 'var(--text-color-text-subtle)',
  }),
  indicatorSeparator: (baseStyles) => ({
    ...baseStyles,
    backgroundColor: 'var(--borders-color-border-1)',
  }),
  dropdownIndicator: (baseStyles) => ({
    ...baseStyles,
    color: 'var(--text-color-text-subtle)',
    '&:hover': {
      color: 'var(--text-color-text-main)',
    },
  }),
  clearIndicator: (baseStyles) => ({
    ...baseStyles,
    color: 'var(--text-color-text-subtle)',
    '&:hover': {
      color: 'var(--text-color-text-main)',
    },
  }),
};
