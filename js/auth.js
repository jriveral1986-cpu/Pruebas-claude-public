/**
 * auth.js — Firebase Auth + Firestore sync
 *
 * Exports:
 *   requireAuth()        — redirige a login.html si no hay sesión activa
 *   initNavAuth()        — inyecta avatar + botón Salir en el .nav
 *   iniciarSesionEmail() — sign-in email/contraseña
 *   iniciarSesionGoogle()— sign-in OAuth Google popup
 *   registrarse()        — crear cuenta nueva
 *   cerrarSesion()       — logout + limpiar localStorage
 *   syncToFirestore()    — guarda Store en /users/{uid}/datos
 *   loadFromFirestore()  — carga /users/{uid}/datos → Store
 *   getUsuarioActual()   — devuelve el user de Firebase o null
 */

import { firebaseConfig }        from './firebase-config.js';
import { Store }                 from './store.js';

// ── Firebase SDK (CDN modular) ────────────────────────────────────────────────
import { initializeApp }         from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
}                                from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
}                                from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// ── Credenciales internas admin ───────────────────────────────────────────────
const ADMIN_INTERNAL_EMAIL = 'admin@previsionchile.local';
const ADMIN_INTERNAL_PASS  = 'Admin.2026!';

// ── Inicialización ────────────────────────────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

// Mantener referencia global para Store.uid()
onAuthStateChanged(auth, (user) => { window._firebaseUser = user || null; });

// ── requireAuth ───────────────────────────────────────────────────────────────
/**
 * Espera a que Firebase resuelva el estado de autenticación.
 * Usa auth.authStateReady() para esperar a que la persistencia se cargue.
 * Si no hay sesión → redirige a login.html preservando la URL actual.
 */
export async function requireAuth() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (user) {
    window._firebaseUser = user;
    return user;
  }
  const next = encodeURIComponent(location.pathname + location.search);
  const base = location.pathname.includes('/pages/') ? '../pages/login.html' : 'pages/login.html';
  location.href = `${base}?next=${next}`;
  // Mantener la promesa pendiente mientras redirige
  return new Promise(() => {});
}

// ── getUsuarioActual ──────────────────────────────────────────────────────────
export function getUsuarioActual() {
  return auth.currentUser;
}

// ── initNavAuth ───────────────────────────────────────────────────────────────
/**
 * Inyecta el bloque de usuario (avatar + nombre + botón Salir) en el .nav.
 * Llama después de requireAuth().
 */
export function initNavAuth() {
  const nav  = document.querySelector('.nav');
  if (!nav) return;
  const user = auth.currentUser;
  if (!user) return;

  // Calcular iniciales (máx. 2 caracteres)
  const nombre    = user.displayName || user.email || '';
  const partes    = nombre.trim().split(/\s+/);
  const iniciales = partes.length >= 2
    ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
    : nombre.slice(0, 2).toUpperCase();
  const nombreCorto = partes[0] || user.email.split('@')[0];

  // Inyectar al final del nav
  const span = document.createElement('span');
  span.className = 'nav__user';
  span.innerHTML = `
    <span class="nav__avatar" aria-hidden="true">${iniciales}</span>
    <span class="nav__username">${nombreCorto}</span>
    <button class="nav__logout" id="btn-logout" type="button" aria-label="Cerrar sesión">Salir</button>
  `;
  nav.appendChild(span);

  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
}

// ── iniciarSesionEmail ────────────────────────────────────────────────────────
export async function iniciarSesionEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  // Firestore puede no estar habilitado aún — no bloquear el login
  loadFromFirestore(cred.user).catch(() => {});
  return cred.user;
}

// ── iniciarSesionGoogle ───────────────────────────────────────────────────────
export async function iniciarSesionGoogle() {
  const cred = await signInWithPopup(auth, provider);
  _ensurePerfil(cred.user).catch(() => {});
  loadFromFirestore(cred.user).catch(() => {});
  return cred.user;
}

