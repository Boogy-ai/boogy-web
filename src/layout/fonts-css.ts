// The foundation's typefaces, self-hosted: every Boogy origin serves these
// files same-origin at {FONTS_PATH}, so an app gets them with no setup, no
// third-party request and no CSP change. Variable fonts (one file covers every
// weight), each split into latin and latin-ext subsets; a browser downloads a
// file only when text on the page needs it. The version is in each file name,
// so a file never changes under its URL and can be cached permanently.
//
// Unica One, the brand wordmark face, has one weight and style (400 normal):
// a bold or italic wordmark is synthesised by the browser, as the console's is.
//
// Figtree, JetBrains Mono, Syne and Unica One are licensed under the SIL Open
// Font License 1.1 (see fonts/LICENSE-*.txt).

export const FONTS_PATH = '/boogy/fonts/';

export const FONT_FILES = [
  'figtree-latin-ext-wght-5.3.0.woff2',
  'figtree-latin-wght-5.3.0.woff2',
  'jetbrains-mono-latin-ext-wght-5.3.0.woff2',
  'jetbrains-mono-latin-wght-5.3.0.woff2',
  'syne-latin-ext-wght-5.3.0.woff2',
  'syne-latin-wght-5.3.0.woff2',
  'unica-one-latin-ext-400-v20.woff2',
  'unica-one-latin-400-v20.woff2',
] as const;

export const FONTS_CSS = `
@font-face {
  font-family: "Figtree";
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
  src: url('/boogy/fonts/figtree-latin-ext-wght-5.3.0.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
}
@font-face {
  font-family: "Figtree";
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
  src: url('/boogy/fonts/figtree-latin-wght-5.3.0.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
}
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 100 800;
  font-display: swap;
  src: url('/boogy/fonts/jetbrains-mono-latin-ext-wght-5.3.0.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
}
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 100 800;
  font-display: swap;
  src: url('/boogy/fonts/jetbrains-mono-latin-wght-5.3.0.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
}
@font-face {
  font-family: "Syne";
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url('/boogy/fonts/syne-latin-ext-wght-5.3.0.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
}
@font-face {
  font-family: "Syne";
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url('/boogy/fonts/syne-latin-wght-5.3.0.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
}
@font-face {
  font-family: "Unica One";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/boogy/fonts/unica-one-latin-ext-400-v20.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
}
@font-face {
  font-family: "Unica One";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/boogy/fonts/unica-one-latin-400-v20.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
}
`;
