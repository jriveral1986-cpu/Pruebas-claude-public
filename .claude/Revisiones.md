# Revisiones

## 2026-04-15 — Sprint 6: informe.html mejorado
- Eliminado: sección Trabajo Pesado (calculador + educativo), sección Metodología, nav "Otros módulos"
- Agregado: tabla Escenarios de Jubilación (hoy vs +5 años con PGU), panel ELD, filas grupo familiar en Antecedentes, bonificación por hijo (solo mujeres), botones Exportar CSV/JSON
- CSS: eliminados estilos `.tp-calc`, `.tp-edu`, `.step`, `.step-num`, `.step-title`, `.step-body`; agregados `.btn-export`, `.eld-card--aplica/--no`, `.escenarios-table tr.esc-hoy/esc-fut`

## 2026-04-15 — Sprint 7: Login obligatorio + Firebase Auth
- Creado: js/firebase-config.js (template de configuración)
- Creado: js/auth.js (requireAuth, requireAdmin, initNavAuth, syncToFirestore, loadFromFirestore, mensajeError)
- Creado: pages/login.html (tabs login/registro, Google OAuth, modo admin vía ?admin=1)
- Creado: pages/admin.html (panel admin, protegido por requireAdmin, gestión UIDs)
- Modificado: css/main.css — estilos nav__user/avatar/logout
- Modificado: js/store.js — Store.uid() helper
- Modificado: index.html + 8 pages — requireAuth + initNavAuth al inicio del módulo

## 2026-04-16 — Admin login: credenciales fijas administrador/admin
- pages/login.html: en modo ?admin=1, campo email cambia a tipo texto con label "Usuario"
- pages/login.html: si usuario === "administrador", mapea internamente a email Firebase "admin@previsionchile.local"
- pages/login.html: si usuario no es "administrador", muestra "Usuario no reconocido"
- pages/admin.html: sección Info actualizada con instrucciones de setup (crear cuenta Firebase con email admin@previsionchile.local)

## 2026-04-16 — Fix: credenciales internas + export firebase-config + Firestore no bloquea login
- js/firebase-config.js: agregado `export` faltante (sin él todos los imports fallaban)
- pages/login.html: contraseña interna Firebase mapeada a "Admin.2026!" (min 6 chars requeridos por Firebase)
- pages/login.html: valida usuario Y contraseña antes de llamar Firebase; muestra "Usuario o contraseña incorrectos"
- js/auth.js: `loadFromFirestore` en `iniciarSesionEmail` e `iniciarSesionGoogle` cambiado a fire-and-forget (.catch(() => {})) para no bloquear login si Firestore no está habilitado aún

## 2026-04-17 — Registro de usuarios solo para administrador
- pages/login.html: eliminado tab "Crear cuenta" y todo su HTML/JS — registro público deshabilitado
- pages/admin.html: agregada card "Crear Usuario" con formulario nombre/email/contraseña
- js/auth.js: agregada función exportada `crearUsuario(nombre, email, pass)` — crea usuario y re-autentica al admin automáticamente (createUserWithEmailAndPassword hace sign-in como el nuevo usuario)
- js/auth.js: constantes ADMIN_INTERNAL_EMAIL y ADMIN_INTERNAL_PASS movidas a nivel de módulo para ser reutilizadas por crearUsuario

## 2026-04-16 — Fix: requireAuth usa auth.authStateReady() — elimina loop de redirección
- js/auth.js: `requireAuth()` refactorizado para usar `auth.authStateReady()` (Firebase SDK 10.x)
- Elimina condición de carrera donde `onAuthStateChanged` disparaba con null antes de restaurar la sesión desde IndexedDB, causando redirección en bucle a login.html
- Login administrador/admin validado con Playwright: redirige correctamente a index.html
