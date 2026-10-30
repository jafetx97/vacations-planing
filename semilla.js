// ============================================================
//  LUGARES INICIALES
//  La lista original. Se usa para:
//   - Subirla a Firestore UNA vez (botón que solo ve el admin).
//   - El modo local (si Firebase no está configurado).
//  Después de subirla, los lugares se agregan/editan desde la app.
//
//  Campos: id, categoria, nombre, mapa (texto para buscar en Maps),
//          wiki (título en Wikipedia en inglés, para la foto)
// ============================================================
const LUGARES_INICIALES = [
  // Familia
  { id: "tia-lola", categoria: "familia", nombre: "Tía Lola" },
  { id: "tia-belen", categoria: "familia", nombre: "Tía Belén" },
  { id: "tio-mouse", categoria: "familia", nombre: "Tío Mouse" },
  { id: "chitaro", categoria: "familia", nombre: "Chítaro" },

  // Actividades
  { id: "reunion-tower", categoria: "actividades", nombre: "Reunion Tower", mapa: "Reunion Tower, Dallas, TX", wiki: "Reunion Tower" },
  { id: "stockyards", categoria: "actividades", nombre: "Stockyards", mapa: "Fort Worth Stockyards, TX", wiki: "Fort Worth Stockyards" },
  { id: "boliche", categoria: "actividades", nombre: "Boliche", mapa: "bowling near Dallas, TX", wiki: "Tenpin bowling" },
  { id: "cowboys", categoria: "actividades", nombre: "Partido Cowboys", mapa: "AT&T Stadium, Arlington, TX", wiki: "AT&T Stadium" },
  { id: "mavericks", categoria: "actividades", nombre: "Partido Mavericks", mapa: "American Airlines Center, Dallas, TX", wiki: "American Airlines Center" },
  { id: "grapevine-mills", categoria: "actividades", nombre: "Grapevine Mills", mapa: "Grapevine Mills, Grapevine, TX", wiki: "Grapevine Mills" },
  { id: "allen-outlets", categoria: "actividades", nombre: "Allen Premium Outlets", mapa: "Allen Premium Outlets, Allen, TX" },
  { id: "buc-ees", categoria: "actividades", nombre: "Buc-ee's", mapa: "Buc-ee's, Terrell, TX", wiki: "Buc-ee's" },
  { id: "jfk-memorial", categoria: "actividades", nombre: "JFK Memorial Plaza", mapa: "John F. Kennedy Memorial Plaza, Dallas, TX", wiki: "Dealey Plaza" },
  { id: "centro-dallas", categoria: "actividades", nombre: "Centro Dallas (caminar)", mapa: "Downtown Dallas, TX", wiki: "Downtown Dallas" },
  { id: "gas-monkey", categoria: "actividades", nombre: "Gas Monkey", mapa: "Gas Monkey Bar N' Grill, Dallas, TX", wiki: "Gas Monkey Bar N' Grill" },

  // Desayunos
  { id: "pan-pa-vos", categoria: "desayunos", nombre: "Pan Pa' Vos", mapa: "Pan Pa Vos bakery Dallas TX" },
  { id: "kolaches", categoria: "desayunos", nombre: "Kolaches", mapa: "kolache shop Dallas TX", wiki: "Klobásník" },
  { id: "ihop", categoria: "desayunos", nombre: "IHOP", mapa: "IHOP Dallas TX", wiki: "IHOP" },
  { id: "donuts", categoria: "desayunos", nombre: "Donuts", mapa: "donut shop Dallas TX", wiki: "Doughnut" },
  { id: "dennys", categoria: "desayunos", nombre: "Denny's", mapa: "Denny's Dallas TX", wiki: "Denny's" },
  { id: "jjs", categoria: "desayunos", nombre: "JJ's", mapa: "JJ's restaurant Dallas TX" },

  // Comida rápida
  { id: "whataburger", categoria: "comida-rapida", nombre: "Whataburger", mapa: "Whataburger Dallas TX", wiki: "Whataburger" },
  { id: "taco-bell", categoria: "comida-rapida", nombre: "Taco Bell", mapa: "Taco Bell Dallas TX", wiki: "Taco Bell" },
  { id: "daves-hot-chicken", categoria: "comida-rapida", nombre: "Dave's Hot Chicken", mapa: "Dave's Hot Chicken Dallas TX", wiki: "Dave's Hot Chicken" },
  { id: "in-n-out", categoria: "comida-rapida", nombre: "In-N-Out", mapa: "In-N-Out Burger Dallas TX", wiki: "In-N-Out Burger" },
  { id: "cicis", categoria: "comida-rapida", nombre: "Cicis", mapa: "Cicis Pizza Dallas TX", wiki: "Cicis Pizza" },
  { id: "panda-express", categoria: "comida-rapida", nombre: "Panda Express", mapa: "Panda Express Dallas TX", wiki: "Panda Express" },

  // Restaurantes
  { id: "olive-garden", categoria: "restaurantes", nombre: "Olive Garden", mapa: "Olive Garden Dallas TX", wiki: "Olive Garden" },
  { id: "texas-roadhouse", categoria: "restaurantes", nombre: "Texas Roadhouse", mapa: "Texas Roadhouse Dallas TX", wiki: "Texas Roadhouse" },
  { id: "espadas-brasilenas", categoria: "restaurantes", nombre: "Espadas brasileñas", mapa: "Brazilian steakhouse Dallas TX", wiki: "Churrascaria" },

  // Mexicano
  { id: "taqueria-nuevo-leon", categoria: "mexicano", nombre: "Taquería Nuevo León", mapa: "Taqueria Nuevo Leon Dallas TX" },
  { id: "delicias-aguascalientes", categoria: "mexicano", nombre: "Delicias Aguascalientes", mapa: "Delicias Aguascalientes Dallas TX" },

  // Casero
  { id: "jugo-de-carne", categoria: "casero", nombre: "Jugo de carne / Lengua (Roy)" },
  { id: "carne-asada", categoria: "casero", nombre: "Carne asada", wiki: "Carne asada" },

  // Cenas
  { id: "panaderia-guatemalteca", categoria: "cenas", nombre: "Panadería guatemalteca", mapa: "Guatemalan bakery Dallas TX", wiki: "Pan dulce" },
  { id: "aunt-annies", categoria: "cenas", nombre: "Auntie Anne's", mapa: "Auntie Anne's Dallas TX", wiki: "Auntie Anne's" },
  { id: "escape-360", categoria: "cenas", nombre: "Escape 360", mapa: "Escape 360 Dallas TX" },
];

const SEMILLA_IDS = new Set(LUGARES_INICIALES.map((l) => l.id));
