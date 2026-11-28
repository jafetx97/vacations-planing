// ============================================================
//  Lógica de la app
//  - Pinta tarjetas, días y votos
//  - Botón "Agregar al día" / "Mover / Quitar" con selector de día
//  - Formulario para agregar / editar lugares (borrar: solo admin)
//  - Con Firebase: lugares, agenda y votos en Firestore, en tiempo real
//  - Sin Firebase (modo local): lista de semilla.js + localStorage
// ============================================================

const CLAVE_GUARDADO = "vacaciones-dallas-v1";
let ciudad = ""; // para buscar en Maps los lugares nuevos (viene del viaje)

// agenda:    { fecha: [ids en orden] }
// visitados: { fecha: [ids ya visitados ese día] }
function estadoVacio() {
  const agenda = {};
  const visitados = {};
  DIAS.forEach((d) => { agenda[d.id] = []; visitados[d.id] = []; });
  return { agenda, visitados, favoritos: [] };
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
        const v = guardado.visitados && Array.isArray(guardado.visitados[d.id]) ? guardado.visitados[d.id] : [];
        est.visitados[d.id] = v.filter((id) => est.agenda[d.id].includes(id));
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
let visitadosCrudos = {};      // { fecha: [ids] } tal cual llega de Firestore
let viaje = null;              // configuración del viaje (null = todavía no hay)
let viajeDelServidor = false;  // el servidor ya confirmó si hay viaje o no
let lugaresRecibidos = false;  // ya llegó algo (caché o servidor)
let lugaresDelServidor = false;

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

// "Reunion Tower" -> "Reunion Tower, Austin, TX" (para buscar en Maps).
const conCiudad = (nombre) => (ciudad ? `${nombre}, ${ciudad}` : nombre);

// ¿Ya sabemos que no hay viaje configurado? / ¿seguimos esperando al servidor?
const sinViaje = () => Boolean(nube) && viajeDelServidor && !viaje;
const cargandoViaje = () => Boolean(nube) && !viaje && !viajeDelServidor;

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
// Lo último que llegó de lugares, para recalcular si cambian las categorías
// (un lugar de una categoría que aún no llega no se puede pintar).
let lugaresCrudos = [];

function establecerLugares(lista) {
  lugaresCrudos = lista;
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
      horario: typeof l.horario === "string" ? l.horario : "",
      emoji: cat.emoji,
      respaldo: placeholder(String(l.nombre), cat.color),
    };
  });
}

// ============================================================
//  CATEGORÍAS
//  Llegan de Firestore. Mientras la colección esté vacía se usan las 8
//  de la base (CATEGORIAS_BASE), y el admin las sube solas una vez.
// ============================================================
let categoriasDelServidor = false;
let sembrandoCategorias = false;

function establecerCategorias(lista) {
  CATEGORIAS.length = 0;
  Object.keys(CATEGORIAS_POR_ID).forEach((k) => delete CATEGORIAS_POR_ID[k]);
  lista.forEach((c) => {
    if (!c || !c.id || typeof c.titulo !== "string" || !c.titulo) return; // datos raros
    const cat = {
      id: c.id,
      titulo: c.titulo,
      emoji: typeof c.emoji === "string" && c.emoji ? c.emoji : "📌",
      color: /^[0-9a-f]{6}$/.test(c.color) ? c.color : "7f8c8d",
      grupo: GRUPOS_POR_ID[c.grupo] ? c.grupo : "actividades",
      orden: Number.isInteger(c.orden) ? c.orden : null,
      creadoPor: typeof c.creadoPor === "string" ? c.creadoPor : "",
    };
    CATEGORIAS.push(cat);
    CATEGORIAS_POR_ID[cat.id] = cat;
  });
  CATEGORIAS.sort((a, b) =>
    GRUPOS.findIndex((g) => g.id === a.grupo) - GRUPOS.findIndex((g) => g.id === b.grupo) ||
    ordenarCategorias(a, b));
}

// Lugares que hay en una categoría (sin filtro de búsqueda).
const lugaresEnCategoria = (catId) =>
  Object.values(LUGARES_POR_ID).filter((l) => l.categoria === catId).length;

// Llena el selector de categoría del formulario de lugar, por bloque.
function llenarSelectCategorias(seleccion) {
  const select = $("#lugar-categoria");
  select.innerHTML = GRUPOS.map((g) => {
    const cats = categoriasDeGrupo(g.id);
    if (!cats.length) return "";
    return `<optgroup label="${escapar(`${g.emoji} ${g.titulo}`)}">${cats
      .map((c) => `<option value="${escapar(c.id)}">${escapar(`${c.emoji} ${c.titulo}`)}</option>`)
      .join("")}</optgroup>`;
  }).join("") + (puedeEditarLugares() ? `<option value="__nueva__">➕ Nueva categoría…</option>` : "");
  select.value = CATEGORIAS_POR_ID[seleccion] ? seleccion : (CATEGORIAS[0] ? CATEGORIAS[0].id : "");
  select.dataset.anterior = select.value;
}

// ---------- Búsqueda ----------
// Texto que escribió la persona, sin acentos ni mayúsculas ("" = sin filtro).
// Es una sola búsqueda para las tres pestañas.
let busqueda = "";

const normalizar = (t) =>
  String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Cada palabra escrita debe aparecer en el nombre, la categoría o el grupo
// del lugar: "taco" encuentra "Taco Bell" y "mexicano" encuentra todo lo mexicano.
function coincide(lugar) {
  if (!busqueda) return true;
  if (!lugar) return false;
  const cat = CATEGORIAS_POR_ID[lugar.categoria];
  const grupo = cat && GRUPOS_POR_ID[cat.grupo];
  const texto = normalizar(`${lugar.nombre} ${cat ? cat.titulo : ""} ${grupo ? grupo.titulo : ""}`);
  return busqueda.split(" ").every((palabra) => texto.includes(palabra));
}

// Mensaje cuando la búsqueda no encuentra nada (el texto va con escapar()).
const sinResultados = () =>
  `<p class="vacio">No encontré nada con "<strong>${escapar($("#busqueda").value.trim())}</strong>".</p>`;

