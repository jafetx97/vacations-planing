// ============================================================
//  INICIO DE SESIÓN CON GOOGLE (Firebase Auth)
//  - Si no hay configuración, la app sigue en modo local.
//  - Si la persona inicia sesión y su correo está en la colección
//    "miembros" de Firestore, puede editar. Si no, solo lectura.
// ============================================================
import { firebaseConfig } from "./firebase-config.js";
import { iniciarNube } from "./nube.js";

const VERSION_SDK = "13.1.0";
const CDN = `https://www.gstatic.com/firebasejs/${VERSION_SDK}`;

const configurado =
  firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "PEGA_AQUI";

if (!configurado) {
  console.info("Firebase sin configurar: modo local (sin inicio de sesión).");
  window.App.establecerSesion({ estado: "local" });
} else {
  iniciar().catch((e) => {
    console.error("No se pudo iniciar Firebase:", e);
    window.App.establecerSesion({ estado: "error", mensaje: "No se pudo conectar. Revisa tu internet." });
  });
}

async function iniciar() {
  // Cargamos el SDK solo si hace falta (no hay build ni npm).
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  const { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } = authMod;
  const {
    getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    doc, getDoc,
  } = fsMod;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  auth.languageCode = "es";

  // Caché en el dispositivo: la app funciona sin señal y sincroniza después.
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn("Sin caché offline, usando Firestore normal:", e);
    db = getFirestore(app);
  }

  // Agenda y votos en tiempo real (se pueden leer aun sin sesión).
  window.App.usarNube(iniciarNube(db, fsMod));

  const proveedor = new GoogleAuthProvider();
  // Útil en celulares compartidos: siempre pregunta qué cuenta usar.
  proveedor.setCustomParameters({ prompt: "select_account" });

  // Botones de entrar / salir (los pinta app.js).
  document.addEventListener("click", async (e) => {
    if (e.target.closest("#btn-login")) {
      try {
        await signInWithPopup(auth, proveedor);
      } catch (err) {
        manejarErrorLogin(err);
      }
    } else if (e.target.closest("#btn-logout")) {
      await signOut(auth);
    }
  });

  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) {
      window.App.establecerSesion({ estado: "anonimo" });
      return;
    }

    window.App.establecerSesion({ estado: "cargando" });
    const email = (usuario.email || "").toLowerCase();
    const base = {
      uid: usuario.uid,
      email,
      nombre: usuario.displayName || email,
      foto: usuario.photoURL || "",
    };

    try {
      // Solo cada quien puede leer su propio documento de miembro.
      const snap = await getDoc(doc(db, "miembros", email));
      if (snap.exists() && usuario.emailVerified) {
        const datos = snap.data();
        window.App.establecerSesion({ ...base, estado: "miembro", nombre: datos.nombre || base.nombre });
      } else {
        window.App.establecerSesion({ ...base, estado: "invitado" });
      }
    } catch (err) {
      console.error("Error al revisar la lista de miembros:", err);
      window.App.establecerSesion({
        ...base,
        estado: "invitado",
        mensaje: "No pude revisar la lista de la familia. Intenta de nuevo.",
      });
    }
  });
}

function manejarErrorLogin(err) {
  const codigo = err && err.code;
  if (codigo === "auth/popup-closed-by-user" || codigo === "auth/cancelled-popup-request") return;

  const mensajes = {
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta de nuevo.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
  };
  console.error("Error de inicio de sesión:", err);
  alert(mensajes[codigo] || "No se pudo iniciar sesión. Intenta de nuevo.");
}
