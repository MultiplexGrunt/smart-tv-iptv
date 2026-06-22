# TecnoTV Smart Player — Aplicación Web para Smart TV

Esta es una aplicación web de reproducción de listas IPTV en formato M3U, optimizada específicamente para pantallas grandes y control remoto (Smart TV).

## 🚀 Características
- **Interfaz de 10 Pies (10-foot UI):** Diseñada para ser legible desde el sillón a unos 3 metros de distancia.
- **Navegación por D-Pad:** Soporte total de teclado simulando un control remoto (Flechas + Enter + Backspace).
- **Resolución de Carpeta Dinámica:** Lee el folder administrativo desde `admincode.php` al iniciar para cargar las listas actualizadas.
- **Buscador Integrado:** Permite filtrar canales de forma rápida.
- **Reproductor HTML5 con HLS.js:** Reproduce transmisiones `.m3u8` en vivo directamente en navegadores web compatibles.

## 🎮 Controles de Navegación (D-Pad)
Usa los siguientes botones de tu teclado o control remoto:
- **`Flechas de Dirección (▲ ▼ ◀ ▶)`:** Mueve el foco activo entre los apartados, canales y controles del reproductor.
- **`ENTER`:** Activa/Selecciona el elemento enfocado (cargar una categoría, reproducir un canal, activar pantalla completa).
- **`BACKSPACE` (Retroceso) / `ESC`:** Regresa el foco directamente a la barra lateral de categorías. En pantalla completa, sale al modo normal.

## 🛠️ Cómo Iniciar la Aplicación
1. Puedes abrir directamente el archivo `index.html` en cualquier navegador web.
2. Si prefieres un servidor local de desarrollo:
   - Ejecuta `npx serve ./` en este directorio para levantar un servidor estático rápido.
3. **Recomendación:** Se sugiere establecer esta carpeta (`smart-tv-iptv`) como tu espacio de trabajo activo en tu entorno de desarrollo.

## 📂 Estructura de Archivos
- `index.html`: Estructura semántica del reproductor y la cuadrícula de canales.
- `style.css`: Estilos visuales esmerilados (glassmorphism), temas oscuros de contraste y brillo de enfoque de neón.
- `app.js`: Lógica de navegación espacial por proximidad, parser de listas M3U y control de video.
