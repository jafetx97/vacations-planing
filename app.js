// ============================================================
//  Lógica de la app
//  - Pinta tarjetas, días y votos
//  - Botón "Agregar al día" / "Mover / Quitar" con selector de día
//  - Formulario para agregar / editar lugares (borrar: solo admin)
//  - Con Firebase: lugares, agenda y votos en Firestore, en tiempo real
//  - Sin Firebase (modo local): lista de semilla.js + localStorage
// ============================================================

const CLAVE_GUARDADO = "vacaciones-dallas-v1";
const CLAVE_MIGRACION = "vacaciones-dallas-migrado";
const CIUDAD = "Dallas, TX"; // para buscar en Maps los lugares nuevos

function estadoVacio() {
  const agenda = {};
  DIAS.forEach((d) => (agenda[d.id] = []));
  return { agenda, favoritos: [] };
}

// Plan guardado en este navegador (modo local, o para migrarlo a la nube).
function cargarEstadoLocal() {
  const est = estadoVacio();
  const existe = (id) => LUGARES_POR_ID[id] || SEMILLA_IDS.has(id);
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    if (guardado && guardado.agenda && Array.isArray(guardado.favoritos)) {
      DIAS.forEach((d) => {
        est.agenda[d.id] = (guardado.agenda[d.id] || []).filter(existe);
      });
      est.favoritos = guardado.favoritos.filter(existe);
    }
  } catch (e) {
    /* si está corrupto, empezamos limpio */
  }
  return est;
}

function guardarLocal() {
  localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado));
}

// Estado que se pinta. En modo nube, "agenda" se calcula a partir de
// Firestore y "favoritos" no se usa (se usan los votos por persona).
let estado = estadoVacio();

// ---------- Nube ----------
let nube = null;               // API de nube.js cuando Firebase está activo
let votos = {};                // { uid: { nombre, lugares: [ids] } }
let agendaCruda = {};          // agenda tal cual llega de Firestore
let agendaDelServidor = false;
let lugaresRecibidos = false;  // ya llegó algo (caché o servidor)
let lugaresDelServidor = false;
let sembrando = false;

// ---------- Sesión ----------
// Hasta que auth.js diga lo contrario, la app arranca en solo lectura.
let sesion = { estado: "cargando" };
let puedeEditar = false;

const quienSoy = () => ({ uid: sesion.uid, nombre: sesion.nombre });
const esAdmin = () => sesion.estado === "miembro" && sesion.admin === true;
// Agregar/editar lugares solo tiene sentido con la nube.
const puedeEditarLugares = () => puedeEditar && Boolean(nube);

// ---------- Utilidades ----------
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// Todo texto que venga de la base de datos se escapa antes de ponerlo
// en HTML (nombres de lugares, de quien vota, enlaces...).
function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Solo deja pasar enlaces http(s) (evita cosas como "javascript:...").
function urlSegura(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (e) {
    return "";
  }
}

// ============================================================
//  LUGARES
// ============================================================
function establecerLugares(lista) {
  Object.keys(LUGARES_POR_ID).forEach((id) => delete LUGARES_POR_ID[id]);
  lista.forEach((l) => {
    const cat = CATEGORIAS_POR_ID[l.categoria];
    if (!cat || !l.id || !l.nombre) return; // datos raros: los ignoramos
    LUGARES_POR_ID[l.id] = {
      id: l.id,
      nombre: String(l.nombre),
      categoria: cat.id,
      mapa: typeof l.mapa === "string" ? l.mapa : "",
      mapsUrl: typeof l.mapsUrl === "string" ? l.mapsUrl : "",
      web: typeof l.web === "string" ? l.web : "",
      wiki: typeof l.wiki === "string" ? l.wiki : "",
      creadoPor: typeof l.creadoPor === "string" ? l.creadoPor : "",
      emoji: cat.emoji,
      respaldo: placeholder(String(l.nombre), cat.color),
    };
  });
}

