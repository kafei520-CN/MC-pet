export function packIndexKey(dir) {
  const clean = String(dir ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!clean || clean === 'assets') {
    return ''
  }
  if (clean.startsWith('assets/')) {
    return clean.slice('assets/'.length)
  }
  return clean
}
