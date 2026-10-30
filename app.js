// ============================================================
//  Lógica de la app
//  - Pinta tarjetas, días y votos
//  - Botón "Agregar al día" / "Mover / Quitar" con selector de día
//  - Con Firebase: agenda y votos en Firestore, en tiempo real (nube.js)
//  - Sin Firebase (modo local): todo en localStorage, como antes
// ============================================================

const CLAVE_GUARDADO = "vacaciones-dallas-v1";
const CLAVE_MIGRACION = "vacaciones-dallas-migrado";

function estadoVacio() {
  const agenda = {};
  DIAS.forEach((d) => (agenda[d.id] = []));
  return { agenda, favoritos: [] };
}

// Plan guardado en este navegador (modo local, o para migrarlo a la nube).
function cargarEstadoLocal() {
  const est = estadoVacio();
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    if (guardado && guardado.agenda && Array.isArray(guardado.favoritos)) {
      // Solo conservamos días y lugares que todavía existen.
      DIAS.forEach((d) => {
        est.agenda[d.id] = (guardado.agenda[d.id] || []).filter((id) => LUGARES_POR_ID[id]);
      });
      est.favoritos = guardado.favoritos.filter((id) => LUGARES_POR_ID[id]);
    }
  } catch (e) {
    /* si está corrupto, empezamos limpio */
  }
  return est;
}

function guardarLocal() {
  localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado));
}

// Estado que se pinta. En modo nube, "agenda" viene de Firestore y
// "favoritos" no se usa (se usan los votos por persona).
let estado = estadoVacio();

// ---------- Nube ----------
let nube = null;            // API de nube.js cuando Firebase está activo
let votos = {};             // { uid: { nombre, lugares: [ids] } }
let agendaDelServidor = false;

// ---------- Sesión ----------
// Hasta que auth.js diga lo contrario, la app arranca en solo lectura.
let sesion = { estado: "cargando" };
let puedeEditar = false;

const quienSoy = () => ({ uid: sesion.uid, nombre: sesion.nombre });

// ---------- Utilidades ----------
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// Para textos que vienen de la base de datos (nombres de quien vota).
function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ¿Yo voté por este lugar?
function esFavorito(id) {
  if (nube) {
    const mio = sesion.uid && votos[sesion.uid];
    return Boolean(mio && mio.lugares.includes(id));
  }
  return estado.favoritos.includes(id);
}

// Nombres de quienes votaron por este lugar (solo modo nube).
function votantesDe(id) {
  if (!nube) return [];
  return Object.values(votos)
    .filter((v) => v.lugares.includes(id))
    .map((v) => v.nombre)
    .sort((a, b) => a.localeCompare(b, "es"));
}

function totalVotos(id) {
  return nube ? votantesDe(id).length : (esFavorito(id) ? 1 : 0);
}

// Días en los que ya está agendado un lugar (en orden del viaje).
function diasDeLugar(lugarId) {
  return DIAS.filter((d) => estado.agenda[d.id].includes(lugarId));
}

function refrescarTodo() {
  pintarActividades();
  pintarDias();
  if ($("#vista-favoritos").classList.contains("activa")) pintarFavoritos();
}

