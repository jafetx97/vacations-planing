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
- **Los días**: del 7 al 22. Solo la llegada (sáb 7) y la salida (dom 22) son fijas.
  **🔀 Mover / Quitar** cambia una actividad de día o la saca del plan.
- **❤️ Votos**: lo que la familia votó, del más votado al menos.
- **Sin sesión**: se ve todo en modo solo lectura.

## Permisos

| Acción                         | Sin sesión | Miembro | Admin |
|--------------------------------|:----------:|:-------:|:-----:|
| Ver lugares, agenda y votos    | ✔          | ✔       | ✔     |
| Votar (solo sus propios votos) |            | ✔       | ✔     |
| Agendar / mover / quitar       |            | ✔       | ✔     |
| Agregar y editar lugares       |            | ✔       | ✔     |
| Borrar lugares                 |            |         | ✔     |

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
viajes/dallas/lugares/{id}    → { nombre, categoria, mapa, mapsUrl, web, wiki,
                                  creadoPor, creadoEn, actualizadoPor, actualizadoEn }
viajes/dallas/agenda/{diaId}  → { lugares: [ids], actualizadoPor, actualizadoEn }
viajes/dallas/votos/{uid}     → { nombre, lugares: [ids], actualizadoEn }
```

- Todo se sincroniza en tiempo real y funciona sin señal (se sube al reconectar).
- La primera vez, el admin ve un botón para subir la lista original (`semilla.js`).
- Si un navegador tenía un plan guardado de antes de la nube, la app ofrece subirlo una vez.

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
- `data.js` — categorías, grupos y días del viaje
- `semilla.js` — la lista original de lugares (para subirla una vez)
- `app.js` — la lógica de la interfaz
- `auth.js` — inicio de sesión con Google y arranque de Firebase
- `nube.js` — lectura y escritura en Firestore (tiempo real)
- `firebase-config.js` — configuración del proyecto de Firebase
- `firestore.rules` — reglas de seguridad
