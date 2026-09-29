// Card: a summary of one thing — media and a title with a subtitle, a short
// summary, caption lines, and a foot for its actions. CardGrid lays cards out
// in as many columns as fit, never more than three.
export interface CardAttrs { 'data-boogy': 'card' }
export function card(): CardAttrs { return { 'data-boogy': 'card' }; }
export interface CardGridAttrs { 'data-boogy': 'card-grid' }
export function cardGrid(): CardGridAttrs { return { 'data-boogy': 'card-grid' }; }
