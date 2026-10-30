// ============================================================
//  Lógica de la app
//  - Pinta tarjetas, días y favoritos
//  - Botón "Agregar al día" / "Mover / Quitar" con selector de día
//  - Guarda todo en localStorage (sin servidor, sin login)
// ============================================================

const CLAVE_GUARDADO = "vacaciones-dallas-v1";

// Estado: qué está en cada día + qué es favorito.
// { agenda: { "dom-8": ["mavericks", ...], ... }, favoritos: ["ihop", ...] }
let estado = cargarEstado();

function cargarEstado() {
  const agenda = {};
  DIAS.forEach((d) => (agenda[d.id] = []));
  let favoritos = [];

  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    if (guardado && guardado.agenda && Array.isArray(guardado.favoritos)) {
      // Solo conservamos días y lugares que todavía existen.
      DIAS.forEach((d) => {
        agenda[d.id] = (guardado.agenda[d.id] || []).filter((id) => LUGARES_POR_ID[id]);
      });
      favoritos = guardado.favoritos.filter((id) => LUGARES_POR_ID[id]);
    }
  } catch (e) {
    /* si está corrupto, empezamos limpio */
  }
  return { agenda, favoritos };
}

function guardar() {
  localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado));
}

// ---------- Utilidades ----------
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

function esFavorito(id) {
  return estado.favoritos.includes(id);
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
//  TARJETA (la misma en Actividades, Los días y Favoritos)
//  diaId: si viene, la card está dentro de ese día -> "Mover / Quitar"
// ============================================================
function crearTarjeta(lugar, diaId = null) {
  const fav = esFavorito(lugar.id);
  const agendado = diasDeLugar(lugar.id);

  const el = document.createElement("div");
  el.className = "tarjeta";
  el.dataset.id = lugar.id;

  // En Actividades/Favoritos mostramos en qué días ya está.
  const etiquetas = !diaId && agendado.length
    ? `<div class="agendado">📅 ${agendado.map((d) => d.corto).join(", ")}</div>`
    : "";

  const botonDia = diaId
    ? `<button class="dia-btn mover" data-id="${lugar.id}" data-dia="${diaId}">🔀 Mover / Quitar</button>`
    : `<button class="dia-btn" data-id="${lugar.id}">➕ Agregar al día</button>`;

  el.innerHTML = `
    <img src="${fotoDe(lugar)}" alt="${lugar.nombre}" loading="lazy" />
    <div class="cuerpo">
      <div class="nombre">${lugar.nombre}</div>
      ${etiquetas}
      <div class="acciones">
        <button class="fav-btn ${fav ? "activo" : ""}" data-id="${lugar.id}"
                aria-label="${fav ? "Quitar de favoritos" : "Marcar como favorito"}"
                aria-pressed="${fav}">
          ${fav ? "❤️" : "🤍"}
        </button>
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
//  VISTA: FAVORITOS
// ============================================================
function pintarFavoritos() {
  const cont = $("#favoritos");
  if (estado.favoritos.length === 0) {
    cont.innerHTML = `<p class="vacio">Aún no hay favoritos.<br>Toca 🤍 en las actividades que te gusten.</p>`;
    return;
  }
  cont.innerHTML = '<div class="grid"></div>';
  const grid = $(".grid", cont);
  estado.favoritos.forEach((id) => grid.appendChild(crearTarjeta(LUGARES_POR_ID[id])));
}

// ============================================================
//  FAVORITOS: toggle
// ============================================================
function alternarFavorito(id) {
  const i = estado.favoritos.indexOf(id);
  if (i >= 0) estado.favoritos.splice(i, 1);
  else estado.favoritos.push(id);
  guardar();
  refrescarTodo();
}

// ============================================================
//  AGENDA: agregar / mover / quitar
// ============================================================
function agregarADia(lugarId, diaId) {
  if (!estado.agenda[diaId].includes(lugarId)) estado.agenda[diaId].push(lugarId);
}

function quitarDeDia(lugarId, diaId) {
  estado.agenda[diaId] = estado.agenda[diaId].filter((id) => id !== lugarId);
}

// ============================================================
//  MODAL: ELEGIR DÍA
//  modo "agregar": desde Actividades/Favoritos
//  modo "mover":   desde una card que ya está en un día
// ============================================================
const modalDia = $("#modal-dia");
let seleccion = null; // { lugarId, diaOrigen | null }

function abrirSelectorDia(lugarId, diaOrigen = null) {
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
  if (!seleccion) return;
  const { lugarId, diaOrigen } = seleccion;
  const lugar = LUGARES_POR_ID[lugarId];

  // Modo agregar + día donde ya está -> quitarlo de ese día.
  if (!diaOrigen && estado.agenda[diaId].includes(lugarId)) {
    quitarDeDia(lugarId, diaId);
    guardar();
    cerrarModal(modalDia);
    refrescarTodo();
    avisar(`Quitado del ${DIAS_POR_ID[diaId].etiqueta}: ${lugar.nombre}`);
    return;
  }

  if (diaOrigen) quitarDeDia(lugarId, diaOrigen);
  agregarADia(lugarId, diaId);
  guardar();
  cerrarModal(modalDia);
  refrescarTodo();
  avisar(`${diaOrigen ? "Movido" : "Agregado"}: ${lugar.nombre} → ${DIAS_POR_ID[diaId].etiqueta}`);
}

function quitarSeleccion() {
  if (!seleccion || !seleccion.diaOrigen) return;
  const { lugarId, diaOrigen } = seleccion;
  quitarDeDia(lugarId, diaOrigen);
  guardar();
  cerrarModal(modalDia);
  refrescarTodo();
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

  if (t.closest("#btn-reiniciar")) {
    if (confirm("¿Borrar todas las elecciones y empezar de cero?")) {
      localStorage.removeItem(CLAVE_GUARDADO);
      estado = cargarEstado();
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
