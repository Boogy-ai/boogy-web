// Zoom controls: a group of two buttons that make the interface smaller or
// larger, along the zoom ladder. Each shows a letter beside a down or up
// arrow, drawn by the Preact entry's glyphs.
export interface ZoomControlsAttrs { 'data-boogy': 'zoom-controls'; role: 'group' }
export function zoomControls(): ZoomControlsAttrs {
  return { 'data-boogy': 'zoom-controls', role: 'group' };
}
