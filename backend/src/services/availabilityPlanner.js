/**
 * availabilityPlanner.js — armar opciones combinatorias de stay
 * cuando no hay disponibilidad full-stay del tipo pedido.
 *
 * E-AGENT-15 (2026-04-26).
 *
 * Problema que resuelve:
 *   Pepe quiere reservar del 1 al 10 abril, 2 parejas, en privada con baño.
 *   Pero LobbyPMS reporta:
 *     - 1-5 abril:  hay 1 privada baño privado (cabe 1 pareja)
 *     - 5-7 abril:  hay 1 dorm compartido (4 camas) + 1 privada baño compartido
 *     - 7-9 abril:  solo dorm compartido (6 camas)
 *     - 9-10 abril: 2 privadas baño privado disponibles
 *
 *   El huésped prefiere "privada baño privado" pero la stay completa no
 *   se puede dar así. El planner arma 2-3 opciones tipo:
 *
 *   Opción A (cambiando habitación):
 *     1-5  ▸ 2 personas en privada baño privado + 2 personas en dorm
 *     5-7  ▸ 4 personas en dorm compartido
 *     7-9  ▸ 4 personas en dorm compartido
 *     9-10 ▸ 4 personas en 2 privadas baño privado
 *     Total: $XXX
 *
 *   Opción B (todos en dorm para evitar mover entre habs):
 *     1-10 ▸ 4 personas en dorm compartido
 *     Total: $YYY (más barato)
 *
 *   Opción C (una pareja en privada, otra en dorm, todo el tiempo):
 *     1-10 ▸ 2 personas en privada (sin baño los días 5-9) + 2 en dorm
 *     Total: $ZZZ
 *
 * El planner devuelve un array de opciones; el agente las narra al huésped
 * y deja que elija.
 */

/**
 * @typedef {Object} RoomInventory
 * @property {string} type             - 'private_bath' | 'shared_bath' | 'dorm' | (string libre del PMS)
 * @property {string} label            - "Privada con baño privado", "Dormitorio mixto 6 camas", etc.
 * @property {number} capacity         - personas que entran por unidad
 * @property {number} unitsAvailable   - cuántas unidades de ese tipo libres ese día
 * @property {number} pricePerNight    - en moneda local
 * @property {string} [roomId]         - id en LobbyPMS para confirm_booking
 *
 * @typedef {Object} DayAvailability
 * @property {string} date             - YYYY-MM-DD (la noche del check-in al día siguiente)
 * @property {RoomInventory[]} rooms
 *
 * @typedef {Object} StayOption
 * @property {string} label            - descripción humana de la opción
 * @property {Array<{from:string, to:string, allocations:Array<{rooms:RoomInventory, people:number}>}>} legs
 * @property {number} totalPrice
 * @property {number} satisfactionScore - 0-1, alto = más cerca del pedido original
 * @property {string[]} tradeoffs       - lista de cosas a aclarar al huésped
 */

const ROOM_PRIORITY = {
  private_bath: 4,        // preferido si pidió privada
  private_shared_bath: 3, // privada con baño compartido
  shared_bath: 2,         // alias legacy
  dorm: 1,                // último recurso
};

function priorityFor(type) {
  return ROOM_PRIORITY[type] ?? 0;
}

/**
 * Determina los "tramos" donde el inventario cambia.
 * Recibe un array DayAvailability ordenado por fecha y agrupa días
 * consecutivos con el mismo set de tipos disponibles.
 */
function buildLegs(dayAvailability) {
  if (!dayAvailability?.length) return [];
  const sorted = [...dayAvailability].sort((a, b) => a.date.localeCompare(b.date));
  const legs = [];
  let current = { from: sorted[0].date, days: [sorted[0]] };

  function fingerprint(rooms) {
    return rooms
      .map((r) => `${r.type}:${r.unitsAvailable}`)
      .sort()
      .join('|');
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = current.days[current.days.length - 1];
    if (fingerprint(prev.rooms) === fingerprint(sorted[i].rooms)) {
      current.days.push(sorted[i]);
    } else {
      legs.push(closeLeg(current));
      current = { from: sorted[i].date, days: [sorted[i]] };
    }
  }
  legs.push(closeLeg(current));
  return legs;
}

