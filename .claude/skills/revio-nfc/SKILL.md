---
name: revio-nfc
description: |
  Modulo NFC/Wallets de Revio. 55% completo (785 lineas existentes).
  WalletPanel.jsx (549L) y wallets.js (236L) ya existen.
  Pendiente: NFC real, PWA offline meseros, liquidacion check-out.
  Activar cuando se trabaje en consumos NFC, billetera, POS, pulseras.
triggers:
  - NFC
  - pulsera
  - consumos
  - bar
  - restaurante
  - spa
  - billetera
  - wallet
  - cargo habitacion
  - punto de venta movil
status: muy-avanzado-55pct
priority: P1
---

# Revio NFC/Wallets

## Estado real (auditado 2026-04-05)
- backend/src/routes/wallets.js: **236 lineas (EXISTE)**
- frontend/src/components/Dashboard/WalletPanel.jsx: **549 lineas (EXISTE)**
- **TOTAL: 785 lineas — 55% completo**

## Lo que falta

### 1. Web NFC API (Chrome Android)
```javascript
// Solo funciona en Chrome en Android (NO iOS)
// frontend/src/components/NFC/NFCReader.jsx
const NFCReader = () => {
  const [reading, setReading] = useState(false);

  const startReading = async () => {
    if (!('NDEFReader' in window)) {
      alert('NFC no disponible. Usar Chrome en Android.');
      return;
    }
    const ndef = new NDEFReader();
    await ndef.scan();
    ndef.addEventListener('reading', ({ message, serialNumber }) => {
      // serialNumber = ID unico de la pulsera
      handleGuestNFC(serialNumber);
    });
    setReading(true);
  };

  return (
    <button onClick={startReading} className="btn-primary">
      {reading ? 'Leyendo NFC...' : 'Acercar pulsera'}
    </button>
  );
};
```

### 2. PWA para meseros (offline mode)
```javascript
// frontend/public/sw.js -- Service Worker
self.addEventListener('fetch', (event) => {
  // Cache estrategia: Network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Sincronizar consumos offline cuando vuelva internet
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-consumptions') {
    event.waitUntil(syncPendingConsumptions());
  }
});
```

### 3. Liquidacion automatica al check-out
```javascript
// En el hook de check-out del PMS, llamar:
const liquidateWallet = async (reservationId, guestId) => {
  const { data } = await supabase
    .from('wallet_consumptions')
    .select('amount')
    .eq('guest_id', guestId)
    .eq('status', 'pending');

  const total = data?.reduce((sum, c) => sum + c.amount, 0) || 0;
  if (total > 0) {
    // Agregar al cargo de la reserva y facturar
    await supabase.from('pms_reservations')
      .update({ wallet_charges: total })
      .eq('id', reservationId);
  }
};
```

## Hardware NFC requerido
- Pulseras NFC: MIFARE Classic 1K o NTAG215 (~$2 USD c/u)
- Lector NFC para testing: smartphone Android con Chrome
- Proveedor Colombia: mercadolibre.com.co (pulseras NFC silicona)
- Alternativa: tarjetas NFC plasticas (mas baratas)

## Bloqueante
- Hardware fisico para testing: comprar pulseras NFC (~$50 USD para testing)
- Web NFC NO funciona en iOS (Apple no lo soporta)
  - Alternativa iOS: QR code (fallback)

## Tiempo restante: 2 semanas con 1 agente
