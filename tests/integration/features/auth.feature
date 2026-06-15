# language: es
Característica: Autenticación
  Como usuario de Andiko
  Quiero poder iniciar sesión, cerrar sesión y mantener mi sesión segura
  Para acceder a las funcionalidades del ERP

  Escenario: Inicio de sesión exitoso
    Dado voy a la página de login
    Cuando ingreso las credenciales "test-admin@andiko.local" y "Test123456!"
    Y hago clic en login
    Entonces soy redireccionado al dashboard

  Escenario: Credenciales inválidas
    Dado voy a la página de login
    Cuando ingreso las credenciales "test-admin@andiko.local" y "IncorrectPassword"
    Y hago clic en login
    Entonces veo error "Credenciales inválidas"
    Y permanezco en la página de login

  Escenario: Logout exitoso
    Dado estoy autenticado como "admin"
    Cuando hago logout
    Entonces soy redireccionado a login

  Escenario: Acceso sin autenticación
    Cuando intento acceder a "/erp/sales" sin autenticación
    Entonces soy redireccionado a login automáticamente

  Escenario: Sesión expirada
    Dado estoy autenticado como "admin"
    Cuando dejo la sesión inactiva por 30 minutos
    Entonces la sesión expira automáticamente