function closeLeg({ from, days }) {
  // Para mostrar "1-5 abril" usamos la fecha del día siguiente al último
  // (en hostelería el rango de fechas es checkin → checkout no inclusivo).
  const last = days[days.length - 1].date;
  const checkoutDate = addDays(last, 1);
  return {
    from,
    to: checkoutDate,
    nights: days.length,
    rooms: days[0].rooms, // todas las noches del leg tienen el mismo inventory
  };
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Resuelve la mejor allocation para un leg dado: cómo distribuir
 * `peopleCount` personas en las `rooms` disponibles del leg, priorizando
 * `preferredType`.
 *
 * Greedy: usa primero el tipo preferido hasta agotar capacidad, después
 * el siguiente en prioridad, etc. Devuelve null si no entran todas las
 * personas.
 */
function allocateLeg(leg, peopleCount, preferredType) {
  // Ordenar rooms por prioridad: preferredType primero, después por
  // ROOM_PRIORITY. Si dos rooms tienen igual prioridad, la más barata
  // primero (mejor para el huésped).
  const ordered = [...leg.rooms]
    .filter((r) => r.unitsAvailable > 0)
    .sort((a, b) => {
      if (a.type === preferredType && b.type !== preferredType) return -1;
      if (b.type === preferredType && a.type !== preferredType) return 1;
      const pa = priorityFor(a.type);
      const pb = priorityFor(b.type);
      if (pa !== pb) return pb - pa;
      return a.pricePerNight - b.pricePerNight;
    });

  const allocations = [];
  let remaining = peopleCount;

  for (const room of ordered) {
    if (remaining <= 0) break;
    const unitsToUse = Math.min(
      room.unitsAvailable,
      Math.ceil(remaining / room.capacity)
    );
    if (unitsToUse > 0) {
      const peopleHere = Math.min(remaining, unitsToUse * room.capacity);
      allocations.push({
        rooms: room,
        units: unitsToUse,
        people: peopleHere,
        legNightly: unitsToUse * room.pricePerNight,
      });
      remaining -= peopleHere;
    }
  }

  if (remaining > 0) {
    // No alcanza para todos en este leg
    return null;
  }
  return allocations;
}

/**
 * Genera 2-4 opciones de stay con distintos trade-offs.
 *
 * @param {Object} params
 * @param {DayAvailability[]} params.dayAvailability
 * @param {number} params.peopleCount       - personas en el grupo
 * @param {string} params.preferredType     - 'private_bath' | 'shared_bath' | 'dorm'
 * @param {string} params.checkin           - YYYY-MM-DD
 * @param {string} params.checkout          - YYYY-MM-DD (no inclusivo)
 * @returns {{options: StayOption[], unservable: boolean}}
 */
export function planStayOptions({
  dayAvailability,
  peopleCount,
  preferredType = 'private_bath',
  checkin,
  checkout,
}) {
  if (!dayAvailability?.length) return { options: [], unservable: true };

  const legs = buildLegs(dayAvailability);
  if (!legs.length) return { options: [], unservable: true };

  const requestedNights = legs.reduce((s, l) => s + l.nights, 0);

  // ── Opción A: priorizar el tipo PEDIDO (cambia de room si hace falta)
  const optionA = buildOption(legs, peopleCount, preferredType, 'preferred');

  // ── Opción B: minimizar precio total (siempre el más barato disponible)
  const optionB = buildOption(legs, peopleCount, 'cheapest', 'cheapest');

  // ── Opción C: minimizar cambios entre habitaciones (favorece tipo único
  //   que cubra todos los legs, aunque no sea el preferido)
  const stableType = pickMostStableType(legs, peopleCount);
  const optionC = stableType ? buildOption(legs, peopleCount, stableType, 'stable') : null;

  // Filtrar nulls + deduplicar opciones idénticas (mismo split)
  const candidates = [optionA, optionB, optionC].filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const opt of candidates) {
    const fp = JSON.stringify(opt.legs.map((l) => ({
      from: l.from,
      to: l.to,
      a: l.allocations.map((a) => `${a.rooms.type}:${a.units}`),
    })));
    if (!seen.has(fp)) {
      seen.add(fp);
      unique.push(opt);
    }
  }

  // Calcular satisfacción (qué tan cerca del pedido)
  for (const opt of unique) {
    opt.satisfactionScore = computeSatisfaction(opt, preferredType, requestedNights);
  }

  // Ordenar: la que mejor matcha el pedido primero
  unique.sort((a, b) => b.satisfactionScore - a.satisfactionScore);

  return {
    options: unique,
    unservable: unique.length === 0,
    requestedRange: { checkin, checkout, nights: requestedNights },
    legCount: legs.length,
  };
}

function buildOption(legs, peopleCount, preferredOrStrategy, kind) {
  const legAllocations = [];
  let totalPrice = 0;
  for (const leg of legs) {
    const pref = preferredOrStrategy === 'cheapest' ? cheapestType(leg) : preferredOrStrategy;
    const alloc = allocateLeg(leg, peopleCount, pref);
    if (!alloc) return null; // si un leg no se puede cubrir, descartamos opción
    legAllocations.push({
      from: leg.from,
      to: leg.to,
      nights: leg.nights,
      allocations: alloc,
      legPrice: alloc.reduce((s, a) => s + a.legNightly * leg.nights, 0),
    });
    totalPrice += legAllocations[legAllocations.length - 1].legPrice;
  }

  const tradeoffs = computeTradeoffs(legAllocations, kind);
  const label = labelFor(kind, legAllocations);

  return {
    label,
    kind,
    legs: legAllocations,
    totalPrice,
    tradeoffs,
  };
}

