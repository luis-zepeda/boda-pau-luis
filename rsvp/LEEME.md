# Invitados y confirmaciones en Google Sheets

La hoja de Google Sheets es el "backend" del sitio:

- **Invitados:** ustedes escriben quién está invitado y cuántos pases tiene.
- **Respuestas:** se llena sola cada vez que alguien confirma.

El sitio consulta la hoja con el código del link (`?i=...`). Así sabe el nombre del invitado, sus pases y si ya respondió. Cambiar pases o agregar invitados **no requiere tocar el código ni volver a publicar el sitio**.

## Pestañas

**Invitados**: una fila por invitación.

| Columna | Quién la llena | Qué es |
|---|---|---|
| Nombre | Ustedes | Cómo aparece en el sobre y el saludo ("Familia López", "Manuel e Ivana") |
| Pases | Ustedes | Total de lugares de esa invitación, incluida la persona nombrada |
| Código | Menú 💍 Boda | Por ejemplo `familia-lopez-k7q2`. **No lo cambies después de enviar el link.** |
| Link | Menú 💍 Boda | El link personal para mandar |
| Enviar | Menú 💍 Boda | Botón que abre WhatsApp con el mensaje y el link listos |
| Asistencia … Actualizado | El sitio | La **última** respuesta del invitado |

**Respuestas**: historial con una fila por cada envío. Si alguien cambia de opinión, aquí se ven todas sus respuestas.

Mantén **Invitados** y **Respuestas** con esos nombres exactos. Puedes agregar más pestañas (por ejemplo "Resumen").

## Instalación / actualización del script

1. En la hoja: **Extensiones → Apps Script**. Reemplaza todo el código por el de `apps-script.gs` y guarda.
2. Recarga la hoja. Aparece el menú **💍 Boda**.
3. **💍 Boda → Preparar hoja** (solo la primera vez). Crea las pestañas y renombra la de respuestas anterior. Google pedirá permisos: acepta.
4. Publica los cambios del script **sin cambiar la URL**:
   **Implementar → Administrar implementaciones →** lápiz ✏️ **→ Versión: Nueva versión → Implementar**.
   No uses "Nueva implementación", porque crea otra URL y habría que cambiarla en `js/main.js`.

## Día a día

1. Escribe Nombre y Pases en **Invitados**.
2. **💍 Boda → Generar códigos y links**. Llena Código, Link y Enviar de los nuevos. Los códigos existentes no cambian.
3. Manda el link, o usa el botón **WhatsApp** de la columna Enviar.

Para **quitar** a un invitado, borra su fila; su link dejará de funcionar. Para **cambiar pases**, edita el número; el invitado lo verá la próxima vez que abra su link.

## Totales

En cualquier celda de otra pestaña:

- Asistentes confirmados: `=SUMA(Invitados!G2:G)`
- Invitaciones que dijeron que sí: `=CONTAR.SI(Invitados!F2:F; "Sí")`
- Invitaciones que no han respondido: `=CONTARA(Invitados!A2:A) - CONTARA(Invitados!F2:F)`
- Pases entregados: `=SUMA(Invitados!B2:B)`

Si Sheets marca error, cambia `;` por `,`, porque depende de la configuración regional.
