/**
 * "Backend" de la invitación: la hoja de Google Sheets es la lista de invitados
 * y guarda sus respuestas. Instrucciones en rsvp/LEEME.md.
 *
 *  - Pestaña "Invitados": ustedes escriben Nombre y Pases; el menú 💍 Boda
 *    genera Código, Link y el botón de WhatsApp; el script llena la última
 *    respuesta de cada invitado (Asistencia … Actualizado).
 *  - Pestaña "Respuestas": historial, una fila por cada envío.
 */

// URL pública del sitio (GitHub Pages). Si cambia, corre otra vez "Generar códigos y links".
const SITE_URL = "https://luis-zepeda.github.io/boda-pau-luis/";

const HOJA_INVITADOS = "Invitados";
const HOJA_RESPUESTAS = "Respuestas";

const COLUMNAS_INVITADOS = [
  "Nombre", "Pases", "Código", "Link", "Enviar",
  "Asistencia", "Confirmados", "Nombres", "Alergias", "Mensaje", "Actualizado",
];
const COLUMNAS_RESPUESTAS = [
  "Fecha", "Código", "Invitado", "Pases", "Asistencia",
  "Confirmados", "Nombres", "Alergias", "Mensaje",
];
// Índices (desde 0) de las columnas de Invitados.
const C = {
  nombre: 0, pases: 1, codigo: 2, link: 3, enviar: 4,
  asistencia: 5, confirmados: 6, nombres: 7, alergias: 8, mensaje: 9, actualizado: 10,
};

const MENSAJE_WHATSAPP = "Con mucho cariño te compartimos nuestra invitación de boda 💍";

/* ---------- Menú ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("💍 Boda")
    .addItem("Preparar hoja", "prepararHoja")
    .addItem("Generar códigos y links", "generarCodigos")
    .addToUi();
}

// Crea las pestañas con sus encabezados. Si ya existe la pestaña de
// respuestas de antes (encabezado "Fecha"), la renombra a "Respuestas".
function prepararHoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let respuestas = ss.getSheetByName(HOJA_RESPUESTAS);
  if (!respuestas) {
    const anterior = ss.getSheets().find((s) =>
      s.getName() !== HOJA_INVITADOS && String(s.getRange(1, 1).getValue()) === "Fecha");
    respuestas = anterior ? anterior.setName(HOJA_RESPUESTAS) : ss.insertSheet(HOJA_RESPUESTAS);
  }
  ponerEncabezados(respuestas, COLUMNAS_RESPUESTAS);

  const invitados = ss.getSheetByName(HOJA_INVITADOS) || ss.insertSheet(HOJA_INVITADOS, 0);
  ponerEncabezados(invitados, COLUMNAS_INVITADOS);
  ss.setActiveSheet(invitados);

  ss.toast("Escribe Nombre y Pases en Invitados y luego usa 💍 Boda → Generar códigos y links.", "Hoja lista", 8);
}

// Crea un código para cada invitado nuevo (nunca cambia uno existente)
// y rehace los links y botones de WhatsApp de todas las filas.
function generarCodigos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_INVITADOS);
  if (!hoja) {
    ss.toast('Primero usa 💍 Boda → Preparar hoja.', "Falta la pestaña Invitados", 8);
    return;
  }
  const n = hoja.getLastRow() - 1;
  if (n < 1) {
    ss.toast("Escribe al menos un invitado (Nombre y Pases).", "Sin invitados", 8);
    return;
  }

  const filas = hoja.getRange(2, 1, n, COLUMNAS_INVITADOS.length).getValues();
  const usados = new Set(filas.map((f) => normalizarCodigo(f[C.codigo])).filter(Boolean));
  const codigosYLinks = [];
  const botones = [];
  let nuevos = 0;

  filas.forEach((f, i) => {
    const nombre = String(f[C.nombre]).trim();
    let codigo = normalizarCodigo(f[C.codigo]);
    if (!nombre) {
      codigosYLinks.push([f[C.codigo], f[C.link]]);
      botones.push([""]);
      return;
    }
    if (!codigo) {
      do {
        codigo = `${slug(nombre)}-${aleatorio(4)}`;
      } while (usados.has(codigo));
      usados.add(codigo);
      nuevos++;
    }
    const fila = i + 2;
    codigosYLinks.push([codigo, `${SITE_URL}?i=${codigo}`]);
    botones.push([
      `=HYPERLINK("https://wa.me/?text="&ENCODEURL("¡Hola "&A${fila}&"! ${MENSAJE_WHATSAPP}"&CHAR(10)&D${fila}),"WhatsApp")`,
    ]);
  });

  hoja.getRange(2, C.codigo + 1, n, 2).setValues(codigosYLinks);
  hoja.getRange(2, C.enviar + 1, n, 1).setFormulas(botones);
  ss.toast(`${nuevos} códigos nuevos. Links actualizados.`, "Listo", 6);
}

/* ---------- API para el sitio ---------- */

