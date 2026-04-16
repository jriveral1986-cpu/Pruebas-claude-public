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
