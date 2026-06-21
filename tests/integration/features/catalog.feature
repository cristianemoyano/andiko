# language: es
Característica: Catálogo de Productos
  Como gerente de inventario
  Quiero gestionar el catálogo de productos
  Para mantener información actualizada de precios, costos y stock

  Escenario: Crear nuevo producto
    Dado estoy autenticado como "gerente"
    Cuando navego a "/erp/catalog/products"
    Y creo un producto con datos:
      | nombre          | Resina Epóxica       |
      | codigo          | RES-001              |
      | categoria       | Materias Primas      |
      | unidad          | kg                   |
      | precio_costo    | 150.50               |
      | precio_venta    | 250.00               |
    Entonces veo el mensaje "Producto creado exitosamente"
    Y veo el producto creado en la lista

  Escenario: Buscar producto por nombre
    Dado estoy autenticado como "gerente"
    Y el producto de prueba "Catalizador" está disponible
    Y existen productos en catálogo
    Cuando navego a "/erp/catalog/products"
    Y busco el producto "Catalizador"
    Entonces veo el producto "Catalizador" en la lista

  Escenario: Editar producto
    Dado estoy autenticado como "gerente"
    Y el producto de prueba "Catalizador" está disponible
    Cuando navego a "/erp/catalog/products"
    Y edito el producto "Catalizador"
    Y establezco el precio de venta en "280.00"
    Y guardo el producto
    Entonces veo el mensaje "Producto actualizado"

  Escenario: Archivar producto
    Dado estoy autenticado como "gerente"
    Y el producto de prueba "Catalizador" está disponible
    Cuando navego a "/erp/catalog/products"
    Y archivar el producto "Catalizador"
    Entonces veo el mensaje "Producto actualizado"
    Y el producto "Catalizador" está archivado
    Y no veo el producto "Catalizador" en la lista activa

  Escenario: Filtrar productos por categoría
    Dado estoy autenticado como "gerente"
    Y el producto de prueba "Catalizador" está disponible
    Cuando navego a "/erp/catalog/products"
    Y filtro productos por categoría "Materias Primas"
    Entonces veo solo productos de la categoría "Materias Primas"

  Escenario: Crear lista de precios
    Dado estoy autenticado como "gerente"
    Cuando establezco una lista de precios "Mayoristas" con:
      | producto | precio |
      | CAT-001  | 100.00 |
      | MDF-001  | 85.00  |
    Entonces la tabla contiene "CAT-001"
    Y la tabla contiene "MDF-001"
    Y la lista de precios "Mayoristas" existe
