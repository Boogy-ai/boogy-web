// Zoom controls: a group of two buttons that make the interface smaller or
// larger, along the zoom ladder. Their glyphs are a small and a large letter
// from the body font, so they are crisp at any size.
export interface ZoomControlsAttrs { 'data-boogy': 'zoom-controls'; role: 'group' }
export function zoomControls(): ZoomControlsAttrs {
  return { 'data-boogy': 'zoom-controls', role: 'group' };
}
