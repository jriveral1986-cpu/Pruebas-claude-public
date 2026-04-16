/**
 * firebase-config.js — Configuración del proyecto Firebase
 *
 * SETUP (una sola vez):
 *  1. Ir a https://console.firebase.google.com
 *  2. Crear proyecto "prevision-chile"
 *  3. Agregar app web → copiar el objeto firebaseConfig
 *  4. Authentication → habilitar Email/Contraseña + Google
 *  5. Firestore Database → crear en modo producción (región us-central1)
 *  6. Reemplazar los valores TU_* abajo con los de tu proyecto
 *
 * NOTA SEGURIDAD:
 *  La API key de Firebase para web NO es un secreto — Firebase la expone
 *  al cliente por diseño. La seguridad viene de las Firestore Security Rules
 *  y de los dominios autorizados en Firebase Console.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyBj25zGRFI_bSIjiSmE0QsbPvrWLJwj4r8",
  authDomain: "previsionchile-577a1.firebaseapp.com",
  projectId: "previsionchile-577a1",
  storageBucket: "previsionchile-577a1.firebasestorage.app",
  messagingSenderId: "261701629963",
  appId: "1:261701629963:web:69a53fe2378efa0cfbaf0e",
  measurementId: "G-EKLESWDYHF"
};