// ============================================================
//  TARJETA (la misma en Actividades, Los días y Votos)
//  diaId: si viene, la card está dentro de ese día -> "Mover / Quitar"
// ============================================================
function crearTarjeta(lugar, diaId = null) {
  const fav = esFavorito(lugar.id);
  const total = totalVotos(lugar.id);
  const votantes = votantesDe(lugar.id);
  const agendado = diasDeLugar(lugar.id);

  const el = document.createElement("div");
  el.className = "tarjeta";
  el.dataset.id = lugar.id;

  // En Actividades/Votos mostramos en qué días ya está.
  const etiquetas = !diaId && agendado.length
    ? `<div class="agendado">📅 ${agendado.map((d) => d.corto).join(", ")}</div>`
    : "";

  // Quién votó (los nombres vienen de Firestore: se escapan).
  const lineaVotos = votantes.length
    ? `<div class="votantes" title="${escapar(votantes.join(", "))}">❤️ ${votantes.map(escapar).join(", ")}</div>`
    : "";

  // En modo solo lectura no hay botones para votar ni agendar.
  const botonDia = !puedeEditar
    ? ""
    : diaId
      ? `<button class="dia-btn mover" data-id="${lugar.id}" data-dia="${diaId}">🔀 Mover / Quitar</button>`
      : `<button class="dia-btn" data-id="${lugar.id}">➕ Agregar al día</button>`;

  const conteo = nube && total ? ` ${total}` : "";
  const botonFav = !puedeEditar
    ? (total ? `<span class="fav-solo" aria-label="${total} voto${total > 1 ? "s" : ""}">❤️${conteo}</span>` : "")
    : `<button class="fav-btn ${fav ? "activo" : ""}" data-id="${lugar.id}"
               aria-label="${fav ? "Quitar mi voto" : "Votar por este lugar"}${total ? ` (${total} voto${total > 1 ? "s" : ""})` : ""}"
               aria-pressed="${fav}">
         ${fav ? "❤️" : "🤍"}${conteo}
       </button>`;

  el.innerHTML = `
    <img src="${fotoDe(lugar)}" alt="${lugar.nombre}" loading="lazy" />
    <div class="cuerpo">
      <div class="nombre">${lugar.nombre}</div>
      ${etiquetas}
      ${lineaVotos}
      <div class="acciones">
        ${botonFav}
        ${lugar.mapa ? `<button class="mapa-btn" data-id="${lugar.id}">📍 Mapa</button>` : ""}
      </div>
      ${botonDia}
    </div>`;

  // Si la foto no carga, usamos el placeholder de color (nunca imagen rota).
  const img = $("img", el);
  // Los logos (SVG de Wikipedia) se muestran completos, sin recortar.
  if (/\.svg[./?]/i.test(img.getAttribute("src"))) img.classList.add("logo");
  img.addEventListener("error", () => {
    if (img.src !== lugar.respaldo) img.src = lugar.respaldo;
  });
  return el;
}

// ============================================================
//  FOTOS AUTOMÁTICAS DE WIKIPEDIA
//  Una sola petición para todos los títulos, sin API key.
//  Se guarda en caché 7 días en este dispositivo.
// ============================================================
const CLAVE_FOTOS = "vacaciones-dallas-fotos-wiki";
const DURACION_CACHE = 7 * 24 * 60 * 60 * 1000;
let fotosWiki = {}; // { "Reunion Tower": "https://...jpg" | null }

function fotoDe(lugar) {
  if (lugar.foto) return lugar.foto;
  if (lugar.wiki && fotosWiki[lugar.wiki]) return fotosWiki[lugar.wiki];
  return lugar.respaldo;
}

function leerCacheFotos() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_FOTOS));
    if (c && c.fecha && Date.now() - c.fecha < DURACION_CACHE && c.fotos) return c.fotos;
  } catch (e) {
    /* caché corrupta -> la ignoramos */
  }
  return {};
}

async function cargarFotosWiki() {
  fotosWiki = leerCacheFotos();

  // Solo pedimos los títulos que no están en caché (y si no tienen foto propia).
  const pendientes = [...new Set(
    Object.values(LUGARES_POR_ID)
      .filter((l) => l.wiki && !l.foto && !(l.wiki in fotosWiki))
      .map((l) => l.wiki)
  )];
  if (pendientes.length === 0) return false;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*", // permite llamar la API desde el navegador (CORS)
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
    redirects: "1",
    titles: pendientes.join("|"),
  });

  try {
    const resp = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
    if (!resp.ok) return false;
    const datos = await resp.json();
    const q = datos.query || {};

    // Wikipedia puede normalizar o redirigir el título; seguimos el rastro.
    const siguiente = {};
    (q.normalized || []).forEach((n) => (siguiente[n.from] = n.to));
    (q.redirects || []).forEach((r) => (siguiente[r.from] = r.to));
    const fotoPorTitulo = {};
    Object.values(q.pages || {}).forEach((p) => {
      fotoPorTitulo[p.title] = p.thumbnail ? p.thumbnail.source : null;
    });

    pendientes.forEach((titulo) => {
      let t = titulo;
      for (let i = 0; i < 3 && siguiente[t]; i++) t = siguiente[t];
      fotosWiki[titulo] = fotoPorTitulo[t] || null;
    });

    localStorage.setItem(CLAVE_FOTOS, JSON.stringify({ fecha: Date.now(), fotos: fotosWiki }));
    return true;
  } catch (e) {
    // Sin internet o Wikipedia caída: nos quedamos con los placeholders.
    return false;
  }
}

// ============================================================
//  VISTA: ACTIVIDADES
// ============================================================
// Qué grupos están cerrados (se recuerda en este dispositivo).
const CLAVE_GRUPOS = "vacaciones-dallas-grupos-cerrados";
let gruposCerrados = new Set();
try {
  const g = JSON.parse(localStorage.getItem(CLAVE_GRUPOS) || "[]");
  if (Array.isArray(g)) gruposCerrados = new Set(g);
} catch (e) {
  /* si está corrupto, todos abiertos */
}

