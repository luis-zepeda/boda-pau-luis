(() => {
  "use strict";

  // URL del Web App de Google Apps Script: lista de invitados y respuestas (ver rsvp/LEEME.md).
  const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbz1Vbj63L5YJVnusPsPff4QiOYhh4b41prBmXnaDd1-H_Fx968mabYbv9UvCy1MkSa-0w/exec";

  // Primer evento de cada lista, hora del centro de México (UTC-6, sin horario de verano).
  //   civil: fin de semana + boda civil · finde: fin de semana · sabado: solo sábado
  const START_BY_LISTA = {
    civil: new Date("2027-03-19T19:00:00-06:00"),
    finde: new Date("2027-03-19T22:00:00-06:00"),
    sabado: new Date("2027-03-20T17:00:00-06:00"),
  };
  let lista = "sabado"; // versión pública hasta saber quién es el invitado

  /* ---------- Invitado a partir del link (?i=codigo) ---------- */
  // La lista vive en Google Sheets (pestaña Invitados); aquí se consulta por código.
  const code = (new URLSearchParams(location.search).get("i") || "").trim().toLowerCase();
  const cacheKey = `invitado:${code}`;
  let guestLoadFailed = false; // no se pudo consultar la hoja (red, Google caído)

  function readCache() {
    try { return JSON.parse(localStorage.getItem(cacheKey)); } catch { return null; }
  }
  function writeCache(guest) {
    try { localStorage.setItem(cacheKey, JSON.stringify(guest)); } catch {}
  }

  // → { nombre, pases, ninos, lista, respuesta } o null si el código no está en la lista.
  async function loadGuest() {
    if (!code) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${RSVP_ENDPOINT}?codigo=${encodeURIComponent(code)}`, { signal: controller.signal });
      const data = await res.json();
      if (!data.ok) throw new Error("respuesta inválida");
      const guest = data.invitado && { ...data.invitado, respuesta: data.respuesta };
      if (guest) writeCache(guest);
      return guest || null;
    } catch {
      guestLoadFailed = true;
      return readCache(); // sin conexión con la hoja: lo último que vio este celular
    } finally {
      clearTimeout(timeout);
    }
  }

  // js/sobre.js también espera esta promesa para escribir el nombre en el sobre.
  window.invitadoListo = loadGuest();

  window.invitadoListo.then((guest) => {
    applyLista(guest?.lista);
    if (!guest) return;
    const greeting = document.getElementById("guest-greeting");
    greeting.textContent = guest.nombre;
    greeting.hidden = false;
  });

  /* ---------- Versión de la invitación según la lista ---------- */
  // Los bloques con data-listas="civil finde" solo se ven en esas listas.
  function applyLista(nueva) {
    lista = START_BY_LISTA[nueva] ? nueva : "sabado";
    document.documentElement.dataset.lista = lista;
    document.querySelectorAll("[data-listas]").forEach((el) => {
      el.hidden = !el.dataset.listas.split(" ").includes(lista);
    });
    // Fin de semana: las tarjetas con foto de la boda van dentro de la pestaña del sábado.
    if (lista !== "sabado") document.getElementById("dia-sab").append(document.querySelector(".timeline"));
    tick(); // la cuenta regresiva cambia de evento según la lista
  }

  /* ---------- Pestañas del itinerario (fin de semana) ---------- */
  const tabs = [...document.querySelectorAll('.days__tabs [role="tab"]')];

  function selectTab(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  /* ---------- Música ---------- */
  // El navegador solo deja sonar audio después de un toque del invitado,
  // por eso arranca al abrir el sobre o con el botón flotante.
  const music = document.getElementById("musica");
  const musicBtn = document.getElementById("music-toggle");
  const MUSIC_VOLUME = 0.6;
  let fadeFrame = null;

  function fadeVolume(target, ms, done) {
    cancelAnimationFrame(fadeFrame);
    const from = music.volume;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      music.volume = from + (target - from) * k; // en iPhone el volumen es fijo; solo aplica en otros
      if (k < 1) fadeFrame = requestAnimationFrame(step);
      else done?.();
    };
    fadeFrame = requestAnimationFrame(step);
  }

  function setMusicState(playing) {
    musicBtn.classList.toggle("is-playing", playing);
    musicBtn.setAttribute("aria-pressed", String(playing));
    musicBtn.setAttribute("aria-label", playing ? "Pausar música" : "Reproducir música");
  }

  window.iniciarMusica = () => {
    if (!music.paused) {
      // Estaba bajando el volumen para pausar: volver a subirlo.
      setMusicState(true);
      fadeVolume(MUSIC_VOLUME, 800);
      return;
    }
    music.volume = 0;
    music.play().then(() => {
      setMusicState(true);
      fadeVolume(MUSIC_VOLUME, 3000);
    }).catch(() => setMusicState(false));
  };

  function pauseMusic() {
    fadeVolume(0, 400, () => music.pause());
    setMusicState(false);
  }

  musicBtn.addEventListener("click", () =>
    musicBtn.classList.contains("is-playing") ? pauseMusic() : window.iniciarMusica());

  // Pausar si el invitado cambia de app o de pestaña, y reanudar al volver.
  let resumeOnReturn = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resumeOnReturn = !music.paused;
      music.pause();
    } else if (resumeOnReturn) {
      music.play().catch(() => setMusicState(false));
    }
  });

  /* ---------- Sobre de apertura ---------- */
  // La animación 3D vive en js/sobre.js; aquí están el cierre y el respaldo sin 3D.
  const root = document.documentElement;
  const sobre = document.getElementById("sobre");

  if (!root.classList.contains("sobre-activo")) {
    sobre.remove();
  } else {
    let closing = false;
    window.cerrarSobre = () => {
      if (closing) return;
      closing = true;
      try { sessionStorage.setItem("sobreAbierto", "1"); } catch {}
      root.classList.add("sobre-saliendo");
      setTimeout(() => {
        root.classList.remove("sobre-activo", "sobre-saliendo");
        sobre.remove();
        window.__sobreCleanup?.();
      }, 800);
    };
    window.mostrarRespaldoSobre = () => {
      if (window.__sobreListo) return;
      window.__sobreRespaldo = true;
      document.getElementById("sobre-open").hidden = false;
    };

    for (const id of ["sobre-open", "sobre-skip"]) {
      document.getElementById(id).addEventListener("click", (e) => {
        e.stopPropagation();
        window.iniciarMusica();
        window.cerrarSobre();
      });
    }
    // Si el 3D no arranca a tiempo (red lenta, sin WebGL), abrir sin él.
    setTimeout(window.mostrarRespaldoSobre, 6000);
  }

  /* ---------- Cuenta regresiva ---------- */
  const countdown = document.getElementById("countdown");
  const units = {
    days: countdown.querySelector('[data-unit="days"]'),
    hours: countdown.querySelector('[data-unit="hours"]'),
    minutes: countdown.querySelector('[data-unit="minutes"]'),
    seconds: countdown.querySelector('[data-unit="seconds"]'),
  };
  const pad = (n) => String(n).padStart(2, "0");

  function tick() {
    const diff = Math.max(0, START_BY_LISTA[lista] - Date.now());
    const s = Math.floor(diff / 1000);
    units.days.textContent = Math.floor(s / 86400);
    units.hours.textContent = pad(Math.floor((s % 86400) / 3600));
    units.minutes.textContent = pad(Math.floor((s % 3600) / 60));
    units.seconds.textContent = pad(s % 60);
  }
  setInterval(tick, 1000);
  tick();

  /* ---------- Animación al hacer scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Lightbox de la galería ---------- */
  // Cada grupo (data-lightbox) se navega por separado: galería, vestimenta.
  const lightbox = document.getElementById("lightbox");
  const lbImg = lightbox.querySelector("img");
  let items = [];
  let current = 0;

  function show(i) {
    current = (i + items.length) % items.length;
    lbImg.src = items[current].href;
    lbImg.alt = items[current].querySelector("img").alt;
  }
  function open(link) {
    items = [...document.querySelectorAll(`[data-lightbox="${link.dataset.lightbox}"]`)];
    lightbox.classList.toggle("is-single", items.length < 2);
    show(items.indexOf(link));
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function close() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-lightbox]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); open(a); }));
  lightbox.querySelector(".lightbox__close").addEventListener("click", close);
  lightbox.querySelector(".lightbox__prev").addEventListener("click", () => show(current - 1));
  lightbox.querySelector(".lightbox__next").addEventListener("click", () => show(current + 1));
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  let touchX = null;
  lightbox.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  /* ---------- Copiar CLABE ---------- */
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = document.querySelector(btn.dataset.copy).textContent.trim();
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "¡Copiada!";
      } catch {
        btn.textContent = text;
      }
      setTimeout(() => { btn.textContent = label; }, 2000);
    });
  });

  /* ---------- RSVP ---------- */
  const form = document.getElementById("rsvp-form");
  const status = document.getElementById("rsvp-status");
  const rsvpLoading = document.getElementById("rsvp-loading");

  if (code) {
    document.getElementById("rsvp-nocode").hidden = true;
    rsvpLoading.hidden = false;
  }

  window.invitadoListo.then((guest) => {
    rsvpLoading.hidden = true;
    if (guest) return setupRsvp(guest);
    if (!code) return;
    const notFound = document.getElementById("rsvp-notfound");
    if (guestLoadFailed) {
      notFound.querySelector("p").textContent =
        "No pudimos cargar tu invitación. Revisa tu conexión y vuelve a abrir el link.";
    }
    notFound.hidden = false;
  });

  function setupRsvp(guest) {
    const passes = guest.pases;
    const kids = guest.ninos || 0; // lugares para niños, aparte de los pases
    const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

    document.getElementById("rsvp-passes").innerHTML = kids
      ? `Hemos reservado <strong>${plural(passes, "lugar", "lugares")} para adultos</strong> y <strong>${kids} para niños</strong> en su honor`
      : passes === 1
        ? "Hemos reservado <strong>1 lugar</strong> en tu honor"
        : `Hemos reservado <strong>${passes} lugares</strong> en su honor`;

    const select = document.getElementById("confirmados");
    for (let n = passes; n >= 1; n--) {
      select.add(new Option(kids ? plural(n, "adulto", "adultos") : plural(n, "persona", "personas"), n));
    }
    if (kids) document.getElementById("confirmados-label").textContent = "¿Cuántos adultos asistirán?";

    const selectKids = document.getElementById("ninos");
    for (let n = kids; n >= 0; n--) {
      selectKids.add(new Option(n === 0 ? "Ninguno" : plural(n, "niño", "niños"), n));
    }

    const done = document.getElementById("rsvp-done");
    const button = form.querySelector('button[type="submit"]');
    const fieldConfirmados = document.getElementById("field-confirmados");
    const fieldNinos = document.getElementById("field-ninos");
    const fieldNombres = document.getElementById("field-nombres");
    let last = guest.respuesta; // última respuesta conocida

    function syncFields() {
      const attending = form.elements.asistencia.value !== "no";
      fieldConfirmados.hidden = !attending || passes === 1;
      fieldNinos.hidden = !attending || kids === 0;
      fieldNombres.hidden = !attending;
    }
    syncFields();
    form.addEventListener("change", (e) => { if (e.target.name === "asistencia") syncFields(); });

    function showForm() {
      done.hidden = true;
      form.hidden = false;
      form.querySelectorAll("input, select, textarea").forEach((el) => { el.disabled = false; });
      button.hidden = false;
      button.disabled = false;
      status.className = "rsvp__status";
      status.textContent = "";
    }

    function showDone(r) {
      last = r;
      const attending = r.asistencia === "Sí";
      const n = Number(r.confirmados) || 0;
      const k = Number(r.ninos) || 0;
      document.getElementById("rsvp-done-title").textContent =
        attending ? "¡Gracias por confirmar!" : "Gracias por avisarnos";
      const detail = document.getElementById("rsvp-done-detail");
      detail.textContent = "";
      if (attending) {
        detail.append("Asistirán ");
        detail.appendChild(document.createElement("strong")).textContent = k
          ? `${plural(n, "adulto", "adultos")} y ${plural(k, "niño", "niños")}`
          : plural(n, "persona", "personas");
        if (r.nombres) detail.append(`: ${r.nombres}`);
      } else {
        detail.append("Nos dijiste que no podrás acompañarnos. ¡Te vamos a extrañar!");
      }
      form.hidden = true;
      done.hidden = false;
    }

    // "Cambiar mi respuesta": el formulario vuelve con lo último que contestaron.
    document.getElementById("rsvp-edit").addEventListener("click", () => {
      if (last) {
        const attending = last.asistencia === "Sí";
        form.elements.asistencia.value = attending ? "si" : "no";
        select.value = String(Math.min(Math.max(Number(last.confirmados) || 1, 1), passes));
        selectKids.value = String(Math.min(Number(last.ninos) || 0, kids));
        form.elements.nombres.value = last.nombres || "";
        form.elements.alergias.value = last.alergias || "";
        form.elements.mensaje.value = last.mensaje || "";
      }
      syncFields();
      showForm();
    });

    if (last) showDone(last);
    else showForm();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const attending = data.get("asistencia") === "si";

      const answer = {
        asistencia: attending ? "Sí" : "No",
        confirmados: attending ? Math.min(Number(data.get("confirmados") || 1), passes) : 0,
        ninos: attending ? Math.min(Number(data.get("ninos") || 0), kids) : 0,
        nombres: attending ? (data.get("nombres") || "") : "",
        alergias: data.get("alergias") || "",
        mensaje: data.get("mensaje") || "",
      };

      button.disabled = true;
      status.className = "rsvp__status";
      status.textContent = "Enviando…";

      try {
        // "no-cors": Google guarda los datos aunque el navegador no lea la respuesta.
        // Nombre, pases y niños los toma el script de la hoja, no de aquí.
        await fetch(RSVP_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          body: new URLSearchParams({ codigo: code, ...answer }),
        });
        writeCache({ ...guest, respuesta: answer });
        showDone(answer);
      } catch {
        status.classList.add("is-error");
        status.textContent = "No pudimos enviar tu confirmación. Intenta de nuevo o escríbenos.";
        button.disabled = false;
      }
    });
  }

  /* ---------- Agregar a calendario (.ics) ---------- */
  // [inicio, fin, título, detalle] en UTC (centro de México = UTC-6). Las horas de fin son aproximadas.
  const VIE_CIVIL = ["20270320T010000Z", "20270320T070000Z", "Boda civil, cena y pre-fiesta · Pau & Luis",
    "Boda civil 7:00 PM · Cena 8:00 PM · Pre-fiesta 10:00 PM"];
  const VIE_PREFIESTA = ["20270320T040000Z", "20270320T060000Z", "Pre-fiesta · Pau & Luis", "Pre-fiesta 10:00 PM"];
  const SAB_COMPLETO = ["20270320T150000Z", "20270321T080000Z", "Boda de Pau & Luis",
    "Desayuno 9:00 AM · Tour 11:15 AM · Brunch 1:00 PM · Ceremonia religiosa 5:00 PM · Cóctel 6:00 PM · Salón Campanas 7:00 PM"];
  const SAB_BODA = ["20270320T230000Z", "20270321T080000Z", "Boda de Pau & Luis",
    "Ceremonia religiosa 5:00 PM · Cóctel 6:00 PM · Salón Campanas (fiesta y cena) 7:00 PM"];
  const DOM = ["20270321T170000Z", "20270321T190000Z", "Desayuno regional · Pau & Luis", "Desayuno regional 11:00 AM"];
  const CALENDARIO = {
    civil: [VIE_CIVIL, SAB_COMPLETO, DOM],
    finde: [VIE_PREFIESTA, SAB_COMPLETO, DOM],
    sabado: [SAB_BODA],
  };

  document.getElementById("add-calendar").addEventListener("click", () => {
    const eventos = CALENDARIO[lista].flatMap(([inicio, fin, titulo, detalle], i) => [
      "BEGIN:VEVENT",
      `UID:boda-pau-luis-${lista}-${i}@pauyluis`,
      "DTSTAMP:20260101T000000Z",
      `DTSTART:${inicio}`,
      `DTEND:${fin}`,
      `SUMMARY:${titulo}`,
      "LOCATION:Hacienda Chimalpa\\, C. Morelos s/n\\, 43920 Chimalpa Tlalayote\\, Hgo.\\, México",
      `DESCRIPTION:${detalle}`,
      // Recordatorio un día antes, solo en el primer evento.
      ...(i === 0 ? ["BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY",
        "DESCRIPTION:Mañana empieza la boda de Pau & Luis", "END:VALARM"] : []),
      "END:VEVENT",
    ]);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pau y Luis//Boda//ES",
      "CALSCALE:GREGORIAN",
      ...eventos,
      "END:VCALENDAR",
    ].join("\r\n");

    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "boda-pau-y-luis.ics" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
