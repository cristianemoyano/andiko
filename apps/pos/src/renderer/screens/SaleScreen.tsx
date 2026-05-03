import { useState, useEffect, useRef } from 'react'
import type { PosSale, PosSaleItem, PosProduct, PosCustomer } from '@andiko/shared'
import { randomUUID } from '../lib/uuid'

type CartItem = {
  product: PosProduct
  qty: number
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

export function SaleScreen({
  resumeDraftId,
  onResumeDraftConsumed,
}: {
  resumeDraftId: string | null
  onResumeDraftConsumed: () => void
}) {
  const modKey = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'
  const [products, setProducts] = useState<PosProduct[]>([])
  const [search, setSearch]     = useState('')
  const [cart, setCart]         = useState<CartItem[]>([])
  const [payment, setPayment]   = useState<'cash' | 'card' | 'transfer'>('cash')
  const [saving, setSaving]     = useState(false)
  const [lastSale, setLastSale] = useState<{ total: string } | null>(null)
  const [receiptSale, setReceiptSale] = useState<PosSale | null>(null)
  const [customer, setCustomer] = useState<PosCustomer | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerRows, setCustomerRows] = useState<PosCustomer[]>([])
  const [customerError, setCustomerError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const customerInputRef = useRef<HTMLInputElement>(null)
  const [cashierName, setCashierName] = useState('')
  const [cashierUserId, setCashierUserId] = useState('')
  const [noCashierError, setNoCashierError] = useState(false)
  const [enabledPayments, setEnabledPayments] = useState<Array<'cash' | 'card' | 'transfer'>>(['cash', 'card', 'transfer'])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPayment, setCheckoutPayment] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [cashReceived, setCashReceived] = useState('') // string for input
  const cashReceivedRef = useRef<HTMLInputElement>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
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

  useEffect(() => {
    window.pos.products.search(search).then(setProducts)
  }, [search])

  useEffect(() => {
    // Cashier comes from the active cash session — if no session is open, block checkout
    void (async () => {
      const [session, s] = await Promise.all([
        window.pos.cashSessions.getCurrent(),
        window.pos.settings.get(),
      ])
      if (session) {
        setCashierName(session.cashier_name ?? '')
        setCashierUserId(session.cashier_user_id ?? '')
      } else {
        setCashierName('')
        setCashierUserId('')
      }
      try {
        const raw = s['pos_payment_methods']
        if (raw) {
          const parsed = JSON.parse(raw) as unknown
          if (Array.isArray(parsed)) {
            const allowed = new Set(['cash', 'card', 'transfer'])
            const cleaned = parsed.filter((x): x is 'cash' | 'card' | 'transfer' => typeof x === 'string' && allowed.has(x))
            if (cleaned.length > 0) setEnabledPayments(cleaned)
          }
        }
      } catch {
        // ignore malformed local setting
      }
    })()
  }, [])

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
          name: it.product_name,
          price: it.unit_price,
          iva_rate: (it.iva_rate as unknown as PosProduct['iva_rate']) ?? '21',
          is_active: true,
          updated_at: now,
        },
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
    function onAfterPrint() {
      document.body.removeAttribute('data-printing')
      setReceiptSale(null)
      setLastSale(null)
      searchRef.current?.focus()
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
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
          if (currentPayment === 'cash') {
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

      // Payment method shortcuts
      if (e.key === 'F1') { e.preventDefault(); setCheckoutPayment('cash'); setPayment('cash'); return }
      if (e.key === 'F2') { e.preventDefault(); setCheckoutPayment('card'); setPayment('card'); return }
      if (e.key === 'F3') { e.preventDefault(); setCheckoutPayment('transfer'); setPayment('transfer'); return }

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

      // Barcode scanner behavior on normal product search:
      // if focus is in the search input and Enter is received, add exact match to cart.
      if (!hasMod && e.key === 'Enter' && target === searchRef.current) {
        const raw = search.trim()
        if (!raw) return
        const exact = products.find((p) => (p.sku ?? '').trim() === raw) ?? products.find((p) => p.id === raw)
        if (exact) {
          e.preventDefault()
          addToCart(exact)
          return
        }
      }

      // For non-modifier keys, keep the typing guard.
      if (isTyping) return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [receiptSale, customerOpen, checkoutOpen, priceCheckOpen, cart.length, payment, customer])

  const filtered = products

  function startNewSale() {
    setReceiptSale(null)
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

  function handlePrint() {
    // Print just the receipt via CSS (see index.css @media print)
    document.body.setAttribute('data-printing', '1')
    window.print()
  }

  function addToCart(product: PosProduct) {
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
        if (existing) return c.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i))
        return [...c, { product, qty: 1 }]
      })
      setSearch('')
      searchRef.current?.focus()
    })()
  }

  function removeFromCart(productId: string) {
    setCart(c => c.filter(i => i.product.id !== productId))
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) return removeFromCart(productId)
    setCart(c => c.map(i => i.product.id === productId ? { ...i, qty } : i))
  }

  const total = cart.reduce((sum, i) => sum + parseFloat(i.product.price) * i.qty, 0)
  const taxAmount = cart.reduce((sum, i) => {
    const rate = parseFloat(i.product.iva_rate) / 100
    const base = parseFloat(i.product.price) * i.qty / (1 + rate)
    return sum + (parseFloat(i.product.price) * i.qty - base)
  }, 0)
  const subtotal = total - taxAmount

  const cashReceivedNum = parseFloat((cashReceived || '').replace(',', '.'))
  const cashIsValid = checkoutPayment !== 'cash' || (!Number.isNaN(cashReceivedNum) && cashReceivedNum >= total)
  const change = checkoutPayment === 'cash' && !Number.isNaN(cashReceivedNum) ? (cashReceivedNum - total) : 0

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
        total: (parseFloat(i.product.price) * i.qty).toFixed(2),
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
    setCheckoutPayment(payment)
    setCheckoutOpen(true)
    setCashReceived('')
    setCheckoutError(null)
    if (payment === 'cash') setTimeout(() => cashReceivedRef.current?.focus(), 0)
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
      total:        (parseFloat(i.product.price) * i.qty).toFixed(2),
    }))
    const soldAt = new Date().toISOString()
    try {
      let localId = randomUUID()
      if (draftSaleId) {
        const res = await window.pos.draftSales.checkout({
          draft_sale_id: draftSaleId,
          payment_method: payment,
          sold_at: soldAt,
          subtotal: subtotal.toFixed(2),
          tax_amount: taxAmount.toFixed(2),
          total: total.toFixed(2),
        })
        if (!res.ok) throw new Error(res.error ?? 'CHECKOUT_FAILED')
        localId = res.sale_id ?? localId
      } else {
        const sale: PosSale = {
          local_id:       localId,
          device_id:      'local',
          cashier_user_id: cashierUserId || null,
          cashier_name:   cashierName || null,
          customer_id:    customer?.id ?? null,
          payment_method: payment,
          subtotal:       subtotal.toFixed(2),
          tax_amount:     taxAmount.toFixed(2),
          total:          total.toFixed(2),
          sold_at:        soldAt,
          items,
        }
        await window.pos.sales.create(sale)
      }

      const receipt: PosSale = {
        local_id: localId,
        device_id: 'local',
        cashier_user_id: cashierUserId || null,
        cashier_name: cashierName || null,
        customer_id: customer?.id ?? null,
        payment_method: payment,
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        sold_at: soldAt,
        items,
      }
      setLastSale({ total: total.toFixed(2) })
      setReceiptSale(receipt)
      setCart([])
      setSearch('')
      setCheckoutOpen(false)
      setCashReceived('')
      setCheckoutError(null)
      setDraftSaleId(null)
      lastDraftProductIdsRef.current = []
      searchRef.current?.focus()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Price check (barcode) */}
      {priceCheckOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-800">Ver precio</div>
              <button
                onClick={() => { setPriceCheckOpen(false); setPriceCheckProduct(null); setPriceCheckError(null); searchRef.current?.focus() }}
                className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-[12px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
                Escaneá el código de barras. No se agrega al carrito. <span className="text-zinc-400">({modKey} + I)</span>
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
                className="w-full h-10 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
              />

              {priceCheckError && (
                <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {priceCheckError}
                </div>
              )}

              {priceCheckProduct && (
                <div className="border border-zinc-200 rounded-lg p-4 bg-white space-y-2">
                  <div className="text-[14px] font-semibold text-zinc-900">{priceCheckProduct.name}</div>
                  <div className="text-[12px] text-zinc-500">
                    {priceCheckProduct.sku ? <>Código: <span className="font-mono">{priceCheckProduct.sku}</span></> : 'Sin SKU'}
                    {' · '}IVA {priceCheckProduct.iva_rate}%
                  </div>
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[12px] text-zinc-600">Precio</span>
                    <span className="text-[18px] font-bold text-zinc-900">
                      ${parseFloat(priceCheckProduct.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {!priceCheckProduct && (
                <div className="text-[12px] text-zinc-500">
                  Tip: si hay varios resultados, el Enter solo funciona cuando el código coincide exacto.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout / Cobrar */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-800">Cobrar</div>
              <button
                onClick={() => { setCheckoutOpen(false); setCashReceived('') }}
                className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-zinc-600">Total</span>
                <span className="font-semibold text-zinc-900">
                  ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {enabledPayments.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setCheckoutPayment(m); setPayment(m); if (m === 'cash') setTimeout(() => cashReceivedRef.current?.focus(), 0) }}
                    className={`h-9 rounded-md text-[12px] font-medium border transition-colors ${
                      checkoutPayment === m
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:border-blue-400'
                    }`}
                  >
                    {PAYMENT_LABELS[m]}{' '}
                    <span className={`${checkoutPayment === m ? 'text-blue-100' : 'text-zinc-400'}`}>
                      {m === 'cash' ? '(F1)' : m === 'card' ? '(F2)' : '(F3)'}
                    </span>
                  </button>
                ))}
              </div>

              {checkoutPayment === 'cash' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[12px] font-medium text-zinc-700 mb-1">Efectivo recibido</label>
                    <input
                      ref={cashReceivedRef}
                      value={cashReceived}
                      onChange={(e) => { setCashReceived(e.target.value); setCheckoutError(null) }}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="w-full h-10 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-zinc-600">Vuelto</span>
                    <span className={`font-semibold ${cashIsValid ? 'text-zinc-900' : 'text-red-700'}`}>
                      ${Math.max(0, change).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {!cashIsValid && (
                    <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      El efectivo recibido debe ser mayor o igual al total.
                    </div>
                  )}
                </div>
              )}

              {checkoutError && (
                <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {checkoutError}
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={saving || cart.length === 0 || !cashIsValid}
                className="w-full h-11 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-800">Cliente</div>
              <button
                onClick={() => setCustomerOpen(false)}
                className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Cerrar
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
                className="w-full h-10 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
              />

              {customerError && (
                <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  Error buscando clientes: {customerError}
                </div>
              )}

              <div className="max-h-[360px] overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                <button
                  onClick={() => { setCustomer(null); setCustomerOpen(false); searchRef.current?.focus() }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors"
                >
                  <div className="text-[13px] font-medium text-zinc-900">Consumidor final</div>
                  <div className="text-[11px] text-zinc-500">Sin asignar cliente</div>
                </button>

                {customerRows.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCustomer(c); setCustomerOpen(false); searchRef.current?.focus() }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="text-[13px] font-medium text-zinc-900 truncate">
                      {c.trade_name ?? c.legal_name}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      {c.legal_name}{c.cuit ? ` · CUIT ${c.cuit}` : ''}
                    </div>
                  </button>
                ))}

                {customerRows.length === 0 && customerQuery.trim() && (
                  <div className="px-3 py-6 text-center text-[12px] text-zinc-500">
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-800">Ticket</div>
              <button
                onClick={startNewSale}
                className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Nueva venta
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-[12px] text-zinc-500">
                {new Date(receiptSale.sold_at).toLocaleString('es-AR')}
                {' · '}
                {PAYMENT_LABELS[receiptSale.payment_method]}
              </div>

              <div id="pos-receipt" className="border border-zinc-200 rounded-lg p-3">
                <div className="text-[13px] font-semibold text-zinc-900">Andiko POS</div>
                <div className="text-[11px] text-zinc-500">Venta: {receiptSale.local_id}</div>
                <div className="mt-3 space-y-2">
                  {receiptSale.items.map((it, idx) => (
                    <div key={`${it.product_id}-${idx}`} className="flex gap-2 text-[12px]">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-zinc-800">{it.product_name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {it.qty} × ${parseFloat(it.unit_price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="font-medium text-zinc-900">
                        ${parseFloat(it.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-200 space-y-1 text-[12px]">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>${parseFloat(receiptSale.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>IVA</span>
                    <span>${parseFloat(receiptSale.tax_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-zinc-900 text-[13px] pt-1">
                    <span>Total</span>
                    <span>${parseFloat(receiptSale.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 h-10 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Imprimir <span className="text-[11px] text-blue-100">{`(${modKey}+P)`}</span>
                </button>
                <button
                  onClick={startNewSale}
                  className="flex-1 h-10 bg-white text-zinc-700 font-semibold rounded-lg border border-zinc-300 hover:border-zinc-400 transition-colors"
                >
                  Nueva venta <span className="text-[11px] text-zinc-400">{`(${modKey}+N)`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left: product search */}
      <div className="flex flex-col flex-1 p-4 gap-3 overflow-hidden">
        <div className="flex items-center gap-2">
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Buscar producto por nombre o código… (${modKey} + K)`}
            className="flex-1 h-10 px-4 text-sm border border-zinc-300 rounded-md focus:outline-none focus:border-blue-500 bg-white"
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
            className="h-10 px-3 text-[13px] font-medium bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
          >
            Ver precio <span className="text-[11px] text-zinc-400">{`(${modKey}+I)`}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 content-start">
          {filtered.slice(0, 40).map(p => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="text-left bg-white border border-zinc-200 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="text-[13px] font-medium text-zinc-900 truncate">{p.name}</div>
              {p.sku && <div className="text-[11px] text-zinc-400 font-mono">{p.sku}</div>}
              <div className="mt-1 text-sm font-semibold text-zinc-800">
                ${parseFloat(p.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
            </button>
          ))}
          {filtered.length === 0 && search && (
            <div className="col-span-2 text-center text-sm text-zinc-400 py-8">Sin resultados para &quot;{search}&quot;</div>
          )}
        </div>
      </div>

      {/* Right: cart + checkout */}
      <div className="flex flex-col w-80 border-l border-zinc-200 bg-white">
        <div className="px-4 py-3 border-b border-zinc-100 text-sm font-semibold text-zinc-700">Carrito</div>

        {/* Cashier — read-only, set from Turno de caja */}
        <div className="px-4 py-2.5 border-b border-zinc-100">
          <div className="text-[11px] text-zinc-500">Cajero/a en turno</div>
          <div className="text-[13px] font-medium text-zinc-900 truncate">
            {cashierName || <span className="text-zinc-400 italic">Sin turno abierto</span>}
          </div>
          {noCashierError && (
            <div className="mt-1 text-[11px] text-amber-700">
              Abrí un turno de caja antes de cobrar
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="px-4 py-3 border-b border-zinc-100">
          <button
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
            className="w-full text-left"
          >
            <div className="text-[11px] text-zinc-500">Cliente</div>
            <div className="text-[13px] font-medium text-zinc-900 truncate">
              {customer ? (customer.trade_name ?? customer.legal_name) : 'Consumidor final'}{' '}
              <span className="text-[11px] font-medium text-zinc-400">({modKey} + U)</span>
            </div>
            {customer?.cuit && <div className="text-[11px] text-zinc-500">CUIT {customer.cuit}</div>}
          </button>
          {customer && (
            <button
              onClick={() => setCustomer(null)}
              className="mt-2 text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
            >
              Quitar cliente
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {cart.length === 0 && (
            <div className="text-center text-sm text-zinc-400 py-10">Agregá productos al carrito</div>
          )}
          {cart.map(({ product, qty }) => (
            <div key={product.id} className="px-4 py-2.5 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-zinc-900 truncate">{product.name}</div>
                <div className="text-[12px] text-zinc-500">
                  ${parseFloat(product.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })} c/u
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(product.id, qty - 1)} className="w-6 h-6 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-sm font-medium flex items-center justify-center">−</button>
                <span className="w-6 text-center text-[13px] font-medium">{qty}</span>
                <button onClick={() => updateQty(product.id, qty + 1)} className="w-6 h-6 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-sm font-medium flex items-center justify-center">+</button>
              </div>
              <div className="text-[13px] font-semibold text-zinc-900 w-16 text-right">
                ${(parseFloat(product.price) * qty).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-zinc-200 px-4 py-3 space-y-1 text-[13px]">
          <div className="flex justify-between text-zinc-500">
            <span>Subtotal (sin IVA)</span>
            <span>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>IVA</span>
            <span>${taxAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between font-semibold text-base text-zinc-900 pt-1 border-t border-zinc-100">
            <span>Total</span>
            <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {lastSale && (
          <div className="mx-4 mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-[12px] text-green-800">
            ✓ Venta registrada: ${parseFloat(lastSale.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
        )}

        <div className="px-4 pb-4">
          <button
            onClick={openCheckout}
            disabled={cart.length === 0 || saving || !cashierUserId}
            className="w-full h-11 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Registrando…' : `Cobrar (${modKey} + Enter)`}
          </button>
        </div>
      </div>
    </div>
  )
}
