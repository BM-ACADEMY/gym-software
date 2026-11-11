'use strict';
// Before and after photos of a vehicle. We store only a REFERENCE to where the picture is kept (a storage key), never the
// picture itself in the database. A photo must be compressed on the phone to about 300 KB before it is uploaded.
// The cloud storage account is an owner decision (WSH-P1); until it exists the reference is typed or pasted by the app. Pure.
const MAX_BYTES = 300 * 1024;
const MIME = ['image/jpeg', 'image/webp', 'image/png'];
const KINDS = ['before', 'after'];
const MAX_PER_KIND = 6;
const REF = /^[A-Za-z0-9][A-Za-z0-9/_.-]{2,198}$/;
function checkPhoto(p) {
  if (!p || !KINDS.includes(p.kind)) return { error: 'Choose before or after' };
  const ref = typeof p.ref === 'string' ? p.ref.trim() : '';
  if (!REF.test(ref) || ref.includes('..') || ref.startsWith('/')) return { error: 'The photo reference is not valid' };
  if (!Number.isInteger(p.bytes) || p.bytes < 1) return { error: 'The photo size is missing' };
  if (p.bytes > MAX_BYTES) return { error: 'This photo is too big. Compress it to about 300 KB before uploading.' };
  if (!MIME.includes(p.mime)) return { error: 'Photos can be JPEG, WebP or PNG' };
  return { value: { kind: p.kind, ref, bytes: p.bytes, mime: p.mime } };
}
module.exports = { MAX_BYTES, MIME, KINDS, MAX_PER_KIND, checkPhoto };
