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
  apiKey:            'TU_API_KEY',
  authDomain:        'TU_PROYECTO.firebaseapp.com',
  projectId:         'TU_PROYECTO',
  storageBucket:     'TU_PROYECTO.appspot.com',
  messagingSenderId: 'TU_SENDER_ID',
  appId:             'TU_APP_ID',
};