function guardarGrupos() {
  localStorage.setItem(CLAVE_GRUPOS, JSON.stringify([...gruposCerrados]));
}

function pintarActividades() {
  const cont = $("#categorias");
  cont.innerHTML = "";
  const catPorId = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));

  GRUPOS.forEach((grupo) => {
    const cats = grupo.categorias.map((id) => catPorId[id]).filter(Boolean);
    const total = cats.reduce((n, c) => n + c.lugares.length, 0);
    // Si el grupo tiene una sola categoría, no repetimos el subtítulo.
    const conSubtitulos = cats.length > 1;

    const det = document.createElement("details");
    det.className = "grupo";
    det.open = !gruposCerrados.has(grupo.id);
    det.innerHTML = `
      <summary>
        <span class="grupo-titulo">${grupo.emoji} ${grupo.titulo}</span>
        <span class="conteo">${total}</span>
        <span class="grupo-flecha" aria-hidden="true">▾</span>
      </summary>
      <div class="grupo-contenido"></div>`;
    const contenido = $(".grupo-contenido", det);

    cats.forEach((cat) => {
      const seccion = document.createElement("div");
      seccion.className = "categoria";
      seccion.innerHTML = `
        ${conSubtitulos ? `<h3>${cat.emoji} ${cat.titulo} <span class="conteo">${cat.lugares.length}</span></h3>` : ""}
        <div class="grid"></div>`;
      const grid = $(".grid", seccion);
      cat.lugares.forEach((lugar) => grid.appendChild(crearTarjeta(LUGARES_POR_ID[lugar.id])));
      contenido.appendChild(seccion);
    });

    det.addEventListener("toggle", () => {
      if (det.open) gruposCerrados.delete(grupo.id);
      else gruposCerrados.add(grupo.id);
      guardarGrupos();
    });

    cont.appendChild(det);
  });
}

// ============================================================
//  VISTA: DÍAS
// ============================================================
function pintarDias() {
  const cont = $("#dias");
  cont.innerHTML = "";

  DIAS.forEach((dia) => {
    const ids = estado.agenda[dia.id];
    const el = document.createElement("div");
    el.className = "dia";
    el.innerHTML = `
      <div class="dia-cabecera">
        <span>${dia.etiqueta}</span>
        ${dia.fijo ? `<span class="fijo">${dia.fijo}</span>` : ""}
      </div>
      <div class="dia-lista"></div>`;

    const lista = $(".dia-lista", el);
    if (ids.length === 0) {
      lista.innerHTML = `<p class="dia-vacio">Nada todavía. Agrega algo desde <strong>Actividades</strong>.</p>`;
    } else {
      const grid = document.createElement("div");
      grid.className = "grid";
      ids.forEach((id) => grid.appendChild(crearTarjeta(LUGARES_POR_ID[id], dia.id)));
      lista.appendChild(grid);
    }
    cont.appendChild(el);
  });
}

// ============================================================
//  VISTA: VOTOS (pestaña "favoritos")
// ============================================================
function pintarFavoritos() {
  const cont = $("#favoritos");

  // Modo nube: todo lo que tenga al menos un voto, del más votado al menos.
  // Modo local: mis favoritos, en el orden en que los marqué.
  const ids = nube
    ? Object.keys(LUGARES_POR_ID)
        .filter((id) => totalVotos(id) > 0)
        .sort((a, b) => totalVotos(b) - totalVotos(a))
    : estado.favoritos;

  if (ids.length === 0) {
    cont.innerHTML = `<p class="vacio">Aún no hay votos.<br>Toca 🤍 en las actividades que te gusten.</p>`;
    return;
  }
  cont.innerHTML = '<div class="grid"></div>';
  const grid = $(".grid", cont);
  ids.forEach((id) => grid.appendChild(crearTarjeta(LUGARES_POR_ID[id])));
}

// ============================================================
//  CAMBIOS (votos y agenda)
//  En modo nube se mandan a Firestore; la pantalla se actualiza sola
//  cuando llega el cambio (al instante, incluso sin señal).
// ============================================================
function errorAlGuardar(err) {
  console.error("No se pudo guardar:", err);
  avisar(err && err.code === "permission-denied"
    ? "No tienes permiso para hacer cambios."
    : "No se pudo guardar. Intenta de nuevo.");
}

