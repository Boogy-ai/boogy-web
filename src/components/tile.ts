// Tile: a card — media above a title and subtitle — for a grid of things to
// choose from. TileGrid lays tiles out in as many columns as fit.
export interface TileAttrs { 'data-boogy': 'tile' }
export function tile(): TileAttrs { return { 'data-boogy': 'tile' }; }
export interface TileGridAttrs { 'data-boogy': 'tile-grid' }
export function tileGrid(): TileGridAttrs { return { 'data-boogy': 'tile-grid' }; }
