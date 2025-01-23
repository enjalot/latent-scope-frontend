export const mapSelectionDomain = [0, 1, 2, 3, 4];

// these will be used as indexes to map to colors and opacities and sizes
export const mapSelectionKey = {
  normal: 0,
  selected: 1,
  notSelected: 2,
  hovered: 3,
  hidden: 4,
};

export const baseColor = '#b87333';
export const baseColorDark = '#E0EFFF';

export const mapSelectionColorsLight = [
  baseColor,
  baseColor,
  baseColor,
  '#8bcf66', // 3, hovered
  '#fcfbfd', // 99, hidden
];

export const mapSelectionColorsDark = [
  baseColorDark,
  baseColorDark,
  baseColorDark,
  baseColorDark,
  '#fcfbfd', // 99, hidden
];

export const mapSelectionOpacity = [
  0.75, // normal
  0.95, // selected
  0.25, // not selected
  1, // hovered
  0, // hidden
];
export const mapPointSizeRange = [
  3, // normal
  6, // selected
  2, // not selected
  12.5, // hovered
  0, // hidden
];
