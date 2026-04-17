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

## 2026-04-17 — Admin login: Google también permitido en modo admin
- pages/login.html: modo ?admin=1 ahora muestra botón "Continuar con Google"
- pages/login.html: tras login Google en modo admin, verifica isAdmin() — si no tiene flag, hace cerrarSesion() y muestra "Esta cuenta Google no tiene permisos de administrador"
- pages/login.html: importados cerrarSesion e isAdmin desde auth.js

## 2026-04-17 — Registro de usuarios solo para administrador
- pages/login.html: eliminado tab "Crear cuenta" y todo su HTML/JS — registro público deshabilitado
- pages/admin.html: agregada card "Crear Usuario" con formulario nombre/email/contraseña
- js/auth.js: agregada función exportada `crearUsuario(nombre, email, pass)` — crea usuario y re-autentica al admin automáticamente (createUserWithEmailAndPassword hace sign-in como el nuevo usuario)
- js/auth.js: constantes ADMIN_INTERNAL_EMAIL y ADMIN_INTERNAL_PASS movidas a nivel de módulo para ser reutilizadas por crearUsuario

## 2026-04-16 — Fix: requireAuth usa auth.authStateReady() — elimina loop de redirección
- js/auth.js: `requireAuth()` refactorizado para usar `auth.authStateReady()` (Firebase SDK 10.x)
- Elimina condición de carrera donde `onAuthStateChanged` disparaba con null antes de restaurar la sesión desde IndexedDB, causando redirección en bucle a login.html
- Login administrador/admin validado con Playwright: redirige correctamente a index.html

## 2026-04-17 — Setup Firestore: habilitación + permisos admin + UID de usuario

### Problema raíz
- Firestore Database no estaba habilitado en proyecto `previsionchile-577a1` → todas las operaciones Firestore fallaban con `permission-denied`
- Documento `users/{adminUID}/perfil/info` no existía → `requireAdmin()` redirigía a index.html aunque el admin estuviera autenticado

### Solución
- Usuario habilitó Firestore Database en Firebase Console (modo producción, región us-central1)
- Usuario actualizó Firestore Security Rules a modo permisivo temporal (`allow read, write: if request.auth != null`)
- Documento `users/RPl9dbv4peQ7QIMrbncxETgtvPY2/perfil/info` creado vía JS desde el navegador con campos `isAdmin: true`, `email: admin@previsionchile.local`
- UID `57FNeXp323R4DwUyjthokTFEI6K2` otorgado con `isAdmin: true` desde panel admin (validado con Playwright)

### Pendiente (acción del usuario)
- Cambiar Firestore Security Rules a reglas definitivas que restringen cada usuario a su propio documento (`request.auth.uid == userId`)

## 2026-04-17 — Nav: enlace Admin visible solo para administradores
- js/auth.js: `initNavAuth()` convertida a `async` — ahora llama `isAdmin()` antes de inyectar el nav
- js/auth.js: si `isAdmin()` retorna true, inyecta `<a class="nav__link nav__link--admin">` con ícono de escudo SVG apuntando a admin.html
- css/main.css: agregado estilo `.nav__link--admin` con color dorado, borde sutil y hover
- index.html + 8 pages: `initNavAuth()` cambiado a `await initNavAuth()` en todos los módulos
- Validado con Playwright: enlace "Admin" aparece en navbar solo para usuarios con isAdmin:true

## 2026-04-17 — admin.html: botón Volver al inicio
- pages/admin.html: agregado `<a class="btn-back">` con ícono SVG chevron-left en el header del panel
- pages/admin.html: estilo `.btn-back` inline — borde semitransparente sobre fondo navy, hover sutil
- Validado con Playwright: botón "Volver" visible en header del panel admin