// GET ?codigo=familia-lopez-k7q2
//   → { ok, invitado: { nombre, pases } | null, respuesta: {...} | null }
function doGet(e) {
  const codigo = normalizarCodigo(e.parameter.codigo);
  const vacio = { ok: true, invitado: null, respuesta: null };
  if (!codigo) return json(vacio);

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_INVITADOS);
  const encontrado = hoja && buscarInvitado(hoja, codigo);
  if (!encontrado) return json(vacio);

  const f = encontrado.valores;
  return json({
    ok: true,
    invitado: { nombre: String(f[C.nombre]).trim(), pases: pasesDe(f) },
    respuesta: f[C.asistencia]
      ? {
          asistencia: f[C.asistencia],
          confirmados: Number(f[C.confirmados]) || 0,
          nombres: f[C.nombres],
          alergias: f[C.alergias],
          mensaje: f[C.mensaje],
          fecha: f[C.actualizado],
        }
      : null,
  });
}

// POST con la confirmación. Nombre y pases salen de la hoja, no del navegador.
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const invitados = ss.getSheetByName(HOJA_INVITADOS);
    const codigo = normalizarCodigo(e.parameter.codigo);
    const encontrado = invitados && codigo && buscarInvitado(invitados, codigo);
    if (!encontrado) return json({ ok: false, error: "codigo" });

    const f = encontrado.valores;
    const p = e.parameter;
    const nombre = String(f[C.nombre]).trim();
    const pases = pasesDe(f);
    const asiste = p.asistencia === "Sí";
    const confirmados = asiste ? Math.min(Math.max(Number(p.confirmados) || 1, 1), pases) : 0;
    const nombres = asiste ? texto(p.nombres) : "";
    const alergias = texto(p.alergias);
    const mensaje = texto(p.mensaje);
    const ahora = new Date();

    let respuestas = ss.getSheetByName(HOJA_RESPUESTAS);
    if (!respuestas) {
      respuestas = ss.insertSheet(HOJA_RESPUESTAS);
      ponerEncabezados(respuestas, COLUMNAS_RESPUESTAS);
    }
    respuestas.appendRow([
      ahora, codigo, nombre, pases, asiste ? "Sí" : "No",
      confirmados, nombres, alergias, mensaje,
    ]);

    invitados
      .getRange(encontrado.fila, C.asistencia + 1, 1, 6)
      .setValues([[asiste ? "Sí" : "No", confirmados, nombres, alergias, mensaje, ahora]]);

    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Utilidades ---------- */

function buscarInvitado(hoja, codigo) {
  const n = hoja.getLastRow() - 1;
  if (n < 1) return null;
  const filas = hoja.getRange(2, 1, n, COLUMNAS_INVITADOS.length).getValues();
  const i = filas.findIndex((f) => normalizarCodigo(f[C.codigo]) === codigo);
  return i === -1 ? null : { fila: i + 2, valores: filas[i] };
}

function ponerEncabezados(hoja, columnas) {
  if (String(hoja.getRange(1, 1).getValue()) === "") {
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight("bold");
  }
  hoja.setFrozenRows(1);
}

function pasesDe(fila) {
  return Math.max(1, Math.floor(Number(fila[C.pases]) || 1));
}

function normalizarCodigo(valor) {
  return String(valor || "").trim().toLowerCase();
}

function slug(texto) {
  const s = String(texto)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 30).replace(/-+$/, "");
  return s || "invitado";
}

// Sin 0/o, 1/l/i para que el código se pueda dictar sin confusiones.
function aleatorio(largo) {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < largo; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return s;
}

// Texto que escribe el invitado: sin fórmulas (evita que "=..." se ejecute en la hoja).
function texto(valor) {
  const s = String(valor || "").trim().slice(0, 500);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
