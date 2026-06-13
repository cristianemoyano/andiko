# Changelog

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
