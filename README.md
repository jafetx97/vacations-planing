# 🧳 Vacaciones en Dallas

Página web para planear con la familia qué hacer cada día del viaje: lugares con
fotos y mapas, votos con ❤️ y una agenda compartida que se actualiza en tiempo real
en todos los celulares. Inicio de sesión con Google (Firebase).

Publicada en https://vacations-planing.pamolitas.com (GitHub Pages).

## ¿Cómo se usa?

- **Actividades**: tarjetas con foto por categoría, en grupos que se abren y cierran.
  - ❤️ para votar (se ve quién votó), 📍 para el mapa, 🌐 para el sitio web.
  - **➕ Agregar al día** para agendarlo (tocar un día verde lo quita).
  - **➕ Nuevo lugar** y ✏️ para agregar o editar lugares.
- **Los días**: un bloque por cada día del viaje. El primero y el último pueden llevar
  una nota fija (llegada, salida). **🔀 Mover / Quitar** cambia una actividad de día o
  la saca del plan.
- **❤️ Votos**: lo que la familia votó, del más votado al menos.
- **+ en cada día** (pestaña "Los días"): abre la lista de lugares que todavía no están
  en ningún día; tocas los que quieras (se pueden agregar varios seguidos) y "Listo".
  Al final de esa lista, **+ Nuevo lugar** crea un lugar y lo agrega a ese día.
- **🔍 Buscador** (arriba de las pestañas): filtra mientras escribes, sin importar
  mayúsculas ni acentos. Busca en el nombre, la categoría y el grupo ("mexicano",
  "alimentos"…). Es una sola búsqueda que se aplica a Actividades, Los días y Votos.
  En "Los días" solo muestra los días que tienen coincidencias.
- **Sin sesión**: se ve todo en modo solo lectura.
- **↺ Reiniciar viaje** (solo admin, arriba a la derecha): para reutilizar el sitio con
  otro viaje. Pide nombre, ciudad y fechas de inicio y fin (máximo 60 días), y borra la
  agenda y los votos del viaje anterior. Los lugares se borran también, a menos que
  marques "Conservar la lista de lugares actual". Los días de la pestaña "Los días"
  se generan solos a partir de esas fechas. No se guarda historial de viajes.

## Permisos

| Acción                         | Sin sesión | Miembro | Admin |
|--------------------------------|:----------:|:-------:|:-----:|
| Ver lugares, agenda y votos    | ✔          | ✔       | ✔     |
| Votar (solo sus propios votos) |            | ✔       | ✔     |
| Agendar / mover / quitar       |            | ✔       | ✔     |
| Agregar y editar lugares       |            | ✔       | ✔     |
| Borrar lugares                 |            |         | ✔     |
| Configurar / reiniciar el viaje|            |         | ✔     |

Esto lo hacen cumplir las reglas de Firestore (`firestore.rules`), no solo la interfaz.

## Configuración de Firebase

- `firebase-config.js`: el `firebaseConfig` del proyecto. No es secreto. Mientras
  diga `PEGA_AQUI`, la app funciona en modo local (sin sesión, con `localStorage`).
- `firestore.rules`: cópialas en Firestore → Reglas → Publicar cada vez que cambien.
- **Miembros:** colección `miembros`. ID del documento = correo en minúsculas
  (ej. `mama@gmail.com`), campo `nombre` (string, ej. `"Mamá"`).
- **Admin:** en tu documento de `miembros`, agrega el campo `admin` (boolean) = `true`.
- Los correos no están en el código, porque el repo es público.

## Datos en Firestore

```
miembros/{correo}             → { nombre, admin? }
viajes/dallas                 → { nombre, ciudad, inicio, fin, llegada, salida,
                                  actualizadoPor, actualizadoEn }   (el viaje activo)
viajes/dallas/lugares/{id}    → { nombre, categoria, mapa, mapsUrl, web, wiki,
                                  creadoPor, creadoEn, actualizadoPor, actualizadoEn }
viajes/dallas/agenda/{fecha}  → { lugares: [ids], actualizadoPor, actualizadoEn }
                                  (fecha = "2026-11-23", dentro del rango del viaje)
viajes/dallas/votos/{uid}     → { nombre, lugares: [ids], actualizadoEn }
```

- `dallas` es solo el ID interno del documento, no el nombre del viaje (ese está en
  el campo `nombre` y se cambia desde la app).
- Todo se sincroniza en tiempo real y funciona sin señal (se sube al reconectar).
- Mientras no exista el documento del viaje, el admin ve "Configurar viaje" y los demás
  ven que todavía no está configurado.

**Fotos:** vienen de Wikipedia (gratis, sin API key). Al agregar un lugar, el
formulario busca opciones por nombre y eliges una o "Sin foto". Se guardan en caché
7 días. Si no hay foto, se usa un placeholder de color con el nombre.

## Cómo verlo en tu computadora

Necesita un servidor local (los módulos de JavaScript no funcionan abriendo el
archivo directo):

```bash
python -m http.server 8000
# luego abre http://localhost:8000
```

## Archivos

- `index.html` — estructura de la página
- `styles.css` — estilos (mobile-first)
- `data.js` — categorías, grupos y el cálculo de los días a partir de las fechas
- `semilla.js` — la lista original de lugares de Dallas (referencia y modo local)
- `app.js` — la lógica de la interfaz
- `auth.js` — inicio de sesión con Google y arranque de Firebase
- `nube.js` — lectura y escritura en Firestore (tiempo real)
- `firebase-config.js` — configuración del proyecto de Firebase
- `firestore.rules` — reglas de seguridad
