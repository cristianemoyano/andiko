/**
 * Stub `server-only` for Node CLI scripts (seed, migrate helpers) that import
 * `@/modules/*` services marked with `import 'server-only'`.
 */
const Module = require('node:module')

const originalLoad = Module._load
Module._load = function cliServerPreload(request, parent, isMain) {
  if (request === 'server-only') {
    return {}
  }
  return originalLoad.apply(this, arguments)
}
