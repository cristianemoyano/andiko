import { useState, useEffect, useRef } from 'react'
import type { PosSale, PosSaleItem, PosProduct, PosCustomer, PosPaymentMethod, BalanzaBarcodeConfig } from '@andiko/shared'
import { parseBalanzaBarcode } from '@andiko/shared'
import { randomUUID } from '../lib/uuid'
import { PosReceipt } from '../components/PosReceipt'
import { PosTicketBrandPanel } from '../components/PosTicketBrandPanel'
import { usePosFiscalProfile } from '../lib/usePosFiscalProfile'
import { usePosCashier } from '../lib/usePosCashier'
import { printPosReceipt } from '../lib/print-receipt'

type CartItem = {
  product: PosProduct
  qty: number               // weight items: fractional kg
  weightItem?: boolean
  lineTotalOverride?: string | null  // set when the scanned label embedded a total price
}

/** Keyboard shortcut badge — neutral styling, readable without competing with actions. */
function ShortcutBadge({ modKey, keyLabel }: { modKey: string; keyLabel: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1"
      aria-label={`Atajo: ${modKey} + ${keyLabel}`}
    >
      <kbd className="min-w-[1.25rem] text-center text-base font-medium text-zinc-600 font-mono leading-none">{modKey}</kbd>
      <span className="text-xs text-zinc-400">+</span>
      <kbd className="min-w-[1rem] text-center text-base font-semibold text-zinc-700 font-mono leading-none">{keyLabel}</kbd>
    </span>
  )
}

/** Final amount charged for a cart line (label price for weight items, else price × qty). */
function lineTotal(i: CartItem): number {
  if (i.lineTotalOverride != null) return parseFloat(i.lineTotalOverride)
  return parseFloat(i.product.price) * i.qty
}

async function loadBalanzaConfig(): Promise<BalanzaBarcodeConfig | null> {
  const s = await window.pos.settings.get()
  const raw = s['balanza_config']
  if (!raw) return null
  try {
    return JSON.parse(raw) as BalanzaBarcodeConfig
  } catch {
    return null
  }
}

function looksLikeBalanzaCode(code: string, cfg: BalanzaBarcodeConfig): boolean {
  return (
    /^\d+$/.test(code) &&
    code.length === cfg.totalLength &&
    (!cfg.prefix || code.startsWith(cfg.prefix))
  )
}

