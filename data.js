// ============================================================
//  DATOS DEL ITINERARIO
//  Aquí vive toda la información. Para cambiar fotos, mapas o
//  agregar lugares, edita solo este archivo.
//
//  Cada lugar tiene:
//    id     -> identificador único (no repetir)
//    nombre
//    mapa   -> texto que se busca en Google Maps (nombre + ciudad)
//    wiki   -> (opcional) título del artículo en Wikipedia en inglés.
//              La foto principal del artículo se usa automáticamente.
//    foto   -> (opcional) TU foto. Si la pones, tiene prioridad sobre todo.
//              Puede ser una URL o una ruta local, ej. "img/tia-lola.jpg"
//
//  Orden de prioridad de la imagen:  foto  ->  wiki  ->  placeholder de color
// ============================================================

// Placeholder de color con el nombre encima (respaldo si no hay foto).
function placeholder(texto, color) {
  const t = encodeURIComponent(texto);
  return `https://placehold.co/600x400/${color}/ffffff?text=${t}&font=poppins`;
}

const CATEGORIAS = [
  {
    id: "familia",
    titulo: "Familia",
    emoji: "👨‍👩‍👧",
    color: "e67e22",
    lugares: [
      { id: "tia-lola", nombre: "Tía Lola", mapa: "" },
      { id: "tia-belen", nombre: "Tía Belén", mapa: "" },
      { id: "tio-mouse", nombre: "Tío Mouse", mapa: "" },
      { id: "chitaro", nombre: "Chítaro", mapa: "" },
    ],
  },
  {
    id: "actividades",
    titulo: "Actividades",
    emoji: "🎢",
    color: "2980b9",
    lugares: [
      { id: "reunion-tower", nombre: "Reunion Tower", mapa: "Reunion Tower, Dallas, TX", wiki: "Reunion Tower" },
      { id: "stockyards", nombre: "Stockyards", mapa: "Fort Worth Stockyards, TX", wiki: "Fort Worth Stockyards" },
      { id: "boliche", nombre: "Boliche", mapa: "bowling near Dallas, TX", wiki: "Tenpin bowling" },
      { id: "cowboys", nombre: "Partido Cowboys", mapa: "AT&T Stadium, Arlington, TX", wiki: "AT&T Stadium" },
      { id: "mavericks", nombre: "Partido Mavericks", mapa: "American Airlines Center, Dallas, TX", wiki: "American Airlines Center" },
      { id: "grapevine-mills", nombre: "Grapevine Mills", mapa: "Grapevine Mills, Grapevine, TX", wiki: "Grapevine Mills" },
      { id: "allen-outlets", nombre: "Allen Premium Outlets", mapa: "Allen Premium Outlets, Allen, TX" },
      { id: "buc-ees", nombre: "Buc-ee's", mapa: "Buc-ee's, Terrell, TX", wiki: "Buc-ee's" },
      { id: "jfk-memorial", nombre: "JFK Memorial Plaza", mapa: "John F. Kennedy Memorial Plaza, Dallas, TX", wiki: "Dealey Plaza" },
      { id: "centro-dallas", nombre: "Centro Dallas (caminar)", mapa: "Downtown Dallas, TX", wiki: "Downtown Dallas" },
      { id: "gas-monkey", nombre: "Gas Monkey", mapa: "Gas Monkey Bar N' Grill, Dallas, TX", wiki: "Gas Monkey Bar N' Grill" },
    ],
  },
  {
    id: "desayunos",
    titulo: "Desayunos",
    emoji: "🍳",
    color: "f39c12",
    lugares: [
      { id: "pan-pa-vos", nombre: "Pan Pa' Vos", mapa: "Pan Pa Vos bakery Dallas TX" },
      { id: "kolaches", nombre: "Kolaches", mapa: "kolache shop Dallas TX", wiki: "Klobásník" },
      { id: "ihop", nombre: "IHOP", mapa: "IHOP Dallas TX", wiki: "IHOP" },
      { id: "donuts", nombre: "Donuts", mapa: "donut shop Dallas TX", wiki: "Doughnut" },
      { id: "dennys", nombre: "Denny's", mapa: "Denny's Dallas TX", wiki: "Denny's" },
      { id: "jjs", nombre: "JJ's", mapa: "JJ's restaurant Dallas TX" },
    ],
  },
  {
    id: "comida-rapida",
    titulo: "Comida rápida / Hamburguesas",
    emoji: "🍔",
    color: "c0392b",
    lugares: [
      { id: "whataburger", nombre: "Whataburger", mapa: "Whataburger Dallas TX", wiki: "Whataburger" },
      { id: "taco-bell", nombre: "Taco Bell", mapa: "Taco Bell Dallas TX", wiki: "Taco Bell" },
      { id: "daves-hot-chicken", nombre: "Dave's Hot Chicken", mapa: "Dave's Hot Chicken Dallas TX", wiki: "Dave's Hot Chicken" },
      { id: "in-n-out", nombre: "In-N-Out", mapa: "In-N-Out Burger Dallas TX", wiki: "In-N-Out Burger" },
      { id: "cicis", nombre: "Cicis", mapa: "Cicis Pizza Dallas TX", wiki: "Cicis Pizza" },
      { id: "panda-express", nombre: "Panda Express", mapa: "Panda Express Dallas TX", wiki: "Panda Express" },
    ],
  },
  {
    id: "restaurantes",
    titulo: "Restaurantes",
    emoji: "🍽️",
    color: "27ae60",
    lugares: [
      { id: "olive-garden", nombre: "Olive Garden", mapa: "Olive Garden Dallas TX", wiki: "Olive Garden" },
      { id: "texas-roadhouse", nombre: "Texas Roadhouse", mapa: "Texas Roadhouse Dallas TX", wiki: "Texas Roadhouse" },
      { id: "espadas-brasilenas", nombre: "Espadas brasileñas", mapa: "Brazilian steakhouse Dallas TX", wiki: "Churrascaria" },
    ],
  },
  {
    id: "mexicano",
    titulo: "Mexicano",
    emoji: "🌮",
    color: "8e44ad",
    lugares: [
      { id: "taqueria-nuevo-leon", nombre: "Taquería Nuevo León", mapa: "Taqueria Nuevo Leon Dallas TX" },
      { id: "delicias-aguascalientes", nombre: "Delicias Aguascalientes", mapa: "Delicias Aguascalientes Dallas TX" },
    ],
  },
  {
    id: "casero",
    titulo: "Casero",
    emoji: "🏠",
    color: "16a085",
    lugares: [
      { id: "jugo-de-carne", nombre: "Jugo de carne / Lengua (Roy)", mapa: "" },
      { id: "carne-asada", nombre: "Carne asada", mapa: "", wiki: "Carne asada" },
    ],
  },
  {
    id: "cenas",
    titulo: "Cenas",
    emoji: "🌙",
    color: "34495e",
    lugares: [
      { id: "panaderia-guatemalteca", nombre: "Panadería guatemalteca", mapa: "Guatemalan bakery Dallas TX", wiki: "Pan dulce" },
      { id: "aunt-annies", nombre: "Auntie Anne's", mapa: "Auntie Anne's Dallas TX", wiki: "Auntie Anne's" },
      { id: "escape-360", nombre: "Escape 360", mapa: "Escape 360 Dallas TX" },
    ],
  },
];

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

// Índice rápido id -> lugar, para buscar sin recorrer todo.
// Cada lugar recibe su placeholder según el color de su categoría.
const LUGARES_POR_ID = {};
CATEGORIAS.forEach((cat) => {
  cat.lugares.forEach((l) => {
    LUGARES_POR_ID[l.id] = {
      ...l,
      categoria: cat.id,
      emoji: cat.emoji,
      respaldo: placeholder(l.nombre, cat.color),
    };
  });
});
