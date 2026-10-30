// ============================================================
//  SINCRONIZACIÓN CON FIRESTORE (agenda y votos en tiempo real)
//
//  viajes/{VIAJE}/agenda/{diaId} -> { lugares: [ids], actualizadoPor, actualizadoEn }
//  viajes/{VIAJE}/votos/{uid}    -> { nombre, lugares: [ids], actualizadoEn }
//
//  Usamos arrayUnion / arrayRemove para que dos personas puedan
//  cambiar cosas al mismo tiempo sin borrarse lo de la otra.
// ============================================================

const VIAJE = "dallas";

export function iniciarNube(db, fs) {
  const {
    collection, doc, onSnapshot, setDoc, writeBatch,
    arrayUnion, arrayRemove, serverTimestamp,
  } = fs;

  const colAgenda = collection(db, "viajes", VIAJE, "agenda");
  const colVotos = collection(db, "viajes", VIAJE, "votos");

  // ---------- Escuchar cambios (cualquiera puede leer) ----------
  // includeMetadataChanges: así sabemos cuándo ya llegó la versión del
  // servidor (y no solo la caché local).
  onSnapshot(
    colAgenda,
    { includeMetadataChanges: true },
    (snap) => {
      const agenda = {};
      snap.forEach((d) => {
        const l = d.data().lugares;
        agenda[d.id] = Array.isArray(l) ? l : [];
      });
      window.App.actualizarAgenda(agenda, !snap.metadata.fromCache);
    },
    (err) => window.App.errorNube(err)
  );

  onSnapshot(
    colVotos,
    (snap) => {
      const votos = {};
      snap.forEach((d) => {
        const v = d.data();
        votos[d.id] = {
          nombre: typeof v.nombre === "string" ? v.nombre : "Alguien",
          lugares: Array.isArray(v.lugares) ? v.lugares : [],
        };
      });
      window.App.actualizarVotos(votos);
    },
    (err) => window.App.errorNube(err)
  );

  // ---------- Escrituras (solo miembros; lo validan las reglas) ----------
  const datosDia = (lugares, quien) => ({
    lugares,
    actualizadoPor: quien.nombre,
    actualizadoEn: serverTimestamp(),
  });

  const datosVoto = (lugares, quien) => ({
    nombre: quien.nombre,
    lugares,
    actualizadoEn: serverTimestamp(),
  });

  return {
    // Agregar, quitar o mover (quitar de un día + agregar a otro) en una
    // sola operación atómica.
    async cambiarAgenda(lugarId, quitarDe, agregarA, quien) {
      const lote = writeBatch(db);
      if (quitarDe) lote.set(doc(colAgenda, quitarDe), datosDia(arrayRemove(lugarId), quien), { merge: true });
      if (agregarA) lote.set(doc(colAgenda, agregarA), datosDia(arrayUnion(lugarId), quien), { merge: true });
      await lote.commit();
    },

    async votar(lugarId, si, quien) {
      await setDoc(
        doc(colVotos, quien.uid),
        datosVoto(si ? arrayUnion(lugarId) : arrayRemove(lugarId), quien),
        { merge: true }
      );
    },

    // Sube un plan guardado en el navegador. Se SUMA a lo que ya hay.
    async importar(plan, quien) {
      const lote = writeBatch(db);
      let cambios = 0;
      Object.entries(plan.agenda).forEach(([diaId, ids]) => {
        if (ids.length) {
          lote.set(doc(colAgenda, diaId), datosDia(arrayUnion(...ids), quien), { merge: true });
          cambios++;
        }
      });
      if (plan.favoritos.length) {
        lote.set(doc(colVotos, quien.uid), datosVoto(arrayUnion(...plan.favoritos), quien), { merge: true });
        cambios++;
      }
      if (cambios) await lote.commit();
    },
  };
}
