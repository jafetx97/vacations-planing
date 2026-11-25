// ============================================================
//  SINCRONIZACIÓN CON FIRESTORE (todo en tiempo real)
//
//  viajes/{VIAJE}                -> { nombre, ciudad, inicio, fin, llegada, salida,
//                                     actualizadoPor, actualizadoEn }   (el viaje activo)
//  viajes/{VIAJE}/agenda/{fecha} -> { lugares: [ids en orden], visitados: [ids],
//                                     actualizadoPor, actualizadoEn }
//  viajes/{VIAJE}/votos/{uid}    -> { nombre, lugares: [ids], actualizadoEn }
//  viajes/{VIAJE}/lugares/{id}   -> { nombre, categoria, mapa, mapsUrl, web, wiki, horario,
//                                     creadoPor, creadoEn, actualizadoPor, actualizadoEn }
//
//  viajes/{VIAJE}/categorias/{id}-> { titulo, emoji, color, grupo, orden?,
//                                     creadoPor, creadoEn, actualizadoPor, actualizadoEn }
//                                    (se conservan al reiniciar el viaje)
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
    runTransaction, arrayUnion, arrayRemove, serverTimestamp,
  } = fs;

  const docViaje = doc(db, "viajes", VIAJE);
  const colAgenda = collection(db, "viajes", VIAJE, "agenda");
  const colVotos = collection(db, "viajes", VIAJE, "votos");
  const colLugares = collection(db, "viajes", VIAJE, "lugares");
  const colCategorias = collection(db, "viajes", VIAJE, "categorias");

  onSnapshot(
    colCategorias,
    { includeMetadataChanges: true },
    (snap) => {
      const lista = [];
      snap.forEach((d) => lista.push({ ...d.data(), id: d.id }));
      window.App.actualizarCategorias(lista, !snap.metadata.fromCache);
    },
    (err) => window.App.errorNube(err)
  );

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
      const visitados = {};
      snap.forEach((d) => {
        const { lugares: l, visitados: v } = d.data();
        agenda[d.id] = Array.isArray(l) ? l : [];
        visitados[d.id] = Array.isArray(v) ? v : [];
      });
      window.App.actualizarAgenda(agenda, visitados);
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
    // Al quitar un lugar de un día, también se borra su marca de visitado ahí.
    async cambiarAgenda(lugarId, quitarDe, agregarA, quien) {
      const lote = writeBatch(db);
      if (quitarDe) {
        lote.set(doc(colAgenda, quitarDe),
          { ...datosDia(arrayRemove(lugarId), quien), visitados: arrayRemove(lugarId) },
          { merge: true });
      }
      if (agregarA) lote.set(doc(colAgenda, agregarA), datosDia(arrayUnion(lugarId), quien), { merge: true });
      await lote.commit();
    },

    // Cambia el orden de un día. Va en una transacción: lee la lista actual
    // del servidor y solo reordena lo que sigue ahí, así no se pierde algo
    // que otra persona haya agregado o quitado en ese mismo momento.
    // (Necesita internet: las transacciones no funcionan sin señal.)
    async reordenarDia(diaId, ordenDeseado, quien) {
      const ref = doc(colAgenda, diaId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const actuales = snap.exists() && Array.isArray(snap.data().lugares) ? snap.data().lugares : [];
        const enOrden = ordenDeseado.filter((id) => actuales.includes(id));
        const nuevos = actuales.filter((id) => !enOrden.includes(id)); // llegaron mientras tanto
        tx.set(ref, datosDia([...enOrden, ...nuevos], quien), { merge: true });
      });
    },

    async marcarVisitado(diaId, lugarId, si, quien) {
      await setDoc(doc(colAgenda, diaId), {
        visitados: si ? arrayUnion(lugarId) : arrayRemove(lugarId),
        actualizadoPor: quien.nombre,
        actualizadoEn: serverTimestamp(),
      }, { merge: true });
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
        lote.set(doc(colAgenda, diaId),
          { ...datosDia(arrayRemove(id), quien), visitados: arrayRemove(id) },
          { merge: true });
      });
      await lote.commit();
    },

    // ---------- Categorías ----------
    // datos: { titulo, emoji, color, grupo } (+ orden en las de la base)
    async crearCategoria(id, datos, quien) {
      await setDoc(doc(colCategorias, id), {
        ...datos,
        creadoPor: quien.nombre,
        creadoEn: serverTimestamp(),
        actualizadoPor: quien.nombre,
        actualizadoEn: serverTimestamp(),
      });
    },

    // Solo el admin (lo validan las reglas).
    async editarCategoria(id, datos, quien) {
      await updateDoc(doc(colCategorias, id), {
        ...datos,
        actualizadoPor: quien.nombre,
        actualizadoEn: serverTimestamp(),
      });
    },

    // Solo el admin, y la app solo lo permite si no tiene lugares.
    async borrarCategoria(id) {
      await deleteDoc(doc(colCategorias, id));
    },

    // Sube las categorías base (la primera vez). Mismos IDs de siempre,
    // así los lugares que ya existen siguen en su categoría.
    async sembrarCategorias(lista, quien) {
      await Promise.all(lista.map(({ id, ...datos }) => this.crearCategoria(id, datos, quien)));
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
