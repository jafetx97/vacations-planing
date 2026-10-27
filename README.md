# 🧳 Vacaciones en Dallas

Página web para mostrarles a mis papás la lista de lugares y actividades, con fotos
y mapas, para que ellos elijan qué hacer cada día. Sin base de datos y sin login:
todo se guarda en el propio navegador (localStorage).

## ¿Cómo se usa?

- **Actividades**: tarjetas con foto por categoría. Toca ❤️ para marcar favoritos
  y 📍 para ver el mapa. Mantén presionada una tarjeta y arrástrala a un día.
- **Los días**: el calendario del 7 al 22 con los eventos fijos ya puestos
  (Mavericks, Cowboys, Espadas, llegada y salida). Arrastra actividades a cada día,
  muévelas entre días o suéltalas en la papelera 🗑️ para quitarlas.
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

Todo (lugares, fotos, mapas, días) está en **`data.js`**. Para cambiar una foto,
reemplaza la URL del campo `foto`. Para cambiar el mapa, ajusta el texto del campo
`mapa` (es lo que se busca en Google Maps).

## Archivos

- `index.html` — estructura de la página
- `styles.css` — estilos (mobile-first)
- `data.js` — **los datos** (edita aquí)
- `app.js` — la lógica (tabs, favoritos, drag & drop, guardado)

## Nota sobre el guardado

Las elecciones se guardan en el dispositivo donde se usan; no se sincronizan entre
teléfonos. Ideal para verlo juntos en un solo celular o tablet. Si algún día se
quiere que cada quien vote desde su propio teléfono, habría que añadir un backend.
