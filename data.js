// ============================================================
//  DATOS DEL ITINERARIO
//  Aquí vive toda la información. Para cambiar fotos, mapas o
//  agregar lugares, edita solo este archivo.
//
//  Cada lugar tiene:
//    id    -> identificador único (no repetir)
//    nombre
//    foto  -> URL de imagen (ahora son placeholders, cámbialas por fotos reales)
//    mapa  -> texto que se busca en Google Maps (nombre + ciudad)
// ============================================================

// Helper para generar una foto placeholder bonita con el nombre encima.
function placeholder(texto, color) {
  const t = encodeURIComponent(texto);
  return `https://placehold.co/600x400/${color}/ffffff?text=${t}&font=poppins`;
}

const CATEGORIAS = [
  {
    id: "familia",
    titulo: "Familia",
    emoji: "👨‍👩‍👧",
    lugares: [
      { id: "tia-lola", nombre: "Tía Lola", foto: placeholder("Tía Lola", "e67e22"), mapa: "" },
      { id: "tia-belen", nombre: "Tía Belén", foto: placeholder("Tía Belén", "e67e22"), mapa: "" },
      { id: "tio-mouse", nombre: "Tío Mouse", foto: placeholder("Tío Mouse", "e67e22"), mapa: "" },
      { id: "chitaro", nombre: "Chítaro", foto: placeholder("Chítaro", "e67e22"), mapa: "" },
    ],
  },
  {
    id: "actividades",
    titulo: "Actividades",
    emoji: "🎢",
    lugares: [
      { id: "reunion-tower", nombre: "Reunion Tower", foto: placeholder("Reunion Tower", "2980b9"), mapa: "Reunion Tower, Dallas, TX" },
      { id: "stockyards", nombre: "Stockyards", foto: placeholder("Stockyards", "2980b9"), mapa: "Fort Worth Stockyards, TX" },
      { id: "boliche", nombre: "Boliche", foto: placeholder("Boliche", "2980b9"), mapa: "bowling near Dallas, TX" },
      { id: "cowboys", nombre: "Partido Cowboys", foto: placeholder("Cowboys", "2980b9"), mapa: "AT&T Stadium, Arlington, TX" },
      { id: "mavericks", nombre: "Partido Mavericks", foto: placeholder("Mavericks", "2980b9"), mapa: "American Airlines Center, Dallas, TX" },
      { id: "grapevine-mills", nombre: "Grapevine Mills", foto: placeholder("Grapevine Mills", "2980b9"), mapa: "Grapevine Mills, Grapevine, TX" },
      { id: "allen-outlets", nombre: "Allen Premium Outlets", foto: placeholder("Allen Outlets", "2980b9"), mapa: "Allen Premium Outlets, Allen, TX" },
      { id: "buc-ees", nombre: "Buc-ee's", foto: placeholder("Buc-ee's", "2980b9"), mapa: "Buc-ee's, Terrell, TX" },
      { id: "jfk-memorial", nombre: "JFK Memorial Plaza", foto: placeholder("JFK Memorial", "2980b9"), mapa: "John F. Kennedy Memorial Plaza, Dallas, TX" },
      { id: "centro-dallas", nombre: "Centro Dallas (caminar)", foto: placeholder("Centro Dallas", "2980b9"), mapa: "Downtown Dallas, TX" },
      { id: "gas-monkey", nombre: "Gas Monkey", foto: placeholder("Gas Monkey", "2980b9"), mapa: "Gas Monkey Bar N' Grill, Dallas, TX" },
    ],
  },
  {
    id: "desayunos",
    titulo: "Desayunos",
    emoji: "🍳",
    lugares: [
      { id: "pan-pa-vos", nombre: "Pan Pa' Vos", foto: placeholder("Pan Pa Vos", "f39c12"), mapa: "Pan Pa Vos bakery Dallas TX" },
      { id: "kolaches", nombre: "Kolaches", foto: placeholder("Kolaches", "f39c12"), mapa: "kolache shop Dallas TX" },
      { id: "ihop", nombre: "IHOP", foto: placeholder("IHOP", "f39c12"), mapa: "IHOP Dallas TX" },
      { id: "donuts", nombre: "Donuts", foto: placeholder("Donuts", "f39c12"), mapa: "donut shop Dallas TX" },
      { id: "dennys", nombre: "Denny's", foto: placeholder("Denny's", "f39c12"), mapa: "Denny's Dallas TX" },
      { id: "jjs", nombre: "JJ's", foto: placeholder("JJ's", "f39c12"), mapa: "JJ's restaurant Dallas TX" },
    ],
  },
  {
    id: "comida-rapida",
    titulo: "Comida rápida / Hamburguesas",
    emoji: "🍔",
    lugares: [
      { id: "whataburger", nombre: "Whataburger", foto: placeholder("Whataburger", "c0392b"), mapa: "Whataburger Dallas TX" },
      { id: "taco-bell", nombre: "Taco Bell", foto: placeholder("Taco Bell", "c0392b"), mapa: "Taco Bell Dallas TX" },
      { id: "daves-hot-chicken", nombre: "Dave's Hot Chicken", foto: placeholder("Daves Hot Chicken", "c0392b"), mapa: "Dave's Hot Chicken Dallas TX" },
      { id: "in-n-out", nombre: "In-N-Out", foto: placeholder("In-N-Out", "c0392b"), mapa: "In-N-Out Burger Dallas TX" },
      { id: "cicis", nombre: "Cicis", foto: placeholder("Cicis", "c0392b"), mapa: "Cicis Pizza Dallas TX" },
      { id: "panda-express", nombre: "Panda Express", foto: placeholder("Panda Express", "c0392b"), mapa: "Panda Express Dallas TX" },
    ],
  },
  {
    id: "restaurantes",
    titulo: "Restaurantes",
    emoji: "🍽️",
    lugares: [
      { id: "olive-garden", nombre: "Olive Garden", foto: placeholder("Olive Garden", "27ae60"), mapa: "Olive Garden Dallas TX" },
      { id: "texas-roadhouse", nombre: "Texas Roadhouse", foto: placeholder("Texas Roadhouse", "27ae60"), mapa: "Texas Roadhouse Dallas TX" },
      { id: "espadas-brasilenas", nombre: "Espadas brasileñas", foto: placeholder("Espadas Brasileñas", "27ae60"), mapa: "Brazilian steakhouse Dallas TX" },
    ],
  },
  {
    id: "mexicano",
    titulo: "Mexicano",
    emoji: "🌮",
    lugares: [
      { id: "taqueria-nuevo-leon", nombre: "Taquería Nuevo León", foto: placeholder("Taquería Nuevo León", "8e44ad"), mapa: "Taqueria Nuevo Leon Dallas TX" },
      { id: "delicias-aguascalientes", nombre: "Delicias Aguascalientes", foto: placeholder("Delicias Aguascalientes", "8e44ad"), mapa: "Delicias Aguascalientes Dallas TX" },
    ],
  },
  {
    id: "casero",
    titulo: "Casero",
    emoji: "🏠",
    lugares: [
      { id: "jugo-de-carne", nombre: "Jugo de carne / Lengua (Roy)", foto: placeholder("Jugo de carne - Roy", "16a085"), mapa: "" },
      { id: "carne-asada", nombre: "Carne asada", foto: placeholder("Carne asada", "16a085"), mapa: "" },
    ],
  },
  {
    id: "cenas",
    titulo: "Cenas",
    emoji: "🌙",
    lugares: [
      { id: "panaderia-guatemalteca", nombre: "Panadería guatemalteca", foto: placeholder("Panadería Guatemalteca", "34495e"), mapa: "Guatemalan bakery Dallas TX" },
      { id: "aunt-annies", nombre: "Aunt Annie's", foto: placeholder("Aunt Annie's", "34495e"), mapa: "Auntie Anne's Dallas TX" },
      { id: "escape-360", nombre: "Escape 360", foto: placeholder("Escape 360", "34495e"), mapa: "Escape 360 Dallas TX" },
    ],
  },
];