function cheapestType(leg) {
  const cheapest = [...leg.rooms]
    .filter((r) => r.unitsAvailable > 0)
    .sort((a, b) => a.pricePerNight - b.pricePerNight)[0];
  return cheapest?.type || 'dorm';
}

/**
 * Encuentra el tipo de habitación que está disponible en TODOS los legs
 * con suficiente capacidad para el grupo. Prefiere el de mayor prioridad
 * (privada > dorm).
 */
function pickMostStableType(legs, peopleCount) {
  const candidatesByLeg = legs.map((leg) =>
    new Set(
      leg.rooms
        .filter((r) => r.unitsAvailable * r.capacity >= peopleCount)
        .map((r) => r.type)
    )
  );
  if (!candidatesByLeg.length) return null;
  const intersection = [...candidatesByLeg[0]].filter((t) =>
    candidatesByLeg.every((s) => s.has(t))
  );
  if (!intersection.length) return null;
  intersection.sort((a, b) => priorityFor(b) - priorityFor(a));
  return intersection[0];
}

function computeTradeoffs(legAllocations, kind) {
  const tradeoffs = [];
  // Detectar cambios de tipo entre legs (genera "tienen que cambiar de habitación")
  const typesPerLeg = legAllocations.map((leg) =>
    leg.allocations.map((a) => a.rooms.type).sort().join('+')
  );
  const uniqueTypes = new Set(typesPerLeg);
  if (uniqueTypes.size > 1) {
    tradeoffs.push(
      `Cambian de habitación ${uniqueTypes.size - 1} ${uniqueTypes.size - 1 === 1 ? 'vez' : 'veces'} durante la estadía.`
    );
  }
  // Detectar mix de tipos en el mismo leg (grupo dividido)
  const splitLegs = legAllocations.filter((l) => l.allocations.length > 1);
  if (splitLegs.length > 0) {
    tradeoffs.push(
      `El grupo se divide en habitaciones distintas (${splitLegs.length} ${splitLegs.length === 1 ? 'tramo' : 'tramos'}).`
    );
  }
  if (kind === 'cheapest') tradeoffs.push('Esta es la opción más económica.');
  if (kind === 'stable') tradeoffs.push('Esta opción evita cambiar de habitación durante la estadía.');
  return tradeoffs;
}

function labelFor(kind, legAllocations) {
  if (legAllocations.length === 1) {
    const main = legAllocations[0].allocations[0]?.rooms?.label || 'opción';
    return `Toda la estadía en ${main}`;
  }
  if (kind === 'preferred') return 'Lo más cercano a tu pedido (cambiando entre habitaciones)';
  if (kind === 'cheapest') return 'Opción más económica';
  if (kind === 'stable') return 'Sin cambios de habitación';
  return 'Opción combinada';
}

function computeSatisfaction(option, preferredType, totalNights) {
  let preferredNights = 0;
  for (const leg of option.legs) {
    for (const a of leg.allocations) {
      if (a.rooms.type === preferredType) preferredNights += leg.nights;
    }
  }
  return preferredNights / Math.max(1, totalNights);
}

/**
 * Formatea las opciones a texto natural en el idioma del huésped, listo
 * para que el agente lo envíe sin elaborar mucho. Ejemplos en español:
 *
 *   "Para tu grupo de 4 personas del 1 al 10 de abril, tengo 2 alternativas:
 *
 *    Opción 1: Lo más cercano a tu pedido (cambiando entre habitaciones)
 *    ▸ 1-5 abril (4 noches): 1 pareja en privada baño privado + 1 pareja en dormitorio compartido — $X
 *    ▸ 5-9 abril (4 noches): 4 personas en dormitorio compartido — $Y
 *    ▸ 9-10 abril (1 noche): 2 parejas en 2 privadas baño privado — $Z
 *    Total: $TTT
 *    Trade-offs: el grupo se divide en habitaciones distintas (2 tramos).
 *    Cambian de habitación 2 veces durante la estadía.
 *
 *    Opción 2: Sin cambios de habitación
 *    ▸ 1-10 abril (9 noches): 4 personas en dormitorio compartido — $AAA
 *    Total: $AAA
 *    Trade-offs: esta opción evita cambiar de habitación durante la estadía."
 */