function alternarFavorito(id) {
  if (!puedeEditar) return;
  if (nube) {
    nube.votar(id, !esFavorito(id), quienSoy()).catch(errorAlGuardar);
    return;
  }
  const i = estado.favoritos.indexOf(id);
  if (i >= 0) estado.favoritos.splice(i, 1);
  else estado.favoritos.push(id);
  guardarLocal();
  refrescarTodo();
}

// Quitar de un día y/o agregar a otro (mover = las dos cosas a la vez).
function cambiarAgenda(lugarId, { quitarDe = null, agregarA = null }) {
  if (nube) {
    nube.cambiarAgenda(lugarId, quitarDe, agregarA, quienSoy()).catch(errorAlGuardar);
    return;
  }
  if (quitarDe) estado.agenda[quitarDe] = estado.agenda[quitarDe].filter((id) => id !== lugarId);
  if (agregarA && !estado.agenda[agregarA].includes(lugarId)) estado.agenda[agregarA].push(lugarId);
  guardarLocal();
  refrescarTodo();
}

// ============================================================
//  MODAL: ELEGIR DÍA
//  modo "agregar": desde Actividades/Votos
//  modo "mover":   desde una card que ya está en un día
// ============================================================
const modalDia = $("#modal-dia");
let seleccion = null; // { lugarId, diaOrigen | null }

function abrirSelectorDia(lugarId, diaOrigen = null) {
  if (!puedeEditar) return;
  const lugar = LUGARES_POR_ID[lugarId];
  seleccion = { lugarId, diaOrigen };

  $("#modal-dia-titulo").textContent = diaOrigen
    ? `Mover "${lugar.nombre}"`
    : `¿Qué día vamos a "${lugar.nombre}"?`;
  const yaAgendado = diasDeLugar(lugarId).length > 0;
  $("#modal-dia-sub").textContent = diaOrigen
    ? `Ahora está el ${DIAS_POR_ID[diaOrigen].etiqueta}. Elige otro día o quítalo.`
    : yaAgendado
      ? "Toca un día libre para agregarlo, o uno verde para quitarlo."
      : "Elige un día:";

  const opciones = $("#modal-dia-opciones");
  opciones.innerHTML = "";
  DIAS.forEach((dia) => {
    const yaEsta = estado.agenda[dia.id].includes(lugarId);
    const btn = document.createElement("button");
    btn.className = "dia-opcion";
    btn.dataset.dia = dia.id;
    if (dia.id === diaOrigen) btn.classList.add("actual");
    else if (yaEsta) btn.classList.add("ya-esta");
    // Al mover, no se puede elegir un día donde ya está.
    // Al agregar, tocar un día verde lo quita (interruptor).
    btn.disabled = Boolean(diaOrigen) && yaEsta;
    if (yaEsta && !diaOrigen) btn.setAttribute("aria-label", `${dia.etiqueta}: ya está, tocar para quitar`);
    const cuantos = estado.agenda[dia.id].length;
    btn.innerHTML = `
      <span class="dia-opcion-nombre">${dia.corto}</span>
      <span class="dia-opcion-info">${
        yaEsta ? "✔ Ya está" : dia.fijo ? dia.fijo.split(" ")[0] : cuantos ? `${cuantos} plan${cuantos > 1 ? "es" : ""}` : "Libre"
      }</span>
      ${yaEsta && !diaOrigen ? '<span class="dia-opcion-quitar">✕ Quitar</span>' : ""}`;
    opciones.appendChild(btn);
  });

  $("#btn-quitar-dia").style.display = diaOrigen ? "block" : "none";
  abrirModal(modalDia);
}

function elegirDia(diaId) {
  if (!seleccion || !puedeEditar) return;
  const { lugarId, diaOrigen } = seleccion;
  const lugar = LUGARES_POR_ID[lugarId];
  cerrarModal(modalDia);

  // Modo agregar + día donde ya está -> quitarlo de ese día.
  if (!diaOrigen && estado.agenda[diaId].includes(lugarId)) {
    cambiarAgenda(lugarId, { quitarDe: diaId });
    avisar(`Quitado del ${DIAS_POR_ID[diaId].etiqueta}: ${lugar.nombre}`);
    return;
  }

  cambiarAgenda(lugarId, { quitarDe: diaOrigen, agregarA: diaId });
  avisar(`${diaOrigen ? "Movido" : "Agregado"}: ${lugar.nombre} → ${DIAS_POR_ID[diaId].etiqueta}`);
}