function lugaresDeCategoria(catId) {
  return Object.values(LUGARES_POR_ID)
    .filter((l) => l.categoria === catId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// En modo nube la agenda se recalcula cuando cambian los lugares o la
// agenda (así un lugar borrado desaparece de los días).
function recalcularAgenda() {
  DIAS.forEach((d) => {
    estado.agenda[d.id] = (agendaCruda[d.id] || []).filter((id) => LUGARES_POR_ID[id]);
  });
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
  pintarBarra();
  pintarActividades();
  pintarDias();
  if ($("#vista-favoritos").classList.contains("activa")) pintarFavoritos();
}

// ============================================================
//  TARJETA (la misma en Actividades, Los días y Votos)
//  diaId: si viene, la card está dentro de ese día -> "Mover / Quitar"
// ============================================================
function crearTarjeta(lugar, diaId = null) {
  const id = escapar(lugar.id);
  const nombre = escapar(lugar.nombre);
  const fav = esFavorito(lugar.id);
  const total = totalVotos(lugar.id);
  const votantes = votantesDe(lugar.id);
  const agendado = diasDeLugar(lugar.id);
  const web = urlSegura(lugar.web);

  const el = document.createElement("div");
  el.className = "tarjeta";
  el.dataset.id = lugar.id;

  // En Actividades/Votos mostramos en qué días ya está.
  const etiquetas = !diaId && agendado.length
    ? `<div class="agendado">📅 ${agendado.map((d) => d.corto).join(", ")}</div>`
    : "";

  const lineaVotos = votantes.length
    ? `<div class="votantes" title="${escapar(votantes.join(", "))}">❤️ ${votantes.map(escapar).join(", ")}</div>`
    : "";

  // En modo solo lectura no hay botones para votar, agendar ni editar.
  const botonDia = !puedeEditar
    ? ""
    : diaId
      ? `<button class="dia-btn mover" data-id="${id}" data-dia="${diaId}">🔀 Mover / Quitar</button>`
      : `<button class="dia-btn" data-id="${id}">➕ Agregar al día</button>`;

  const conteo = nube && total ? ` ${total}` : "";
  const textoVotos = total ? ` (${total} voto${total > 1 ? "s" : ""})` : "";
  const botonFav = !puedeEditar
    ? (total ? `<span class="fav-solo" aria-label="${total} voto${total > 1 ? "s" : ""}">❤️${conteo}</span>` : "")
    : `<button class="fav-btn ${fav ? "activo" : ""}" data-id="${id}"
               aria-label="${fav ? "Quitar mi voto" : "Votar por este lugar"}${textoVotos}"
               aria-pressed="${fav}">
         ${fav ? "❤️" : "🤍"}${conteo}
       </button>`;

  const botonMapa = lugar.mapa || lugar.mapsUrl
    ? `<button class="mapa-btn" data-id="${id}">📍 Mapa</button>`
    : "";
  const botonWeb = web
    ? `<a class="web-btn" href="${escapar(web)}" target="_blank" rel="noopener noreferrer"
          aria-label="Sitio web de ${nombre}">🌐</a>`
    : "";
  const botonEditar = puedeEditarLugares()
    ? `<button class="editar-btn" data-id="${id}" aria-label="Editar ${nombre}">✏️</button>`
    : "";

  el.innerHTML = `
    <img src="${escapar(fotoDe(lugar))}" alt="${nombre}" loading="lazy" />
    ${botonEditar}
    <div class="cuerpo">
      <div class="nombre">${nombre}</div>
      ${etiquetas}
      ${lineaVotos}
      <div class="acciones">
        ${botonFav}
        ${botonMapa}
        ${botonWeb}
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
//  FOTOS DE WIKIPEDIA
//  - cargarFotosWiki: trae la foto de cada título guardado (caché 7 días)
//  - buscarFotosWiki: busca opciones por nombre (para el formulario)
//  Sin API key.
// ============================================================
const CLAVE_FOTOS = "vacaciones-dallas-fotos-wiki";
const DURACION_CACHE = 7 * 24 * 60 * 60 * 1000;
const API_WIKI = "https://en.wikipedia.org/w/api.php";
let fotosWiki = {}; // { "Reunion Tower": "https://...jpg" | null }
let fechaCacheFotos = Date.now();

function fotoDe(lugar) {
  if (lugar.wiki && fotosWiki[lugar.wiki]) return fotosWiki[lugar.wiki];
  return lugar.respaldo;
}

function leerCacheFotos() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_FOTOS));
    if (c && c.fecha && Date.now() - c.fecha < DURACION_CACHE && c.fotos) {
      fechaCacheFotos = c.fecha;
      return c.fotos;
    }
  } catch (e) {
    /* caché corrupta -> la ignoramos */
  }
  fechaCacheFotos = Date.now();
  return {};
}

function guardarCacheFotos() {
  localStorage.setItem(CLAVE_FOTOS, JSON.stringify({ fecha: fechaCacheFotos, fotos: fotosWiki }));
}

async function pedirWiki(params) {
  const resp = await fetch(`${API_WIKI}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`);
  if (!resp.ok) throw new Error(`Wikipedia respondió ${resp.status}`);
  return resp.json();
}

async function cargarFotosWiki() {
  // Solo pedimos los títulos que no están en caché.
  const pendientes = [...new Set(
    Object.values(LUGARES_POR_ID)
      .filter((l) => l.wiki && !(l.wiki in fotosWiki))
      .map((l) => l.wiki)
  )];
  if (pendientes.length === 0) return false;

  try {
    // La API acepta hasta 50 títulos por petición.
    for (let i = 0; i < pendientes.length; i += 50) {
      const grupo = pendientes.slice(i, i + 50);
      const datos = await pedirWiki({
        action: "query",
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: "600",
        redirects: "1",
        titles: grupo.join("|"),
      });
      const q = datos.query || {};

      // Wikipedia puede normalizar o redirigir el título; seguimos el rastro.
      const siguiente = {};
      (q.normalized || []).forEach((n) => (siguiente[n.from] = n.to));
      (q.redirects || []).forEach((r) => (siguiente[r.from] = r.to));
      const fotoPorTitulo = {};
      Object.values(q.pages || {}).forEach((p) => {
        fotoPorTitulo[p.title] = p.thumbnail ? p.thumbnail.source : null;
      });

      grupo.forEach((titulo) => {
        let t = titulo;
        for (let j = 0; j < 3 && siguiente[t]; j++) t = siguiente[t];
        fotosWiki[titulo] = fotoPorTitulo[t] || null;
      });
    }
    guardarCacheFotos();
    return true;
  } catch (e) {
    // Sin internet o Wikipedia caída: nos quedamos con los placeholders.
    return false;
  }
}

// Evita pedir fotos en paralelo cuando llegan varios cambios seguidos.
let cargandoFotos = false;
let repetirFotos = false;
async function actualizarFotos() {
  if (cargandoFotos) { repetirFotos = true; return; }
  cargandoFotos = true;
  const hayNuevas = await cargarFotosWiki();
  cargandoFotos = false;
  if (hayNuevas) refrescarTodo();
  if (repetirFotos) { repetirFotos = false; actualizarFotos(); }
}

// Hasta 3 artículos con foto que coincidan con el texto.
async function buscarFotosWiki(texto) {
  const datos = await pedirWiki({
    action: "query",
    generator: "search",
    gsrsearch: texto,
    gsrlimit: "8",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
    pilimit: "8",
  });
  const paginas = Object.values((datos.query && datos.query.pages) || {});
  return paginas
    .filter((p) => p.thumbnail && p.thumbnail.source)
    .sort((a, b) => a.index - b.index)
    .slice(0, 3)
    .map((p) => ({ titulo: p.title, url: p.thumbnail.source }));
}

// ============================================================
//  BARRA DE ACTIVIDADES (nuevo lugar / subir lista inicial)
// ============================================================
function pintarBarra() {
  const barra = $("#barra-actividades");
  barra.innerHTML = "";
  const total = Object.keys(LUGARES_POR_ID).length;

  if (nube && lugaresDelServidor && total === 0) {
    const caja = document.createElement("div");
    caja.className = "caja-vacia";
    if (esAdmin()) {
      caja.innerHTML = `
        <p>Todavía no hay lugares en la nube.</p>
        <button id="btn-sembrar" class="btn-principal" ${sembrando ? "disabled" : ""}>
          ${sembrando ? "Subiendo…" : `⬆️ Subir los ${LUGARES_INICIALES.length} lugares iniciales`}
        </button>`;
    } else {
      caja.innerHTML = `<p>Todavía no hay lugares. En cuanto alguien los suba aparecerán aquí.</p>`;
    }
    barra.append(caja);
  }

  if (puedeEditarLugares()) {
    const b = document.createElement("button");
    b.id = "btn-nuevo-lugar";
    b.className = "btn-nuevo-lugar";
    b.textContent = "➕ Nuevo lugar";
    barra.append(b);
  }
}

async function sembrar() {
  if (!esAdmin() || sembrando) return;
  if (!confirm(`¿Subir los ${LUGARES_INICIALES.length} lugares de la lista original a la nube?`)) return;
  sembrando = true;
  pintarBarra();
  try {
    await nube.sembrarLugares(LUGARES_INICIALES, quienSoy());
    avisar("Lugares subidos ✔");
  } catch (err) {
    errorAlGuardar(err);
  } finally {
    sembrando = false;
    pintarBarra();
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

  if ((nube && !lugaresRecibidos) || (!nube && sesion.estado === "cargando")) {
    cont.innerHTML = `<p class="vacio">Cargando lugares…</p>`;
    return;
  }

  GRUPOS.forEach((grupo) => {
    const cats = grupo.categorias
      .map((id) => ({ cat: CATEGORIAS_POR_ID[id], lugares: lugaresDeCategoria(id) }))
      .filter((c) => c.cat);
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

    if (total === 0) {
      contenido.innerHTML = `<p class="dia-vacio">Nada todavía.</p>`;
    }

    cats.forEach(({ cat, lugares }) => {
      if (lugares.length === 0) return;
      const seccion = document.createElement("div");
      seccion.className = "categoria";
      seccion.innerHTML = `
        ${conSubtitulos ? `<h3>${cat.emoji} ${cat.titulo} <span class="conteo">${lugares.length}</span></h3>` : ""}
        <div class="grid"></div>`;
      const grid = $(".grid", seccion);
      lugares.forEach((lugar) => grid.appendChild(crearTarjeta(lugar)));
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
    : estado.favoritos.filter((id) => LUGARES_POR_ID[id]);

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
    ? "No tienes permiso para hacer ese cambio."
    : "No se pudo guardar. Intenta de nuevo.");
}

function alternarFavorito(id) {
  if (!puedeEditar || !LUGARES_POR_ID[id]) return;
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
  const lugar = LUGARES_POR_ID[lugarId];
  if (!puedeEditar || !lugar) return;
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
  if (!lugar) return; // lo borraron mientras estaba abierto

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
  const lugar = LUGARES_POR_ID[lugarId];
  cerrarModal(modalDia);
  cambiarAgenda(lugarId, { quitarDe: diaOrigen });
  avisar(`Quitado del ${DIAS_POR_ID[diaOrigen].etiqueta}${lugar ? `: ${lugar.nombre}` : ""}`);
}

// ============================================================
//  MODAL: NUEVO / EDITAR LUGAR
// ============================================================
const modalLugar = $("#modal-lugar");
const formLugar = $("#form-lugar");
let edicion = null;     // null = nuevo; si no, el id del lugar
let fotoElegida = "";   // título de Wikipedia elegido ("" = sin foto)
let opcionesFoto = [];  // [{ titulo, url }]
let busquedaFoto = 0;   // para ignorar búsquedas viejas

// Llenar la lista de categorías una sola vez.
$("#lugar-categoria").innerHTML = CATEGORIAS
  .map((c) => `<option value="${c.id}">${c.emoji} ${c.titulo}</option>`)
  .join("");

function abrirFormLugar(id = null) {
  if (!puedeEditarLugares()) return;
  const lugar = id ? LUGARES_POR_ID[id] : null;
  if (id && !lugar) return;
  edicion = id;

  $("#lugar-titulo").textContent = lugar ? `Editar "${lugar.nombre}"` : "Nuevo lugar";
  $("#lugar-nombre").value = lugar ? lugar.nombre : "";
  $("#lugar-categoria").value = lugar ? lugar.categoria : "actividades";
  $("#lugar-maps").value = lugar ? lugar.mapsUrl : "";
  $("#lugar-web").value = lugar ? lugar.web : "";
  $("#lugar-creado").textContent = lugar && lugar.creadoPor ? `Agregado por ${lugar.creadoPor}` : "";
  mostrarError("");

  // Foto actual (si tiene) como única opción, ya elegida.
  fotoElegida = lugar ? lugar.wiki : "";
  opcionesFoto = lugar && lugar.wiki && fotosWiki[lugar.wiki]
    ? [{ titulo: lugar.wiki, url: fotosWiki[lugar.wiki] }]
    : [];
  pintarOpcionesFoto(lugar && lugar.wiki && !opcionesFoto.length ? "Tiene foto de Wikipedia." : "");

  // Borrar: solo el admin y solo al editar.
  $("#btn-borrar-lugar").hidden = !(lugar && esAdmin());

  abrirModal(modalLugar);
  $("#lugar-nombre").focus();
}

function mostrarError(texto) {
  const e = $("#lugar-error");
  e.textContent = texto;
  e.hidden = !texto;
}

function pintarOpcionesFoto(mensaje = "") {
  const cont = $("#fotos-opciones");
  cont.innerHTML = "";

  opcionesFoto.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "foto-opcion" + (o.titulo === fotoElegida ? " elegida" : "");
    b.dataset.titulo = o.titulo;
    b.setAttribute("aria-pressed", String(o.titulo === fotoElegida));
    const img = document.createElement("img");
    img.src = o.url;
    img.alt = "";
    const t = document.createElement("span");
    t.textContent = o.titulo;
    b.append(img, t);
    cont.append(b);
  });

  const sin = document.createElement("button");
  sin.type = "button";
  sin.className = "foto-opcion sin-foto" + (fotoElegida === "" ? " elegida" : "");
  sin.dataset.titulo = "";
  sin.setAttribute("aria-pressed", String(fotoElegida === ""));
  sin.textContent = "🚫 Sin foto";
  cont.append(sin);

  const m = $("#fotos-mensaje");
  m.textContent = mensaje;
  m.hidden = !mensaje;
}

async function buscarFoto() {
  const nombre = $("#lugar-nombre").value.trim();
  if (!nombre) {
    mostrarError("Escribe el nombre primero para buscar la foto.");
    return;
  }
  mostrarError("");
  const turno = ++busquedaFoto;
  const boton = $("#btn-buscar-foto");
  boton.disabled = true;
  boton.textContent = "Buscando…";
  pintarOpcionesFoto("Buscando en Wikipedia…");
  try {
    const encontradas = await buscarFotosWiki(nombre);
    if (turno !== busquedaFoto) return; // llegó una búsqueda más nueva
    // Conservamos la foto actual (si tenía) al principio.
    const actual = opcionesFoto.find((o) => o.titulo === fotoElegida);
    opcionesFoto = [actual, ...encontradas.filter((o) => !actual || o.titulo !== actual.titulo)]
      .filter(Boolean)
      .slice(0, 4);
    pintarOpcionesFoto(encontradas.length ? "Toca la foto que corresponda, o \"Sin foto\"." : "No encontré fotos con ese nombre.");
  } catch (e) {
    if (turno === busquedaFoto) pintarOpcionesFoto("No se pudo buscar. Revisa tu internet.");
  } finally {
    if (turno === busquedaFoto) {
      boton.disabled = false;
      boton.textContent = "🔍 Buscar foto en Wikipedia";
    }
  }
}

// Acepta el enlace solo, o un texto compartido que lo contenga
// ("Mira este lugar https://maps.app.goo.gl/abc").
function extraerUrl(texto) {
  const m = String(texto).match(/https?:\/\/\S+/i);
  return m ? m[0] : String(texto).trim();
}

const HOSTS_MAPS = /^(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)$/i;

function validarMaps(texto) {
  if (!texto.trim()) return { ok: true, url: "" };
  try {
    const url = new URL(extraerUrl(texto));
    if (url.protocol !== "https:" || !HOSTS_MAPS.test(url.hostname)) throw new Error();
    if (url.href.length > 300) return { ok: false, error: "El enlace de Maps es demasiado largo." };
    return { ok: true, url: url.href };
  } catch (e) {
    return { ok: false, error: "El enlace de Google Maps no es válido. Cópialo desde \"Compartir\" en Maps." };
  }
}

function validarWeb(texto) {
  if (!texto.trim()) return { ok: true, url: "" };
  let t = extraerUrl(texto);
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`; // "ejemplo.com" -> "https://ejemplo.com"
  try {
    const url = new URL(t);
    if (!url.hostname.includes(".")) throw new Error();
    if (url.href.length > 300) return { ok: false, error: "El enlace del sitio web es demasiado largo." };
    return { ok: true, url: url.href };
  } catch (e) {
    return { ok: false, error: "El sitio web no es válido." };
  }
}

// "Taquería El Güero" -> "taqueria-el-guero-k3f9"
function nuevoId(nombre) {
  const base = nombre
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "lugar";
  const azar = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  return `${base}-${azar}`;
}

const normalizarNombre = (n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function guardarLugar(e) {
  e.preventDefault();
  if (!puedeEditarLugares()) return;

  const nombre = $("#lugar-nombre").value.trim().replace(/\s+/g, " ");
  const categoria = $("#lugar-categoria").value;
  const maps = validarMaps($("#lugar-maps").value);
  const web = validarWeb($("#lugar-web").value);

  if (!nombre) return mostrarError("El nombre es obligatorio.");
  if (nombre.length > 60) return mostrarError("El nombre es muy largo (máximo 60 letras).");
  if (!CATEGORIAS_POR_ID[categoria]) return mostrarError("Elige una categoría.");
  if (!maps.ok) return mostrarError(maps.error);
  if (!web.ok) return mostrarError(web.error);

  const repetido = Object.values(LUGARES_POR_ID).find(
    (l) => l.id !== edicion && normalizarNombre(l.nombre) === normalizarNombre(nombre)
  );
  if (repetido) return mostrarError(`Ya existe "${repetido.nombre}".`);

  const anterior = edicion ? LUGARES_POR_ID[edicion] : null;
  if (edicion && !anterior) return mostrarError("Este lugar ya no existe (alguien lo borró).");

  // "mapa" es el texto para el mini-mapa. Se conserva el que ya tenía;
  // si es nuevo y trae enlace de Maps, buscamos por nombre + ciudad.
  const mapa = anterior && anterior.mapa
    ? anterior.mapa
    : maps.url ? `${nombre}, ${CIUDAD}` : "";

  const datos = { nombre, categoria, mapa, mapsUrl: maps.url, web: web.url, wiki: fotoElegida };

  // Guardamos la foto elegida en caché para mostrarla de inmediato.
  const opcion = opcionesFoto.find((o) => o.titulo === fotoElegida);
  if (opcion) {
    fotosWiki[opcion.titulo] = opcion.url;
    guardarCacheFotos();
  }

  const promesa = edicion
    ? nube.editarLugar(edicion, datos, quienSoy())
    : nube.crearLugar(nuevoId(nombre), datos, quienSoy());
  promesa.catch(errorAlGuardar);

  cerrarModal(modalLugar);
  avisar(edicion ? `Guardado: ${nombre}` : `Agregado: ${nombre} ✔`);
}

function borrarLugar() {
  const lugar = edicion && LUGARES_POR_ID[edicion];
  if (!lugar || !esAdmin()) return;

  const dias = diasDeLugar(lugar.id);
  const total = totalVotos(lugar.id);
  const detalles = [];
  if (dias.length) detalles.push(`está agendado el ${dias.map((d) => d.corto).join(", ")}`);
  if (total) detalles.push(`tiene ${total} voto${total > 1 ? "s" : ""}`);

  const ok = confirm(
    `¿Borrar "${lugar.nombre}"?\n\n` +
    (detalles.length ? `Ojo: ${detalles.join(" y ")}. Se quitará de la agenda.\n\n` : "") +
    "Esto no se puede deshacer."
  );
  if (!ok) return;

  nube.borrarLugar(lugar.id, dias.map((d) => d.id), quienSoy()).catch(errorAlGuardar);
  cerrarModal(modalLugar);
  avisar(`Borrado: ${lugar.nombre}`);
}

formLugar.addEventListener("submit", guardarLugar);

// ============================================================
//  MODAL: MAPA
// ============================================================
const modalMapa = $("#modal-mapa");

function abrirMapa(id) {
  const lugar = LUGARES_POR_ID[id];
  if (!lugar || !(lugar.mapa || lugar.mapsUrl)) return;
  const consulta = encodeURIComponent(lugar.mapa || `${lugar.nombre}, ${CIUDAD}`);
  $("#modal-titulo").textContent = lugar.nombre;
  $("#modal-iframe").src = `https://www.google.com/maps?q=${consulta}&output=embed`;
  // Si hay enlace exacto de Maps, "Abrir en Google Maps" usa ese.
  $("#modal-abrir-maps").href = urlSegura(lugar.mapsUrl) ||
    `https://www.google.com/maps/search/?api=1&query=${consulta}`;
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
  if (m === modalLugar) { edicion = null; busquedaFoto++; }
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
  if (sesion.estado === "local") {
    establecerLugares(LUGARES_INICIALES);
    estado = cargarEstadoLocal();
    actualizarFotos();
  }
  pintarSesion();
  if (!puedeEditar) $$(".modal.abierto").forEach(cerrarModal);
  // Si ya no es admin, que no quede a la vista el botón de borrar.
  if (!esAdmin()) $("#btn-borrar-lugar").hidden = true;
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
  estado = estadoVacio(); // lugares y agenda llegan de Firestore en un momento
  establecerLugares([]);
  $("#btn-reiniciar").hidden = true;
  refrescarTodo();
}

function actualizarLugares(lista, desdeServidor) {
  establecerLugares(lista);
  lugaresRecibidos = true;
  if (desdeServidor) lugaresDelServidor = true;
  recalcularAgenda();
  refrescarTodo();
  actualizarFotos();
}

function actualizarAgenda(agendaNube, desdeServidor) {
  agendaCruda = agendaNube;
  if (desdeServidor) agendaDelServidor = true;
  recalcularAgenda();
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
window.App = {
  establecerSesion, usarNube, actualizarLugares, actualizarAgenda, actualizarVotos, errorNube,
};

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

  const editar = t.closest(".editar-btn");
  if (editar) { abrirFormLugar(editar.dataset.id); return; }

  if (t.closest("#btn-nuevo-lugar")) { abrirFormLugar(); return; }
  if (t.closest("#btn-sembrar")) { sembrar(); return; }
  if (t.closest("#btn-buscar-foto")) { buscarFoto(); return; }
  if (t.closest("#btn-borrar-lugar")) { borrarLugar(); return; }
  if (t.closest("#btn-cancelar-lugar")) { cerrarModal(modalLugar); return; }

  const foto = t.closest(".foto-opcion");
  if (foto) {
    fotoElegida = foto.dataset.titulo;
    pintarOpcionesFoto($("#fotos-mensaje").textContent);
    return;
  }

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
// Pintamos de inmediato; los lugares llegan de Firestore (o de
// semilla.js en modo local) en cuanto auth.js decide el modo.
fotosWiki = leerCacheFotos();
refrescarTodo();
