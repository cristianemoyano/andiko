/**
 * data-testid contract between integration steps and the UI.
 * Steps should prefer getByTestId / [data-testid="..."] over fragile selectors.
 */
export const TEST_IDS = {
  // Layout / auth
  sidebar: 'sidebar',
  logoutBtn: 'logout-btn',
  userMenuTrigger: 'user-menu-trigger',
  loginEmail: 'login-email-input',
  loginPassword: 'login-password-input',
  loginSubmit: 'login-submit-btn',
  loginError: 'login-error',

  // Contacts
  newContactBtn: 'new-contact-btn',
  contactModal: 'contact-modal',
  contactSaveBtn: 'contact-save-btn',
  contactSearch: 'contact-search-input',
  contactTypeFilter: 'contact-type-filter',
  contactRow: 'contact-row',
  contactTypeCell: 'contact-type-cell',
  editContactBtn: 'edit-contact-btn',
  cuitError: 'cuit-error',
  cbuError: 'cbu-error',

  // Contact payment info (detail page)
  paymentInfoAddBtn: 'payment-info-add-btn',
  paymentInfoModal: 'payment-info-modal',
  paymentInfoSaveBtn: 'payment-info-save-btn',

  // Catalog
  newProductBtn: 'new-product-btn',
  productModal: 'product-modal',
  productPricingTab: 'product-pricing-tab',
  productSaveBtn: 'product-save-btn',
  productRow: 'product-row',
  editProductBtn: 'edit-product-btn',
  deleteProductBtn: 'delete-product-btn',
  productSearch: 'product-search-input',
  productStatusFilter: 'product-status-filter',
  productBasePrice: 'product-base-price-input',
  productCostPrice: 'product-cost-price-input',
  archivedBadge: 'archived-badge',

  // Price lists
  newPriceListBtn: 'new-price-list-btn',
  priceListModal: 'price-list-modal',
  priceListNameInput: 'price-list-name-input',
  priceListCreateBtn: 'price-list-create-btn',
  priceListRow: 'price-list-row',
  priceListSkuInput: 'price-list-sku-input',
  priceListPriceInput: 'price-list-price-input',
  priceListSavePriceBtn: 'price-list-save-price-btn',
  priceListItemSku: 'price-list-item-sku',

  // Shared dialogs
  confirmDialog: 'confirm-dialog',
  confirmDialogBtn: 'confirm-dialog-btn',
  confirmDialogCancelBtn: 'confirm-dialog-cancel-btn',

  // Sales — cuenta corriente
  accountStatementSearch: 'account-statement-search',
  accountStatementBalanceFilter: 'account-statement-balance-filter',
  accountStatementRow: 'account-statement-row',
  customerDebt: 'customer-debt',
  customerOverdueBalance: 'customer-overdue-balance',
  dueDate: 'due-date',
  accountMovementRow: 'account-movement-row',

  // Sales — facturas / cobros
  invoiceBalance: 'invoice-balance',
  paymentAmountInput: 'payment-amount-input',
  paymentMethodSelect: 'payment-method-select',
  paymentSubmitBtn: 'payment-submit-btn',

  // Purchases
  purchaseOrderNumber: 'purchase-order-number',
  purchaseOrderStatus: 'purchase-order-status',
  purchaseOrderTotal: 'purchase-order-total',
  supplierInvoiceStatus: 'supplier-invoice-status',

  // Planned — UI not implemented yet (sales / purchases / financials)
  quoteNumber: 'quote-number',
  quoteStatus: 'quote-status',
  quoteTotal: 'quote-total',
  invoiceStatus: 'invoice-status',
  invoiceNumber: 'invoice-number',
  orderNumber: 'order-number',
  orderStatus: 'order-status',
  orderTotal: 'order-total',
  supplierBalance: 'supplier-balance',
  totalAssets: 'total-assets',
  totalLiabilities: 'total-liabilities',
  netEquity: 'net-equity',
  trialBalanceFrom: 'trial-balance-from',
  trialBalanceTo: 'trial-balance-to',
} as const
