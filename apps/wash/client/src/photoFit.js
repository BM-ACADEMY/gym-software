// Shrinks a photo on the phone to a JPEG under the server's limit (300 KB) before it is uploaded. Browser only (canvas).
// The server checks the size and the real file type again; this only saves the staff from a "too big" message.
export const MAX_BYTES = 300 * 1024;
const QUALITIES = [0.8, 0.65, 0.5];
// Pure: the next picture size to try, starting at 1600 px on the long side and shrinking a quarter each round.
export const sizes = (width, height, rounds = 6) => {
  const out = []; let scale = Math.min(1, 1600 / Math.max(width, height, 1));
  for (let i = 0; i < rounds; i += 1) { out.push({ w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }); scale *= 0.75; }
  return out;
};
export async function fitPhoto(file, max = MAX_BYTES) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Choose a photo');
  const bmp = await createImageBitmap(file);
  for (const { w, h } of sizes(bmp.width, bmp.height)) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    for (const q of QUALITIES) { const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q)); if (blob && blob.size <= max) return blob; }
  }
  throw new Error('This photo could not be made small enough. Try another photo.');
}