/** Local edit state so kg isn't reformatted on every keystroke. */
function CartWeightInput({
  qtyKg,
  onCommit,
}: {
  qtyKg: number
  onCommit: (kg: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')

  const formatted = qtyKg.toFixed(3)

  function commit() {
    const normalized = text.trim().replace(',', '.')
    if (!normalized) {
      setEditing(false)
      return
    }
    const kg = parseFloat(normalized)
    if (Number.isNaN(kg) || kg <= 0) {
      setEditing(false)
      return
    }
    onCommit(kg)
    setEditing(false)
  }

  return (
    <input
      value={editing ? text : formatted}
      onFocus={(e) => {
        setEditing(true)
        setText(formatted.replace('.', ','))
        e.target.select()
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setEditing(false)
          e.currentTarget.blur()
        }
      }}
      inputMode="decimal"
      className="w-[4.5rem] h-6 px-1 text-right text-[14px] border border-zinc-300 rounded bg-white focus:outline-none focus:border-brand-600"
    />
  )
}


export function SaleScreen({
  resumeDraftId,
  onResumeDraftConsumed,
}: {
  resumeDraftId: string | null
  onResumeDraftConsumed: () => void
}) {
  const modKey = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'
  const fiscal = usePosFiscalProfile()
  const [products, setProducts] = useState<PosProduct[]>([])
  const [search, setSearch]     = useState('')
  const [cart, setCart]         = useState<CartItem[]>([])
  const [saving, setSaving]     = useState(false)
  const [lastSale, setLastSale] = useState<{ total: string } | null>(null)
  const [receiptSale, setReceiptSale] = useState<PosSale | null>(null)
  const [receiptChange, setReceiptChange] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<PosCustomer | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerRows, setCustomerRows] = useState<PosCustomer[]>([])
  const [customerError, setCustomerError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const customerInputRef = useRef<HTMLInputElement>(null)
  const { cashierName, cashierUserId } = usePosCashier()
  const [noCashierError, setNoCashierError] = useState(false)
  const [enabledPayments, setEnabledPayments] = useState<PosPaymentMethod[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPayment, setCheckoutPayment] = useState<PosPaymentMethod | null>(null)
  const [cashReceived, setCashReceived] = useState('') // string for input
  const cashReceivedRef = useRef<HTMLInputElement>(null)
  const [referenceCode, setReferenceCode] = useState('')
  const referenceCodeRef = useRef<HTMLInputElement>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [fiscalPendingWarning, setFiscalPendingWarning] = useState<string | null>(null)
  const cashReceivedValueRef = useRef(cashReceived)
  const checkoutPaymentValueRef = useRef(checkoutPayment)
  const cashIsValidValueRef = useRef(false)
  const [draftSaleId, setDraftSaleId] = useState<string | null>(null)
  const lastDraftProductIdsRef = useRef<string[]>([])
  const savingDraftRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [priceCheckOpen, setPriceCheckOpen] = useState(false)
  const [priceCheckQuery, setPriceCheckQuery] = useState('')
  const [priceCheckRows, setPriceCheckRows] = useState<PosProduct[]>([])
  const [priceCheckProduct, setPriceCheckProduct] = useState<PosProduct | null>(null)
  const [priceCheckError, setPriceCheckError] = useState<string | null>(null)
  const priceCheckInputRef = useRef<HTMLInputElement>(null)
  const balanzaCfgRef = useRef<BalanzaBarcodeConfig | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  async function refreshBalanzaConfig() {
    const cfg = await loadBalanzaConfig()
    balanzaCfgRef.current = cfg
    return cfg
  }

  const submitSearchBarcodeRef = useRef<(raw: string) => Promise<void>>(async () => {})
  const lastSubmittedBarcodeRef = useRef('')

  useEffect(() => {
    const trimmed = search.trim()

    if (!trimmed) {
      lastSubmittedBarcodeRef.current = ''
    }

    // Long numeric input is probably a barcode — skip name search until Enter/paste.
    const shouldSearch = trimmed.length >= 2 && !/^\d{8,}$/.test(trimmed)
    if (!shouldSearch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results while typing barcodes or short queries
      setProducts([])
      return
    }

    lastSubmittedBarcodeRef.current = ''
    window.pos.products.search(search).then(setProducts)
  }, [search])

  useEffect(() => {
    void refreshBalanzaConfig()
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const pms = await window.pos.paymentMethods.list()
        setEnabledPayments(pms)
      } catch {
        // ignore
      }
    })()
  }, [])

  useEffect(() => {
    if (!draftSaleId || !cashierUserId) return
    void window.pos.draftSales.update({
      draft_sale_id: draftSaleId,
      cashier_user_id: cashierUserId,
      cashier_name: cashierName || null,
    })
  }, [draftSaleId, cashierUserId, cashierName])

  async function hydrateDraft(draftId: string) {
    const res = await window.pos.draftSales.get(draftId)
    if (!res.ok || !res.data) return
    const now = new Date().toISOString()
    setDraftSaleId(draftId)
    // Customer hydration: we keep only the customer_id in the draft; the UI can re-select customer if needed.
    // (Customer search is local anyway; keep current behavior and avoid extra DB/API work here.)
    setCart(
      res.data.items.map((it) => ({
        product: {
          id: it.product_id,
          sku: null,
          barcode: null,
          name: it.product_name,
          price: it.unit_price,
          iva_rate: (it.iva_rate as unknown as PosProduct['iva_rate']) ?? '21',
          is_active: true,
          image_url: null,
          // A fractional saved qty means it was a weight line.
          sold_by_weight: !Number.isInteger(it.qty),
          plu_code: null,
          updated_at: now,
        },
        weightItem: !Number.isInteger(it.qty),
        qty: it.qty,
      })),
    )
    lastDraftProductIdsRef.current = res.data.items.map((it) => it.product_id)
  }

  useEffect(() => {
    // Resume explicit draft (from "Ventas" -> "Borradores")
    if (!resumeDraftId) return
    ;(async () => {
      const created = await window.pos.draftSales.createOrResume({ draft_sale_id: resumeDraftId })
      if (created.ok) await hydrateDraft(created.id)
      onResumeDraftConsumed()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDraftId])

  useEffect(() => {
    // Auto-resume most recent active draft on startup
    ;(async () => {
      const res = await window.pos.draftSales.getActive()
      if (res.ok && res.data?.id) {
        await hydrateDraft(res.data.id)
      }
    })()
     
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't steal keys while user is typing in an input
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || (target as HTMLElement | null)?.isContentEditable
      const hasMod = e.ctrlKey || e.metaKey

      if (receiptSale) {
        if (hasMod && e.key.toLowerCase() === 'p') {
          e.preventDefault()
          handlePrint()
          return
        }
        if (hasMod && e.key.toLowerCase() === 'n') {
          e.preventDefault()
          startNewSale()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          startNewSale()
        }
        return
      }

      // Global shortcuts
      if (hasMod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }

      // Price check (barcode) modal
      if (hasMod && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setPriceCheckOpen(true)
        setPriceCheckError(null)
        setPriceCheckProduct(null)
        setPriceCheckQuery('')
        setPriceCheckRows([])
        setTimeout(() => priceCheckInputRef.current?.focus(), 0)
        return
      }

      if (priceCheckOpen && e.key === 'Escape') {
        e.preventDefault()
        setPriceCheckOpen(false)
        setPriceCheckError(null)
        setPriceCheckProduct(null)
        searchRef.current?.focus()
        return
      }

      if (hasMod && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        setCustomerOpen(true)
        window.pos.customers.search('').then(setCustomerRows)
        setTimeout(() => customerInputRef.current?.focus(), 0)
        return
      }

      if (hasMod && e.key === 'Enter') {
        e.preventDefault()
        if (!checkoutOpen) {
          if (cart.length === 0) return
          openCheckout()
        } else {
          // Use refs to avoid stale values inside the keydown handler.
          const currentPayment = checkoutPaymentValueRef.current
          const currentCashReceived = cashReceivedValueRef.current
          const currentCashIsValid = cashIsValidValueRef.current

          // In cash payments, Cmd/Ctrl+Enter can be pressed before entering cash.
          if (currentPayment?.type === 'cash') {
            const trimmed = currentCashReceived.trim()
            if (!trimmed) {
              setCheckoutError('Ingresá el efectivo recibido para calcular el vuelto.')
              setTimeout(() => cashReceivedRef.current?.focus(), 0)
              return
            }
            if (!currentCashIsValid) {
              setCheckoutError('El efectivo recibido debe ser mayor o igual al total.')
              setTimeout(() => cashReceivedRef.current?.focus(), 0)
              return
            }
          }
          setCheckoutError(null)
          void handleConfirm()
        }
        return
      }

      // Payment method shortcuts — Fn selects nth enabled method
      if (e.key === 'F1' && enabledPayments[0]) { e.preventDefault(); setCheckoutPayment(enabledPayments[0]); return }
      if (e.key === 'F2' && enabledPayments[1]) { e.preventDefault(); setCheckoutPayment(enabledPayments[1]); return }
      if (e.key === 'F3' && enabledPayments[2]) { e.preventDefault(); setCheckoutPayment(enabledPayments[2]); return }

      if (customerOpen && e.key === 'Escape') {
        e.preventDefault()
        setCustomerOpen(false)
        searchRef.current?.focus()
      }

      if (checkoutOpen && e.key === 'Escape') {
        e.preventDefault()
        setCheckoutOpen(false)
        setCashReceived('')
      }

      if (cancelConfirm && e.key === 'Escape') { e.preventDefault(); setCancelConfirm(false); return }
      if (cancelConfirm && e.key === 'Enter') { e.preventDefault(); void executeCancelDraft(); return }

      if (hasMod && (e.key === 'Delete' || e.key === 'Backspace') && cart.length > 0 && !checkoutOpen) {
        e.preventDefault()
        void handleCancelDraft()
        return
      }

      // Barcode scanner behavior on normal product search:
      // if focus is in the search input and Enter is received, add exact match to cart.
      if (!hasMod && e.key === 'Enter' && target === searchRef.current) {
        const raw = searchRef.current?.value.trim() ?? ''
        if (!raw) return
        e.preventDefault()
        lastSubmittedBarcodeRef.current = raw
        void submitSearchBarcodeRef.current(raw)
        return
      }

      // For non-modifier keys, keep the typing guard.
      if (isTyping) return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptSale, customerOpen, checkoutOpen, priceCheckOpen, cart.length, checkoutPayment, customer, enabledPayments])

  const searchTrimmed = search.trim()
  const isBarcodeInput = /^\d{8,}$/.test(searchTrimmed)
  const showSearchResults = searchTrimmed.length >= 2 && !isBarcodeInput && products.length > 0

  function startNewSale() {
    setReceiptSale(null)
    setReceiptChange(null)
    setFiscalPendingWarning(null)
    setLastSale(null)
    setCart([])
    setSearch('')
    setCustomer(null)
    setCustomerOpen(false)
    setCustomerQuery('')
    setCustomerRows([])
    setDraftSaleId(null)
    lastDraftProductIdsRef.current = []
    searchRef.current?.focus()
  }

  async function handlePrint() {
    setPrintError(null)
    const result = await printPosReceipt()
    if (!result.ok) {
      setPrintError(result.error ?? 'No se pudo imprimir')
    }
  }

  function addToCart(product: PosProduct, opts?: { qty?: number; weightItem?: boolean; lineTotalOverride?: string | null }) {
    ;(async () => {
      if (!draftSaleId) {
        const created = await window.pos.draftSales.createOrResume({
          cashier_user_id: cashierUserId || null,
          cashier_name: cashierName || null,
          customer_id: customer?.id ?? null,
        })
        if (created.ok) setDraftSaleId(created.id)
      }

      setCart((c) => {
        const existing = c.find((i) => i.product.id === product.id)
        if (opts?.weightItem) {
          // Weight lines accumulate kg (and embedded price) per product — the draft
          // store keys items by product_id, so we merge rather than duplicate.
          const addedQty = opts.qty ?? 0
          const addedTotal = opts.lineTotalOverride != null ? parseFloat(opts.lineTotalOverride) : null
          if (existing) {
            return c.map((i) => {
              if (i.product.id !== product.id) return i
              const nextQty = i.qty + addedQty
              const nextOverride =
                i.lineTotalOverride != null || addedTotal != null
                  ? ((i.lineTotalOverride != null ? parseFloat(i.lineTotalOverride) : 0) + (addedTotal ?? 0)).toFixed(2)
                  : null
              return { ...i, qty: nextQty, weightItem: true, lineTotalOverride: nextOverride }
            })
          }
          return [...c, { product, qty: addedQty, weightItem: true, lineTotalOverride: opts.lineTotalOverride ?? null }]
        }
        if (existing) return c.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i))
        return [...c, { product, qty: 1 }]
      })
      const searchHadFocus = document.activeElement === searchRef.current
      setSearch('')
      if (searchHadFocus) {
        requestAnimationFrame(() => searchRef.current?.focus())
      }
    })()
  }

  submitSearchBarcodeRef.current = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return

    const cfg = await refreshBalanzaConfig()
    const parsed = cfg ? parseBalanzaBarcode(trimmed, cfg) : null

    if (parsed) {
      setScanError(null)
      const product = await window.pos.products.getByPlu(parsed.pluCode)
      if (!product) {
        setScanError(
          `PLU ${parsed.pluCode} sin producto en este POS. Verificá que el producto tenga ese PLU en el catálogo y sincronizá datos del cloud.`,
        )
        return
      }
      const pricePerKg = parseFloat(product.price)
      let qty: number
      let override: string | null = null
      if (parsed.weightKg != null) {
        qty = parseFloat(parsed.weightKg)
      } else {
        const priceArs = parseFloat(parsed.priceArs ?? '0')
        qty = pricePerKg > 0 ? Math.round((priceArs / pricePerKg) * 1000) / 1000 : 0
        override = parsed.priceArs ?? '0'
      }
      addToCart(product, { qty, weightItem: true, lineTotalOverride: override })
      lastSubmittedBarcodeRef.current = ''
      return
    }

    if (cfg && looksLikeBalanzaCode(trimmed, cfg)) {
      if (!cfg.enabled) {
        setScanError(
          'Lectura de etiquetas desactivada en este POS. Guardá la config en el ERP, luego en Configuración → Validar licencia y sincronizá datos.',
        )
        return
      }
      setScanError('El código no coincide con la configuración de balanza. Revisá el formato en el ERP.')
      return
    }

    if (!cfg && /^\d+$/.test(trimmed) && trimmed.length >= 13 && trimmed.startsWith('20')) {
      setScanError('Configuración de balanza no sincronizada. En el POS: Configuración → Validar licencia.')
      return
    }

    const rows = await window.pos.products.search(trimmed)
    const exact =
      rows.find((p) => (p.barcode ?? '').trim() === trimmed) ??
      rows.find((p) => (p.sku ?? '').trim() === trimmed) ??
      rows.find((p) => p.id === trimmed) ??
      null
    if (exact) {
      setScanError(null)
      addToCart(exact)
      lastSubmittedBarcodeRef.current = ''
      return
    }

    if (/^\d{8,}$/.test(trimmed)) {
      setScanError('Código no encontrado. Si es etiqueta de balanza, validá la licencia y sincronizá el catálogo.')
    }
  }

  // Picking a product from the grid: weight items try the connected scale, else
  // add an editable 1.000 kg line. Unit items add normally.
  function handleProductPick(p: PosProduct) {
    if (!p.sold_by_weight) { addToCart(p); return }
    void (async () => {
      setScanError(null)
      try {
        const status = await window.pos.scale.status()
        if (status.enabled && status.available) {
          const r = await window.pos.scale.readWeight()
          if (r.ok && r.weightKg != null) {
            addToCart(p, { qty: r.weightKg, weightItem: true, lineTotalOverride: null })
            return
          }
          setScanError(r.error ?? 'No se pudo leer la balanza')
        }
      } catch {
        // ignore — fall back to manual weight entry
      }
      addToCart(p, { qty: 1, weightItem: true, lineTotalOverride: null })
    })()
  }

  function removeFromCart(productId: string) {
    setCart(c => c.filter(i => i.product.id !== productId))
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) return removeFromCart(productId)
    setCart(c => c.map(i => i.product.id === productId ? { ...i, qty } : i))
  }

  function updateWeightQty(productId: string, kg: number) {
    if (!(kg > 0)) return removeFromCart(productId)
    // Manual weight edits recompute the line from price/kg, dropping any label override.
    setCart(c => c.map(i => i.product.id === productId ? { ...i, qty: kg, lineTotalOverride: null } : i))
  }

  const total = cart.reduce((sum, i) => sum + lineTotal(i), 0)
  const taxAmount = cart.reduce((sum, i) => {
    const rate = parseFloat(i.product.iva_rate) / 100
    const gross = lineTotal(i)
    const base = gross / (1 + rate)
    return sum + (gross - base)
  }, 0)
  const subtotal = total - taxAmount
  const cartProductCount = cart.reduce((sum, i) => sum + (i.weightItem ? 1 : i.qty), 0)

  const cashReceivedNum = parseFloat((cashReceived || '').replace(',', '.'))
  const isCash = checkoutPayment?.type === 'cash'
  const cashIsValid = !isCash || (!Number.isNaN(cashReceivedNum) && cashReceivedNum >= total)
  const change = isCash && !Number.isNaN(cashReceivedNum) ? (cashReceivedNum - total) : 0

  // Persist draft automatically while building the cart
  useEffect(() => {
    if (!draftSaleId) return
    if (savingDraftRef.current) clearTimeout(savingDraftRef.current)
    savingDraftRef.current = setTimeout(() => {
      const currentDraftId = draftSaleId
      const items = cart.map((i, idx) => ({
        draft_sale_id: currentDraftId,
        product_id: i.product.id,
        product_name: i.product.name,
        qty: i.qty,
        unit_price: i.product.price,
        total: lineTotal(i).toFixed(2),
        iva_rate: i.product.iva_rate,
        sort_order: idx,
      }))

      void (async () => {
        for (const it of items) {
          await window.pos.draftSaleItems.upsert(it)
        }
        const prevIds = new Set(lastDraftProductIdsRef.current)
        const nextIds = new Set(items.map((i) => i.product_id))
        for (const id of prevIds) {
          if (!nextIds.has(id)) {
            await window.pos.draftSaleItems.remove({ draft_sale_id: currentDraftId, product_id: id })
          }
        }
        lastDraftProductIdsRef.current = [...nextIds]
        await window.pos.draftSales.update({
          draft_sale_id: currentDraftId,
          subtotal: subtotal.toFixed(2),
          tax_amount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          cashier_user_id: cashierUserId || null,
          cashier_name: cashierName || null,
          customer_id: customer?.id ?? null,
        })
      })()
    }, 250)

    return () => {
      if (savingDraftRef.current) clearTimeout(savingDraftRef.current)
    }
  }, [cart, subtotal, taxAmount, total, draftSaleId, cashierUserId, cashierName, customer])

  useEffect(() => {
    cashReceivedValueRef.current = cashReceived
  }, [cashReceived])

  useEffect(() => {
    checkoutPaymentValueRef.current = checkoutPayment
  }, [checkoutPayment])

  useEffect(() => {
    cashIsValidValueRef.current = cashIsValid
  }, [cashIsValid])

  function openCheckout() {
    if (!cashierUserId) {
      setNoCashierError(true)
      setTimeout(() => setNoCashierError(false), 4000)
      return
    }
    void window.pos.paymentMethods.list().then(pms => {
      setEnabledPayments(pms)
      const first = pms[0] ?? null
      setCheckoutPayment(first)
      if (first?.type === 'cash') setTimeout(() => cashReceivedRef.current?.focus(), 0)
      else if (first) setTimeout(() => referenceCodeRef.current?.focus(), 0)
    })
    setCheckoutOpen(true)
    setCashReceived('')
    setReferenceCode('')
    setCheckoutError(null)
  }

  async function handleConfirm() {
    if (cart.length === 0) return
    if (checkoutOpen && !cashIsValid) return
    if (!cashierUserId) return
    setSaving(true)
    const items: PosSaleItem[] = cart.map(i => ({
      product_id:   i.product.id,
      product_name: i.product.name,
      qty:          i.qty,
      unit_price:   i.product.price,
      total:        lineTotal(i).toFixed(2),
      iva_rate:     i.product.iva_rate,
    }))
    const soldAt = new Date().toISOString()
    const payments = checkoutPayment ? [{
      payment_method_id: checkoutPayment.id,
      payment_method_name: checkoutPayment.name,
      payment_method_type: checkoutPayment.type,
      amount: total.toFixed(2),
      tendered_amount: isCash ? cashReceivedNum.toFixed(2) : null,
      reference: !isCash && referenceCode.trim() ? referenceCode.trim() : null,
    }] : []

    try {
      let localId = randomUUID()
      let ticketNumber = ''
      let fiscalCae: string | null = null
      let fiscalCaeExpiration: string | null = null
      let fiscalQrUrl: string | null = null
      let fiscalPending = false
      let fiscalAfipError: string | null = null
      if (draftSaleId) {
        const res = await window.pos.draftSales.checkout({
          draft_sale_id: draftSaleId,
          payments,
          sold_at: soldAt,
          subtotal: subtotal.toFixed(2),
          tax_amount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          cashier_user_id: cashierUserId || null,
          cashier_name: cashierName || null,
        })
        if (!res.ok) throw new Error(res.error ?? 'CHECKOUT_FAILED')
        localId = res.sale_id ?? localId
        ticketNumber = res.ticket_number ?? localId.slice(0, 8).toUpperCase()
        fiscalCae = res.cae ?? null
        fiscalCaeExpiration = res.cae_expiration ?? null
        fiscalQrUrl = res.qr_url ?? null
        fiscalPending = res.fiscal_pending ?? !fiscalCae
        fiscalAfipError = res.afip_error ?? null
      } else {
        const sale: PosSale = {
          local_id:       localId,
          device_id:      'local',
          cashier_user_id: cashierUserId || null,
          cashier_name:   cashierName || null,
          customer_id:    customer?.id ?? null,
          payments,
          subtotal:       subtotal.toFixed(2),
          tax_amount:     taxAmount.toFixed(2),
          total:          total.toFixed(2),
          sold_at:        soldAt,
          items,
        }
        const created = await window.pos.sales.create(sale)
        ticketNumber = created.ticket_number ?? localId.slice(0, 8).toUpperCase()
        fiscalCae = created.cae ?? null
        fiscalCaeExpiration = created.cae_expiration ?? null
        fiscalQrUrl = created.qr_url ?? null
        fiscalPending = created.fiscal_pending ?? !fiscalCae
        fiscalAfipError = created.afip_error ?? null
      }

      const receipt: PosSale = {
        local_id: localId,
        device_id: 'local',
        ticket_number: ticketNumber,
        cae: fiscalCae,
        cae_expiration: fiscalCaeExpiration,
        qr_url: fiscalQrUrl,
        cashier_user_id: cashierUserId || null,
        cashier_name: cashierName || null,
        customer_id: customer?.id ?? null,
        payments,
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        sold_at: soldAt,
        items,
      }
      setLastSale({ total: total.toFixed(2) })
      if (isCash && !Number.isNaN(cashReceivedNum) && cashReceivedNum >= total) {
        setReceiptChange((cashReceivedNum - total).toFixed(2))
      } else {
        setReceiptChange(null)
      }
      setReceiptSale(receipt)
      setCart([])
      setSearch('')
      setCheckoutOpen(false)
      setCashReceived('')
      setCheckoutError(null)
      setFiscalPendingWarning(
        fiscalPending
          ? (fiscalAfipError ?? 'No se pudo autorizar en AFIP. Podés hacerlo desde Ventas.')
          : null,
      )
      setDraftSaleId(null)
      lastDraftProductIdsRef.current = []
      searchRef.current?.focus()
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const [cancelConfirm, setCancelConfirm] = useState(false)

  async function executeCancelDraft() {
    if (draftSaleId) await window.pos.draftSales.cancel(draftSaleId)
    setCart([])
    setSearch('')
    setDraftSaleId(null)
    lastDraftProductIdsRef.current = []
    setCancelConfirm(false)
    searchRef.current?.focus()
  }

  async function handleCancelDraft() {
    setCancelConfirm(true)
  }

  return (
    <div className="flex h-full">
      {/* Price check (barcode) */}
      {priceCheckOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div className="text-base font-semibold text-zinc-800">Ver precio</div>
              <button
                onClick={() => { setPriceCheckOpen(false); setPriceCheckProduct(null); setPriceCheckError(null); searchRef.current?.focus() }}
                className="text-[14px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-[14px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
                Escaneá el código de barras. No se agrega al ticket. <span className="text-zinc-400">({modKey} + I)</span>
              </div>

              <input
                ref={priceCheckInputRef}
                value={priceCheckQuery}
                onChange={async (e) => {
                  const q = e.target.value
                  setPriceCheckQuery(q)
                  setPriceCheckError(null)
                  setPriceCheckProduct(null)
                  try {
                    const rows = await window.pos.products.search(q)
                    setPriceCheckRows(rows)
                  } catch (err) {
                    setPriceCheckRows([])
                    setPriceCheckError(err instanceof Error ? err.message : String(err))
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const raw = priceCheckQuery.trim()
                  if (!raw) return
                  const exact =
                    priceCheckRows.find((p) => (p.sku ?? '').trim() === raw) ??
                    priceCheckRows.find((p) => p.id === raw)
                  if (!exact) {
                    setPriceCheckError('No se encontró un producto con ese código.')
                    return
                  }
                  e.preventDefault()
                  setPriceCheckProduct(exact)
                }}
                placeholder="Pasar barcode / SKU…"
                className="w-full h-10 px-3 text-[15px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-brand-600"
              />

              {priceCheckError && (
                <div className="text-[14px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {priceCheckError}
                </div>
              )}

              {priceCheckProduct && (
                <div className="border border-zinc-200 rounded-lg p-4 bg-white space-y-2">
                  <div className="text-[14px] font-semibold text-zinc-900">{priceCheckProduct.name}</div>
                  <div className="text-[14px] text-zinc-500">
                    {priceCheckProduct.sku ? <>Código: <span className="font-mono">{priceCheckProduct.sku}</span></> : 'Sin SKU'}
                    {' · '}IVA {priceCheckProduct.iva_rate}%
                  </div>
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[14px] text-zinc-600">Precio</span>
                    <span className="text-[18px] font-bold text-zinc-900">
                      ${parseFloat(priceCheckProduct.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {!priceCheckProduct && (
                <div className="text-[14px] text-zinc-500">
                  Tip: si hay varios resultados, el Enter solo funciona cuando el código coincide exacto.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel draft confirmation modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div>
              <h3 className="text-[17px] font-semibold text-zinc-900">¿Cancelar la venta?</h3>
              <p className="text-[15px] text-zinc-500 mt-1">Se eliminarán los {cart.length} producto{cart.length !== 1 ? 's' : ''} del ticket.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelConfirm(false)}
                className="flex-1 h-10 bg-white border border-zinc-300 text-[15px] font-medium rounded-lg hover:bg-zinc-50 transition-colors"
                autoFocus
              >
                Volver
              </button>
              <button
                onClick={executeCancelDraft}
                className="flex-1 h-10 bg-red-600 text-white text-[15px] font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancelar venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout / Cobrar */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div className="text-base font-semibold text-zinc-800">Cobrar</div>
              <button
                onClick={() => { setCheckoutOpen(false); setCashReceived('') }}
                className="text-[14px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-xl bg-zinc-100 border border-zinc-300 px-5 py-5">
                <div className="space-y-3 text-[17px]">
                  <div className="flex justify-between text-zinc-700">
                    <span className="font-medium">Subtotal (sin IVA)</span>
                    <span className="font-semibold text-zinc-900 tabular-nums">${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-zinc-700">
                    <span className="font-medium">IVA</span>
                    <span className="font-semibold text-zinc-900 tabular-nums">${taxAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-300 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total a cobrar</div>
                  {cart.length > 0 && (
                    <div className="text-xs text-zinc-500 tabular-nums mt-1">
                      {cartProductCount} {cartProductCount === 1 ? 'producto' : 'productos'}
                    </div>
                  )}
                  <div className="mt-2 text-5xl font-extrabold text-zinc-950 tabular-nums tracking-tight leading-none">
                    ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {enabledPayments.length === 0 && (
                <div className="text-[14px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No hay medios de pago configurados. Sincronizá el POS desde Configuración.
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {enabledPayments.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => { setCheckoutPayment(m); setReferenceCode(''); if (m.type === 'cash') setTimeout(() => cashReceivedRef.current?.focus(), 0); else setTimeout(() => referenceCodeRef.current?.focus(), 0) }}
                    className={`h-9 rounded-md text-[14px] font-medium border transition-colors ${
                      checkoutPayment?.id === m.id
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:border-brand-400'
                    }`}
                  >
                    {m.name}{' '}
                    <span className={`${checkoutPayment?.id === m.id ? 'text-brand-100' : 'text-zinc-400'}`}>
                      {`(F${idx + 1})`}
                    </span>
                  </button>
                ))}
              </div>

              {!isCash && checkoutPayment && (
                <div>
                  <label className="block text-[14px] font-medium text-zinc-700 mb-1">
                    Código de operación <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    ref={referenceCodeRef}
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    placeholder="Ej: 123456789"
                    className="w-full h-10 px-3 text-[15px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-brand-600"
                  />
                </div>
              )}

              {isCash && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[14px] font-medium text-zinc-700 mb-1">Efectivo recibido</label>
                    <input
                      ref={cashReceivedRef}
                      value={cashReceived}
                      onChange={(e) => { setCashReceived(e.target.value); setCheckoutError(null) }}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="w-full h-10 px-3 text-[15px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-brand-600"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-zinc-600">Vuelto</span>
                    <span className={`font-semibold ${cashIsValid ? 'text-zinc-900' : 'text-red-700'}`}>
                      ${Math.max(0, change).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {!cashIsValid && (
                    <div className="text-[14px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      El efectivo recibido debe ser mayor o igual al total.
                    </div>
                  )}
                </div>
              )}

              {checkoutError && (
                <div className="text-[14px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {checkoutError}
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={saving || cart.length === 0 || !cashIsValid}
                className="w-full h-11 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Cobrando…' : `Cobrar y emitir ticket (${modKey} + Enter)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer selector */}
      {customerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="text-base font-semibold text-zinc-800">Cliente</div>
                <ShortcutBadge modKey={modKey} keyLabel="U" />
              </div>
              <button
                onClick={() => setCustomerOpen(false)}
                className="text-[14px] font-medium text-zinc-600 hover:text-zinc-900 shrink-0"
              >
                Cerrar <span className="text-zinc-400">(Esc)</span>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                ref={customerInputRef}
                value={customerQuery}
                onChange={async (e) => {
                  const q = e.target.value
                  setCustomerQuery(q)
                  setCustomerError(null)
                  try {
                    const rows = await window.pos.customers.search(q)
                    setCustomerRows(rows)
                  } catch (err) {
                    setCustomerRows([])
                    setCustomerError(err instanceof Error ? err.message : String(err))
                  }
                }}
                placeholder="Buscar por nombre o CUIT…"
                className="w-full h-10 px-3 text-[15px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-brand-600"
              />

              {customerError && (
                <div className="text-[14px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  Error buscando clientes: {customerError}
                </div>
              )}

              <div className="max-h-[360px] overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                <button
                  onClick={() => { setCustomer(null); setCustomerOpen(false); searchRef.current?.focus() }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-[15px] font-medium text-zinc-900">Consumidor final</div>
                  <div className="text-[13px] text-zinc-500">Sin asignar cliente</div>
                </button>

                {customerRows.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCustomer(c); setCustomerOpen(false); searchRef.current?.focus() }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="text-[15px] font-medium text-zinc-900 truncate">
                      {c.trade_name ?? c.legal_name}
                    </div>
                    <div className="text-[13px] text-zinc-500 truncate">
                      {c.legal_name}{c.cuit ? ` · CUIT ${c.cuit}` : ''}
                    </div>
                  </button>
                ))}

                {customerRows.length === 0 && customerQuery.trim() && (
                  <div className="px-3 py-6 text-center text-[14px] text-zinc-500">
                    Sin resultados para “{customerQuery.trim()}”.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt overlay (ticket) */}
      {receiptSale && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:p-0">
          <div className="flex flex-col w-full max-w-md max-h-[min(92vh,920px)] bg-white rounded-xl shadow-xl overflow-hidden print:max-h-none print:shadow-none print:rounded-none">
            <div className="shrink-0 px-4 py-3 border-b border-zinc-200 flex items-center justify-between print:hidden">
              <div className="text-base font-semibold text-zinc-800">Ticket</div>
              <button
                onClick={startNewSale}
                className="text-[14px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Nueva venta
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <PosReceipt
                ticketNumber={receiptSale.ticket_number ?? receiptSale.local_id.slice(0, 8).toUpperCase()}
                soldAt={receiptSale.sold_at}
                items={receiptSale.items.map((it) => ({
                  product_name: it.product_name,
                  qty: it.qty,
                  unit_price: it.unit_price,
                  iva_rate: it.iva_rate ?? '21',
                  total: it.total,
                }))}
                subtotal={receiptSale.subtotal}
                taxAmount={receiptSale.tax_amount}
                total={receiptSale.total}
                payments={receiptSale.payments}
                customer={customer ? {
                  legal_name: customer.legal_name,
                  trade_name: customer.trade_name,
                  cuit: customer.cuit,
                  iva_condition: customer.iva_condition ?? null,
                } : null}
                fiscal={fiscal}
                cashierName={receiptSale.cashier_name ?? cashierName}
                cae={receiptSale.cae}
                caeExpiration={receiptSale.cae_expiration}
                qrUrl={receiptSale.qr_url}
                fiscalPending={!receiptSale.cae}
                changeAmount={receiptChange}
              />
            </div>

            <div className="shrink-0 border-t border-zinc-200 p-4 space-y-3 print:hidden">
              {fiscalPendingWarning && (
                <div className="text-[14px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  Venta registrada. AFIP pendiente: {fiscalPendingWarning}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 h-10 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Imprimir <span className="text-[13px] text-brand-100">{`(${modKey}+P)`}</span>
                </button>
                <button
                  onClick={startNewSale}
                  className="flex-1 h-10 bg-white text-zinc-700 font-semibold rounded-lg border border-zinc-300 hover:border-zinc-400 transition-colors"
                >
                  Nueva venta <span className="text-[13px] text-zinc-400">{`(${modKey}+N)`}</span>
                </button>
              </div>
              {printError && (
                <p className="text-[14px] text-red-600">{printError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Center: search + ticket */}
      <div className="flex flex-col flex-1 p-4 gap-3 overflow-hidden bg-zinc-50">
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={e => { setSearch(e.target.value); if (scanError) setScanError(null) }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text').trim()
              if (!/^\d+$/.test(pasted)) return
              const expectedLen = balanzaCfgRef.current?.totalLength ?? 13
              if (pasted.length !== expectedLen) return
              e.preventDefault()
              setSearch(pasted)
              lastSubmittedBarcodeRef.current = pasted
              void submitSearchBarcodeRef.current(pasted)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey) return
              const raw = searchRef.current?.value.trim() ?? ''
              if (!raw) return
              e.preventDefault()
              e.stopPropagation()
              lastSubmittedBarcodeRef.current = raw
              void submitSearchBarcodeRef.current(raw)
            }}
            placeholder={`Escaneá o buscá producto… (${modKey} + K)`}
            className="flex-1 h-11 px-4 text-base border border-zinc-300 rounded-md focus:outline-none focus:border-brand-600 bg-white"
          />
          <button
            onClick={() => {
              setPriceCheckOpen(true)
              setPriceCheckError(null)
              setPriceCheckProduct(null)
              setPriceCheckQuery('')
              setPriceCheckRows([])
              setTimeout(() => priceCheckInputRef.current?.focus(), 0)
            }}
            className="h-11 px-3 text-[15px] font-medium bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
          >
            Ver precio <span className="text-[13px] text-zinc-400">{`(${modKey}+I)`}</span>
          </button>
        </div>

        {scanError && (
          <div className="shrink-0 text-[14px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {scanError}
          </div>
        )}

        {isBarcodeInput && !scanError && (
          <div className="shrink-0 text-[14px] text-zinc-600 bg-white border border-zinc-200 rounded-md px-3 py-2">
            Código de barras — <span className="font-medium">Enter</span> para agregar al ticket
          </div>
        )}

        {showSearchResults && (
          <div className="shrink-0 rounded-lg border border-zinc-200 bg-white shadow-sm max-h-56 overflow-y-auto divide-y divide-zinc-100">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => handleProductPick(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors flex gap-3 items-center"
              >
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0 bg-zinc-100"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium text-zinc-900 truncate">{p.name}</div>
                  {p.sku && <div className="text-[13px] text-zinc-400 font-mono">{p.sku}</div>}
                </div>
                <div className="text-lg font-semibold text-zinc-800 tabular-nums shrink-0">
                  ${parseFloat(p.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  {p.sold_by_weight && <span className="text-[13px] font-normal text-zinc-400"> /kg</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {searchTrimmed.length >= 2 && !isBarcodeInput && products.length === 0 && !scanError && (
          <div className="shrink-0 text-center text-base text-zinc-400 py-3 bg-white border border-zinc-200 rounded-lg">
            Sin resultados para &ldquo;{search}&rdquo;
          </div>
        )}

        {/* Ticket */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white flex flex-col min-h-0">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
              <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mb-4 text-zinc-400">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
                </svg>
              </div>
              <p className="text-lg font-medium text-zinc-600">Ticket vacío</p>
              <p className="mt-1 text-base text-zinc-400 max-w-sm">
                Escaneá un código de barras o buscá un producto para empezar la venta
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-zinc-100 text-[12px] font-semibold uppercase tracking-wide text-zinc-400 shrink-0">
                <span>Producto</span>
                <span className="w-28 text-center">Cantidad</span>
                <span className="w-24 text-right">Total</span>
                <span className="w-7" aria-hidden />
              </div>
              <div className="divide-y divide-zinc-100">
                {cart.map((item) => {
                  const { product, qty } = item
                  return (
                    <div key={product.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-lg font-medium text-zinc-900 truncate">{product.name}</div>
                        <div className="text-[15px] text-zinc-500 tabular-nums">
                          ${parseFloat(product.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          {item.weightItem ? ' /kg' : ' c/u'}
                        </div>
                      </div>
                      {item.weightItem ? (
                        <div className="w-28 flex items-center justify-center gap-1">
                          <CartWeightInput
                            qtyKg={qty}
                            onCommit={(kg) => updateWeightQty(product.id, kg)}
                          />
                          <span className="text-[13px] text-zinc-400">kg</span>
                        </div>
                      ) : (
                        <div className="w-28 flex items-center justify-center gap-1.5">
                          <button onClick={() => updateQty(product.id, qty - 1)} className="w-8 h-8 rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-lg font-medium flex items-center justify-center">−</button>
                          <span className="w-8 text-center text-lg font-semibold tabular-nums">{qty}</span>
                          <button onClick={() => updateQty(product.id, qty + 1)} className="w-8 h-8 rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-lg font-medium flex items-center justify-center">+</button>
                        </div>
                      )}
                      <div className="w-24 text-right text-lg font-semibold text-zinc-900 tabular-nums">
                        ${lineTotal(item).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        title="Quitar del ticket"
                        className="w-7 h-7 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 text-lg font-medium flex items-center justify-center shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: customer + checkout */}
      <div className="flex flex-col w-[28rem] shrink-0 border-l border-zinc-200 bg-white">
        <div className="px-4 py-3 border-b border-zinc-100">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden">
            <div className="flex items-stretch">
              <button
                type="button"
                title={`Buscar cliente (${modKey} + U)`}
                onClick={async () => {
                  setCustomerOpen(true)
                  setCustomerError(null)
                  try {
                    const rows = await window.pos.customers.search('')
                    setCustomerRows(rows)
                  } catch (err) {
                    setCustomerRows([])
                    setCustomerError(err instanceof Error ? err.message : String(err))
                  }
                  setTimeout(() => customerInputRef.current?.focus(), 0)
                }}
                className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white transition-colors min-w-0"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[15px] font-semibold ${
                    customer ? 'bg-zinc-200 text-zinc-700' : 'bg-white border border-zinc-200 text-zinc-400'
                  }`}
                  aria-hidden
                >
                  {customer ? (customer.trade_name ?? customer.legal_name).charAt(0).toUpperCase() : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-zinc-400">Cliente</div>
                  <div className="text-base font-medium text-zinc-900 truncate">
                    {customer ? (customer.trade_name ?? customer.legal_name) : 'Consumidor final'}
                  </div>
                  {customer?.cuit ? (
                    <div className="text-[13px] text-zinc-500 truncate">CUIT {customer.cuit}</div>
                  ) : (
                    <div className="text-[13px] text-zinc-500">Atajo para buscar cliente</div>
                  )}
                </div>
                <ShortcutBadge modKey={modKey} keyLabel="U" />
              </button>
              {customer && (
                <button
                  type="button"
                  onClick={() => setCustomer(null)}
                  title="Quitar cliente"
                  className="shrink-0 px-2.5 border-l border-zinc-200 text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <PosTicketBrandPanel />

        {/* Totals */}
        <div className="border-t border-zinc-200 bg-zinc-100 px-4 py-4">
          <div className="space-y-3 text-[17px]">
            <div className="flex justify-between text-zinc-700">
              <span className="font-medium">Subtotal (sin IVA)</span>
              <span className="font-semibold text-zinc-900 tabular-nums">${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span className="font-medium">IVA</span>
              <span className="font-semibold text-zinc-900 tabular-nums">${taxAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-300">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Total a cobrar</div>
            {cart.length > 0 && (
              <div className="text-xs text-zinc-500 tabular-nums mb-2">
                {cartProductCount} {cartProductCount === 1 ? 'producto' : 'productos'}
              </div>
            )}
            <div className="text-4xl font-extrabold text-zinc-950 tabular-nums tracking-tight leading-none text-right">
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {lastSale && (
          <div className="mx-4 mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-[14px] text-green-800">
            ✓ Venta registrada: ${parseFloat(lastSale.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
        )}

        <div className="px-4 pb-4 space-y-2">
          {noCashierError && (
            <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
              Abrí un turno de caja antes de cobrar
            </p>
          )}
          <button
            onClick={openCheckout}
            disabled={cart.length === 0 || saving || !cashierUserId}
            className="w-full h-11 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Registrando…' : `Cobrar (${modKey} + Enter)`}
          </button>
          {cart.length > 0 && (
            <button
              onClick={handleCancelDraft}
              className="w-full h-8 text-[14px] font-medium rounded-md transition-colors bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300"
            >
              {`Cancelar venta (${modKey} + ⌫)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
