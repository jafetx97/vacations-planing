# 🧳 Vacaciones en Dallas

Página web para mostrarles a mis papás la lista de lugares y actividades, con fotos
y mapas, para que ellos elijan qué hacer cada día. Sin base de datos y sin login:
todo se guarda en el propio navegador (localStorage).

## ¿Cómo se usa?

- **Actividades**: tarjetas con foto por categoría. Toca ❤️ para marcar favoritos,
  📍 para ver el mapa y **➕ Agregar al día** para elegir en qué día hacerlo.
  Cada card muestra en qué días ya está agendada.
- **Los días**: el calendario del 7 al 22. Solo la llegada (sáb 7) y la salida
  (dom 22) vienen fijas. Las cards agendadas tienen **🔀 Mover / Quitar** para
  cambiarlas de día o sacarlas del plan.
- **Favoritos**: todo lo marcado con ❤️.
- **Reiniciar**: borra las elecciones y empieza de cero.

## Cómo verlo en tu computadora

Solo abre `index.html` en el navegador. (Para que los mapas embebidos carguen bien,
mejor servirlo con un servidor local, por ejemplo:)

```bash
# Con Python
python -m http.server 8000
# luego abre http://localhost:8000
```

## Cómo publicarlo gratis (GitHub Pages)

1. Sube estos archivos al repo.
2. En GitHub: **Settings → Pages → Branch: main / root → Save**.
3. En un par de minutos queda en `https://TU-USUARIO.github.io/vacations-planing/`.
4. Comparte ese enlace o ábrelo en un celular/tablet para enseñárselo a tus papás.

## Editar la lista

Todo (lugares, fotos, mapas, días) está en **`data.js`**.

**Fotos** — cada card elige su imagen en este orden:

1. `foto`: tu propia foto (URL o ruta local, ej. `"img/tia-lola.jpg"`). Siempre gana.
2. `wiki`: título del artículo en Wikipedia en inglés. La app descarga la foto
   principal automáticamente (gratis, sin API key) y la guarda en caché 7 días.
3. Si no hay ninguna, o la foto falla, se usa un placeholder de color con el nombre.

**Mapa** — ajusta el texto del campo `mapa` (es lo que se busca en Google Maps).

## Inicio de sesión (Firebase)

- `firebase-config.js`: pega aquí el `firebaseConfig` de tu proyecto. Mientras diga
  `PEGA_AQUI`, la app funciona en modo local, sin sesión.
- `firestore.rules`: reglas de seguridad. Cópialas en Firestore → Reglas → Publicar.
- **Quién puede editar:** colección `miembros` en Firestore. Cada documento tiene
  como ID el correo en minúsculas (ej. `mama@gmail.com`) y un campo `nombre`
  (ej. `"Mamá"`). Quien no esté ahí, o no inicie sesión, solo puede ver.
- Los correos no están en el código, porque el repo es público.

## Sincronización (Firestore)

La agenda y los votos viven en Firestore y se actualizan en tiempo real en todos los
dispositivos (`nube.js`):

```
viajes/dallas/agenda/{diaId}  → { lugares: [ids], actualizadoPor, actualizadoEn }
viajes/dallas/votos/{uid}     → { nombre, lugares: [ids], actualizadoEn }
```

- Cada miembro solo puede cambiar sus propios votos; la agenda la editan todos.
- Funciona sin señal: los cambios se suben solos al reconectar.
- Si un dispositivo tenía un plan guardado de antes, la app ofrece subirlo una vez.
- Los lugares todavía salen de `data.js`.

## Archivos

- `index.html` — estructura de la página
- `styles.css` — estilos (mobile-first)
- `data.js` — **los datos** (edita aquí)
- `app.js` — la lógica (tabs, favoritos, drag & drop, guardado)

## Nota sobre el guardado

Las elecciones se guardan en el dispositivo donde se usan; no se sincronizan entre
teléfonos. Ideal para verlo juntos en un solo celular o tablet. Si algún día se
quiere que cada quien vote desde su propio teléfono, habría que añadir un backend.
