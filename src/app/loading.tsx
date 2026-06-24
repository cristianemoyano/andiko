/**
 * Root Suspense fallback — streamed immediately while any async layout or page
 * resolves. The inline <style> sets the correct background colour before the
 * external CSS file is fetched, eliminating the black WebView flash on PWA
 * cold-starts.
 */
export default function Loading() {
  return (
    <>
      {/* Critical background: applied before globals.css parses */}
      <style dangerouslySetInnerHTML={{
        __html: '#_pwa-shell{position:fixed;inset:0;background:#FAFAFA}@media(prefers-color-scheme:dark){#_pwa-shell{background:#18181B}}'
      }} />
      <div id="_pwa-shell" aria-hidden="true" />
    </>
  )
}
