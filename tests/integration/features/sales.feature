# language: es
Característica: Ciclo Completo de Ventas
  Como vendedor
  Quiero crear presupuestos, emitir facturas y registrar pagos
  Para llevar un registro completo de las transacciones de venta

  Escenario: Crear Presupuesto → Factura → Cobro
    Dado estoy autenticado como "vendedor"
    Y existe un cliente "Cliente XYZ" con CUIT "20555666777"
    Y existen productos con stock: Producto A=50, Producto B=30

    Cuando navego a ventas
    Y creo un presupuesto para "Cliente XYZ" válido por 7 días con:
      | Producto   | Cantidad | Descuento |
      | Producto A | 5        | 0         |
      | Producto B | 3        | 10%       |

    Entonces veo el mensaje "Presupuesto creado"
    Y el presupuesto tiene estado "Borrador"
    Y el total es XXX (con impuestos)

    Cuando confirmo el presupuesto a factura
    Entonces se genera factura con estado "Pendiente de Pago"
    Y el stock disminuye: Producto A=45, Producto B=27

    Cuando registro un pago parcial de "$1000" sobre la factura
    Entonces el saldo pendiente es YYY
    Y se registra una deuda pendiente

  Escenario: Búsqueda de factura
    Dado estoy autenticado como "vendedor"
    Cuando navego a ventas
    Y busco la factura "001-001-00000001"
    Entonces veo la factura en la lista

  Escenario: Filtrar facturas por estado
    Dado estoy autenticado como "vendedor"
    Cuando navego a ventas
    Y filtro facturas por estado "Pendiente de Pago"
    Entonces veo solo facturas con estado "Pendiente de Pago"

  Escenario: Factura directa sin presupuesto
    Dado estoy autenticado como "vendedor"
    Y existe un cliente "Cliente ABC"
    Y existen productos con stock

    Cuando creo una factura directa para "Cliente ABC" con:
      | Producto | Cantidad | Precio |
      | RES-001  | 2        | 250    |

    Entonces se genera factura con número secuencial
    Y el stock se reduce automáticamente

  Escenario: Múltiples pagos en una factura
    Dado estoy autenticado como "vendedor"
    Y existe una factura con total $5000

    Cuando registro un pago de $2000
    Entonces el saldo pendiente es $3000

    Cuando registro otro pago de $3000
    Entonces la factura cambia a "Pagada"
    Y el saldo pendiente es $0

  Escenario: Nota de crédito por devolución
    Dado estoy autenticado como "vendedor"
    Y existe una factura "001-001-00000001" emitida

    Cuando genero nota de crédito por devolución con:
      | Producto   | Cantidad |
      | Producto A | 2        |

    Entonces se crea documento "NC-001-001-00000001"
    Y el saldo de la factura se reduce
    Y el stock aumenta por la devolución

  Escenario: Presupuesto vencido
    Dado estoy autenticado como "vendedor"
    Y existe un presupuesto "PRS-001" válido por 7 días, emitido hace 10 días

    Cuando intento confirmar el presupuesto a factura
    Entonces veo advertencia "Presupuesto vencido"
    Y debo confirmar explícitamente para continuar