function quitarSeleccion() {
  if (!seleccion || !seleccion.diaOrigen || !puedeEditar) return;
  const { lugarId, diaOrigen } = seleccion;
  cerrarModal(modalDia);
  cambiarAgenda(lugarId, { quitarDe: diaOrigen });
  avisar(`Quitado del ${DIAS_POR_ID[diaOrigen].etiqueta}: ${LUGARES_POR_ID[lugarId].nombre}`);
}

// ============================================================
//  MODAL: MAPA
// ============================================================
const modalMapa = $("#modal-mapa");

function abrirMapa(id) {
  const lugar = LUGARES_POR_ID[id];
  if (!lugar || !lugar.mapa) return;
  const consulta = encodeURIComponent(lugar.mapa);
  $("#modal-titulo").textContent = lugar.nombre;
  $("#modal-iframe").src = `https://www.google.com/maps?q=${consulta}&output=embed`;
  $("#modal-abrir-maps").href = `https://www.google.com/maps/search/?api=1&query=${consulta}`;
  abrirModal(modalMapa);
}

// ---------- Abrir / cerrar modales ----------
function abrirModal(m) {
  m.classList.add("abierto");
  m.setAttribute("aria-hidden", "false");
}

function cerrarModal(m) {
  m.classList.remove("abierto");
  m.setAttribute("aria-hidden", "true");
  if (m === modalMapa) $("#modal-iframe").src = ""; // detener la carga del mapa
  if (m === modalDia) seleccion = null;
}

// ---------- Aviso breve ----------
let temporizadorAviso = null;
function avisar(texto) {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove("visible"), 2200);
}

// ============================================================
//  SESIÓN (la llama auth.js)
//  estados: "cargando" | "local" | "anonimo" | "invitado" | "miembro" | "error"
// ============================================================
function establecerSesion(nueva) {
  sesion = nueva;
  // "local" = Firebase sin configurar: se puede editar como antes.
  puedeEditar = sesion.estado === "miembro" || sesion.estado === "local";
  if (sesion.estado === "local") estado = cargarEstadoLocal();
  pintarSesion();
  if (!puedeEditar) $$(".modal.abierto").forEach(cerrarModal);
  // "Reiniciar" solo en modo local: en la nube borraría el plan de todos.
  $("#btn-reiniciar").hidden = !puedeEditar || Boolean(nube);
  refrescarTodo();
  revisarMigracion();
}

function pintarSesion() {
  const cont = $("#sesion");
  const aviso = $("#aviso-lectura");
  cont.innerHTML = "";

  // Los nombres y fotos vienen de Google: los ponemos con textContent
  // (no con innerHTML) para no inyectar HTML por accidente.
  const texto = (t) => {
    const s = document.createElement("span");
    s.className = "sesion-texto";
    s.textContent = t;
    return s;
  };
  const boton = (id, t) => {
    const b = document.createElement("button");
    b.id = id;
    b.className = "btn-sesion";
    b.textContent = t;
    return b;
  };
  const avatar = () => {
    if (!sesion.foto) return null;
    const img = document.createElement("img");
    img.className = "sesion-avatar";
    img.src = sesion.foto;
    img.alt = "";
    img.referrerPolicy = "no-referrer"; // las fotos de Google lo requieren
    return img;
  };

  let mensajeLectura = "";
  switch (sesion.estado) {
    case "local":
      break; // sin Firebase: no mostramos nada
    case "cargando":
      cont.append(texto("Conectando…"));
      break;
    case "anonimo":
      cont.append(boton("btn-login", "🔐 Iniciar sesión con Google"));
      mensajeLectura = "👀 Estás en modo solo lectura. Inicia sesión para votar y agendar.";
      break;
    case "invitado":
      [avatar(), texto(sesion.email), boton("btn-logout", "Salir")].forEach((n) => n && cont.append(n));
      mensajeLectura = sesion.mensaje ||
        "👀 Tu cuenta no está en la lista de la familia, así que solo puedes ver. Pídele a quien organiza que te agregue.";
      break;
    case "miembro":
      [avatar(), texto(`Hola, ${sesion.nombre}`), boton("btn-logout", "Salir")].forEach((n) => n && cont.append(n));
      break;
    case "error":
      cont.append(texto(sesion.mensaje || "Algo salió mal."));
      mensajeLectura = "👀 Modo solo lectura.";
      break;
  }

  aviso.textContent = mensajeLectura;
  aviso.hidden = !mensajeLectura;
}