export function formatOptionsForAgent(planResult, lang = 'es') {
  if (planResult.unservable || !planResult.options.length) {
    const M = MESSAGES[lang] || MESSAGES.es;
    return M.unservable;
  }
  const M = MESSAGES[lang] || MESSAGES.es;
  const out = [M.intro(planResult.requestedRange)];
  planResult.options.forEach((opt, i) => {
    out.push('');
    out.push(`${M.optionLabel(i + 1)}: ${opt.label}`);
    for (const leg of opt.legs) {
      const range = M.dateRange(leg.from, leg.to, leg.nights);
      const split = leg.allocations
        .map((a) => M.allocText(a.people, a.units, a.rooms.label))
        .join(' + ');
      out.push(`  ▸ ${range}: ${split} — ${M.money(leg.legPrice)}`);
    }
    out.push(M.totalLine(opt.totalPrice));
    if (opt.tradeoffs.length) {
      out.push(`  ${M.tradeoffsPrefix} ${opt.tradeoffs.join(' ')}`);
    }
  });
  out.push('');
  out.push(M.outro);
  return out.join('\n');
}

const MESSAGES = {
  es: {
    intro: ({ checkin, checkout, nights }) =>
      `Para tu grupo del ${humanDate(checkin)} al ${humanDate(checkout)} (${nights} ${nights === 1 ? 'noche' : 'noches'}) no tengo disponibilidad continua del tipo que pediste. Te armé estas alternativas:`,
    optionLabel: (i) => `*Opción ${i}*`,
    dateRange: (from, to, nights) => `${humanDate(from)} al ${humanDate(to)} (${nights} ${nights === 1 ? 'noche' : 'noches'})`,
    allocText: (people, units, label) => `${people} ${people === 1 ? 'persona' : 'personas'} en ${units} ${units === 1 ? '' : '× '}${label}`,
    money: (n) => `$${Math.round(n).toLocaleString('es-CO')} COP`,
    totalLine: (n) => `  *Total: $${Math.round(n).toLocaleString('es-CO')} COP*`,
    tradeoffsPrefix: '⚠️',
    outro: '¿Cuál te interesa? Si querés, también puedo buscar otras fechas donde sí haya el tipo de habitación que pediste para toda la estadía.',
    unservable: 'No tengo disponibilidad para tu pedido en esas fechas. ¿Querés que pruebe con fechas cercanas?',
  },
  en: {
    intro: ({ checkin, checkout, nights }) =>
      `For your stay from ${humanDate(checkin, 'en')} to ${humanDate(checkout, 'en')} (${nights} ${nights === 1 ? 'night' : 'nights'}) I don't have continuous availability of the type you asked for. Here are some alternatives:`,
    optionLabel: (i) => `*Option ${i}*`,
    dateRange: (from, to, nights) => `${humanDate(from, 'en')} to ${humanDate(to, 'en')} (${nights} ${nights === 1 ? 'night' : 'nights'})`,
    allocText: (people, units, label) => `${people} ${people === 1 ? 'person' : 'people'} in ${units} × ${label}`,
    money: (n) => `$${Math.round(n).toLocaleString('en-US')} COP`,
    totalLine: (n) => `  *Total: $${Math.round(n).toLocaleString('en-US')} COP*`,
    tradeoffsPrefix: '⚠️',
    outro: 'Which one works for you? I can also check other dates where your preferred room type is available for the whole stay.',
    unservable: 'I have no availability for those exact dates. Want me to try nearby dates?',
  },
  pt: {
    intro: ({ checkin, checkout, nights }) =>
      `Para a sua estadia de ${humanDate(checkin, 'pt')} a ${humanDate(checkout, 'pt')} (${nights} ${nights === 1 ? 'noite' : 'noites'}) não tenho disponibilidade contínua do tipo que você pediu. Vejam estas alternativas:`,
    optionLabel: (i) => `*Opção ${i}*`,
    dateRange: (from, to, nights) => `${humanDate(from, 'pt')} a ${humanDate(to, 'pt')} (${nights} ${nights === 1 ? 'noite' : 'noites'})`,
    allocText: (people, units, label) => `${people} ${people === 1 ? 'pessoa' : 'pessoas'} em ${units} × ${label}`,
    money: (n) => `$${Math.round(n).toLocaleString('pt-BR')} COP`,
    totalLine: (n) => `  *Total: $${Math.round(n).toLocaleString('pt-BR')} COP*`,
    tradeoffsPrefix: '⚠️',
    outro: 'Qual te interessa? Posso também buscar outras datas onde tenha o tipo de quarto que você pediu para toda a estadia.',
    unservable: 'Não tenho disponibilidade para essas datas exatas. Quer que eu tente datas próximas?',
  },
};

function humanDate(yyyymmdd, lang = 'es') {
  if (!yyyymmdd) return '';
  const months = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  };
  const [y, m, d] = yyyymmdd.split('-');
  const monthName = (months[lang] || months.es)[parseInt(m, 10) - 1];
  if (lang === 'en') return `${monthName} ${parseInt(d, 10)}`;
  return `${parseInt(d, 10)} de ${monthName}`;
}

export default { planStayOptions, formatOptionsForAgent };
