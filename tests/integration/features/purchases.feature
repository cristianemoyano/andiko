# language: es
Característica: Ciclo Completo de Compras
  Como gerente de compras
  Quiero gestionar órdenes de compra, recepción de materiales y pagos a proveedores
  Para mantener el inventario actualizado y la relación con proveedores al día

  Escenario: Crear Orden de Compra → Recibir → Pagar
    Dado estoy autenticado como "comprador"
    Y existe un proveedor "Proveedor Químicos" con CUIT "20123456789"
    Y existen productos en catálogo

    Cuando navego a compras
    Y creo una orden de compra para "Proveedor Químicos" con:
      | Producto    | Cantidad | Precio Unitario |
      | Resina      | 10       | 150.50          |
      | Catalizador | 5        | 75.25           |

    Entonces la orden tiene estado "Borrador"
    Y el total es 2276.31

    Cuando envío la orden al proveedor
    Y registro la recepción de la orden
    Entonces el stock aumenta: Resina=10, Catalizador=5
    Y la orden cambia a "Recibido"

    Cuando registro la factura del proveedor por la orden
    Y registro un pago del total de la factura a "Proveedor Químicos"
    Entonces la factura del proveedor está "Pagada"
    Y el saldo del proveedor es 0.00

  Escenario: Búsqueda de orden de compra
    Dado estoy autenticado como "comprador"
    Cuando navego a compras
    Y busco la orden de compra "OC-001"
    Entonces veo la orden en la lista

  Escenario: Filtrar órdenes por estado
    Dado estoy autenticado como "comprador"
    Cuando navego a compras
    Y aplico un filtro de estado "Enviado"
    Entonces veo solo órdenes con estado "Enviado"

  Escenario: Recepción parcial
    Dado estoy autenticado como "comprador"
    Y existe una orden de compra "OC-002" con 10 unidades

    Cuando navego a compras
    Y busco la orden de compra "OC-002"
    Y registro una recepción parcial de 7 unidades

    Entonces el stock aumenta 7 unidades
    Y la orden queda en estado "Parcialmente Recibida"
    Y permanece pendiente de recibir 3 unidades

  Escenario: Cancelación de orden
    Dado estoy autenticado como "comprador"
    Y existe una orden de compra "OC-003" en estado "Pendiente"

    Cuando navego a compras
    Y busco la orden de compra "OC-003"
    Y hago clic en "Cancelar Orden"
    Y confirmo la cancelación

    Entonces la orden cambia a "Cancelada"
    Y no se deduce stock

  Escenario: Descuento en orden de compra
    Dado estoy autenticado como "comprador"
    Y existe un proveedor con descuento por volumen

    Cuando creo una orden de compra con 50 unidades
    Entonces se aplica automáticamente 5% de descuento
    Y el total refleja el descuento aplicado
