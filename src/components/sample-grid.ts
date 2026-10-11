// SampleGrid: one choice from a grid of samples — a pattern, a texture, a
// theme — each a tile the app paints, named for assistive technology and as a
// tooltip. One tab stop, arrow keys between tiles, Enter or Space to choose, as
// ColorPicker's swatches. It shows `rows` rows of tiles and scrolls past them.
export interface SampleGridAttrs { 'data-boogy': 'sample-grid' }
export function sampleGrid(): SampleGridAttrs { return { 'data-boogy': 'sample-grid' }; }
