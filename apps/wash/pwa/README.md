# Wash app install files (written, not yet tested by a person)

Copy `manifest.webmanifest`, `sw.js` and the three icons into the folder the Wash panel is served from (same level as its `index.html`),
link the manifest from the page (`<link rel="manifest" href="/manifest.webmanifest">`) and register `/sw.js`. The service worker keeps only the
app's own files; it never stores API answers or anything personal. Dev A: open the panel on an Android phone in Chrome, wait for
"Add to Home screen", install, switch on aeroplane mode and open it: the shell opens, data does not.
