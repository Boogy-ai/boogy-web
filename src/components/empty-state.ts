// EmptyState: what a region shows while it has nothing in it yet — a graphic,
// a title, a line saying what belongs here, and the action that adds the
// first thing — centred in the space the region has.
//
// Slots: `media` (the graphic, decorative, shown in a large accent disc),
// `title`, `description`, `action`.

export interface EmptyStateAttrs { 'data-boogy': 'empty-state' }
export function emptyState(): EmptyStateAttrs {
  return { 'data-boogy': 'empty-state' };
}
