/**
 * "Backend" de la invitación: la hoja de Google Sheets es la lista de invitados
 * y guarda sus respuestas. Instrucciones en rsvp/LEEME.md.
 *
 *  - Pestaña "Invitados": ustedes escriben Nombre, Pases, Niños, Fin de semana
 *    y Cena-boda-civil; el menú 💍 Boda genera Código, Link y el botón de
 *    WhatsApp; el script llena la última respuesta de cada invitado.
 *  - Pestaña "Respuestas": historial, una fila por cada envío.
 *
 * Las columnas se buscan por su encabezado, así que el orden no importa.
 */

// URL pública del sitio (GitHub Pages). Si cambia, corre otra vez "Generar códigos y links".
const SITE_URL = "https://luis-zepeda.github.io/boda-pau-luis/";

const HOJA_INVITADOS = "Invitados";
const HOJA_RESPUESTAS = "Respuestas";

// [clave, encabezado que se crea si falta]
const CAMPOS_INVITADOS = [
  ["nombre", "Nombre"], ["pases", "Pases"], ["ninos", "Niños"],
  ["finde", "Fin de semana"], ["civil", "Cena-boda-civil"],
  ["codigo", "Código"], ["link", "Link"], ["enviar", "Enviar"],
  ["asistencia", "Asistencia"], ["confirmados", "Confirmados"], ["ninosConfirmados", "Niños confirmados"],
  ["nombres", "Nombres"], ["alergias", "Alergias"], ["mensaje", "Mensaje"], ["actualizado", "Actualizado"],
];
const CAMPOS_RESPUESTAS = [
  ["fecha", "Fecha"], ["codigo", "Código"], ["invitado", "Invitado"], ["pases", "Pases"],
  ["asistencia", "Asistencia"], ["confirmados", "Confirmados"], ["nombres", "Nombres"],
  ["alergias", "Alergias"], ["mensaje", "Mensaje"], ["ninos", "Niños"], ["lista", "Lista"],
];
// Cualquier encabezado que mencione "civil" cuenta como la columna del civil.
const COINCIDE = { civil: (h) => h.includes("civil") };

const MENSAJE_WHATSAPP = "Con mucho cariño te compartimos nuestra invitación de boda 💍";

/* ---------- Menú ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("💍 Boda")
    .addItem("Preparar hoja", "prepararHoja")
    .addItem("Generar códigos y links", "generarCodigos")
    .addToUi();
}

// Crea las pestañas y agrega las columnas que falten, sin mover las existentes.
// Si ya existe la pestaña de respuestas de antes (encabezado "Fecha"), la renombra.
function prepararHoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let respuestas = ss.getSheetByName(HOJA_RESPUESTAS);
  if (!respuestas) {
    const anterior = ss.getSheets().find((s) =>
      s.getName() !== HOJA_INVITADOS && String(s.getRange(1, 1).getValue()) === "Fecha");
    respuestas = anterior ? anterior.setName(HOJA_RESPUESTAS) : ss.insertSheet(HOJA_RESPUESTAS);
  }
  asegurarColumnas(respuestas, CAMPOS_RESPUESTAS);

  const invitados = ss.getSheetByName(HOJA_INVITADOS) || ss.insertSheet(HOJA_INVITADOS, 0);
  asegurarColumnas(invitados, CAMPOS_INVITADOS);
  ss.setActiveSheet(invitados);

  ss.toast("Llena Nombre, Pases, Niños, Fin de semana y Cena-boda-civil; luego 💍 Boda → Generar códigos y links.", "Hoja lista", 8);
}

// Crea un código para cada invitado con pases (nunca cambia uno existente)
// y rehace los links y botones de WhatsApp. Sin pases = sin link.
function generarCodigos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_INVITADOS);
  if (!hoja) {
    ss.toast("Primero usa 💍 Boda → Preparar hoja.", "Falta la pestaña Invitados", 8);
    return;
  }
  const col = asegurarColumnas(hoja, CAMPOS_INVITADOS);
  const n = hoja.getLastRow() - 1;
  if (n < 1) {
    ss.toast("Escribe al menos un invitado (Nombre y Pases).", "Sin invitados", 8);
    return;
  }

  const filas = leerFilas(hoja, n);
  const usados = new Set(filas.map((f) => normalizarCodigo(f[col.codigo])).filter(Boolean));
  const codigos = [], links = [], botones = [];
  let nuevos = 0, sinPases = 0;

  filas.forEach((f, i) => {
    const nombre = String(f[col.nombre]).trim();
    let codigo = normalizarCodigo(f[col.codigo]);
    if (!nombre || pasesDe(f, col) < 1) {
      if (nombre) sinPases++;
      codigos.push([codigo]);
      links.push([""]);
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
    const celdaNombre = letra(col.nombre) + fila;
    const celdaLink = letra(col.link) + fila;
    codigos.push([codigo]);
    links.push([`${SITE_URL}?i=${codigo}`]);
    botones.push([
      `=HYPERLINK("https://wa.me/?text="&ENCODEURL("¡Hola "&${celdaNombre}&"! ${MENSAJE_WHATSAPP}"&CHAR(10)&${celdaLink}),"WhatsApp")`,
    ]);
  });

  hoja.getRange(2, col.codigo + 1, n, 1).setValues(codigos);
  hoja.getRange(2, col.link + 1, n, 1).setValues(links);
  hoja.getRange(2, col.enviar + 1, n, 1).setFormulas(botones);
  ss.toast(`${nuevos} códigos nuevos. ${sinPases} invitaciones sin pases quedaron sin link.`, "Listo", 8);
}

/* ---------- API para el sitio ---------- */