// ============================================================
//  DÍAS DEL VIAJE (7 al 22)
//  "fijo" es un evento que ya está agendado y no se puede quitar.
// ============================================================
const DIAS = [
  { id: "sab-7",  etiqueta: "Sábado 7",   fijo: "✈️ Llegada (~4 pm)" },
  { id: "dom-8",  etiqueta: "Domingo 8",  fijo: "🏀 Partido Mavericks" },
  { id: "lun-9",  etiqueta: "Lunes 9",    fijo: null },
  { id: "mar-10", etiqueta: "Martes 10",  fijo: null },
  { id: "mie-11", etiqueta: "Miércoles 11", fijo: null },
  { id: "jue-12", etiqueta: "Jueves 12",  fijo: null },
  { id: "vie-13", etiqueta: "Viernes 13", fijo: null },
  { id: "sab-14", etiqueta: "Sábado 14",  fijo: null },
  { id: "dom-15", etiqueta: "Domingo 15", fijo: "🏈 Partido Cowboys" },
  { id: "lun-16", etiqueta: "Lunes 16",   fijo: null },
  { id: "mar-17", etiqueta: "Martes 17",  fijo: null },
  { id: "mie-18", etiqueta: "Miércoles 18", fijo: null },
  { id: "jue-19", etiqueta: "Jueves 19",  fijo: null },
  { id: "vie-20", etiqueta: "Viernes 20", fijo: "🥩 Espadas brasileñas" },
  { id: "sab-21", etiqueta: "Sábado 21",  fijo: null },
  { id: "dom-22", etiqueta: "Domingo 22", fijo: "✈️ Salida (12 pm al aeropuerto)" },
];

// Índice rápido id -> lugar, para buscar sin recorrer todo.
const LUGARES_POR_ID = {};
CATEGORIAS.forEach((cat) => {
  cat.lugares.forEach((l) => {
    LUGARES_POR_ID[l.id] = { ...l, categoria: cat.id, emoji: cat.emoji };
  });
});
