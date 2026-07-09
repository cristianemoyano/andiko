# Changelog

## [0.44.2](https://github.com/cristianemoyano/andiko/compare/v0.44.1...v0.44.2) (2026-07-09)

### Features

* **storage:** extend sys-admin test with presigned upload, download and preview ([2fc699d](https://github.com/cristianemoyano/andiko/commit/2fc699d4b3e582a9c7f290f4eb61aa5bc464b824))

## [0.44.1](https://github.com/cristianemoyano/andiko/compare/v0.44.0...v0.44.1) (2026-07-09)

### Bug Fixes

* **storage:** fix S3 presigned PUT 403 and server-side test upload ([8937a52](https://github.com/cristianemoyano/andiko/commit/8937a528a19b3187d0e58a06cc588c625dae045f))
* **storage:** fix sys-admin test file delete via query param ([cfda32d](https://github.com/cristianemoyano/andiko/commit/cfda32d463f7e4bc44ebf77b83c79f03f5710af9))
* **storage:** make delete test input parser async for build ([fb6154e](https://github.com/cristianemoyano/andiko/commit/fb6154e393637152f3389e3dadb2881d352cbcd1))

## [0.44.0](https://github.com/cristianemoyano/andiko/compare/v0.43.0...v0.44.0) (2026-07-09)

### Features

* **core:** add make prod-prune for safe VPS disk cleanup ([e2357fa](https://github.com/cristianemoyano/andiko/commit/e2357fa831bb702be0a76bd54d73adc3b458913b))
* **core:** add Terraform module for AWS S3 file storage ([65c5171](https://github.com/cristianemoyano/andiko/commit/65c51717fe367ef4a5dae595717653aa819a16f5))
* **core:** deploy-app for routine releases and Thunderbird mail guide ([5a5c185](https://github.com/cristianemoyano/andiko/commit/5a5c185dbbf2cd663135358df15f4f99e863a305))
* **storage:** add sys-admin storage connectivity test ([aa65ddf](https://github.com/cristianemoyano/andiko/commit/aa65ddface7d09f158f8053b8484253473e1f28f))

### Bug Fixes

* **core:** compare docker image IDs by prefix in prod-prune ([2d56f9c](https://github.com/cristianemoyano/andiko/commit/2d56f9c685bdefed7cac511c79252995835d0497))

## [0.43.0](https://github.com/cristianemoyano/andiko/compare/v0.41.0...v0.43.0) (2026-07-08)

### Features

* **core:** add docker-mailserver to Swarm stack for [@andiko](https://github.com/andiko).cloud ([52cc542](https://github.com/cristianemoyano/andiko/commit/52cc5420931c94bb8fbf129a77c1d6737f058d1c))

### Bug Fixes

* **communications:** tls sni for mailserver and zero-downtime db recovery ([0388f7f](https://github.com/cristianemoyano/andiko/commit/0388f7fe3acafd3cdf137528dc4d3b9c23f0584f))

## [](https://github.com/cristianemoyano/andiko/compare/v0.41.0...vnull) (2026-07-08)

### Features

* **core:** add docker-mailserver to Swarm stack for [@andiko](https://github.com/andiko).cloud ([52cc542](https://github.com/cristianemoyano/andiko/commit/52cc5420931c94bb8fbf129a77c1d6737f058d1c))

### Bug Fixes

* **communications:** tls sni for mailserver and zero-downtime db recovery ([0388f7f](https://github.com/cristianemoyano/andiko/commit/0388f7fe3acafd3cdf137528dc4d3b9c23f0584f))

## [0.41.0](https://github.com/cristianemoyano/andiko/compare/v0.40.0...v0.41.0) (2026-07-08)

### Features

* **auth:** harden terms and privacy after adversarial review ([2e95966](https://github.com/cristianemoyano/andiko/commit/2e9596636f9d250e7d86c7bcc9f794432a444240))
* **auth:** overhaul terms of service and privacy policy legal text ([9e29c89](https://github.com/cristianemoyano/andiko/commit/9e29c89fbfbf2d8650e19a658df0349636fe7f6f))
* **logistics:** add delivery runs to group shipments into routes ([6a4da4d](https://github.com/cristianemoyano/andiko/commit/6a4da4de21ed7f9fc139dcf41b6413ef3bbc92a9))

### Bug Fixes

* **core:** defer cookie consent banner until client mount ([165d588](https://github.com/cristianemoyano/andiko/commit/165d58855fa849918027e89558ad21a339df660c))

## [0.40.0](https://github.com/cristianemoyano/andiko/compare/v0.39.0...v0.40.0) (2026-07-03)

### Features

* **core:** integrate PostHog analytics, errors, and server logs ([2c449c0](https://github.com/cristianemoyano/andiko/commit/2c449c076cd1240670fe1eb2054e72dddb981920))

## [0.39.0](https://github.com/cristianemoyano/andiko/compare/v0.38.0...v0.39.0) (2026-07-03)

### Features

* **auth:** revoke sessions for deactivated users, rate-limit login ([680cdcd](https://github.com/cristianemoyano/andiko/commit/680cdcda490eda2c2d2e68fab834378dca66cf31))
* **auth:** show login throttle in UI and add dev unblock script ([ae42fa4](https://github.com/cristianemoyano/andiko/commit/ae42fa4ff5fabbd6357c7f6c190b4374ec970e52))

### Bug Fixes

* **catalog:** correct listProducts pagination, debounce product search ([d4a54bb](https://github.com/cristianemoyano/andiko/commit/d4a54bbc7d4f28f7697c33eb4aec969db386ae49))
* **core:** close image-proxy SSRF, timing-safe migrate secret check ([a453492](https://github.com/cristianemoyano/andiko/commit/a453492734059255d97cfae44b8453f742b60baf))
* **pos:** hash device tokens at rest, rate-limit and fix PIN verify ([7b465f5](https://github.com/cristianemoyano/andiko/commit/7b465f5b9e98872ed3af3484742d127e3bd6c4d5))

### Performance Improvements

* **accounting:** debounce chart-of-accounts search ([cdda5a1](https://github.com/cristianemoyano/andiko/commit/cdda5a10179c399e0bece93b2f60e30114d363b1))
* **contacts:** debounce search and cancel superseded requests ([9a59ef7](https://github.com/cristianemoyano/andiko/commit/9a59ef7a1dd50d74a2b48d4670d9fcc030f203fb))
* **inventory:** debounce list search and cancel superseded requests ([41ebf52](https://github.com/cristianemoyano/andiko/commit/41ebf52c240e80268bef64ba9c1b49a190b679ad))
* **purchases:** debounce list search and cancel superseded requests ([cb4b2bc](https://github.com/cristianemoyano/andiko/commit/cb4b2bce07af23063d97954e64960037d64175ad))
* **sales:** debounce list search and cancel superseded requests ([e6a2590](https://github.com/cristianemoyano/andiko/commit/e6a2590a99284e34a05ee71a08c9da3da09d9d8f))

## [0.38.0](https://github.com/cristianemoyano/andiko/compare/v0.37.1...v0.38.0) (2026-07-02)

### Features

* **logistics:** add shipments module with fulfillment providers ([73ec66e](https://github.com/cristianemoyano/andiko/commit/73ec66e894e140306324b8cbd263112ed0c99052))
* **logistics:** add shipments UI and sales order integration ([86d5496](https://github.com/cristianemoyano/andiko/commit/86d5496d2796e14d28141f3da74ab5d62a46750f))
* **logistics:** shipment editing, services exclusion and sales workflow ([f5e5db5](https://github.com/cristianemoyano/andiko/commit/f5e5db54c8821d40f2dfc315001a6c54323de239))

## [0.37.1](https://github.com/cristianemoyano/andiko/compare/v0.37.0...v0.37.1) (2026-07-01)

## [0.37.0](https://github.com/cristianemoyano/andiko/compare/v0.36.0...v0.37.0) (2026-07-01)

### Features

* **auth:** add organization terms and conditions setting ([a5ea877](https://github.com/cristianemoyano/andiko/commit/a5ea8770c706b5ca468232c5af0181d9f9093a6b))
* **core:** add por-pagar KPI and top-5 debts widget to panel ([5a63e06](https://github.com/cristianemoyano/andiko/commit/5a63e062951aa67c3262c9f87f27901c7088774b))
* **core:** add public terms of service and privacy policy pages ([0730f43](https://github.com/cristianemoyano/andiko/commit/0730f43e8baf7c1de097ee44b0032e0ea412fdd3))
* **core:** require terms of service acceptance on login ([ed9df86](https://github.com/cristianemoyano/andiko/commit/ed9df86479d7fe1f6295041d369a2925ddb94a8f))
* **core:** scaffold self-hosted cookie consent banner (disabled) ([bb2bc6f](https://github.com/cristianemoyano/andiko/commit/bb2bc6fbcd11219560ac7785407305503ce74771))
* **purchases:** add supplier account statement summaries and payables aging ([6c2cbca](https://github.com/cristianemoyano/andiko/commit/6c2cbcac5d72076ad4cb312db1181e4b1b5daf30))
* **sales:** add receivables aging report ([0bb0d0e](https://github.com/cristianemoyano/andiko/commit/0bb0d0e1f39772828a579faf5efd347e20c53697))
* **sales:** auto-expire overdue quotes and list ones expiring soon ([407bf90](https://github.com/cristianemoyano/andiko/commit/407bf907c63b2644767d000748bdc3fe4c458cc1))

### Bug Fixes

* **core:** align aging filters with panel KPIs and same-day overdue bucket ([cd9dcfc](https://github.com/cristianemoyano/andiko/commit/cd9dcfca4b1cdedd44b3c88594fbe7427baf68f2))

## [0.36.0](https://github.com/cristianemoyano/andiko/compare/v0.35.0...v0.36.0) (2026-07-01)

### Features

* **core:** add Gherkin/Playwright integration test suite with tenant `integration` ([237f132](https://github.com/cristianemoyano/andiko/commit/237f132))
* **core:** expand E2E coverage for catalog, contacts, financials, purchases, and sales list flows ([d7b146a](https://github.com/cristianemoyano/andiko/commit/d7b146a))

### Bug Fixes

* **core:** stabilize integration tests (locators, seed, env) ([ddbbf98](https://github.com/cristianemoyano/andiko/commit/ddbbf98))
* **core:** resolve typecheck errors on integration seed and test steps ([3bde61f](https://github.com/cristianemoyano/andiko/commit/3bde61f))

### Documentation

* **core:** refresh stale docs, GTM runbooks, and integration test roadmap ([5fcd64a](https://github.com/cristianemoyano/andiko/commit/5fcd64a), [dcbe97c](https://github.com/cristianemoyano/andiko/commit/dcbe97c))

## [0.35.0](https://github.com/cristianemoyano/andiko/compare/v0.34.0...v0.35.0) (2026-06-30)

### Features

* **sales:** require catalog lines, branch stock validation, and warehouse-per-branch ([f6cbf39](https://github.com/cristianemoyano/andiko/commit/f6cbf39a0f5d49145e6ff47a5f59d1c0e52ba372))

## [0.34.0](https://github.com/cristianemoyano/andiko/compare/v0.33.0...v0.34.0) (2026-06-30)

### Features

* **inventory:** add transfers, catalog stock load, and import depósito ([142fca8](https://github.com/cristianemoyano/andiko/commit/142fca8729903040bf98163e497a11cd0bc19570))

## [0.33.0](https://github.com/cristianemoyano/andiko/compare/v0.32.0...v0.33.0) (2026-06-30)

### Features

* **core:** add make prod-disk-check for VPS disk diagnostics ([f714507](https://github.com/cristianemoyano/andiko/commit/f71450730770285350505ab350ecc407e6cd7355))
* **core:** add Portainer and Docker log rotation on VPS ([40c5c50](https://github.com/cristianemoyano/andiko/commit/40c5c509bc4ee389440404300d804111c6a1e5d7))
* **core:** add prod-release orchestrated deploy command ([ba3bf5d](https://github.com/cristianemoyano/andiko/commit/ba3bf5dd1d52aafc172f4144ba9263acffd8e909))
* **core:** improve price lists, catalog bulk ops, and onboarding ([cfd37f8](https://github.com/cristianemoyano/andiko/commit/cfd37f86d6ec7b548c66a044113f51eb3460fd54))
* **core:** prompt for release tag in prod-release ([146f131](https://github.com/cristianemoyano/andiko/commit/146f1313aca93633ef9a1ac691b06254af4d3309))

### Bug Fixes

* **core:** detect release tag on VPS without node ([6d5cb84](https://github.com/cristianemoyano/andiko/commit/6d5cb84fbde6188e5b7ea85cc3737e40f13d2f64))
* **core:** keep nginx live configs outside git repo on VPS ([67407f8](https://github.com/cristianemoyano/andiko/commit/67407f8a32d786bf19edeaa396ea20bc9b81d0ca))
* **core:** make Portainer htpasswd readable by nginx worker ([efc952e](https://github.com/cristianemoyano/andiko/commit/efc952ee371047e84ff8a16c29cc6de06e2cedef))
* **core:** restore nginx bootstrap confs in repo for new VPS ([24e9f22](https://github.com/cristianemoyano/andiko/commit/24e9f228155770b39b154364a8957f6078145a78))

## [0.32.0](https://github.com/cristianemoyano/andiko/compare/v0.31.0...v0.32.0) (2026-06-29)

### Features

* **core:** billing dashboard, error pages, and safe module redirects ([5e80c63](https://github.com/cristianemoyano/andiko/commit/5e80c634fc4ed75aad28c3f7aff30f86d7370b18))

### Bug Fixes

* **core:** correct dropbox migration order for production ([754e17f](https://github.com/cristianemoyano/andiko/commit/754e17f59089c22b4d4c28e1e3be662f854dd473))

## [0.31.0](https://github.com/cristianemoyano/andiko/compare/v0.30.0...v0.31.0) (2026-06-29)

### Features

* **core:** structured storage paths and immutable org slug ([113d215](https://github.com/cristianemoyano/andiko/commit/113d215b088eb71e73a13584e3561255a325f22b))

## [0.30.0](https://github.com/cristianemoyano/andiko/compare/v0.29.1...v0.30.0) (2026-06-29)

### Features

* **billing:** meter storage usage (bytes + files) into the billing pipeline ([02362e6](https://github.com/cristianemoyano/andiko/commit/02362e695aabec541ba6a45f39624637f2b02216))
* **core:** add Google Drive storage backend and file UI components ([2056708](https://github.com/cristianemoyano/andiko/commit/205670878026f1ef13375d355403f8dda6f58681))
* **core:** add vendor-agnostic file service with S3 backend and ReBAC sharing ([edb4e8e](https://github.com/cristianemoyano/andiko/commit/edb4e8eea0c1fb42b043c3876ac381bdc3fe4447))
* **core:** dropbox storage, file preview, and purchase attachments ([b6e744b](https://github.com/cristianemoyano/andiko/commit/b6e744b9c3b8f8f16279ea773fad13bd81fe09f7))
* **core:** shared files page and real-time storage billing ([d9b8d38](https://github.com/cristianemoyano/andiko/commit/d9b8d38284847b174abd0aff2bf6ec958a10d651))

## [0.29.1](https://github.com/cristianemoyano/andiko/compare/v0.29.0...v0.29.1) (2026-06-28)

### Bug Fixes

* **sales:** use 24-hour format for order list datetimes ([92d6a5a](https://github.com/cristianemoyano/andiko/commit/92d6a5ab7aa758e51f2f9ecf3412aacb735917bb))

## [0.29.0](https://github.com/cristianemoyano/andiko/compare/v0.28.0...v0.29.0) (2026-06-28)

### Features

* **sales:** add sales:scope_own and improve role permission matrix ([92b6d48](https://github.com/cristianemoyano/andiko/commit/92b6d48f867de96297e85be86354d0f3e83f7f02))

## [0.28.0](https://github.com/cristianemoyano/andiko/compare/v0.26.1...v0.28.0) (2026-06-28)

### Features

* **core:** woocommerce sync, pedidos UX, and ERP capabilities ([fe8b957](https://github.com/cristianemoyano/andiko/commit/fe8b957742c79c831b775c95db1f2d4af978c3f1))

## [](https://github.com/cristianemoyano/andiko/compare/v0.26.1...vnull) (2026-06-28)

### Features

* **core:** woocommerce sync, pedidos UX, and ERP capabilities ([fe8b957](https://github.com/cristianemoyano/andiko/commit/fe8b957742c79c831b775c95db1f2d4af978c3f1))

## [0.26.1](https://github.com/cristianemoyano/andiko/compare/v0.26.0...v0.26.1) (2026-06-28)

### Features

* **accounting:** move Libro IVA and fiscal reports under Contabilidad; unify fiscal access under `accounting:read`

### Bug Fixes

* **core:** use CHECK constraint for woocommerce sales order source ([5f3ed84](https://github.com/cristianemoyano/andiko/commit/5f3ed846350aeb41aa30193284aa9a1f47366ad0))

## [0.26.0](https://127.0.0.1/41729/git/cristianemoyano/compare/v0.25.2...v0.26.0) (2026-06-28)

### Features

* **core:** add prod-create-sysadmin for VPS bootstrap ([d7d6518](https://127.0.0.1/41729/git/cristianemoyano/commit/d7d6518583f2cae407cb5ec6e162b22fe95fe6e4))
* **core:** add VPS bootstrap script for fresh Debian hosts ([1ee8346](https://127.0.0.1/41729/git/cristianemoyano/commit/1ee8346d2fb553651e9ab7cf761f63b8aee4438f))
* **core:** add VPS Docker Swarm production deployment ([390e5b0](https://127.0.0.1/41729/git/cristianemoyano/commit/390e5b005b4917f6a62d4344fc4bbc51197037f6))
* **sales:** add WooCommerce as a stock-sharing sales channel ([7af703e](https://127.0.0.1/41729/git/cristianemoyano/commit/7af703e1ddfd68f552d7ac1b251faa06bff51ecd))

### Bug Fixes

* **core:** copy src/modules into Docker image for prod migrations ([c907488](https://127.0.0.1/41729/git/cristianemoyano/commit/c90748822012731e2309d8ebc88529a891960883))
* **core:** fix Docker build for prod-push ([5fdeb49](https://127.0.0.1/41729/git/cristianemoyano/commit/5fdeb491dc43cf62977271e89f86f7577a7b1ffd))
* **core:** fix python heredoc in build_database_url helper ([4c7e517](https://127.0.0.1/41729/git/cristianemoyano/commit/4c7e5178ae5726c347c2d8db359a6d6901f3b2b2))
* **core:** move nginx SSL templates out of conf.d ([0d6e213](https://127.0.0.1/41729/git/cristianemoyano/commit/0d6e213b046244d851d950cafca04a623ed8f59c))
* **core:** quote-safe BACKUP_GDRIVE_FOLDER in prod env template ([72239be](https://127.0.0.1/41729/git/cristianemoyano/commit/72239be15702ba3be581d83129a80bc52a8dc6c2))
* **core:** url-encode database url for prod migrate and secrets ([1bd5e29](https://127.0.0.1/41729/git/cristianemoyano/commit/1bd5e293ee9751bc90e23ee7410cd7625ee4cf4a))
* **sales:** harden WooCommerce sync against races and waste ([46278b1](https://127.0.0.1/41729/git/cristianemoyano/commit/46278b17d377935ae5c5c081ef162b26239cac7e))

## [0.25.2](https://github.com/cristianemoyano/andiko/compare/v0.25.1...v0.25.2) (2026-06-28)

### Bug Fixes

* **core:** enforce tenant org scope across all API routes ([95fed58](https://github.com/cristianemoyano/andiko/commit/95fed58d9d53312f166c33788ab562ac8e0a274f))

## [0.25.1](https://github.com/cristianemoyano/andiko/compare/v0.25.0...v0.25.1) (2026-06-27)

### Features

* **core:** paginar etiquetas de góndola y estilizar tabla ([1b0c96b](https://github.com/cristianemoyano/andiko/commit/1b0c96b515204e94630591d971716c9175847614))

## [0.25.0](https://github.com/cristianemoyano/andiko/compare/v0.24.0...v0.25.0) (2026-06-27)

### Features

* **core:** progreso en import CSV y conversor WooCommerce ([41420da](https://github.com/cristianemoyano/andiko/commit/41420dae32ed9138bd4c6cddaa21a3e62b35deb2))
* **purchases:** add returns and exchanges (devoluciones a proveedor) ([#89](https://github.com/cristianemoyano/andiko/issues/89)) ([659298a](https://github.com/cristianemoyano/andiko/commit/659298ac25c68c9c17d3108073f6790541aad088))

## [0.24.0](https://github.com/cristianemoyano/andiko/compare/v0.23.0...v0.24.0) (2026-06-27)

### Features

* **sales:** devoluciones y cambios de venta con NC, stock y POS ([b06ef86](https://github.com/cristianemoyano/andiko/commit/b06ef8629520abb20c407e19ab3c5dc58f317eba))

## [0.23.0](https://github.com/cristianemoyano/andiko/compare/v0.22.0...v0.23.0) (2026-06-27)

### Features

* **core:** complete platform SaaS billing with metric allowances ([73df494](https://github.com/cristianemoyano/andiko/commit/73df4945eabea6edc4a4d18d22510dfa020a2cad))

## [0.22.0](https://127.0.0.1/41729/git/cristianemoyano/compare/v0.17.1...v0.22.0) (2026-06-27)

### Features

* **auth:** structured address for branches with reusable AddressFields ([51c6680](https://127.0.0.1/41729/git/cristianemoyano/commit/51c6680cb1193a79adf1697c605b575fce7e8c2c))
* **billing:** add platform SaaS subscription billing module ([64d8814](https://127.0.0.1/41729/git/cristianemoyano/commit/64d881464065f12f02a881aa50fbf3c239b51045))
* **billing:** mobile UI polish, DRY primitives, loading skeletons ([da223aa](https://127.0.0.1/41729/git/cristianemoyano/commit/da223aa8d0ad2b13a5b073a8573c5d116617cb21))
* **core:** gerente billing dashboard and mobile impersonation access ([a7cfd98](https://127.0.0.1/41729/git/cristianemoyano/commit/a7cfd9867babd0016cfb72d68c35238daa1d7669))
* **core:** platform issuer (emisor) details for subscription invoices ([cb38d35](https://127.0.0.1/41729/git/cristianemoyano/commit/cb38d35a9c695c44185ecc7604eec9e978a4b501))
* **core:** snapshot platform issuer onto subscription invoices at issue time ([1385aba](https://127.0.0.1/41729/git/cristianemoyano/commit/1385aba6ff25ba92bd32578a29af4ccbef784f98))
* **mobile:** mobile UX phase 2 — PageBody, MenuPanel, TopBar, DataTable actions ([#77](https://127.0.0.1/41729/git/cristianemoyano/issues/77)) ([96b51f8](https://127.0.0.1/41729/git/cristianemoyano/commit/96b51f8015febdf9799438aceb55fa000d1b5914))
* **pwa:** startup perf + mobile UX improvements ([4d48246](https://127.0.0.1/41729/git/cristianemoyano/commit/4d482468737cd05d7583c5944ff4eb0a48d19443))

### Bug Fixes

* **auth:** re-derive branch address when all structured fields are cleared ([b3abaff](https://127.0.0.1/41729/git/cristianemoyano/commit/b3abaff666f2ac2a71b84541b16209852adff156))
* **billing:** 5 critical bugs — missing awaits, race condition, filter overwrite, missing transaction ([95bb605](https://127.0.0.1/41729/git/cristianemoyano/commit/95bb6055eaca8fe432f7bfd7fc14b645580ad453))
* **billing:** move setLoading inside async IIFE to satisfy react-hooks/set-state-in-effect lint rule ([33c0a33](https://127.0.0.1/41729/git/cristianemoyano/commit/33c0a332842b1cfcd303e08319fca4f67b49251a))
* **core:** fix pre-existing lint errors (prefer-const, stale refs, unused import) ([2776718](https://127.0.0.1/41729/git/cristianemoyano/commit/27767183160be50ad9eafd64dc5816ac5c766e37))
* **core:** show app version in mobile menu panel ([f7252c9](https://127.0.0.1/41729/git/cristianemoyano/commit/f7252c933c3a2ef0b09c42d98c44b585e18cf5e4))
* **pwa:** fix adversarial-review findings — parallelise layout DB calls, fix PullToRefresh bugs, add mobileRender for accessible kebab menu ([5cb6ca7](https://127.0.0.1/41729/git/cristianemoyano/commit/5cb6ca7ad4f16333fb3de3e2a8839e2d2c9ee750))

## [0.21.0](https://127.0.0.1/41729/git/cristianemoyano/compare/v0.17.1...v0.21.0) (2026-06-27)

### Features

* **billing:** add platform SaaS subscription billing module ([64d8814](https://127.0.0.1/41729/git/cristianemoyano/commit/64d881464065f12f02a881aa50fbf3c239b51045))
* **billing:** mobile UI polish, DRY primitives, loading skeletons ([da223aa](https://127.0.0.1/41729/git/cristianemoyano/commit/da223aa8d0ad2b13a5b073a8573c5d116617cb21))
* **mobile:** mobile UX phase 2 — PageBody, MenuPanel, TopBar, DataTable actions ([#77](https://127.0.0.1/41729/git/cristianemoyano/issues/77)) ([96b51f8](https://127.0.0.1/41729/git/cristianemoyano/commit/96b51f8015febdf9799438aceb55fa000d1b5914))
* **pwa:** startup perf + mobile UX improvements ([4d48246](https://127.0.0.1/41729/git/cristianemoyano/commit/4d482468737cd05d7583c5944ff4eb0a48d19443))

### Bug Fixes

* **billing:** 5 critical bugs — missing awaits, race condition, filter overwrite, missing transaction ([95bb605](https://127.0.0.1/41729/git/cristianemoyano/commit/95bb6055eaca8fe432f7bfd7fc14b645580ad453))
* **billing:** move setLoading inside async IIFE to satisfy react-hooks/set-state-in-effect lint rule ([33c0a33](https://127.0.0.1/41729/git/cristianemoyano/commit/33c0a332842b1cfcd303e08319fca4f67b49251a))
* **core:** fix pre-existing lint errors (prefer-const, stale refs, unused import) ([2776718](https://127.0.0.1/41729/git/cristianemoyano/commit/27767183160be50ad9eafd64dc5816ac5c766e37))
* **core:** show app version in mobile menu panel ([f7252c9](https://127.0.0.1/41729/git/cristianemoyano/commit/f7252c933c3a2ef0b09c42d98c44b585e18cf5e4))
* **pwa:** fix adversarial-review findings — parallelise layout DB calls, fix PullToRefresh bugs, add mobileRender for accessible kebab menu ([5cb6ca7](https://127.0.0.1/41729/git/cristianemoyano/commit/5cb6ca7ad4f16333fb3de3e2a8839e2d2c9ee750))

## [0.20.0](https://127.0.0.1/41729/git/cristianemoyano/compare/v0.17.1...v0.20.0) (2026-06-24)

### Features

* **mobile:** mobile UX phase 2 — PageBody, MenuPanel, TopBar, DataTable actions ([#77](https://127.0.0.1/41729/git/cristianemoyano/issues/77)) ([96b51f8](https://127.0.0.1/41729/git/cristianemoyano/commit/96b51f8015febdf9799438aceb55fa000d1b5914))
* **pwa:** startup perf + mobile UX improvements ([4d48246](https://127.0.0.1/41729/git/cristianemoyano/commit/4d482468737cd05d7583c5944ff4eb0a48d19443))

### Bug Fixes

* **core:** fix pre-existing lint errors (prefer-const, stale refs, unused import) ([2776718](https://127.0.0.1/41729/git/cristianemoyano/commit/27767183160be50ad9eafd64dc5816ac5c766e37))
* **core:** show app version in mobile menu panel ([f7252c9](https://127.0.0.1/41729/git/cristianemoyano/commit/f7252c933c3a2ef0b09c42d98c44b585e18cf5e4))
* **pwa:** fix adversarial-review findings — parallelise layout DB calls, fix PullToRefresh bugs, add mobileRender for accessible kebab menu ([5cb6ca7](https://127.0.0.1/41729/git/cristianemoyano/commit/5cb6ca7ad4f16333fb3de3e2a8839e2d2c9ee750))

## [0.19.0](https://github.com/cristianemoyano/andiko/compare/v0.18.0...v0.19.0) (2026-06-24)

### Features

* **pwa:** parallelize ERP layout DB calls to eliminate iPhone black screen on cold start ([703fa79](https://github.com/cristianemoyano/andiko/commit/703fa79))
* **pwa:** fix PullToRefresh bugs — no-lag gesture tracking, stale-ref fix, iOS scroll-lock prevention ([5cb6ca7](https://github.com/cristianemoyano/andiko/commit/5cb6ca7))
* **pwa:** migrate DataTable kebab menu to Radix DropdownMenuItem for keyboard nav and accessibility ([703fa79](https://github.com/cristianemoyano/andiko/commit/703fa79))
* **pwa:** add `actions` role support to GroupedMobileCard ([703fa79](https://github.com/cristianemoyano/andiko/commit/703fa79))
* **pwa:** wire pull-to-refresh in Contactos and Catálogo via PageBody onRefresh prop ([703fa79](https://github.com/cristianemoyano/andiko/commit/703fa79))

## [0.18.0](https://127.0.0.1/37255/git/cristianemoyano/compare/v0.17.1...v0.18.0) (2026-06-23)

### Features

* **mobile:** mobile UX phase 2 — PageBody, MenuPanel, TopBar, DataTable actions ([#77](https://127.0.0.1/37255/git/cristianemoyano/issues/77)) ([96b51f8](https://127.0.0.1/37255/git/cristianemoyano/commit/96b51f8015febdf9799438aceb55fa000d1b5914))

## [0.17.1](https://github.com/cristianemoyano/andiko/compare/v0.17.0...v0.17.1) (2026-06-22)

### Bug Fixes

* **auth:** stop onboarding redirect loop on first login ([8635cb1](https://github.com/cristianemoyano/andiko/commit/8635cb14379ae2ab4b41e7d58c2e7c993c6ed20d))

## [0.17.0](https://github.com/cristianemoyano/andiko/compare/v0.16.0...v0.17.0) (2026-06-22)

### Features

* **auth:** complete onboarding wizard and org user profile names ([1d90a23](https://github.com/cristianemoyano/andiko/commit/1d90a2363f88248089904f002aa36f438c444687))

## [0.16.0](https://github.com/cristianemoyano/andiko/compare/v0.15.0...v0.16.0) (2026-06-22)

### Features

* **core:** revamp POS UX with org branding and ticket-first sale flow ([dc3d139](https://github.com/cristianemoyano/andiko/commit/dc3d139803467785ac3d0ef784b75447dd819453))

### Bug Fixes

* **core:** sync closed cash sessions to cloud reliably ([8fcd1d1](https://github.com/cristianemoyano/andiko/commit/8fcd1d1f0189db6d69af1c244c44e4f33046c065))

## [0.15.0](https://github.com/cristianemoyano/andiko/compare/v0.14.0...v0.15.0) (2026-06-22)

### Features

* **core:** clarify panel KPI trend tooltips ([7d13601](https://github.com/cristianemoyano/andiko/commit/7d13601af7320121161f118a9c2386acfc1ad640))
* **core:** improve pos sales filters, shift duration and license banner ([6175577](https://github.com/cristianemoyano/andiko/commit/617557750d064c1fd47ce717437113efa45cf557))

### Bug Fixes

* **core:** cross-platform pos native rebuild on Windows CI ([1619542](https://github.com/cristianemoyano/andiko/commit/16195424ef9175d98c7e9fcce43eb85a62a58bbb))
* **core:** pin electron version for pos release packaging ([fdab55c](https://github.com/cristianemoyano/andiko/commit/fdab55c2bec08f1e628b0094f52cc24948b96ca4))
* **core:** resolve pos afip cbte collision on erp finalize ([6e5e490](https://github.com/cristianemoyano/andiko/commit/6e5e4909c41edb1718b6f65466af155920619be8))
* **core:** run pos electron-builder from app directory ([0054893](https://github.com/cristianemoyano/andiko/commit/0054893527ac997f5a3300890f979b4f2774c6d1))
* **core:** use packageManager pnpm version in pos release workflow ([62e8269](https://github.com/cristianemoyano/andiko/commit/62e82690d9bd77d3bc52779e352877c43fcfd785))

## [0.14.0](https://github.com/cristianemoyano/andiko/compare/v0.13.0...v0.14.0) (2026-06-21)

### Features

* **core:** integrate electronic scales (balanzas) into POS ([d8206a8](https://github.com/cristianemoyano/andiko/commit/d8206a82ea5f5cfef1e7e281a3328645df63eeac))
* **core:** pos fiscal afip checkout with erp invoice sync ([c5473d8](https://github.com/cristianemoyano/andiko/commit/c5473d8e56c745edbd2f50d951d9772a8d0d67fa))

## [0.13.0](https://github.com/cristianemoyano/andiko/compare/v0.12.0...v0.13.0) (2026-06-21)

### Features

* **core:** org roles, capabilities UI, and panel access control ([f57bff6](https://github.com/cristianemoyano/andiko/commit/f57bff63927c6d2b94b1370ef9554be1e775132d))

## [0.12.0](https://github.com/cristianemoyano/andiko/compare/v0.11.0...v0.12.0) (2026-06-21)

### Features

* **core:** panel analytics, widget customization, and dark mode polish ([892bcbc](https://github.com/cristianemoyano/andiko/commit/892bcbcea3b96ebdf8ec933ae659a0959ca4c9fa))

## [0.11.0](https://github.com/cristianemoyano/andiko/compare/v0.10.0...v0.11.0) (2026-06-21)

### Features

* **core:** mobile panel UX, list tables, and dashboard performance ([d05410f](https://github.com/cristianemoyano/andiko/commit/d05410f0ae12f0b7e849da6c1f4d566a43725a61))

## [0.10.0](https://github.com/cristianemoyano/andiko/compare/v0.9.0...v0.10.0) (2026-06-21)

### Features

* **core:** add PWA support and native mobile loading states ([ceb1d55](https://github.com/cristianemoyano/andiko/commit/ceb1d55c66ff025cdef2cc7d4cb212fa82eda31e))

## [0.9.0](https://github.com/cristianemoyano/andiko/compare/v0.7.0...v0.9.0) (2026-06-21)

### Features

* **core:** add AFIP configuration tab (punto de venta, certificate, contingency) ([53bef41](https://github.com/cristianemoyano/andiko/commit/53bef41744b7eac739574f54887b8658629e0ccf))
* **core:** add AFIP credentials API (paste PEM, redacted status) ([a2dfa4e](https://github.com/cristianemoyano/andiko/commit/a2dfa4e1e63bc0bf82ea58b35a0a77c65fe40db2))
* **core:** add AFIP env config and API routes ([b113dd4](https://github.com/cristianemoyano/andiko/commit/b113dd41cdc7d20c3e4c5f6228fbf04930ec667f))
* **core:** add AfipStatusBadge and AfipDocumentPanel design-system components ([1980da3](https://github.com/cristianemoyano/andiko/commit/1980da3926a0161663e5fa69c90bfc872182a449))
* **core:** add light/dark/system theme support ([41d3fc7](https://github.com/cristianemoyano/andiko/commit/41d3fc70122bcbb3e7fbedc18f20f03ac2b61d30))
* **core:** ignore arca certs ([a75df46](https://github.com/cristianemoyano/andiko/commit/a75df465ff652f2d9ea26957f0b94ad5ccb5a72f))
* **sales:** add AFIP credentials service with encrypted key vault ([7b3856e](https://github.com/cristianemoyano/andiko/commit/7b3856e297e87bd636f842bfa00901680f2b8a23))
* **sales:** add AFIP domain logic (classifier, IVA aggregation, payload) ([dd9983e](https://github.com/cristianemoyano/andiko/commit/dd9983ef7138ab31f4079b69c433e86e22a7dc2b))
* **sales:** add AFIP emission, contingency, libro IVA and debit-note services ([9d09ecd](https://github.com/cristianemoyano/andiko/commit/9d09ecd58afa67c6c221cd8868723ee6fd450a66))
* **sales:** add AFIP fields, debit-note/auth-token/emission models and migrations ([42b3a93](https://github.com/cristianemoyano/andiko/commit/42b3a930ade3ed9a875b5f72c4d755ab869bdde4))
* **sales:** add Libro IVA Ventas and Compras pages ([3baedcc](https://github.com/cristianemoyano/andiko/commit/3baedccd2dc37adea7501e981c3d4e66b5000e46))
* **sales:** add notas de débito frontend (list, create, detail) ([311ebcd](https://github.com/cristianemoyano/andiko/commit/311ebcdccca4097021bce8398e1f248c8861f353))
* **sales:** add per-org afip_credentials model and migration ([09167d8](https://github.com/cristianemoyano/andiko/commit/09167d8a25b37f2bd75f967a7eca52a1a5417984))
* **sales:** add WSAA/WSFE transport adapters via @ramiidv/arca-facturacion ([fabcbb7](https://github.com/cristianemoyano/andiko/commit/fabcbb7a94c0e83d38c03f4f7725cf3db9f705ee))
* **sales:** afip config, emission fixes, and nc/nd printing ([1ffd187](https://github.com/cristianemoyano/andiko/commit/1ffd18717f7a66d7706bb8d5a94f6650eb7b1b7e))
* **sales:** print invoice CAE + QR server-side (reimpresión) ([1925d1c](https://github.com/cristianemoyano/andiko/commit/1925d1cd38a71d30d4ba91cca1b8d600db41c67f))
* **sales:** wire AFIP authorize panel into invoice and credit-note detail ([f3d8275](https://github.com/cristianemoyano/andiko/commit/f3d827571e98fccf2dbe1eaa519e3086cc3b8ba7))

# [0.8.0](https://127.0.0.1/43429/git/cristianemoyano/compare/v0.7.0...v0.8.0) (2026-06-15)


### Features

* **core:** add light/dark/system theme support ([41d3fc7](https://127.0.0.1/43429/git/cristianemoyano/commits/41d3fc70122bcbb3e7fbedc18f20f03ac2b61d30))



## [0.7.1](https://github.com/cristianemoyano/andiko/compare/v0.7.0...v0.7.1) (2026-06-15)

### Bug Fixes

* **core:** add overflow handling to recent invoices widget on panel

## [0.7.0](https://github.com/cristianemoyano/andiko/compare/v0.6.0...v0.7.0) (2026-06-14)

### Features

* **core:** mobile bottom tab bar instead of hamburger ([90fa9e4](https://github.com/cristianemoyano/andiko/commit/90fa9e403f5ac504aacd881ec57e56a571d0bd1f))
* **core:** responsive shell with off-canvas sidebar drawer ([20b7509](https://github.com/cristianemoyano/andiko/commit/20b750938120d7afeeb801328910cdae27324524))

### Bug Fixes

* **accounting:** responsive journal and chart-of-accounts grids ([1c9de7d](https://github.com/cristianemoyano/andiko/commit/1c9de7dabd4bcd8e5fff04f5a3645c418f7d06c4))
* **contacts:** responsive toolbar, form grids and detail rows ([d329069](https://github.com/cristianemoyano/andiko/commit/d3290698ac25fe09edb7f91845c4bd6a6aaac2ed))
* **core:** mobile menu toggle, drawer layering, and panel overflow ([6ce1b16](https://github.com/cristianemoyano/andiko/commit/6ce1b16d19f0ed2b02577cfb83469f1405ca2bf1))
* **core:** responsive grids for onboarding, org admin and config ([e472245](https://github.com/cristianemoyano/andiko/commit/e472245f86c75ce8eaa863c26b63b2d3a2cd7942))
* **inventory:** responsive catalog grids and search inputs ([7643d48](https://github.com/cristianemoyano/andiko/commit/7643d484f9acc181ef4829c556d8a24f0a293e8c))
* **inventory:** responsive search inputs and adjustment grid ([7afb5a6](https://github.com/cristianemoyano/andiko/commit/7afb5a62e3cf4b62dccc08fb2baf59c9d1a99141))
* **purchases:** full-width search inputs on mobile ([2aaba53](https://github.com/cristianemoyano/andiko/commit/2aaba53cd35c2f98d1812e27984dc19b81654cda))
* **sales:** responsive form and detail grids on mobile ([9ed3641](https://github.com/cristianemoyano/andiko/commit/9ed3641d067c8ec6e4247b233597c7651e05e484))

## [0.6.0](https://github.com/cristianemoyano/andiko/compare/v0.5.4...v0.6.0) (2026-06-14)

### Features

* **core:** add org email audit inbox with stored content ([401d790](https://github.com/cristianemoyano/andiko/commit/401d7907e4a3fc04fd2b3e563922edda91562dd0))

## [0.5.4](https://github.com/cristianemoyano/andiko/compare/v0.5.3...v0.5.4) (2026-06-14)

### Features

* **core:** add Gmail SMTP preset and password show/hide toggle ([31329e0](https://github.com/cristianemoyano/andiko/commit/31329e05e7c666058b0a39e090403b8f06465825))

## [0.5.3](https://github.com/cristianemoyano/andiko/compare/v0.5.2...v0.5.3) (2026-06-14)

### Features

* **core:** add SMTP test email to sys-admin email settings ([970bd6e](https://github.com/cristianemoyano/andiko/commit/970bd6e4b36af6a32b43fe7c801efb59b45b1664))

## [0.5.2](https://github.com/cristianemoyano/andiko/compare/v0.5.1...v0.5.2) (2026-06-13)

### Features

* **core:** expand landing into full product page from Claude Design ([5b5bd3e](https://github.com/cristianemoyano/andiko/commit/5b5bd3ea737308266505e8e67e7d2623c1286eee))

## [0.5.1](https://github.com/cristianemoyano/andiko/compare/v0.5.0...v0.5.1) (2026-06-13)

### Features

* **core:** revamp login and show deployed version in UI ([9918f47](https://github.com/cristianemoyano/andiko/commit/9918f47b39d88d53d5c9f24163ed4ab60c09111b))

## [0.5.0](https://github.com/cristianemoyano/andiko/compare/v0.4.0...v0.5.0) (2026-06-13)

### Features

* **accounting:** add Contabilidad foundation module ([e6b2177](https://github.com/cristianemoyano/andiko/commit/e6b21770d84a2836ac72ae2de484c879b706034e))

## [0.4.0](https://github.com/cristianemoyano/andiko/compare/v0.3.0...v0.4.0) (2026-06-13)

### Features

* **core:** communications email module — SMTP config, document templates, send + history ([6f3ce0a](https://github.com/cristianemoyano/andiko/commit/6f3ce0a032c0114f34cd1518440b1e0cdf8f1ffa))

### Code Refactoring

* **core:** move SMTP email config from per-org to global sys-admin level ([08d030f](https://github.com/cristianemoyano/andiko/commit/08d030f))

## [0.3.0](https://github.com/cristianemoyano/andiko/compare/v0.2.8...v0.3.0) (2026-06-12)

### Features

* **core:** add coming soon landing with SEO and contact form ([7016f04](https://github.com/cristianemoyano/andiko/commit/7016f04e40337019af1d68950252177ea162b1ed))
* **core:** configurable print templates per organization ([2e8f0e0](https://github.com/cristianemoyano/andiko/commit/2e8f0e0964920c0d1650a7d3410653c3c9535958))
* **inventory:** add delivery notes backend (remitos de entrega) ([9c762bd](https://github.com/cristianemoyano/andiko/commit/9c762bd90f50199ea3d2fbe5761fdd922e90c637))
* **inventory:** add delivery notes REST API (remitos de entrega) ([fb1e58a](https://github.com/cristianemoyano/andiko/commit/fb1e58ab00c4f0a80c368cfd6f3009b7e3b05b0d))
* **inventory:** add delivery notes UI (remitos de entrega) ([f54fb10](https://github.com/cristianemoyano/andiko/commit/f54fb10d53c1a3ab89a240f87eb422e00d1af380))
* **inventory:** add stock_item_batches table and batch link on movements ([68816b3](https://github.com/cristianemoyano/andiko/commit/68816b3c14d87f2228e922e58a02e8f6d1ca996b))
* **inventory:** batch UI for stock, movements, receipts and adjustments ([8972258](https://github.com/cristianemoyano/andiko/commit/8972258c21e8e65a021039d507ca696ce93acbc0))
* **inventory:** consume batches in FEFO order on outbound movements ([374293f](https://github.com/cristianemoyano/andiko/commit/374293f01b2990c565ab6850c97753535221f35d))
* **inventory:** expose batches endpoint and carry lots through receipts ([dadb909](https://github.com/cristianemoyano/andiko/commit/dadb909c9e11e6f69f5242a809eb18d8ddb77d68))
* **inventory:** register delivery note (remito) in printing module ([079aa38](https://github.com/cristianemoyano/andiko/commit/079aa382f4ca4810c0159cc7166c6fb31435d0e5))

## [0.2.8](https://github.com/cristianemoyano/andiko/compare/v0.2.7...v0.2.8) (2026-06-11)

### Bug Fixes

* **core:** resolve onboarding redirect loop on login ([be890fa](https://github.com/cristianemoyano/andiko/commit/be890fab69594ab80eddb27309bd1bb665287ec4))

## [0.2.7](https://github.com/cristianemoyano/andiko/compare/v0.2.6...v0.2.7) (2026-06-11)

### Features

* **core:** prod db CLI, Vercel analytics, and dashboard fixes ([6eda0dc](https://github.com/cristianemoyano/andiko/commit/6eda0dc49f8705b3255a4135b1ba86759f81fccb))

## [0.2.6](https://github.com/cristianemoyano/andiko/compare/v0.2.5...v0.2.6) (2026-06-11)

### Bug Fixes

* **core:** allow empty-value Select options and fix categories limit on price adjustments ([3bbe0ba](https://github.com/cristianemoyano/andiko/commit/3bbe0bac46da32120c3d122d9acbf6f7e18eb72a))
* **core:** pass pg dialectModule for Vercel serverless Sequelize ([1862fe6](https://github.com/cristianemoyano/andiko/commit/1862fe6b0eff1d3e5979264d4eb5fa12873cd29d))

## [0.2.5](https://github.com/cristianemoyano/andiko/compare/v0.2.4...v0.2.5) (2026-06-11)

### Bug Fixes

* **core:** harden Vercel pnpm install against cache and filter issues ([89afe74](https://github.com/cristianemoyano/andiko/commit/89afe74bc7d476e9a74d31843fddd21982257a63))

## [0.2.4](https://github.com/cristianemoyano/andiko/compare/v0.2.3...v0.2.4) (2026-06-11)

### Bug Fixes

* **core:** regenerate lockfile for hoisted pnpm linker ([0d9ac34](https://github.com/cristianemoyano/andiko/commit/0d9ac34599dfe9ae1f572100d53ef88745df3322))

## [0.2.3](https://github.com/cristianemoyano/andiko/compare/v0.2.2...v0.2.3) (2026-06-11)

### Bug Fixes

* **core:** use hoisted pnpm linker for Vercel serverless deploys ([8e0db00](https://github.com/cristianemoyano/andiko/commit/8e0db0089a52c7ce7f4eb8027c2b73545b6d4f76))

## [0.2.2](https://github.com/cristianemoyano/andiko/compare/v0.2.1...v0.2.2) (2026-06-11)

## [0.2.1](https://github.com/cristianemoyano/andiko/compare/v0.2.0...v0.2.1) (2026-06-11)

### Bug Fixes

* **core:** correct inverted vercel ignoreCommand that canceled real deploys ([8bf7c59](https://github.com/cristianemoyano/andiko/commit/8bf7c59c6033c02f44378061282d29d71c8dcec5))

## 0.2.0 (2026-06-11)

### Features

* **auth:** add login page with design system components and ERP route groups ([88b2abb](https://github.com/cristianemoyano/andiko/commit/88b2abb0e812428fc0500d9f8c47a31ba6d09b0d))
* **auth:** add multi-tenant foundation and DB-backed RBAC ([af3cc5c](https://github.com/cristianemoyano/andiko/commit/af3cc5ca809460c82b4e2b344c8ed9486f336c47))
* **auth:** add NextAuth v5, logger, user model and route protection ([f494051](https://github.com/cristianemoyano/andiko/commit/f494051de3eb0ccaa0a37ec5a5c099bd7e4b65c3))
* **auth:** add user profile page ([69834fc](https://github.com/cristianemoyano/andiko/commit/69834fc0abe384b238b344fb61c4bec200cc4abb))
* **contacts:** add contacts module — migration, model, service and API ([5672b88](https://github.com/cristianemoyano/andiko/commit/5672b880b29c8762f0c5fa2cf1d8104a93559603))
* **contacts:** address management in contact detail ([9921cbb](https://github.com/cristianemoyano/andiko/commit/9921cbb64d7d10a0afdade5ba4fec8e9fb56f1fb))
* **contacts:** contacts list page, create/edit modal, and TopBar breadcrumb ([0f5531d](https://github.com/cristianemoyano/andiko/commit/0f5531d5d289b0d55c244a5b513c73adf9fcc0f4))
* **contacts:** detail page, is_active toggle, and [@source](https://github.com/source) inline brand color fix ([ed5b08d](https://github.com/cristianemoyano/andiko/commit/ed5b08d7a76523e1c2a1ce6157486da83f748ba8))
* **contacts:** fill full width on detail page and update roadmap ([e88e30e](https://github.com/cristianemoyano/andiko/commit/e88e30e5ca6cf6ea0da72e3f58726bcd010619cb))
* **contacts:** payment info CRUD (CBU, alias, banco) ([a5a29e9](https://github.com/cristianemoyano/andiko/commit/a5a29e9ff4f07fc6f77c0b5e35707a673748a88d))
* **contacts:** primary payment info and contact person fields ([0a7c440](https://github.com/cristianemoyano/andiko/commit/0a7c440db9d6e6733941ec5fee4ee0b7febea4c6))
* **core:** add AuditModel base class with created_by/updated_by/deleted_by ([4d9af89](https://github.com/cristianemoyano/andiko/commit/4d9af89739f50c02e8fe4c1b1eee270902baa3e1))
* **core:** add catálogo module (productos, categorías, listas) ([f817807](https://github.com/cristianemoyano/andiko/commit/f8178079f10536629460e44fd66c6ad7545da359))
* **core:** add DataTable component and logout button to Sidebar ([4cafc27](https://github.com/cristianemoyano/andiko/commit/4cafc27fe0c25dc4996af5569536b48366273085))
* **core:** add DS components for sales module ([9f00d48](https://github.com/cristianemoyano/andiko/commit/9f00d48e01fcfb4db69885ccdf4f47773b81b44f))
* **core:** add fetchJson helper and global Sonner toasts ([10e08c1](https://github.com/cristianemoyano/andiko/commit/10e08c1111be39a080c1b8324b586881e2ecf030))
* **core:** add pagination utility and enforce it in list endpoints ([dba6bed](https://github.com/cristianemoyano/andiko/commit/dba6bed567d151c2a7b84fcf47b5b1752423d1dc))
* **core:** add PasswordInput component with show/hide toggle ([8f1358d](https://github.com/cristianemoyano/andiko/commit/8f1358d82b860f8e1403dbe3571459109a47aea1))
* **core:** add Sequelize setup, module structure and env config ([2d204f5](https://github.com/cristianemoyano/andiko/commit/2d204f5356b5511f82ca77f0115ce3c310d68582))
* **core:** add Storybook 10, design system structure and first primitives ([1c756c1](https://github.com/cristianemoyano/andiko/commit/1c756c1611fc53a733de6fcf0d5928f869aa2944))
* **core:** add TablePagination for ERP DataTable lists ([4ec9505](https://github.com/cristianemoyano/andiko/commit/4ec9505ee6a42adc09fcfd6b414024d5afd192ff))
* **core:** cash session — cashier search filter + sync cloud button ([3bbcd43](https://github.com/cristianemoyano/andiko/commit/3bbcd43ad49729eb0174cb57d049e33102346486))
* **core:** cash session open requires cashier selection; history shows sync status ([46c62d0](https://github.com/cristianemoyano/andiko/commit/46c62d02989a446ceffa0194cf89e8c43bcf7f46))
* **core:** complete roadmap Lote 2 sweep ([f5bd3c5](https://github.com/cristianemoyano/andiko/commit/f5bd3c5df1f3f2fe13a6b0d24b2726ff9608d617))
* **core:** deliver sales traceability and account statement reliability ([6b3c006](https://github.com/cristianemoyano/andiko/commit/6b3c0061281157b9e5a634fc638ee16ea28ea51a))
* **core:** document printing module and A4 print views ([3acfcc6](https://github.com/cristianemoyano/andiko/commit/3acfcc6d784062df636870b7a14caa9f5c43c6fe))
* **core:** fetchJson across ERP and contacts CSV import flow ([47dbac7](https://github.com/cristianemoyano/andiko/commit/47dbac7c27d875f2170a98deabb3e2a6251a7072))
* **core:** gondola label printing and POS barcode reader support ([6c9137a](https://github.com/cristianemoyano/andiko/commit/6c9137a7c54126c393061c4005993943607b7c79))
* **core:** harden tenancy + add dev seed tooling ([5a3e750](https://github.com/cristianemoyano/andiko/commit/5a3e7502c9ebba0bc52ac014270327d18db1616f))
* **core:** implement brand identity, Badge and Sidebar components ([eaf7453](https://github.com/cristianemoyano/andiko/commit/eaf7453e8fae1bd724ab33e594458af8db68bd96))
* **core:** onboarding wizard — org setup flow ([9739afa](https://github.com/cristianemoyano/andiko/commit/9739afa85a18b4d6f3154a4a45cbb5294bcba98a))
* **core:** panel general con KPIs, gráficos y filtros por período y sucursal ([264f42b](https://github.com/cristianemoyano/andiko/commit/264f42b6c866b333ab6f4ef0084435adfa353acb))
* **core:** pos — cajero read-only en venta; selector solo en turno de caja ([a84a17f](https://github.com/cristianemoyano/andiko/commit/a84a17f404000b49a6cec29988584cf2653f897d))
* **core:** pos — medios de pago dinámicos, cancelación de venta y mejoras de UX ([b580987](https://github.com/cristianemoyano/andiko/commit/b58098789c7b96c5edc9cb4a26dd21b8188b59c1))
* **core:** pos — product images in sale screen grid ([645dc80](https://github.com/cristianemoyano/andiko/commit/645dc80911c6d960320884d82114a215e9284ca8))
* **core:** pos build pipeline — electron-builder, GitHub Actions release, version in UI ([c93b8b4](https://github.com/cristianemoyano/andiko/commit/c93b8b476f3d9f0f3d23f5df8d30496b4f68bbc6))
* **core:** pos cash sessions — apertura/cierre de turno + sync cloud + vista erp ([68ef2f1](https://github.com/cristianemoyano/andiko/commit/68ef2f1046a80ba1914b6de181a613a5f22aba5e))
* **core:** pos monorepo setup — electron app, device management y sync api ([16f24ca](https://github.com/cristianemoyano/andiko/commit/16f24ca599eda661729c3b0afe482d5fc6d3ca9d))
* **core:** pos sprint 1 — closing report, fullscreen, price list sync ([abdad2a](https://github.com/cristianemoyano/andiko/commit/abdad2a318b734f24894367372056d0216d5e685))
* **core:** roadmap Lote 1 sweep — reports, reconciliation, org settings ([0f16b92](https://github.com/cristianemoyano/andiko/commit/0f16b9230323b383ffeb5be917d35f9be1da49ac))
* **core:** unify cash session screen — active turn + sales totals + close in one flow ([15395ab](https://github.com/cristianemoyano/andiko/commit/15395abd340a03e05730ab273518276c3349daef))
* **core:** vercel deployment setup ([62bb92f](https://github.com/cristianemoyano/andiko/commit/62bb92f255a22a1dc3586fd04c46e0ba1c9686f3))
* **inventory:** add inventory module with warehouses, stock items and movements ([d7b38ff](https://github.com/cristianemoyano/andiko/commit/d7b38ff17442ba785188c37572f19463f2d78ded))
* **inventory:** add minimum stock and expiry MVP on stock items ([31b60c2](https://github.com/cristianemoyano/andiko/commit/31b60c23721e72eb0e10cf5e15d408a6437bbbd9))
* **inventory:** enrich stock/movements UI with product names, order refs and filters ([f3b18ae](https://github.com/cristianemoyano/andiko/commit/f3b18ae2b971c624c122309ad6f5a64b2af4b1fc))
* **inventory:** improve catalog import and variants ([e0c3b34](https://github.com/cristianemoyano/andiko/commit/e0c3b3458d3c12e2447dcf204aa75086023a408c))
* **inventory:** stock alert widgets on dashboard + replenishment list ([8428635](https://github.com/cristianemoyano/andiko/commit/842863581f41c8c720c71e115207af96c76a78b7))
* **purchases:** add purchases module and catalog sub-navigation ([5cc8921](https://github.com/cristianemoyano/andiko/commit/5cc892190d0973980087c2709d87d03a6b9d1519))
* **sales:** add sales backend — quotes, orders, invoices, payments ([ef8644d](https://github.com/cristianemoyano/andiko/commit/ef8644d9e0e0f62e732e909a57985fde34e14386))
* **sales:** allow cancelling draft quotes with clearer validation errors ([e19f999](https://github.com/cristianemoyano/andiko/commit/e19f999388e9d0fd18853e9b27b4d64948cde9b9))
* **sales:** complete UX redesign phases 1-5 ([75c6216](https://github.com/cristianemoyano/andiko/commit/75c6216ea40427c06b4c945ead206b05a42b935a))
* **sales:** notas de crédito internas y cuenta corriente proveedor ([0171e9e](https://github.com/cristianemoyano/andiko/commit/0171e9eb40c1841a6bd03cc765d5dab9256b30b7))

### Bug Fixes

* **auth:** fix proxy export and externalize pg/sequelize/pino from bundler ([ff6a684](https://github.com/cristianemoyano/andiko/commit/ff6a684e0a56ad3e1c55e0cf13db0bb8277fa207))
* **auth:** refresh sys-admin nav after impersonation and cache recent users ([9bcdcb1](https://github.com/cristianemoyano/andiko/commit/9bcdcb1524328575343182df660c19b036322487))
* **auth:** rename middleware to proxy for Next.js 16, add server-only to logger ([fada256](https://github.com/cristianemoyano/andiko/commit/fada2563b70df7096ac9195cac41ec87dc03c71f))
* **auth:** split auth config for Edge/Node — proxy uses auth.config.ts only ([0771117](https://github.com/cristianemoyano/andiko/commit/0771117fa183f3122368ca5475646771ff233aa8))
* **core:** add explicit text-gray-900 to Input component ([cccb19c](https://github.com/cristianemoyano/andiko/commit/cccb19cfafbe21c1b317ea2eb4872eb923df5cb2))
* **core:** cash session sync — fix where clause and isolate sales/sessions errors ([6e26725](https://github.com/cristianemoyano/andiko/commit/6e26725b9625471f8a05b57cf1c52c00ae56e704))
* **core:** close Sequelize pool after migration to prevent hanging process ([94ab0b9](https://github.com/cristianemoyano/andiko/commit/94ab0b9e0ad14f4767e4bda528324ad65ce84d9f))
* **core:** exclude /api/admin from auth middleware ([c2cb4d8](https://github.com/cristianemoyano/andiko/commit/c2cb4d86fd0ad000f4f99724abded950cbb53942))
* **core:** exclude apps/pos from vercel install ([32334f5](https://github.com/cristianemoyano/andiko/commit/32334f555c93bfedc0aad1807be770d80a346245))
* **core:** fix users ([0a5f5a9](https://github.com/cristianemoyano/andiko/commit/0a5f5a9b5272ffb496530a8612ec2f013f3df4ec))
* **core:** fix users ([a824067](https://github.com/cristianemoyano/andiko/commit/a8240671b3415530b909b0172f507483ddc93b72))
* **core:** force-generate brand color utilities with [@source](https://github.com/source) inline in Tailwind v4 ([b7bda4d](https://github.com/cristianemoyano/andiko/commit/b7bda4dbde97948c686edb3eb1b942220ee074db))
* **core:** include pg in Vercel serverless file traces ([93a7108](https://github.com/cristianemoyano/andiko/commit/93a7108c09ba19a1930a0b4155a8b751bf81a5b9))
* **core:** load .env.local in migrate script via tsx --env-file ([6472dd3](https://github.com/cristianemoyano/andiko/commit/6472dd3438a35ea74c53394414cd81ca6d8a07a6))
* **core:** pos — cashier bound to active cash session, not settings ([88fe5cb](https://github.com/cristianemoyano/andiko/commit/88fe5cbe3aa1ef571718f379aae98dd357558901))
* **core:** pos — product card layout with optional inline image ([eda9eb2](https://github.com/cristianemoyano/andiko/commit/eda9eb2038410dc496caa3f1b7542c1075b8f7f8))
* **core:** pos — settings full width; sync surfaces per-session errors ([c4665b8](https://github.com/cristianemoyano/andiko/commit/c4665b8012678a99127b78fdd8af2fa244fd9c28))
* **core:** pos cash sessions sync — use device UUID for pos_device_id FK ([85654ff](https://github.com/cristianemoyano/andiko/commit/85654ff535459fc63f6453c0841a69a8091bf041))
* **core:** pos renderer path — unify build output to dist-electron, add devtools shortcut ([7e69959](https://github.com/cristianemoyano/andiko/commit/7e699592599a641bc1f8bb3c5d9fa40025b372f2))
* **core:** remove server-only from db.ts to allow migrate CLI ([2045b49](https://github.com/cristianemoyano/andiko/commit/2045b49e0616eb2286516d4cb61505f1b1c9d16c))
* **core:** separate [@theme](https://github.com/theme) inline (fonts) from [@theme](https://github.com/theme) (colors) so brand utilities generate correctly ([6f772c5](https://github.com/cristianemoyano/andiko/commit/6f772c5f249e1f5a22881a67247d0fdbaad202a5))
* **core:** suppress hydration warning from browser extensions on body tag ([25ae503](https://github.com/cristianemoyano/andiko/commit/25ae503b6108a4592733c9d2a0cca5cea39d0002))
* **core:** wrap context in object when calling migration up/down ([23ed79e](https://github.com/cristianemoyano/andiko/commit/23ed79e9a871b3ae81f02083277364416b49842c))
* **sales:** use static Branch imports to fix SequelizeEagerLoadingError ([e52be99](https://github.com/cristianemoyano/andiko/commit/e52be99cef7eb1e52c1ff51c951be09243139935))