// ============================================================
//  NUBE (la llama nube.js, a través de auth.js)
// ============================================================
function usarNube(api) {
  nube = api;
  estado = estadoVacio(); // la agenda llega de Firestore en un momento
  $("#btn-reiniciar").hidden = true;
  refrescarTodo();
}

function actualizarAgenda(agendaNube, desdeServidor) {
  DIAS.forEach((d) => {
    estado.agenda[d.id] = (agendaNube[d.id] || []).filter((id) => LUGARES_POR_ID[id]);
  });
  if (desdeServidor) agendaDelServidor = true;
  refrescarTodo();
  revisarMigracion();
}

function actualizarVotos(nuevos) {
  votos = nuevos;
  refrescarTodo();
}

function errorNube(err) {
  console.error("Error de sincronización:", err);
  avisar("No se pudo sincronizar. Revisa tu conexión.");
}

// Una sola vez por dispositivo: si había un plan guardado en este
// navegador (de antes de la nube), ofrecemos subirlo. Se SUMA a lo que haya.
function revisarMigracion() {
  if (!nube || sesion.estado !== "miembro" || !agendaDelServidor) return;
  if (localStorage.getItem(CLAVE_MIGRACION)) return;
  localStorage.setItem(CLAVE_MIGRACION, "1"); // no volver a preguntar

  const local = cargarEstadoLocal();
  const actividades = Object.values(local.agenda).reduce((n, a) => n + a.length, 0);
  const favoritos = local.favoritos.length;
  if (!actividades && !favoritos) return;

  const ok = confirm(
    `Encontré un plan guardado en este dispositivo ` +
    `(${actividades} en la agenda y ${favoritos} favoritos).\n\n` +
    `¿Lo subo para que lo vea toda la familia? Se suma a lo que ya haya.`
  );
  if (!ok) return;
  nube.importar(local, quienSoy())
    .then(() => avisar("Plan subido a la nube ✔"))
    .catch(errorAlGuardar);
}

// auth.js y nube.js (módulos) se comunican con la app por aquí.
window.App = { establecerSesion, usarNube, actualizarAgenda, actualizarVotos, errorNube };

// ============================================================
//  NAVEGACIÓN ENTRE VISTAS (tabs)
// ============================================================
function cambiarVista(nombre) {
  $$(".tab").forEach((t) => t.classList.toggle("activa", t.dataset.vista === nombre));
  $$(".vista").forEach((v) => v.classList.remove("activa"));
  $(`#vista-${nombre}`).classList.add("activa");
  if (nombre === "favoritos") pintarFavoritos();
}

// ============================================================
//  EVENTOS GLOBALES (delegación)
// ============================================================
document.addEventListener("click", (e) => {
  const t = e.target;

  const fav = t.closest(".fav-btn");
  if (fav) { alternarFavorito(fav.dataset.id); return; }

  const mapa = t.closest(".mapa-btn");
  if (mapa) { abrirMapa(mapa.dataset.id); return; }

  const diaBtn = t.closest(".dia-btn");
  if (diaBtn) { abrirSelectorDia(diaBtn.dataset.id, diaBtn.dataset.dia || null); return; }

  const opcion = t.closest(".dia-opcion");
  if (opcion && !opcion.disabled) { elegirDia(opcion.dataset.dia); return; }

  if (t.closest("#btn-quitar-dia")) { quitarSeleccion(); return; }

  const tab = t.closest(".tab");
  if (tab) { cambiarVista(tab.dataset.vista); return; }

  // Cerrar modal con la X o tocando el fondo oscuro.
  const modalAbierto = t.closest(".modal");
  if (modalAbierto && (t.closest(".modal-cerrar") || t === modalAbierto)) {
    cerrarModal(modalAbierto);
    return;
  }

  // Solo existe en modo local.
  if (t.closest("#btn-reiniciar")) {
    if (puedeEditar && !nube && confirm("¿Borrar todas las elecciones y empezar de cero?")) {
      localStorage.removeItem(CLAVE_GUARDADO);
      estado = estadoVacio();
      refrescarTodo();
      pintarFavoritos();
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".modal.abierto").forEach(cerrarModal);
});

// ============================================================
//  ARRANQUE
// ============================================================
// Pintamos de inmediato (con caché o placeholders) y, si llegan
// fotos nuevas de Wikipedia, volvemos a pintar.
fotosWiki = leerCacheFotos();
pintarActividades();
pintarDias();
cargarFotosWiki().then((hayNuevas) => {
  if (hayNuevas) refrescarTodo();
});
