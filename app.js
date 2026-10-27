// ============================================================
//  Lógica de la app
//  - Pinta tarjetas, días y favoritos
//  - Drag & drop con SortableJS (táctil + escritorio)
//  - Guarda todo en localStorage (sin servidor, sin login)
// ============================================================

const CLAVE_GUARDADO = "vacaciones-dallas-v1";

// Estado: qué está en cada día + qué es favorito.
// { agenda: { "dom-8": ["mavericks", ...], ... }, favoritos: ["ihop", ...] }
let estado = cargarEstado();

function cargarEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    if (guardado && guardado.agenda && guardado.favoritos) return guardado;
  } catch (e) {
    /* si está corrupto, empezamos limpio */
  }
  const agenda = {};
  DIAS.forEach((d) => (agenda[d.id] = []));
  return { agenda, favoritos: [] };
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

// ============================================================
//  VISTA: ACTIVIDADES
// ============================================================
function pintarActividades() {
  const cont = $("#categorias");
  cont.innerHTML = "";

  CATEGORIAS.forEach((cat) => {
    const seccion = document.createElement("div");
    seccion.className = "categoria";
    seccion.innerHTML = `
      <h2>${cat.emoji} ${cat.titulo}
        <span class="conteo">${cat.lugares.length}</span>
      </h2>
      <div class="grid" data-categoria="${cat.id}"></div>`;
    const grid = $(".grid", seccion);

    cat.lugares.forEach((lugar) => {
      grid.appendChild(crearTarjeta(lugar));
    });

    cont.appendChild(seccion);

    // Las tarjetas se pueden arrastrar hacia los días.
    new Sortable(grid, {
      group: { name: "actividades", pull: "clone", put: false },
      sort: false,
      animation: 150,
      delay: 120, // mantener presionado un momento para arrastrar en táctil
      delayOnTouchOnly: true,
    });
  });
}

function crearTarjeta(lugar) {
  const el = document.createElement("div");
  el.className = "tarjeta";
  el.dataset.id = lugar.id;
  el.innerHTML = `
    <img src="${lugar.foto}" alt="${lugar.nombre}" loading="lazy" />
    <div class="cuerpo">
      <div class="nombre">${lugar.nombre}</div>
      <div class="acciones">
        <button class="fav-btn ${esFavorito(lugar.id) ? "activo" : ""}"
                data-id="${lugar.id}">
          ${esFavorito(lugar.id) ? "❤️" : "🤍"}
        </button>
        ${lugar.mapa ? `<button class="mapa-btn" data-id="${lugar.id}">📍 Mapa</button>` : ""}
      </div>
    </div>`;
  return el;
}

// ============================================================
//  VISTA: DÍAS
// ============================================================
function pintarDias() {
  const cont = $("#dias");
  cont.innerHTML = "";

  DIAS.forEach((dia) => {
    const el = document.createElement("div");
    el.className = "dia";
    el.innerHTML = `
      <div class="dia-cabecera">
        <span>${dia.etiqueta}</span>
        ${dia.fijo ? `<span class="fijo">${dia.fijo}</span>` : ""}
      </div>
      <div class="dia-lista" data-dia="${dia.id}"></div>`;

    const lista = $(".dia-lista", el);
    (estado.agenda[dia.id] || []).forEach((lugarId) => {
      const chip = crearChip(lugarId);
      if (chip) lista.appendChild(chip);
    });

    cont.appendChild(el);

    // Cada día acepta soltar actividades y reordenarlas entre días.
    new Sortable(lista, {
      group: { name: "actividades", pull: true, put: true },
      animation: 150,
      delay: 120,
      delayOnTouchOnly: true,
      onAdd: onCambioAgenda,
      onRemove: onCambioAgenda,
      onUpdate: onCambioAgenda,
      onStart: () => mostrarPapelera(true),
      onEnd: () => mostrarPapelera(false),
    });
  });
}

function crearChip(lugarId) {
  const lugar = LUGARES_POR_ID[lugarId];
  if (!lugar) return null;
  const el = document.createElement("div");
  el.className = "chip";
  el.dataset.id = lugarId;
  el.innerHTML = `
    <img src="${lugar.foto}" alt="" />
    <span class="chip-nombre">${lugar.emoji} ${lugar.nombre}</span>`;
  return el;
}

// Cuando se mueve algo entre días (o se suelta uno nuevo), reconstruimos
// el estado leyendo lo que hay en el DOM. Simple y a prueba de errores.
function onCambioAgenda() {
  $$(".dia-lista").forEach((lista) => {
    const diaId = lista.dataset.dia;
    estado.agenda[diaId] = $$(".chip", lista).map((c) => c.dataset.id);
  });
  guardar();
}

// ============================================================
//  PAPELERA (para quitar actividades de un día arrastrándolas)
// ============================================================
const papelera = $("#papelera");
let sortablePapelera = null;

function mostrarPapelera(visible) {
  papelera.classList.toggle("visible", visible);
  papelera.setAttribute("aria-hidden", visible ? "false" : "true");
}

sortablePapelera = new Sortable(papelera, {
  group: { name: "actividades", pull: false, put: true },
  onAdd: (evt) => {
    evt.item.remove(); // se cae a la papelera -> se borra
    onCambioAgenda();
  },
});

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
  estado.favoritos.forEach((id) => {
    const lugar = LUGARES_POR_ID[id];
    if (lugar) grid.appendChild(crearTarjeta(lugar));
  });
}

// ============================================================
//  FAVORITOS: toggle
// ============================================================
function alternarFavorito(id) {
  const i = estado.favoritos.indexOf(id);
  if (i >= 0) estado.favoritos.splice(i, 1);
  else estado.favoritos.push(id);
  guardar();
  // Refrescar vistas que muestran el estado de favorito.
  pintarActividades();
  if ($("#vista-favoritos").classList.contains("activa")) pintarFavoritos();
}

// ============================================================
//  MODAL DE MAPA
// ============================================================
const modal = $("#modal-mapa");

function abrirMapa(id) {
  const lugar = LUGARES_POR_ID[id];
  if (!lugar || !lugar.mapa) return;
  const consulta = encodeURIComponent(lugar.mapa);
  $("#modal-titulo").textContent = lugar.nombre;
  $("#modal-iframe").src = `https://www.google.com/maps?q=${consulta}&output=embed`;
  $("#modal-abrir-maps").href = `https://www.google.com/maps/search/?api=1&query=${consulta}`;
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");
}

function cerrarMapa() {
  modal.classList.remove("abierto");
  modal.setAttribute("aria-hidden", "true");
  $("#modal-iframe").src = ""; // detener la carga del mapa
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
  const fav = e.target.closest(".fav-btn");
  if (fav) { alternarFavorito(fav.dataset.id); return; }

  const mapa = e.target.closest(".mapa-btn");
  if (mapa) { abrirMapa(mapa.dataset.id); return; }

  const tab = e.target.closest(".tab");
  if (tab) { cambiarVista(tab.dataset.vista); return; }

  if (e.target.closest(".modal-cerrar") || e.target === modal) { cerrarMapa(); return; }

  if (e.target.closest("#btn-reiniciar")) {
    if (confirm("¿Borrar todas las elecciones y empezar de cero?")) {
      localStorage.removeItem(CLAVE_GUARDADO);
      estado = cargarEstado();
      pintarActividades();
      pintarDias();
      pintarFavoritos();
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarMapa();
});

// ============================================================
//  ARRANQUE
// ============================================================
pintarActividades();
pintarDias();
