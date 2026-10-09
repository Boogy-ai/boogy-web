// Test helper: a screenshot's pixels. Kept out of src/ so it is never bundled
// or published with the package.
import { inflateSync } from 'node:zlib';

/** An 8-bit RGB or RGBA PNG, as the engine's screenshot returns it. */
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgb(x: number, y: number): [number, number, number] } {
  const b = Buffer.from(bytes);
  let pos = 8;
  let width = 0, height = 0, depth = 0, colour = 0;
  const idat: Buffer[] = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString('ascii', pos + 4, pos + 8);
    const data = b.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (colour !== 2 && colour !== 6)) throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}`);
  const bpp = colour === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? out[y * stride + i - bpp] : 0;
      const up = y > 0 ? out[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= bpp ? out[(y - 1) * stride + i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += left;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        v += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out[y * stride + i] = v & 255;
    }
  }
  return { width, height, rgb: (x, y) => [out[y * stride + x * bpp], out[y * stride + x * bpp + 1], out[y * stride + x * bpp + 2]] };
}