// ── crearUsuario (solo desde admin) ──────────────────────────────────────────
/**
 * Crea un nuevo usuario y re-autentica al admin automáticamente.
 * createUserWithEmailAndPassword hace sign-in como el nuevo usuario,
 * por eso al terminar volvemos a iniciar sesión con las credenciales admin.
 */
export async function crearUsuario(nombre, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (nombre) await updateProfile(cred.user, { displayName: nombre });
  await _ensurePerfil(cred.user, nombre);
  const nuevoUid = cred.user.uid;
  // Re-autenticar como admin
  await signInWithEmailAndPassword(auth, ADMIN_INTERNAL_EMAIL, ADMIN_INTERNAL_PASS);
  return nuevoUid;
}

// ── cerrarSesion ──────────────────────────────────────────────────────────────
export async function cerrarSesion() {
  await signOut(auth);
  Store.borrar();
  const base = location.pathname.includes('/pages/') ? '../pages/login.html' : 'pages/login.html';
  location.href = base;
}

// ── recuperarPassword ─────────────────────────────────────────────────────────
export async function recuperarPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── syncToFirestore ───────────────────────────────────────────────────────────
/**
 * Guarda el Store completo en /users/{uid}/datos en Firestore.
 * Llamar después de cada guardado de datos del afiliado.
 */
export async function syncToFirestore() {
  const user = auth.currentUser;
  if (!user) return;
  const datos = Store.leer();
  await setDoc(doc(db, 'users', user.uid, 'datos', 'store'), {
    ...datos,
    _syncAt: serverTimestamp(),
  });
}

// ── loadFromFirestore ─────────────────────────────────────────────────────────
/**
 * Carga /users/{uid}/datos/store desde Firestore y lo guarda en localStorage.
 * Llamar después de login exitoso.
 */
export async function loadFromFirestore(user) {
  const u = user || auth.currentUser;
  if (!u) return;
  const snap = await getDoc(doc(db, 'users', u.uid, 'datos', 'store'));
  if (snap.exists()) {
    const datos = snap.data();
    delete datos._syncAt; // no guardar el timestamp de server en localStorage
    Store.guardar(datos);
  }
}

// ── _ensurePerfil (privado) ───────────────────────────────────────────────────
async function _ensurePerfil(user, nombre) {
  const ref  = doc(db, 'users', user.uid, 'perfil', 'info');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      nombre:    nombre || user.displayName || '',
      email:     user.email,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
  } else {
    // Actualizar último login
    await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
  }
}

// ── isAdmin ───────────────────────────────────────────────────────────────────
/**
 * Verifica si el usuario actual tiene el flag isAdmin en Firestore.
 * El flag se setea manualmente desde Firebase Console o con el script de setup.
 * Los administradores se crean SOLO con email/contraseña (sin Google).
 */
export async function isAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, 'users', user.uid, 'perfil', 'info'));
  return snap.exists() ? (snap.data().isAdmin === true) : false;
}

/**
 * requireAdmin() — igual que requireAuth() pero además verifica isAdmin.
 * Redirige a index.html si el usuario no tiene permisos de admin.
 */
export async function requireAdmin() {
  await requireAuth();
  const admin = await isAdmin();
  if (!admin) {
    const base = location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
    location.href = base;
    throw new Error('Acceso denegado — se requieren permisos de administrador');
  }
}

// ── Mensajes de error en español ─────────────────────────────────────────────
export function mensajeError(code) {
  const map = {
    'auth/invalid-email':            'El correo electrónico no es válido.',
    'auth/user-not-found':           'No existe una cuenta con ese correo.',
    'auth/wrong-password':           'Contraseña incorrecta.',
    'auth/invalid-credential':       'Correo o contraseña incorrectos.',
    'auth/email-already-in-use':     'Ya existe una cuenta con ese correo.',
    'auth/weak-password':            'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user':     'Se cerró la ventana de Google. Intenta de nuevo.',
    'auth/network-request-failed':   'Error de red. Verifica tu conexión.',
    'auth/too-many-requests':        'Demasiados intentos. Espera unos minutos.',
    'auth/user-disabled':            'Esta cuenta ha sido deshabilitada.',
  };
  return map[code] || 'Error inesperado. Intenta de nuevo.';
}
