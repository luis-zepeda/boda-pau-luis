# Invitados y confirmaciones en Google Sheets

La hoja de Google Sheets es el "backend" del sitio:

- **Invitados:** ustedes escriben quién está invitado, cuántos pases tiene y a qué lista pertenece.
- **Respuestas:** se llena sola cada vez que alguien confirma.

El sitio consulta la hoja con el código del link (`?i=...`). Así sabe el nombre del invitado, sus pases, sus niños, su lista y si ya respondió. Cambiar pases o listas **no requiere tocar el código ni volver a publicar el sitio**.

## Las tres invitaciones

Cada invitado ve una versión distinta según dos columnas:

| Fin de semana | Cena-boda-civil | Versión | Qué ve |
|---|---|---|---|
| si | si | **civil** | Viernes (civil 7 PM, cena 8 PM, pre-fiesta 10 PM), sábado completo, domingo |
| si | no | **finde** | Viernes (pre-fiesta 10 PM), sábado completo, domingo |
| no | no | **sabado** | Sábado: misa 5 PM, cóctel 6 PM, Salón Campanas 7 PM |

Lo que cambia según la versión:
- **Fin de semana (civil y finde):**
  - el aviso de hospedaje en la hacienda (la hacienda los contacta);
  - el código de vestimenta del viernes;
  - la cuenta regresiva hasta su primer evento;
  - el calendario con sus días.
- **Solo sábado:** hoteles cercanos.

Quien abre el sitio sin link ve la versión de solo sábado.

## Columnas de Invitados

Las columnas se buscan por su **encabezado**, así que el orden no importa.

| Columna | Quién la llena | Qué es |
|---|---|---|
| nombre | Ustedes | Cómo aparece en el sobre y el saludo |
| pases | Ustedes | Lugares para adultos. **0 = aún no decidido**: no se genera link y su link no funciona |
| niños | Ustedes | Lugares extra para niños (vacío = 0) |
| Fin de semana | Ustedes | `si` / `no` |
| Cena-boda-civil | Ustedes | `si` / `no` (cualquier encabezado que diga "civil" sirve) |
| codigo | Menú 💍 Boda | Por ejemplo `familia-lopez-k7q2`. **No lo cambies después de enviar el link.** |
| Link, Enviar | Menú 💍 Boda | El link personal y el botón de WhatsApp |
| Asistencia … Actualizado | El sitio | La **última** respuesta: asistencia, adultos (Confirmados), Niños confirmados, nombres, alergias, mensaje |

**Respuestas**: historial con una fila por cada envío, incluida la lista.

## Primera vez: cargar la lista

1. **Script:** en la hoja, ve a **Extensiones → Apps Script**. Reemplaza todo el código por el de `apps-script.gs` y guarda.
2. **Publicar sin cambiar la URL:** **Implementar → Administrar implementaciones →** lápiz ✏️ **→ Versión: Nueva versión → Implementar** (la implementación que termina en `…MkSa-0w`). No uses "Nueva implementación", porque crea otra URL.
3. **Importar el CSV:** recarga la hoja, abre la pestaña **Invitados** (créala si no existe) y ve a **Archivo → Importar → Subir** `boda-invitados.csv` **→ Reemplazar hoja actual**.
4. **Vaciar la columna codigo** (deja el encabezado). Los códigos se generan de nuevo con parte aleatoria.
5. **💍 Boda → Preparar hoja.** Agrega las columnas que falten y renombra la pestaña de respuestas anterior. Acepta los permisos.
6. **💍 Boda → Generar códigos y links.**

## Día a día

- **Agregar invitados o darle pases a alguien que tenía 0:** escribe los datos y vuelve a usar **Generar códigos y links**. Los códigos existentes no cambian.
- **Cambiar de lista o de pases:** edita la celda; el invitado lo verá la próxima vez que abra su link.
- **Quitar a alguien:** pon sus pases en 0 o borra su fila.
- **Para la hacienda:** filtra la columna **Fin de semana = si** (Datos → Crear un filtro) y comparte o copia esas filas.

## Totales

En otra pestaña (por ejemplo "Resumen"):

- Adultos confirmados: `=SUMA(Invitados!J2:J)`. Usa la letra de la columna **Confirmados** en tu hoja.
- Niños confirmados: `=SUMA(Invitados!K2:K)`, con la columna **Niños confirmados**.
- Por lista, por ejemplo adultos de la cena del civil: `=SUMAR.SI.CONJUNTO(Invitados!J2:J; Invitados!F2:F; "si")`, con la columna **Cena-boda-civil** como criterio.
- Invitaciones que no han respondido: `=CONTAR.SI.CONJUNTO(Invitados!B2:B; ">0"; Invitados!I2:I; "")`, con **pases** y **Asistencia**.

Si Sheets marca error, cambia `;` por `,`, porque depende de la configuración regional.