// GET ?codigo=familia-lopez-k7q2
//   → { ok, invitado: { nombre, pases, ninos, lista } | null, respuesta: {...} | null }
// lista: "civil" (fin de semana + civil), "finde" (fin de semana) o "sabado".
function doGet(e) {
  const codigo = normalizarCodigo(e.parameter.codigo);
  const vacio = { ok: true, invitado: null, respuesta: null };
  if (!codigo) return json(vacio);

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_INVITADOS);
  const encontrado = hoja && buscarInvitado(hoja, codigo);
  if (!encontrado) return json(vacio);

  const { valores: f, col } = encontrado;
  return json({
    ok: true,
    invitado: {
      nombre: String(f[col.nombre]).trim(),
      pases: pasesDe(f, col),
      ninos: ninosDe(f, col),
      lista: listaDe(f, col),
    },
    respuesta: f[col.asistencia]
      ? {
          asistencia: f[col.asistencia],
          confirmados: Number(f[col.confirmados]) || 0,
          ninos: Number(f[col.ninosConfirmados]) || 0,
          nombres: f[col.nombres],
          alergias: f[col.alergias],
          mensaje: f[col.mensaje],
          fecha: f[col.actualizado],
        }
      : null,
  });
}

// POST con la confirmación. Nombre, pases, niños y lista salen de la hoja, no del navegador.
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const invitados = ss.getSheetByName(HOJA_INVITADOS);
    const codigo = normalizarCodigo(e.parameter.codigo);
    const encontrado = invitados && codigo && buscarInvitado(invitados, codigo);
    if (!encontrado) return json({ ok: false, error: "codigo" });

    const { fila, valores: f, col } = encontrado;
    const p = e.parameter;
    const pases = pasesDe(f, col);
    const maxNinos = ninosDe(f, col);
    const asiste = p.asistencia === "Sí";
    const confirmados = asiste ? Math.min(Math.max(Number(p.confirmados) || 1, 1), pases) : 0;
    const ninos = asiste ? Math.min(Math.max(Number(p.ninos) || 0, 0), maxNinos) : 0;
    const nombres = asiste ? texto(p.nombres) : "";
    const alergias = texto(p.alergias);
    const mensaje = texto(p.mensaje);
    const ahora = new Date();

    let respuestas = ss.getSheetByName(HOJA_RESPUESTAS);
    if (!respuestas) respuestas = ss.insertSheet(HOJA_RESPUESTAS);
    const colR = asegurarColumnas(respuestas, CAMPOS_RESPUESTAS);
    const nueva = new Array(respuestas.getLastColumn()).fill("");
    Object.entries({
      fecha: ahora, codigo, invitado: String(f[col.nombre]).trim(), pases,
      asistencia: asiste ? "Sí" : "No", confirmados, nombres, alergias, mensaje,
      ninos, lista: listaDe(f, col),
    }).forEach(([clave, valor]) => { nueva[colR[clave]] = valor; });
    respuestas.appendRow(nueva);

    Object.entries({
      asistencia: asiste ? "Sí" : "No", confirmados, ninosConfirmados: ninos,
      nombres, alergias, mensaje, actualizado: ahora,
    }).forEach(([clave, valor]) => {
      invitados.getRange(fila, col[clave] + 1).setValue(valor);
    });

    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Columnas por encabezado ---------- */

// Devuelve { clave: índice desde 0 } y agrega al final las columnas que falten.
function asegurarColumnas(hoja, campos) {
  const ancho = hoja.getLastColumn();
  const encabezados = ancho ? hoja.getRange(1, 1, 1, ancho).getValues()[0].map(normalizarEncabezado) : [];
  const col = {};
  let siguiente = encabezados.length;
  campos.forEach(([clave, titulo]) => {
    const coincide = COINCIDE[clave] || ((h) => h === normalizarEncabezado(titulo));
    let i = encabezados.findIndex(coincide);
    if (i === -1) {
      i = siguiente++;
      hoja.getRange(1, i + 1).setValue(titulo).setFontWeight("bold");
    }
    col[clave] = i;
  });
  hoja.setFrozenRows(1);
  return col;
}

function leerFilas(hoja, n) {
  return hoja.getRange(2, 1, n, hoja.getLastColumn()).getValues();
}

function buscarInvitado(hoja, codigo) {
  const col = asegurarColumnas(hoja, CAMPOS_INVITADOS);
  const n = hoja.getLastRow() - 1;
  if (n < 1) return null;
  const filas = leerFilas(hoja, n);
  const i = filas.findIndex((f) => normalizarCodigo(f[col.codigo]) === codigo);
  // Sin pases = invitación aún no decidida: el link no funciona.
  if (i === -1 || pasesDe(filas[i], col) < 1) return null;
  return { fila: i + 2, valores: filas[i], col };
}

/* ---------- Utilidades ---------- */

function pasesDe(fila, col) {
  return Math.max(0, Math.floor(Number(fila[col.pases]) || 0));
}

function ninosDe(fila, col) {
  return Math.max(0, Math.floor(Number(fila[col.ninos]) || 0));
}

function listaDe(fila, col) {
  if (esSi(fila[col.civil])) return "civil";
  if (esSi(fila[col.finde])) return "finde";
  return "sabado";
}

function esSi(valor) {
  return valor === true || ["si", "x", "true", "1", "yes"].includes(normalizarEncabezado(valor));
}

function normalizarEncabezado(valor) {
  return String(valor || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

// Índice de columna (desde 0) → letra de Sheets: 0 → A, 26 → AA.
function letra(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
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
