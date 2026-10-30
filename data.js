// ============================================================
//  CONFIGURACIÓN FIJA DEL VIAJE
//  Categorías, grupos y días. Los LUGARES ya no viven aquí:
//  están en Firestore (y la lista original, en semilla.js).
// ============================================================

// Placeholder de color con el nombre encima (respaldo si no hay foto).
function placeholder(texto, color) {
  const t = encodeURIComponent(texto);
  return `https://placehold.co/600x400/${color}/ffffff?text=${t}&font=poppins`;
}

// Las categorías son fijas. Si agregas una, agrégala también en
// firestore.rules (lista CATEGORIAS_VALIDAS) y en algún GRUPO.
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
//  DÍAS DEL VIAJE (7 al 22)
//  Solo los vuelos quedan fijos; todo lo demás se agrega con el botón
//  "Agregar al día" de cada card. "corto" se usa en botones y etiquetas.
// ============================================================
const DIAS = [
  { id: "sab-7",  etiqueta: "Sábado 7",     corto: "Sáb 7",  fijo: "✈️ Llegada (~4 pm)" },
  { id: "dom-8",  etiqueta: "Domingo 8",    corto: "Dom 8",  fijo: null },
  { id: "lun-9",  etiqueta: "Lunes 9",      corto: "Lun 9",  fijo: null },
  { id: "mar-10", etiqueta: "Martes 10",    corto: "Mar 10", fijo: null },
  { id: "mie-11", etiqueta: "Miércoles 11", corto: "Mié 11", fijo: null },
  { id: "jue-12", etiqueta: "Jueves 12",    corto: "Jue 12", fijo: null },
  { id: "vie-13", etiqueta: "Viernes 13",   corto: "Vie 13", fijo: null },
  { id: "sab-14", etiqueta: "Sábado 14",    corto: "Sáb 14", fijo: null },
  { id: "dom-15", etiqueta: "Domingo 15",   corto: "Dom 15", fijo: null },
  { id: "lun-16", etiqueta: "Lunes 16",     corto: "Lun 16", fijo: null },
  { id: "mar-17", etiqueta: "Martes 17",    corto: "Mar 17", fijo: null },
  { id: "mie-18", etiqueta: "Miércoles 18", corto: "Mié 18", fijo: null },
  { id: "jue-19", etiqueta: "Jueves 19",    corto: "Jue 19", fijo: null },
  { id: "vie-20", etiqueta: "Viernes 20",   corto: "Vie 20", fijo: null },
  { id: "sab-21", etiqueta: "Sábado 21",    corto: "Sáb 21", fijo: null },
  { id: "dom-22", etiqueta: "Domingo 22",   corto: "Dom 22", fijo: "✈️ Salida (12 pm al aeropuerto)" },
];

const DIAS_POR_ID = {};
DIAS.forEach((d) => (DIAS_POR_ID[d.id] = d));

// Índice id -> lugar. Lo llena app.js (desde Firestore o desde semilla.js).
const LUGARES_POR_ID = {};
