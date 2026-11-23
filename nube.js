// ============================================================
//  SINCRONIZACIÓN CON FIRESTORE (todo en tiempo real)
//
//  viajes/{VIAJE}                -> { nombre, ciudad, inicio, fin, llegada, salida,
//                                     actualizadoPor, actualizadoEn }   (el viaje activo)
//  viajes/{VIAJE}/agenda/{fecha} -> { lugares: [ids], actualizadoPor, actualizadoEn }
//  viajes/{VIAJE}/votos/{uid}    -> { nombre, lugares: [ids], actualizadoEn }
//  viajes/{VIAJE}/lugares/{id}   -> { nombre, categoria, mapa, mapsUrl, web, wiki,
//                                     creadoPor, creadoEn, actualizadoPor, actualizadoEn }
//
//  VIAJE es solo el ID interno del documento: no es el nombre del viaje
//  (ese está en el campo "nombre" y se cambia desde la app).
//
//  Usamos arrayUnion / arrayRemove para que dos personas puedan
//  cambiar cosas al mismo tiempo sin borrarse lo de la otra.
// ============================================================

const VIAJE = "dallas";

export function iniciarNube(db, fs) {
  const {
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs, writeBatch,
    arrayUnion, arrayRemove, serverTimestamp,
  } = fs;

  const docViaje = doc(db, "viajes", VIAJE);
  const colAgenda = collection(db, "viajes", VIAJE, "agenda");
  const colVotos = collection(db, "viajes", VIAJE, "votos");
  const colLugares = collection(db, "viajes", VIAJE, "lugares");

  // ---------- Escuchar cambios (cualquiera puede leer) ----------
  // includeMetadataChanges: así sabemos cuándo ya llegó la versión del
  // servidor (y no solo la caché local).
  onSnapshot(
    docViaje,
    { includeMetadataChanges: true },
    (snap) => {
      window.App.actualizarViaje(snap.exists() ? snap.data() : null, !snap.metadata.fromCache);
    },
    (err) => window.App.errorNube(err)
  );

  onSnapshot(
    colLugares,
    { includeMetadataChanges: true },
    (snap) => {
      const lista = [];
      snap.forEach((d) => lista.push({ ...d.data(), id: d.id }));
      window.App.actualizarLugares(lista, !snap.metadata.fromCache);
    },
    (err) => window.App.errorNube(err)
  );

  onSnapshot(
    colAgenda,
    (snap) => {
      const agenda = {};
      snap.forEach((d) => {
        const l = d.data().lugares;
        agenda[d.id] = Array.isArray(l) ? l : [];
      });
      window.App.actualizarAgenda(agenda);
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

    // ---------- Lugares ----------
    // datos: { nombre, categoria, mapa, mapsUrl, web, wiki } (todos string)
    async crearLugar(id, datos, quien) {
      await setDoc(doc(colLugares, id), {
        ...datos,
        creadoPor: quien.nombre,
        creadoEn: serverTimestamp(),
        actualizadoPor: quien.nombre,
        actualizadoEn: serverTimestamp(),
      });
    },

    async editarLugar(id, datos, quien) {
      await updateDoc(doc(colLugares, id), {
        ...datos,
        actualizadoPor: quien.nombre,
        actualizadoEn: serverTimestamp(),
      });
    },

    // Solo el admin (lo validan las reglas). También lo quita de la agenda.
    async borrarLugar(id, diasDondeEsta, quien) {
      const lote = writeBatch(db);
      lote.delete(doc(colLugares, id));
      diasDondeEsta.forEach((diaId) => {
        lote.set(doc(colAgenda, diaId), datosDia(arrayRemove(id), quien), { merge: true });
      });
      await lote.commit();
    },

    // ---------- Viaje ----------
    // Solo el admin. Borra toda la agenda y todos los votos (y los lugares,
    // si no se pide conservarlos) y guarda la configuración del viaje nuevo.
    // Los borrados van uno por uno (cada uno se valida por su cuenta en las
    // reglas) y la configuración va al final: si algo falla a la mitad, se
    // puede volver a intentar sin dejar un viaje nuevo con datos viejos.
    // cfg: { nombre, ciudad, inicio, fin, llegada, salida }
    async reiniciarViaje(cfg, conservarLugares, quien) {
      const [agenda, votos, lugares] = await Promise.all([
        getDocs(colAgenda),
        getDocs(colVotos),
        conservarLugares ? null : getDocs(colLugares),
      ]);
      const refs = [...agenda.docs, ...votos.docs, ...(lugares ? lugares.docs : [])].map((d) => d.ref);
      await Promise.all(refs.map((r) => deleteDoc(r)));

      await setDoc(docViaje, {
        ...cfg,
        actualizadoPor: quien.nombre,
        actualizadoEn: serverTimestamp(),
      });
    },
  };
}