function lugaresDeCategoria(catId) {
  return Object.values(LUGARES_POR_ID)
    .filter((l) => l.categoria === catId && coincide(l))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// En modo nube la agenda se recalcula cuando cambian los lugares o la
// agenda (así un lugar borrado desaparece de los días).
function recalcularAgenda() {
  estado.agenda = {};
  estado.visitados = {};
  DIAS.forEach((d) => {
    estado.agenda[d.id] = (agendaCruda[d.id] || []).filter((id) => LUGARES_POR_ID[id]);
    estado.visitados[d.id] = (visitadosCrudos[d.id] || []).filter((id) => estado.agenda[d.id].includes(id));
  });
}

const esVisitado = (diaId, lugarId) =>
  Boolean(estado.visitados[diaId] && estado.visitados[diaId].includes(lugarId));

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

// Título, fechas y botón de reinicio (solo admin) en el encabezado.
function pintarEncabezado() {
  $("#titulo-viaje").textContent = `🧳 ${viaje ? viaje.nombre : "Vacaciones"}`;
  document.title = viaje ? `${viaje.nombre} · ¿Qué hacemos hoy?` : "¿Qué hacemos hoy?";

  const partes = viaje ? [rangoLegible(viaje), viaje.ciudad].filter(Boolean) : [];
  const sub = $("#subtitulo-viaje");
  sub.textContent = partes.join(" · ");
  sub.hidden = partes.length === 0;

  $("#btn-viaje").hidden = !(nube && esAdmin());
  // Botón al final de "Los días" (solo admin, con viaje configurado).
  $("#dias-pie").hidden = !(nube && esAdmin() && viaje);
  if (!(nube && esAdmin())) cerrarModal(modalConfirmar);
  // Sin viaje no hay nada que buscar.
  $("#buscador").hidden = sinViaje();
}

// Mientras alguien arrastra, no repintamos (se perdería lo que está moviendo).
// Lo que llegue mientras tanto se pinta al soltar.
let arrastrando = false;
let repintarAlSoltar = false;

function refrescarTodo() {
  if (arrastrando) { repintarAlSoltar = true; return; }
  pintarEncabezado();
  pintarBarra();
  pintarActividades();
  pintarDias();
  if ($("#vista-favoritos").classList.contains("activa")) pintarFavoritos();
  // Si la lista de "agregar a un día" está abierta, se actualiza sola.
  if (modalAgregar.classList.contains("abierto")) pintarAgregar();
  if (modalCategorias.classList.contains("abierto")) pintarCategorias();
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

  // Todavía no hay viaje: el admin lo configura, los demás esperan.
  if (sinViaje()) {
    const caja = document.createElement("div");
    caja.className = "caja-vacia";
    caja.innerHTML = esAdmin()
      ? `<p>Todavía no hay un viaje configurado.</p>
         <button id="btn-viaje-config" class="btn-principal">🧳 Configurar viaje</button>`
      : `<p>El viaje todavía no está configurado. En cuanto el administrador lo prepare aparecerá aquí.</p>`;
    barra.append(caja);
    return;
  }

  if (nube && lugaresDelServidor && total === 0) {
    const caja = document.createElement("div");
    caja.className = "caja-vacia";
    caja.innerHTML = puedeEditarLugares()
      ? `<p>Todavía no hay lugares. Agrega el primero con <strong>➕ Nuevo lugar</strong>.</p>`
      : `<p>Todavía no hay lugares.</p>`;
    barra.append(caja);
  }

  if (puedeEditarLugares()) {
    const fila = document.createElement("div");
    fila.className = "barra-botones";
    const b = document.createElement("button");
    b.id = "btn-nuevo-lugar";
    b.className = "btn-nuevo-lugar";
    b.textContent = "➕ Nuevo lugar";
    const c = document.createElement("button");
    c.id = "btn-categorias";
    c.className = "btn-nuevo-lugar btn-categorias";
    c.textContent = "🏷️ Categorías";
    fila.append(b, c);
    barra.append(fila);
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

  if ((nube && !lugaresRecibidos) || cargandoViaje() || (!nube && sesion.estado === "cargando")) {
    cont.innerHTML = `<p class="vacio">Cargando lugares…</p>`;
    return;
  }
  if (sinViaje()) return; // la barra de arriba explica qué falta

  let hayResultados = false;
  GRUPOS.forEach((grupo) => {
    const cats = categoriasDeGrupo(grupo.id)
      .map((cat) => ({ cat, lugares: lugaresDeCategoria(cat.id) }));
    const total = cats.reduce((n, c) => n + c.lugares.length, 0);
    // Buscando: los grupos sin coincidencias se esconden.
    if (busqueda && total === 0) return;
    hayResultados = true;
    // Si el grupo tiene una sola categoría, no repetimos el subtítulo.
    const conSubtitulos = cats.length > 1;

    // Buscando: los grupos con coincidencias se abren (sin cambiar lo que
    // la persona había dejado abierto o cerrado).
    const forzado = Boolean(busqueda);
    const det = document.createElement("details");
    det.className = "grupo";
    det.open = forzado || !gruposCerrados.has(grupo.id);
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
        ${conSubtitulos ? `<h3>${escapar(cat.emoji)} ${escapar(cat.titulo)} <span class="conteo">${lugares.length}</span></h3>` : ""}
        <div class="grid"></div>`;
      const grid = $(".grid", seccion);
      lugares.forEach((lugar) => {
        const tarjeta = crearTarjeta(lugar);
        // Solo en esta pestaña: lo que ya está en algún día se ve en gris.
        if (diasDeLugar(lugar.id).length) tarjeta.classList.add("asignada");
        grid.appendChild(tarjeta);
      });
      contenido.appendChild(seccion);
    });

    det.addEventListener("toggle", () => {
      if (forzado) return; // abierto por la búsqueda: no es una elección de la persona
      if (det.open) gruposCerrados.delete(grupo.id);
      else gruposCerrados.add(grupo.id);
      guardarGrupos();
    });

    cont.appendChild(det);
  });

  if (busqueda && !hayResultados) cont.innerHTML = sinResultados();
}

// ============================================================
//  VISTA: DÍAS
// ============================================================
function pintarDias() {
  const cont = $("#dias");
  cont.innerHTML = "";

  if (cargandoViaje() || (!nube && sesion.estado === "cargando")) {
    cont.innerHTML = `<p class="vacio">Cargando…</p>`;
    return;
  }
  if (sinViaje()) {
    cont.innerHTML = `<p class="vacio">Todavía no hay un viaje configurado.</p>`;
    return;
  }

  let hayResultados = false;
  DIAS.forEach((dia) => {
    // Buscando: solo se muestran los días que tienen coincidencias.
    const ids = estado.agenda[dia.id].filter((id) => coincide(LUGARES_POR_ID[id]));
    if (busqueda && ids.length === 0) return;
    hayResultados = true;

    const expandido = diasExpandidos.has(dia.id);
    // Buscando, todos los días con coincidencias se muestran abiertos
    // (sin cambiar lo que la persona había minimizado).
    const minimizado = !busqueda && diasMinimizados.has(dia.id);
    const esHoy = dia.id === hoyIso();
    const total = estado.agenda[dia.id].length;
    const el = document.createElement("div");
    el.className = "dia" + (expandido ? " expandido" : "") + (minimizado ? " minimizado" : "") + (esHoy ? " hoy" : "");
    el.dataset.dia = dia.id;
    el.innerHTML = `
      <div class="dia-cabecera">
        <button type="button" class="dia-toggle" data-dia="${escapar(dia.id)}"
                aria-expanded="${!minimizado}"
                aria-label="${minimizado ? "Mostrar" : "Minimizar"} el ${escapar(dia.etiqueta)}">
          <span class="dia-flecha" aria-hidden="true">▾</span>
          <span>${escapar(dia.etiqueta)}</span>
          ${esHoy ? `<span class="dia-hoy">Hoy</span>` : ""}
          ${minimizado && total ? `<span class="dia-cuenta">${total} plan${total === 1 ? "" : "es"}</span>` : ""}
        </button>
        <span class="dia-cabecera-der">
          ${dia.fijo ? `<span class="fijo">${escapar(dia.fijo)}</span>` : ""}
          ${minimizado ? "" : `
          <button type="button" class="dia-expandir" data-dia="${escapar(dia.id)}"
                  aria-expanded="${expandido}"
                  aria-label="${expandido ? "Volver a la vista de tarjetas" : "Ver en lista con detalles"} del ${escapar(dia.etiqueta)}">
            ${expandido ? "▦ Tarjetas" : "☰ Detalle"}
          </button>`}
        </span>
      </div>
      ${minimizado ? "" : `<div class="dia-lista"></div>
      ${puedeEditar
        ? `<div class="dia-pie">
             <button type="button" class="dia-mas" data-dia="${escapar(dia.id)}"
                     aria-label="Agregar una actividad al ${escapar(dia.etiqueta)}">+</button>
           </div>`
        : ""}`}`;

    if (minimizado) { cont.appendChild(el); return; }

    const lista = $(".dia-lista", el);
    if (ids.length === 0) {
      lista.innerHTML = `<p class="dia-vacio">${puedeEditar ? "Nada todavía. Toca + para agregar algo." : "Nada todavía."}</p>`;
    } else if (expandido) {
      lista.appendChild(crearListaDetalle(dia, ids));
    } else {
      const grid = document.createElement("div");
      grid.className = "grid";
      ids.forEach((id) => grid.appendChild(crearTarjeta(LUGARES_POR_ID[id], dia.id)));
      lista.appendChild(grid);
    }
    cont.appendChild(el);
  });

  if (busqueda && !hayResultados) cont.innerHTML = sinResultados();

  // Se pidió ir a hoy (al abrir la pestaña) y los días ya están pintados.
  if (irAHoyPendiente && DIAS.length && $("#vista-dias").classList.contains("activa")) {
    irAHoyPendiente = false;
    requestAnimationFrame(irAHoy);
  }
}

// ============================================================
//  MINIMIZAR DÍAS e IR A HOY
// ============================================================
// Qué días están minimizados (se recuerda en este dispositivo).
const CLAVE_MINIMIZADOS = "vacaciones-dias-minimizados";
let diasMinimizados = new Set();
try {
  const g = JSON.parse(localStorage.getItem(CLAVE_MINIMIZADOS) || "[]");
  if (Array.isArray(g)) diasMinimizados = new Set(g);
} catch (e) {
  /* si está corrupto, todos abiertos */
}

function guardarMinimizados() {
  localStorage.setItem(CLAVE_MINIMIZADOS, JSON.stringify([...diasMinimizados]));
}

function alternarMinimizado(diaId) {
  if (!DIAS_POR_ID[diaId] || busqueda) return; // buscando, todos se ven abiertos
  if (diasMinimizados.has(diaId)) diasMinimizados.delete(diaId);
  else diasMinimizados.add(diaId);
  guardarMinimizados();
  pintarDias();
  const b = $(`.dia-toggle[data-dia="${CSS.escape(diaId)}"]`);
  if (b) b.focus();
}

// Fecha de hoy en este dispositivo, en el mismo formato que los IDs de día.
const hoyIso = () => isoDeFecha(new Date());

let irAHoyPendiente = false;

// Lleva la pantalla al día de hoy (si está dentro del viaje y visible).
// Si estaba minimizado, lo abre: la idea es ver qué toca hoy.
function irAHoy() {
  const hoy = hoyIso();
  if (!DIAS_POR_ID[hoy]) return; // hoy no es parte del viaje
  if (diasMinimizados.has(hoy) && !busqueda) {
    diasMinimizados.delete(hoy);
    guardarMinimizados();
    pintarDias();
  }
  const el = $(`.dia[data-dia="${CSS.escape(hoy)}"]`);
  if (!el) return; // escondido por la búsqueda
  // El encabezado de arriba es fijo: dejamos espacio para que no tape el día.
  const alto = $(".app-header").offsetHeight + 12;
  const y = el.getBoundingClientRect().top + window.scrollY - alto;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

// ============================================================
//  DÍA EXPANDIDO: lista con detalles, orden y visitados
// ============================================================
// Qué días están expandidos (se recuerda en este dispositivo).
const CLAVE_EXPANDIDOS = "vacaciones-dias-expandidos";
let diasExpandidos = new Set();
try {
  const g = JSON.parse(localStorage.getItem(CLAVE_EXPANDIDOS) || "[]");
  if (Array.isArray(g)) diasExpandidos = new Set(g);
} catch (e) {
  /* si está corrupto, ninguno expandido */
}

function alternarExpandido(diaId) {
  if (!DIAS_POR_ID[diaId]) return;
  if (diasExpandidos.has(diaId)) diasExpandidos.delete(diaId);
  else diasExpandidos.add(diaId);
  localStorage.setItem(CLAVE_EXPANDIDOS, JSON.stringify([...diasExpandidos]));
  pintarDias();
  // Que el botón conserve el foco tras repintar (teclado / lector de pantalla).
  const b = $(`.dia-expandir[data-dia="${CSS.escape(diaId)}"]`);
  if (b) b.focus();
}

// Una fila de detalle: dato con su ícono (el texto ya va escapado).
const filaDato = (icono, html) => `<li><span aria-hidden="true">${icono}</span> ${html}</li>`;

function crearListaDetalle(dia, ids) {
  // Con búsqueda activa se ve solo una parte del día: no se puede reordenar.
  const sePuedeOrdenar = puedeEditar && !busqueda && ids.length > 1;

  const ol = document.createElement("ol");
  ol.className = "detalle-lista";
  ol.dataset.dia = dia.id;

  ids.forEach((id) => {
    const lugar = LUGARES_POR_ID[id];
    const visitado = esVisitado(dia.id, id);
    const cat = CATEGORIAS_POR_ID[lugar.categoria];
    const maps = urlSegura(lugar.mapsUrl) ||
      (lugar.mapa ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar.mapa)}` : "");
    const web = urlSegura(lugar.web);
    const votantes = votantesDe(id);

    const datos = [
      cat ? filaDato(escapar(cat.emoji), escapar(cat.titulo)) : "",
      lugar.horario ? filaDato("🕒", escapar(lugar.horario)) : "",
      maps ? filaDato("📍", `<a href="${escapar(maps)}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>`) : "",
      web ? filaDato("🌐", `<a href="${escapar(web)}" target="_blank" rel="noopener noreferrer">${escapar(new URL(web).hostname.replace(/^www\./, ""))}</a>`) : "",
      votantes.length ? filaDato("❤️", escapar(votantes.join(", "))) : "",
      lugar.creadoPor ? filaDato("👤", `Agregado por ${escapar(lugar.creadoPor)}`) : "",
    ].join("");

    const li = document.createElement("li");
    li.className = "detalle-item" + (visitado ? " visitado" : "");
    li.dataset.id = id;
    li.innerHTML = `
      <div class="detalle-controles">
        <input type="checkbox" class="visitado-check" data-dia="${escapar(dia.id)}" data-id="${escapar(id)}"
               ${visitado ? "checked" : ""} ${puedeEditar ? "" : "disabled"}
               aria-label="${escapar(lugar.nombre)}: ${visitado ? "ya visitado" : "marcar como visitado"}" />
        ${sePuedeOrdenar
          ? `<span class="detalle-agarre" aria-hidden="true" title="Arrastra para cambiar el orden">⠿</span>`
          : ""}
      </div>
      <img class="detalle-foto" src="${escapar(fotoDe(lugar))}" alt="" loading="lazy" />
      <div class="detalle-principal">
        <div class="detalle-nombre">${escapar(lugar.nombre)}</div>
        ${puedeEditar
          ? `<button class="dia-btn mover detalle-mover" data-id="${escapar(id)}" data-dia="${escapar(dia.id)}">🔀 Mover / Quitar</button>`
          : ""}
      </div>
      <ul class="detalle-datos">${datos || filaDato("ℹ️", "Sin más información")}</ul>`;

    const img = $(".detalle-foto", li);
    img.addEventListener("error", () => {
      if (img.src !== lugar.respaldo) img.src = lugar.respaldo;
    });
    ol.appendChild(li);
  });

  const cont = document.createElement("div");
  cont.append(ol);
  if (busqueda && puedeEditar && ids.length > 1) {
    const nota = document.createElement("p");
    nota.className = "ayuda-campo";
    nota.textContent = "Borra la búsqueda para poder cambiar el orden.";
    cont.append(nota);
  }

  if (sePuedeOrdenar && window.Sortable) {
    Sortable.create(ol, {
      handle: ".detalle-agarre",   // solo se arrastra desde ⠿ (el scroll no mueve nada)
      animation: 150,
      ghostClass: "detalle-fantasma",
      onStart: () => { arrastrando = true; },
      onEnd: (evt) => {
        arrastrando = false;
        const nuevoOrden = $$(".detalle-item", ol).map((n) => n.dataset.id);
        if (evt.oldIndex !== evt.newIndex) reordenarDia(dia.id, nuevoOrden);
        if (repintarAlSoltar) { repintarAlSoltar = false; refrescarTodo(); }
      },
    });
  }
  return cont;
}

function reordenarDia(diaId, nuevoOrden) {
  if (!puedeEditar || !DIAS_POR_ID[diaId]) return;
  if (nube) {
    nube.reordenarDia(diaId, nuevoOrden, quienSoy()).catch((err) => {
      console.error("No se pudo cambiar el orden:", err);
      avisar(err && err.code === "permission-denied"
        ? "No tienes permiso para hacer ese cambio."
        : "No se pudo guardar el orden (se necesita internet). Intenta de nuevo.");
      refrescarTodo(); // regresa al orden que tiene la nube
    });
    return;
  }
  estado.agenda[diaId] = nuevoOrden.filter((id) => estado.agenda[diaId].includes(id));
  guardarLocal();
  refrescarTodo();
}

function marcarVisitado(diaId, lugarId, si) {
  if (!puedeEditar || !DIAS_POR_ID[diaId] || !LUGARES_POR_ID[lugarId]) return;
  if (nube) {
    nube.marcarVisitado(diaId, lugarId, si, quienSoy()).catch((err) => {
      errorAlGuardar(err);
      refrescarTodo();
    });
    return;
  }
  const v = estado.visitados[diaId] || [];
  estado.visitados[diaId] = si ? [...new Set([...v, lugarId])] : v.filter((id) => id !== lugarId);
  guardarLocal();
  refrescarTodo();
}

// ============================================================
//  VISTA: VOTOS (pestaña "favoritos")
// ============================================================
function pintarFavoritos() {
  const cont = $("#favoritos");

  // Modo nube: todo lo que tenga al menos un voto, del más votado al menos.
  // Modo local: mis favoritos, en el orden en que los marqué.
  const todos = nube
    ? Object.keys(LUGARES_POR_ID)
        .filter((id) => totalVotos(id) > 0)
        .sort((a, b) => totalVotos(b) - totalVotos(a))
    : estado.favoritos.filter((id) => LUGARES_POR_ID[id]);
  const ids = todos.filter((id) => coincide(LUGARES_POR_ID[id]));

  if (todos.length === 0) {
    cont.innerHTML = `<p class="vacio">Aún no hay votos.<br>Toca 🤍 en las actividades que te gusten.</p>`;
    return;
  }
  if (ids.length === 0) {
    cont.innerHTML = sinResultados();
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
  if (quitarDe) {
    estado.agenda[quitarDe] = estado.agenda[quitarDe].filter((id) => id !== lugarId);
    estado.visitados[quitarDe] = (estado.visitados[quitarDe] || []).filter((id) => id !== lugarId);
  }
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
  // Lo borraron o cambiaron el viaje mientras estaba abierto.
  if (!lugar || !DIAS_POR_ID[diaId] || (diaOrigen && !DIAS_POR_ID[diaOrigen])) return;

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
//  MODAL: AGREGAR DESDE UN DÍA (botón "+" de cada día)
//  Lista los lugares que todavía no están en NINGÚN día. Se queda
//  abierto para poder agregar varios; los que se agregan salen de la lista.
// ============================================================
const modalAgregar = $("#modal-agregar");
let diaAgregar = null; // id (fecha) del día al que se está agregando

function lugaresSinAgendar() {
  return Object.values(LUGARES_POR_ID).filter(
    (l) => !DIAS.some((d) => estado.agenda[d.id].includes(l.id))
  );
}

function abrirAgregar(diaId) {
  if (!puedeEditar || !DIAS_POR_ID[diaId]) return;
  diaAgregar = diaId;
  pintarAgregar();
  abrirModal(modalAgregar);
}

function pintarAgregar() {
  const dia = DIAS_POR_ID[diaAgregar];
  if (!dia) { cerrarModal(modalAgregar); return; } // cambió el viaje

  const libres = lugaresSinAgendar();
  const cont = $("#agregar-lista");
  const posicion = cont.scrollTop; // para no volver al inicio tras cada cambio
  cont.innerHTML = "";

  $("#agregar-titulo").textContent = `Agregar al ${dia.etiqueta}`;
  $("#agregar-sub").textContent = libres.length
    ? `${libres.length} lugar${libres.length === 1 ? "" : "es"} sin agendar. Toca los que quieras.`
    : "";

  if (libres.length === 0) {
    cont.innerHTML = `<p class="dia-vacio">Ya agendaste todo lo que hay. Puedes crear un lugar nuevo aquí abajo.</p>`;
  }

  // Mismo orden que la pestaña Actividades: por grupo y categoría.
  GRUPOS.forEach((grupo) => categoriasDeGrupo(grupo.id).forEach((cat) => {
    const catId = cat.id;
    const items = libres
      .filter((l) => l.categoria === catId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (!cat || items.length === 0) return;

    const titulo = document.createElement("h4");
    titulo.textContent = `${cat.emoji} ${cat.titulo}`;
    cont.append(titulo);

    items.forEach((lugar) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "agregar-item";
      b.dataset.id = lugar.id;

      const img = document.createElement("img");
      img.src = fotoDe(lugar);
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", () => {
        if (img.src !== lugar.respaldo) img.src = lugar.respaldo;
      });

      const nombre = document.createElement("span");
      nombre.className = "agregar-nombre";
      nombre.textContent = lugar.nombre;

      const mas = document.createElement("span");
      mas.className = "agregar-mas";
      mas.setAttribute("aria-hidden", "true");
      mas.textContent = "+";

      b.append(img, nombre, mas);
      cont.append(b);
    });
  }));

  // Al final de la lista: crear un lugar nuevo (se agrega también a este día).
  if (puedeEditarLugares()) {
    const nuevo = document.createElement("button");
    nuevo.type = "button";
    nuevo.className = "agregar-nuevo";
    nuevo.setAttribute("aria-label", "Crear un lugar nuevo y agregarlo a este día");
    nuevo.innerHTML = `<span class="agregar-nuevo-mas" aria-hidden="true">+</span><span>Nuevo lugar</span>`;
    cont.append(nuevo);
  }

  cont.scrollTop = posicion;
}

function agregarDesdeLista(lugarId) {
  const lugar = LUGARES_POR_ID[lugarId];
  const dia = DIAS_POR_ID[diaAgregar];
  if (!puedeEditar || !lugar || !dia) return;
  cambiarAgenda(lugarId, { agregarA: dia.id });
  avisar(`Agregado: ${lugar.nombre} → ${dia.etiqueta}`);
}

// ============================================================
//  MODAL: NUEVO / EDITAR LUGAR
// ============================================================
const modalLugar = $("#modal-lugar");
const formLugar = $("#form-lugar");
let edicion = null;     // null = nuevo; si no, el id del lugar
let destinoNuevo = null; // día al que se agrega el lugar nuevo (si se creó desde un día)
let fotoElegida = "";   // título de Wikipedia elegido ("" = sin foto)
let opcionesFoto = [];  // [{ titulo, url }]
let busquedaFoto = 0;   // para ignorar búsquedas viejas


// diaDestino (solo al crear): si viene, el lugar nuevo se agrega también a ese día.
function abrirFormLugar(id = null, diaDestino = null) {
  if (!puedeEditarLugares()) return;
  const lugar = id ? LUGARES_POR_ID[id] : null;
  if (id && !lugar) return;
  edicion = id;
  destinoNuevo = !id && DIAS_POR_ID[diaDestino] ? diaDestino : null;

  $("#lugar-titulo").textContent = lugar
    ? `Editar "${lugar.nombre}"`
    : destinoNuevo ? `Nuevo lugar para el ${DIAS_POR_ID[destinoNuevo].etiqueta}` : "Nuevo lugar";
  $("#lugar-nombre").value = lugar ? lugar.nombre : "";
  llenarSelectCategorias(lugar ? lugar.categoria : "actividades");
  $("#lugar-maps").value = lugar ? lugar.mapsUrl : "";
  $("#lugar-web").value = lugar ? lugar.web : "";
  $("#lugar-horario").value = lugar ? lugar.horario : "";
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

const normalizarNombre = normalizar;

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
    : maps.url ? conCiudad(nombre) : "";

  const horario = $("#lugar-horario").value.trim().replace(/\s+/g, " ");
  if (horario.length > 120) return mostrarError("El horario es muy largo (máximo 120 letras).");

  const datos = { nombre, categoria, mapa, mapsUrl: maps.url, web: web.url, wiki: fotoElegida, horario };

  // Guardamos la foto elegida en caché para mostrarla de inmediato.
  const opcion = opcionesFoto.find((o) => o.titulo === fotoElegida);
  if (opcion) {
    fotosWiki[opcion.titulo] = opcion.url;
    guardarCacheFotos();
  }

  // Si se creó desde el "+" de un día, también se agrega a ese día.
  const diaDestino = !edicion && DIAS_POR_ID[destinoNuevo] ? destinoNuevo : null;
  const editando = Boolean(edicion); // cerrarModal() vacía "edicion"

  if (edicion) {
    nube.editarLugar(edicion, datos, quienSoy()).catch(errorAlGuardar);
  } else {
    const id = nuevoId(nombre);
    // Las dos escrituras salen juntas y Firestore las aplica en orden
    // (también sin señal). Si crear el lugar falla, se deshace lo del día.
    nube.crearLugar(id, datos, quienSoy()).catch((err) => {
      errorAlGuardar(err);
      if (diaDestino) nube.cambiarAgenda(id, diaDestino, null, quienSoy()).catch(() => {});
    });
    if (diaDestino) cambiarAgenda(id, { agregarA: diaDestino });
  }

  cerrarModal(modalLugar);
  // Se creó desde el "+" de un día: también se cierra la lista de atrás.
  if (diaDestino) cerrarModal(modalAgregar);
  avisar(editando
    ? `Guardado: ${nombre}`
    : diaDestino
      ? `Agregado: ${nombre} → ${DIAS_POR_ID[diaDestino].etiqueta} ✔`
      : `Agregado: ${nombre} ✔`);
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
//  MODAL: LISTA DE CATEGORÍAS (todos los miembros la ven;
//  editar y borrar, solo el admin)
// ============================================================
const modalCategorias = $("#modal-categorias");

function abrirCategorias() {
  if (!puedeEditarLugares()) return;
  pintarCategorias();
  abrirModal(modalCategorias);
}

function pintarCategorias() {
  const cont = $("#categorias-lista");
  cont.innerHTML = "";
  $("#categorias-sub").textContent = esAdmin()
    ? "Toca ✏️ para cambiar nombre, emoji o bloque. Solo se puede borrar una categoría vacía."
    : "Cualquiera puede crear categorías. Para cambiar o borrar una, pídeselo al administrador.";

  GRUPOS.forEach((g) => {
    const cats = categoriasDeGrupo(g.id);
    const h = document.createElement("h4");
    h.textContent = `${g.emoji} ${g.titulo}`;
    cont.append(h);
    if (!cats.length) {
      const p = document.createElement("p");
      p.className = "dia-vacio";
      p.textContent = "Sin categorías.";
      cont.append(p);
      return;
    }
    cats.forEach((c) => {
      const n = lugaresEnCategoria(c.id);
      const fila = document.createElement("div");
      fila.className = "categoria-fila";

      const nombre = document.createElement("span");
      nombre.className = "categoria-nombre";
      nombre.textContent = `${c.emoji} ${c.titulo}`;
      const conteo = document.createElement("span");
      conteo.className = "categoria-conteo";
      conteo.textContent = `${n} lugar${n === 1 ? "" : "es"}`;
      fila.append(nombre, conteo);

      if (esAdmin()) {
        const editar = document.createElement("button");
        editar.type = "button";
        editar.className = "categoria-editar";
        editar.dataset.id = c.id;
        editar.setAttribute("aria-label", `Editar la categoría ${c.titulo}`);
        editar.textContent = "✏️";
        fila.append(editar);
      }
      cont.append(fila);
    });
  });

  const nueva = document.createElement("button");
  nueva.type = "button";
  nueva.className = "agregar-nuevo";
  nueva.id = "btn-nueva-categoria";
  nueva.innerHTML = `<span class="agregar-nuevo-mas" aria-hidden="true">+</span><span>Nueva categoría</span>`;
  cont.append(nueva);
}

// ============================================================
//  MODAL: NUEVA / EDITAR CATEGORÍA
//  Se puede abrir desde la lista de categorías o desde el formulario de
//  lugar (opción "➕ Nueva categoría…"); en ese caso, al guardar, la
//  categoría nueva queda elegida en el lugar.
// ============================================================
const modalCategoria = $("#modal-categoria");
let catEdicion = null;       // null = nueva; si no, el id
let catDesdeLugar = false;   // se abrió desde el formulario de lugar
let emojiElegido = "";

function abrirFormCategoria(id = null, { desdeLugar = false, grupo = null } = {}) {
  if (!puedeEditarLugares()) return;
  const cat = id ? CATEGORIAS_POR_ID[id] : null;
  if (id && (!cat || !esAdmin())) return;
  catEdicion = id;
  catDesdeLugar = desdeLugar;

  $("#categoria-titulo").textContent = cat ? `Editar "${cat.titulo}"` : "Nueva categoría";
  $("#categoria-nombre").value = cat ? cat.titulo : "";
  $("#categoria-grupo").innerHTML = GRUPOS
    .map((g) => `<option value="${g.id}">${g.emoji} ${g.titulo}</option>`).join("");
  $("#categoria-grupo").value = cat ? cat.grupo : (GRUPOS_POR_ID[grupo] ? grupo : "alimentos");
  emojiElegido = cat ? cat.emoji : EMOJIS_SUGERIDOS[0];
  $("#categoria-emoji").value = cat && !EMOJIS_SUGERIDOS.includes(cat.emoji) ? cat.emoji : "";
  pintarEmojis();
  errorCategoria("");

  // Borrar: solo admin, solo al editar, solo si está vacía.
  const borrar = $("#btn-borrar-categoria");
  const n = cat ? lugaresEnCategoria(cat.id) : 0;
  borrar.hidden = !cat;
  borrar.disabled = n > 0;
  $("#categoria-borrar-nota").hidden = !(cat && n > 0);
  $("#categoria-borrar-nota").textContent = n > 0
    ? `No se puede borrar: tiene ${n} lugar${n === 1 ? "" : "es"}. Muévelos a otra categoría primero.`
    : "";

  abrirModal(modalCategoria);
  $("#categoria-nombre").focus();
}

function errorCategoria(texto) {
  const e = $("#categoria-error");
  e.textContent = texto;
  e.hidden = !texto;
}

function pintarEmojis() {
  const cont = $("#categoria-emojis");
  cont.innerHTML = "";
  const propio = primerEmoji($("#categoria-emoji").value);
  EMOJIS_SUGERIDOS.forEach((e) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-opcion" + (!propio && e === emojiElegido ? " elegida" : "");
    b.dataset.emoji = e;
    b.setAttribute("aria-pressed", String(!propio && e === emojiElegido));
    b.textContent = e;
    cont.append(b);
  });
}

// Primer "carácter visible" de lo que escribieron (un emoji puede ocupar
// varios caracteres internos, por ejemplo 👨‍👩‍👧).
function primerEmoji(texto) {
  const t = String(texto || "").trim();
  if (!t) return "";
  if (window.Intl && Intl.Segmenter) {
    const [primero] = new Intl.Segmenter("es", { granularity: "grapheme" }).segment(t);
    return primero ? primero.segment : "";
  }
  return [...t][0] || "";
}

function colorNuevo() {
  const usados = new Set(CATEGORIAS.map((c) => c.color));
  return PALETA_CATEGORIAS.find((c) => !usados.has(c)) ||
    PALETA_CATEGORIAS[CATEGORIAS.length % PALETA_CATEGORIAS.length];
}

// "Comida japonesa" -> "comida-japonesa-k3f9"
function nuevoIdCategoria(titulo) {
  return nuevoId(titulo).slice(0, 50);
}

function guardarCategoria(e) {
  e.preventDefault();
  if (!puedeEditarLugares()) return;

  const titulo = $("#categoria-nombre").value.trim().replace(/\s+/g, " ");
  const grupo = $("#categoria-grupo").value;
  const emoji = primerEmoji($("#categoria-emoji").value) || emojiElegido;

  if (!titulo) return errorCategoria("El nombre es obligatorio.");
  if (titulo.length > 40) return errorCategoria("El nombre es muy largo (máximo 40 letras).");
  if (!GRUPOS_POR_ID[grupo]) return errorCategoria("Elige un bloque.");
  if (!emoji || emoji.length > 16) return errorCategoria("Elige un emoji.");

  const repetida = CATEGORIAS.find(
    (c) => c.id !== catEdicion && normalizar(c.titulo) === normalizar(titulo)
  );
  if (repetida) return errorCategoria(`Ya existe "${repetida.titulo}".`);

  const editando = Boolean(catEdicion);
  const desdeLugar = catDesdeLugar;
  const color = colorNuevo();
  let id = catEdicion;

  if (editando) {
    if (!esAdmin()) return;
    const anterior = CATEGORIAS_POR_ID[id];
    if (!anterior) return errorCategoria("Esta categoría ya no existe.");
    const datos = { titulo, emoji, grupo, color: anterior.color };
    if (Number.isInteger(anterior.orden)) datos.orden = anterior.orden;
    nube.editarCategoria(id, datos, quienSoy()).catch(errorAlGuardar);
  } else {
    id = nuevoIdCategoria(titulo);
    nube.crearCategoria(id, { titulo, emoji, grupo, color }, quienSoy()).catch(errorAlGuardar);
  }

  cerrarModal(modalCategoria);
  avisar(editando ? `Guardada: ${emoji} ${titulo}` : `Categoría creada: ${emoji} ${titulo} ✔`);

  // Desde el formulario de lugar: dejarla elegida ahí.
  // (La nube la manda de regreso al instante; si aún no llega, la ponemos ya.)
  if (desdeLugar && modalLugar.classList.contains("abierto")) {
    if (!CATEGORIAS_POR_ID[id]) {
      establecerCategorias([...CATEGORIAS, { id, titulo, emoji, grupo, color }]);
    }
    llenarSelectCategorias(id);
  }
}

function borrarCategoria() {
  const cat = catEdicion && CATEGORIAS_POR_ID[catEdicion];
  if (!cat || !esAdmin()) return;
  if (lugaresEnCategoria(cat.id) > 0) return; // el botón ya está deshabilitado
  if (!confirm(`¿Borrar la categoría "${cat.titulo}"?`)) return;
  nube.borrarCategoria(cat.id).catch(errorAlGuardar);
  cerrarModal(modalCategoria);
  avisar(`Categoría borrada: ${cat.titulo}`);
}

$("#form-categoria").addEventListener("submit", guardarCategoria);

// En el formulario de lugar, elegir "➕ Nueva categoría…" abre el formulario
// de categoría (y el selector regresa a lo que tenía, por si cancelan).
$("#lugar-categoria").addEventListener("change", (e) => {
  const select = e.target;
  if (select.value === "__nueva__") {
    select.value = select.dataset.anterior || "";
    abrirFormCategoria(null, { desdeLugar: true });
  } else {
    select.dataset.anterior = select.value;
  }
});

// Escribir un emoji propio quita la selección de los sugeridos.
$("#categoria-emoji").addEventListener("input", pintarEmojis);

// ============================================================
//  MODAL: MAPA
// ============================================================
const modalMapa = $("#modal-mapa");

function abrirMapa(id) {
  const lugar = LUGARES_POR_ID[id];
  if (!lugar || !(lugar.mapa || lugar.mapsUrl)) return;
  const consulta = encodeURIComponent(lugar.mapa || conCiudad(lugar.nombre));
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
  if (m === modalAgregar) diaAgregar = null;
  if (m === modalCategoria) { catEdicion = null; catDesdeLugar = false; }
  if (m === modalLugar) { edicion = null; destinoNuevo = null; busquedaFoto++; }
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
    aplicarViaje(VIAJE_LOCAL);
    establecerCategorias(CATEGORIAS_BASE);
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
  if (!puedeEditarLugares()) [modalCategorias, modalCategoria].forEach(cerrarModal);
  refrescarTodo();
  revisarSiembraCategorias();
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

function actualizarCategorias(lista, desdeServidor) {
  if (desdeServidor) categoriasDelServidor = true;
  // Colección vacía: seguimos con las de la base (y el admin las sube).
  establecerCategorias(lista.length ? lista : CATEGORIAS_BASE);
  if (lista.length) categoriasSembradas = true;
  establecerLugares(lugaresCrudos); // por si había lugares de una categoría que acaba de llegar
  recalcularAgenda();
  refrescarTodo();
  categoriasVacias = lista.length === 0;
  revisarSiembraCategorias();
}
let categoriasVacias = false;

// La primera vez que el admin abre la app con la colección vacía, se suben
// las 8 de la base. Solo una vez por carga (y solo si el servidor lo confirmó).
let categoriasSembradas = false;
function revisarSiembraCategorias() {
  if (!nube || !esAdmin() || !categoriasDelServidor || !categoriasVacias) return;
  if (categoriasSembradas || sembrandoCategorias) return;
  sembrandoCategorias = true;
  nube.sembrarCategorias(CATEGORIAS_BASE, quienSoy())
    .then(() => { categoriasSembradas = true; })
    .catch((err) => console.error("No se pudieron subir las categorías base:", err))
    .finally(() => { sembrandoCategorias = false; });
}

function actualizarLugares(lista, desdeServidor) {
  establecerLugares(lista);
  lugaresRecibidos = true;
  if (desdeServidor) lugaresDelServidor = true;
  recalcularAgenda();
  refrescarTodo();
  actualizarFotos();
}

// Guarda el viaje y calcula sus días. Se defiende de datos raros
// (por ejemplo, un documento editado a mano en la consola).
function aplicarViaje(cfg) {
  const texto = (v, porDefecto = "") => (typeof v === "string" ? v : porDefecto);
  viaje = cfg
    ? {
        nombre: texto(cfg.nombre, "Vacaciones") || "Vacaciones",
        ciudad: texto(cfg.ciudad),
        inicio: texto(cfg.inicio),
        fin: texto(cfg.fin),
        llegada: texto(cfg.llegada),
        salida: texto(cfg.salida),
      }
    : null;
  ciudad = viaje ? viaje.ciudad : "";
  construirDias(viaje);
}

function actualizarViaje(cfg, desdeServidor) {
  // Si lo que llegó es de la caché y dice "no hay viaje", esperamos al
  // servidor antes de mostrar "configura tu viaje".
  if (!cfg && !desdeServidor) return;
  if (desdeServidor) viajeDelServidor = true;

  aplicarViaje(cfg);
  // Los días cambiaron: un selector de día abierto ya no es válido.
  if (modalDia.classList.contains("abierto")) cerrarModal(modalDia);
  recalcularAgenda();
  refrescarTodo();
}

function actualizarAgenda(agendaNube, visitadosNube = {}) {
  agendaCruda = agendaNube;
  visitadosCrudos = visitadosNube;
  recalcularAgenda();
  refrescarTodo();
}

function actualizarVotos(nuevos) {
  votos = nuevos;
  refrescarTodo();
}

function errorNube(err) {
  console.error("Error de sincronización:", err);
  avisar("No se pudo sincronizar. Revisa tu conexión.");
}

// ============================================================
//  MODAL: CONFIGURAR / REINICIAR VIAJE (solo admin)
//  Borra la agenda y los votos (y los lugares, si no se conservan)
//  y guarda las fechas del viaje nuevo.
// ============================================================
const modalViaje = $("#modal-viaje");
const formViaje = $("#form-viaje");
let guardandoViaje = false;

function errorViaje(texto) {
  const e = $("#viaje-error");
  e.textContent = texto;
  e.hidden = !texto;
}

// ============================================================
//  RESUMEN DEL VIAJE (.txt) y "¿Estás seguro?" antes de reiniciar
// ============================================================
// Texto con los lugares VISITADOS de cada día (solo el nombre).
function generarResumen() {
  if (!viaje || !DIAS.length) throw new Error("No hay viaje configurado.");
  const fecha = (iso) => fechaDeIso(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  const hoy = new Date().toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  const lineas = [
    `RESUMEN DE TU VIAJE: ${viaje.nombre}`,
    `${viaje.ciudad ? `${viaje.ciudad} · ` : ""}${fecha(viaje.inicio)} – ${fecha(viaje.fin)} (${DIAS.length} día${DIAS.length === 1 ? "" : "s"})`,
    `Descargado el ${hoy}${sesion.nombre ? ` por ${sesion.nombre}` : ""}`,
    "",
  ];

  let total = 0;
  DIAS.forEach((d) => {
    // Visitados en el orden del día.
    const visitados = estado.agenda[d.id]
      .filter((id) => esVisitado(d.id, id) && LUGARES_POR_ID[id])
      .map((id) => LUGARES_POR_ID[id].nombre);
    total += visitados.length;
    lineas.push(d.etiqueta.toUpperCase());
    if (visitados.length) visitados.forEach((n) => lineas.push(`  [x] ${n}`));
    else lineas.push("  (nada visitado)");
    lineas.push("");
  });
  lineas.push(`Total visitado: ${total} lugar${total === 1 ? "" : "es"}`);
  return lineas.join("\r\n");
}

// Descarga el resumen como .txt. Lanza error si algo falla (así el
// reinicio no sigue si el resumen no se pudo guardar).
function descargarResumen() {
  const texto = generarResumen();
  const nombre = normalizar(viaje.nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "viaje";
  // La marca BOM ayuda a que el Bloc de notas muestre bien los acentos.
  const blob = new Blob(["\uFEFF" + texto], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resumen-${nombre}-${viaje.inicio}.txt`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return a.download;
}

function descargarResumenBoton() {
  if (!nube || !esAdmin() || !viaje) return;
  try {
    avisar(`Descargado: ${descargarResumen()}`);
  } catch (err) {
    console.error("No se pudo crear el resumen:", err);
    avisar("No se pudo crear el resumen.");
  }
}

const modalConfirmar = $("#modal-confirmar-reinicio");

function pedirConfirmacionReinicio() {
  if (!nube || !esAdmin()) return;
  if (!viaje) { abrirFormViaje(); return; } // no hay nada que borrar

  const actividades = Object.values(agendaCruda).reduce((n, a) => n + a.length, 0);
  const totalVotosAhora = Object.values(votos).reduce((n, v) => n + v.lugares.length, 0);
  const lugares = Object.keys(LUGARES_POR_ID).length;
  const s = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  $("#confirmar-detalle").textContent =
    `Al guardar el viaje nuevo se borrará de "${viaje.nombre}": ` +
    `${s(actividades, "actividad", "actividades")} en la agenda, ${s(totalVotosAhora, "voto", "votos")} ` +
    `y ${s(lugares, "lugar", "lugares")} (los lugares los puedes conservar en el siguiente paso).`;
  abrirModal(modalConfirmar);
  $("#btn-reinicio-no").focus();
}

function confirmarReinicio() {
  if (!nube || !esAdmin()) return;
  cerrarModal(modalConfirmar);
  try {
    const archivo = descargarResumen();
    avisar(`Resumen guardado: ${archivo}`);
  } catch (err) {
    console.error("No se pudo crear el resumen:", err);
    avisar("No se pudo descargar el resumen, así que no se reinició nada.");
    return;
  }
  abrirFormViaje();
}

function abrirFormViaje() {
  if (!nube || !esAdmin()) return;
  const primera = !viaje;

  $("#viaje-titulo").textContent = primera ? "Configurar viaje" : "Reiniciar viaje";
  $("#viaje-aviso").textContent = primera
    ? "Define el viaje. Lo que haya quedado de antes en la agenda y en los votos se borrará."
    : "⚠️ Se borrará toda la agenda y todos los votos del viaje actual. No se puede deshacer.";

  $("#viaje-nombre").value = "";
  $("#viaje-ciudad").value = "";
  $("#viaje-inicio").value = "";
  $("#viaje-fin").value = "";
  $("#viaje-llegada").value = "";
  $("#viaje-salida").value = "";
  $("#viaje-conservar").checked = false;
  errorViaje("");

  abrirModal(modalViaje);
  $("#viaje-nombre").focus();
}

async function guardarViaje(e) {
  e.preventDefault();
  if (!nube || !esAdmin() || guardandoViaje) return;

  const cfg = {
    nombre: $("#viaje-nombre").value.trim().replace(/\s+/g, " "),
    ciudad: $("#viaje-ciudad").value.trim().replace(/\s+/g, " "),
    inicio: $("#viaje-inicio").value,
    fin: $("#viaje-fin").value,
    llegada: $("#viaje-llegada").value.trim(),
    salida: $("#viaje-salida").value.trim(),
  };
  const conservar = $("#viaje-conservar").checked;

  if (!cfg.nombre) return errorViaje("El nombre del viaje es obligatorio.");
  if (!cfg.ciudad) return errorViaje("La ciudad es obligatoria.");
  if (!fechaDeIso(cfg.inicio) || !fechaDeIso(cfg.fin)) return errorViaje("Elige las fechas de inicio y fin.");
  const dias = cuentaDias(cfg.inicio, cfg.fin);
  if (dias === 0) return errorViaje("La fecha final no puede ser antes de la inicial.");
  if (dias > MAX_DIAS_VIAJE) return errorViaje(`El viaje puede durar máximo ${MAX_DIAS_VIAJE} días.`);
  if (!navigator.onLine) return errorViaje("Necesitas internet para reiniciar el viaje.");

  // (La confirmación ya se hizo con el pop up "¿Estás seguro?", que además
  // descargó el resumen del viaje anterior.)

  guardandoViaje = true;
  const boton = $("#btn-guardar-viaje");
  boton.disabled = true;
  boton.textContent = "Guardando…";
  try {
    await nube.reiniciarViaje(cfg, conservar, quienSoy());
    cerrarModal(modalViaje);
    avisar("Viaje listo ✔");
  } catch (err) {
    console.error("No se pudo reiniciar el viaje:", err);
    errorViaje(err && err.code === "permission-denied"
      ? "No tienes permiso para reiniciar el viaje (¿publicaste las reglas nuevas y eres admin?)."
      : "No se pudo completar. Revisa tu internet e intenta de nuevo; es seguro repetirlo.");
  } finally {
    guardandoViaje = false;
    boton.disabled = false;
    boton.textContent = "Guardar";
  }
}

formViaje.addEventListener("submit", guardarViaje);

// auth.js y nube.js (módulos) se comunican con la app por aquí.
window.App = {
  establecerSesion, usarNube, actualizarViaje, actualizarCategorias, actualizarLugares,
  actualizarAgenda, actualizarVotos, errorNube,
};

// ============================================================
//  NAVEGACIÓN ENTRE VISTAS (tabs)
// ============================================================
function cambiarVista(nombre) {
  $$(".tab").forEach((t) => t.classList.toggle("activa", t.dataset.vista === nombre));
  $$(".vista").forEach((v) => v.classList.remove("activa"));
  $(`#vista-${nombre}`).classList.add("activa");
  if (nombre === "favoritos") pintarFavoritos();
  // Al abrir "Los días", ir al día de hoy. Si los días todavía no cargan,
  // se hace en cuanto se pinten.
  irAHoyPendiente = false;
  if (nombre === "dias") {
    if (DIAS.length && $(".dia")) requestAnimationFrame(irAHoy);
    else irAHoyPendiente = true;
  }
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
  if (t.closest("#btn-viaje")) { pedirConfirmacionReinicio(); return; }
  if (t.closest("#btn-viaje-config")) { abrirFormViaje(); return; }
  if (t.closest("#btn-reinicio-si")) { confirmarReinicio(); return; }
  if (t.closest("#btn-reinicio-no")) { cerrarModal(modalConfirmar); return; }
  if (t.closest("#btn-descargar-resumen")) { descargarResumenBoton(); return; }
  if (t.closest("#btn-cancelar-viaje")) { cerrarModal(modalViaje); return; }
  if (t.closest("#btn-buscar-foto")) { buscarFoto(); return; }
  if (t.closest("#btn-borrar-lugar")) { borrarLugar(); return; }
  if (t.closest("#btn-cancelar-lugar")) { cerrarModal(modalLugar); return; }

  const foto = t.closest(".foto-opcion");
  if (foto) {
    fotoElegida = foto.dataset.titulo;
    pintarOpcionesFoto($("#fotos-mensaje").textContent);
    return;
  }

  // ----- Categorías (antes que ".agregar-nuevo", que comparte estilo) -----
  if (t.closest("#btn-categorias")) { abrirCategorias(); return; }
  if (t.closest("#btn-nueva-categoria")) { abrirFormCategoria(null); return; }
  const editarCat = t.closest(".categoria-editar");
  if (editarCat) { abrirFormCategoria(editarCat.dataset.id); return; }
  if (t.closest("#btn-borrar-categoria")) { borrarCategoria(); return; }
  if (t.closest("#btn-cancelar-categoria")) { cerrarModal(modalCategoria); return; }
  const emoji = t.closest(".emoji-opcion");
  if (emoji) {
    emojiElegido = emoji.dataset.emoji;
    $("#categoria-emoji").value = "";
    pintarEmojis();
    return;
  }

  const toggleDia = t.closest(".dia-toggle");
  if (toggleDia) { alternarMinimizado(toggleDia.dataset.dia); return; }

  const expandir = t.closest(".dia-expandir");
  if (expandir) { alternarExpandido(expandir.dataset.dia); return; }

  const mas = t.closest(".dia-mas");
  if (mas) { abrirAgregar(mas.dataset.dia); return; }

  const itemAgregar = t.closest(".agregar-item");
  if (itemAgregar) { agregarDesdeLista(itemAgregar.dataset.id); return; }

  if (t.closest(".agregar-nuevo")) { abrirFormLugar(null, diaAgregar); return; }

  if (t.closest("#btn-agregar-listo")) { cerrarModal(modalAgregar); return; }

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

// Casilla de "visitado" en la vista de detalle de un día.
document.addEventListener("change", (e) => {
  const check = e.target.closest(".visitado-check");
  if (check) marcarVisitado(check.dataset.dia, check.dataset.id, check.checked);
});

// ============================================================
//  BUSCADOR (filtra Actividades, Los días y Votos a la vez)
// ============================================================
const campoBusqueda = $("#busqueda");
const botonLimpiar = $("#btn-limpiar-busqueda");
let temporizadorBusqueda = null;

function aplicarBusqueda() {
  clearTimeout(temporizadorBusqueda);
  busqueda = normalizar(campoBusqueda.value).replace(/\s+/g, " ");
  botonLimpiar.hidden = campoBusqueda.value === "";
  refrescarTodo();
}

function limpiarBusqueda() {
  campoBusqueda.value = "";
  aplicarBusqueda();
}

// Un momento después de la última letra (evita repintar en cada tecla).
campoBusqueda.addEventListener("input", () => {
  botonLimpiar.hidden = campoBusqueda.value === "";
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(aplicarBusqueda, 150);
});

campoBusqueda.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && campoBusqueda.value) limpiarBusqueda();
  if (e.key === "Enter") campoBusqueda.blur(); // cierra el teclado en el celular
});

botonLimpiar.addEventListener("click", () => {
  limpiarBusqueda();
  campoBusqueda.focus();
});

// ============================================================
//  ARRANQUE
// ============================================================
// Pintamos de inmediato; los lugares llegan de Firestore (o de
// semilla.js en modo local) en cuanto auth.js decide el modo.
fotosWiki = leerCacheFotos();
establecerCategorias(CATEGORIAS_BASE); // hasta que lleguen las de Firestore
refrescarTodo();
