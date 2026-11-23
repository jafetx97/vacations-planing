// ============================================================
//  CONFIGURACIÓN FIJA DE LA APP
//  Categorías, grupos y días. Los LUGARES no viven aquí: están en
//  Firestore (y la lista original, en semilla.js).
//  Los DÍAS se calculan a partir de las fechas del viaje, que se
//  configuran desde la app (botón "Reiniciar viaje", solo admin).
// ============================================================

// Placeholder de color con el nombre encima (respaldo si no hay foto).
function placeholder(texto, color) {
  const t = encodeURIComponent(texto);
  return `https://placehold.co/600x400/${color}/ffffff?text=${t}&font=poppins`;
}

// Las categorías son fijas. Si agregas una, agrégala también en
// firestore.rules (función categoriaValida) y en algún GRUPO.
const CATEGORIAS = [
  { id: "familia",       titulo: "Familia",                      emoji: "👨‍👩‍👧", color: "e67e22" },
  { id: "actividades",   titulo: "Actividades",                  emoji: "🎢", color: "2980b9" },
  { id: "desayunos",     titulo: "Desayunos",                    emoji: "🍳", color: "f39c12" },
  { id: "comida-rapida", titulo: "Comida rápida / Hamburguesas", emoji: "🍔", color: "c0392b" },
  { id: "restaurantes",  titulo: "Restaurantes",                 emoji: "🍽️", color: "27ae60" },
  { id: "mexicano",      titulo: "Mexicano",                     emoji: "🌮", color: "8e44ad" },
  { id: "casero",        titulo: "Casero",                       emoji: "🏠", color: "16a085" },
  { id: "cenas",         titulo: "Cenas",                        emoji: "🌙", color: "34495e" },
];

const CATEGORIAS_POR_ID = {};
CATEGORIAS.forEach((c) => (CATEGORIAS_POR_ID[c.id] = c));

// ============================================================
//  GRUPOS (se pueden expandir / retraer en la pestaña Actividades)
//  Cada grupo junta una o varias categorías de arriba.
// ============================================================
const GRUPOS = [
  { id: "actividades", titulo: "Actividades", emoji: "🎢", categorias: ["actividades"] },
  {
    id: "alimentos",
    titulo: "Alimentos",
    emoji: "🍴",
    categorias: ["desayunos", "comida-rapida", "restaurantes", "mexicano", "casero", "cenas"],
  },
  { id: "familia",     titulo: "Familia",     emoji: "👨‍👩‍👧", categorias: ["familia"] },
];

// ============================================================
//  VIAJE Y DÍAS
//  Configuración del viaje (la guarda Firestore en viajes/dallas):
//    { nombre, ciudad, inicio: "2026-11-23", fin: "2026-11-29",
//      llegada: "✈️ Llegada", salida: "✈️ Salida" }
//  "llegada" se pone en el primer día y "salida" en el último
//  (pueden ir vacías).
//
//  DIAS se llena con construirDias(). Cada día:
//    id        -> la fecha ISO ("2026-11-23"); es el ID en Firestore
//    etiqueta  -> "Lunes 23"
//    corto     -> "Lun 23"  (para botones y etiquetas)
//    fijo      -> texto fijo del día (llegada/salida) o null
//  Si el viaje cruza de mes, se agrega el mes: "Lun 30 nov".
// ============================================================
const MAX_DIAS_VIAJE = 60;

// Solo se usa si Firebase no está configurado (modo local).
const VIAJE_LOCAL = {
  nombre: "Mi viaje",
  ciudad: "",
  inicio: "2026-11-23",
  fin: "2026-11-29",
  llegada: "",
  salida: "",
};

const DIAS = [];
const DIAS_POR_ID = {};

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// "2026-11-23" -> Date local (a mediodía, para que el cambio de horario no la mueva).
// Regresa null si no es una fecha real (por ejemplo "2026-02-31").
function fechaDeIso(iso) {
  const m = FECHA_ISO.exec(String(iso));
  if (!m) return null;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(a, mes - 1, d, 12);
  const real = f.getFullYear() === a && f.getMonth() === mes - 1 && f.getDate() === d;
  return real ? f : null;
}

function isoDeFecha(f) {
  const p = (n) => String(n).padStart(2, "0");
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Días entre dos fechas ISO, contando ambos extremos (0 si algo no es válido).
function cuentaDias(inicio, fin) {
  const a = fechaDeIso(inicio);
  const b = fechaDeIso(fin);
  if (!a || !b || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

// "23 nov – 29 nov" (para el encabezado).
function rangoLegible(cfg) {
  const a = fechaDeIso(cfg.inicio);
  const b = fechaDeIso(cfg.fin);
  if (!a || !b) return "";
  const f = (d) => `${d.getDate()} ${d.toLocaleDateString("es", { month: "short" }).replace(".", "")}`;
  return a.getTime() === b.getTime() ? f(a) : `${f(a)} – ${f(b)}`;
}

// Rellena DIAS y DIAS_POR_ID (en el mismo arreglo, para que todo el
// código que ya los usa vea el cambio).
function construirDias(cfg) {
  DIAS.length = 0;
  Object.keys(DIAS_POR_ID).forEach((k) => delete DIAS_POR_ID[k]);

  const inicio = cfg && fechaDeIso(cfg.inicio);
  const fin = cfg && fechaDeIso(cfg.fin);
  if (!inicio || !fin || fin < inicio) return;

  const cruzaMes = inicio.getMonth() !== fin.getMonth() || inicio.getFullYear() !== fin.getFullYear();
  const total = Math.min(cuentaDias(cfg.inicio, cfg.fin), MAX_DIAS_VIAJE);

  const f = new Date(inicio);
  for (let i = 0; i < total; i++) {
    const dia = f.getDate();
    const mes = f.toLocaleDateString("es", { month: "short" }).replace(".", "");
    const sufijo = cruzaMes ? ` ${mes}` : "";
    const fijos = [];
    if (i === 0 && cfg.llegada) fijos.push(cfg.llegada);
    if (i === total - 1 && cfg.salida) fijos.push(cfg.salida);

    const d = {
      id: isoDeFecha(f),
      etiqueta: `${mayuscula(f.toLocaleDateString("es", { weekday: "long" }))} ${dia}${sufijo}`,
      corto: `${mayuscula(f.toLocaleDateString("es", { weekday: "short" }).replace(".", ""))} ${dia}${sufijo}`,
      fijo: fijos.length ? fijos.join(" · ") : null,
    };
    DIAS.push(d);
    DIAS_POR_ID[d.id] = d;
    f.setDate(f.getDate() + 1);
  }
}

// Índice id -> lugar. Lo llena app.js (desde Firestore o desde semilla.js).
const LUGARES_POR_ID = {};
