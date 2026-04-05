import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, ArrowUpCircle, ArrowDownCircle, QrCode, RefreshCw, X, CheckCircle, Wifi } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('revio_token'); }
function fmt(n) { return `$ ${Number(n || 0).toLocaleString('es-CO')}`; }

function QRCode({ data, size = 140 }) {
  // Simple SVG QR placeholder — in production use a real QR lib like qrcode.react
  const d = data || 'REVIO_WALLET';
  const hash = d.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) => ((hash * (x + 1) * (y + 1)) % 3 !== 0))
  );
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" style={{ borderRadius: 8 }}>
      <rect width="110" height="110" fill="white" />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="10" height="10" fill="#111" /> : null
        )
      )}
      {/* QR corner markers */}
      {[[0,0],[60,0],[0,60]].map(([cx, cy], i) => (
        <g key={i} transform={`translate(${cx},${cy})`}>
          <rect x="0" y="0" width="30" height="30" fill="none" stroke="#111" strokeWidth="3" rx="3" />
          <rect x="6" y="6" width="18" height="18" fill="#111" rx="2" />
        </g>
      ))}
    </svg>
  );
}

function NFCAnimation() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      <div className="nfc-animation">
        <Wifi className="w-10 h-10" style={{ color: 'var(--accent)', transform: 'rotate(90deg)' }} />
      </div>
      {[80, 100, 120].map((s, i) => (
        <div key={i} className="nfc-ring absolute" style={{ width: s, height: s, animationDelay: `${i * 0.4}s` }} />
      ))}
    </div>
  );
}

export default function WalletPanel() {
  const [wallets, setWallets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [nfcScan, setNfcScan] = useState(false);
  const [newWallet, setNewWallet] = useState({ guest_name: '', wristband_code: '', initial_balance: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/wallets`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    setWallets(data.wallets || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function selectWallet(w) {
    setSelected(w);
    const res = await fetch(`${API}/api/wallets/${w.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    setTransactions(data.transactions || []);
  }

  async function createWallet() {
    if (!newWallet.guest_name) return;
    await fetch(`${API}/api/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ ...newWallet, initial_balance: parseFloat(newWallet.initial_balance) || 0 })
    });
    setShowNew(false);
    setNewWallet({ guest_name: '', wristband_code: '', initial_balance: '' });
    load();
  }

  async function topup() {
    if (!selected || !topupAmount) return;
    await fetch(`${API}/api/wallets/${selected.id}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ amount: parseFloat(topupAmount), description: 'Recarga manual' })
    });
    setShowTopup(false);
    setTopupAmount('');
    load();
    selectWallet(selected);
  }

  async function deactivate(id) {
    if (!confirm('¿Desactivar esta billetera?')) return;
    await fetch(`${API}/api/wallets/${id}/deactivate`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${getToken()}` }
    });
    load();
    if (selected?.id === id) setSelected(null);
  }

  // Simulate NFC tap
  function simulateNFC() {
    setNfcScan(true);
    setTimeout(() => {
      setNfcScan(false);
      if (wallets.length > 0) selectWallet(wallets[0]);
    }, 2000);
  }

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: 0 }}>
      {/* Wallet list */}
      <div className="flex flex-col" style={{ width: 300, flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Billeteras NFC</h1>
          <div className="flex gap-2">
            <button onClick={load} className="rv-btn-ghost p-2">
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-2)' }} />
            </button>
            <button onClick={() => setShowNew(true)} className="rv-btn-primary py-2 px-3 text-xs">
              <Plus className="w-3.5 h-3.5" /> Nueva
            </button>
          </div>
        </div>

        {/* NFC tap area */}
        <div
          className="rv-card mb-4 flex flex-col items-center gap-3 py-6 cursor-pointer"
          onClick={simulateNFC}
          style={{ borderColor: nfcScan ? 'var(--accent)' : 'var(--border)' }}
        >
          {nfcScan ? (
            <>
              <NFCAnimation />
              <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Escaneando...</p>
            </>
          ) : (
            <>
              <Wifi className="w-12 h-12" style={{ color: 'var(--text-3)', transform: 'rotate(90deg)' }} />
              <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                Toca aquí para simular<br />lectura NFC de brazalete
              </p>
            </>
          )}
        </div>

        {/* Wallet cards */}
        <div className="space-y-2 overflow-y-auto flex-1">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="rv-skeleton h-20 rounded-xl" />)
          ) : wallets.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-3)' }}>
              No hay billeteras activas
            </div>
          ) : (
            wallets.map(w => (
              <div
                key={w.id}
                onClick={() => selectWallet(w)}
                className="rv-card cursor-pointer transition-all"
                style={{
                  borderColor: selected?.id === w.id ? 'var(--accent)' : 'var(--border)',
                  background: selected?.id === w.id
                    ? 'color-mix(in srgb, var(--accent) 5%, var(--card))'
                    : 'var(--card)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    {w.wristband_code}
                  </span>
                  <span className={`rv-badge ${w.is_active ? 'rv-badge-green' : 'rv-badge-gray'}`}>
                    {w.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="font-semibold" style={{ color: 'var(--text-1)' }}>
                  {w.guests
                    ? `${w.guests.first_name} ${w.guests.last_name || ''}`
                    : w.guest_name || 'Huésped'
                  }
                </div>
                <div className="text-sm font-bold mt-1" style={{ color: 'var(--success)' }}>
                  {fmt(w.balance)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Wallet detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="rv-card h-full flex flex-col items-center justify-center gap-4">
            <Wallet className="w-16 h-16" style={{ color: 'var(--text-3)' }} />
            <p style={{ color: 'var(--text-3)' }}>Selecciona o escanea una billetera</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header card */}
            <div className="rv-card" style={{
              background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #818CF8 100%)',
              border: 'none'
            }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white/70 text-xs uppercase tracking-wider mb-1">Brazalete</div>
                  <div className="text-white font-mono text-xl font-bold">{selected.wristband_code}</div>
                  <div className="text-white text-lg mt-2">
                    {selected.guests
                      ? `${selected.guests.first_name} ${selected.guests.last_name || ''}`
                      : selected.guest_name || 'Huésped'
                    }
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/70 text-xs uppercase tracking-wider mb-1">Saldo</div>
                  <div className="text-white text-3xl font-bold">{fmt(selected.balance)}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowTopup(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
                >
                  <ArrowUpCircle className="w-4 h-4" /> Recargar
                </button>
                {selected.is_active && (
                  <button
                    onClick={() => deactivate(selected.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
                  >
                    <X className="w-4 h-4" /> Desactivar
                  </button>
                )}
              </div>
            </div>

            {/* QR code */}
            <div className="rv-card flex items-center gap-6">
              <QRCode data={selected.qr_data || selected.wristband_code} size={120} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Código QR</h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Presenta este código para identificar el brazalete<br />en el punto de venta.
                </p>
                <p className="font-mono text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                  {selected.qr_data || selected.wristband_code}
                </p>
              </div>
            </div>

            {/* Transaction history */}
            <div className="rv-card">
              <h3 className="font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Movimientos</h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-3)' }}>Sin movimientos</p>
              ) : (
                <div className="space-y-1">
                  {transactions.slice(0, 20).map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2"
                      style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}
                        style={{
                          background: t.type === 'topup'
                            ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                            : 'color-mix(in srgb, var(--danger) 15%, transparent)'
                        }}>
                        {t.type === 'topup'
                          ? <ArrowUpCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                          : <ArrowDownCircle className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm" style={{ color: 'var(--text-1)' }}>{t.description || t.type}</div>
                        <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {new Date(t.created_at).toLocaleString('es-CO')}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold`}
                        style={{ color: t.amount > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {t.amount > 0 ? '+' : ''}{fmt(t.amount)}
                      </div>
                      <div className="text-xs w-24 text-right" style={{ color: 'var(--text-3)' }}>
                        Saldo: {fmt(t.balance_after)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create wallet modal */}
      {showNew && (
        <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="rv-modal" style={{ maxWidth: 440 }}>
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Nueva Billetera</h2>
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="rv-modal-body space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nombre del huésped *</label>
                <input className="rv-input" placeholder="Ej: Juan García" value={newWallet.guest_name}
                  onChange={e => setNewWallet(w => ({ ...w, guest_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Código de brazalete (opcional)</label>
                <input className="rv-input font-mono" placeholder="Auto-generado si se deja vacío"
                  value={newWallet.wristband_code}
                  onChange={e => setNewWallet(w => ({ ...w, wristband_code: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Saldo inicial (COP)</label>
                <input type="number" className="rv-input" placeholder="0" value={newWallet.initial_balance}
                  onChange={e => setNewWallet(w => ({ ...w, initial_balance: e.target.value }))} />
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={createWallet} className="rv-btn-primary">Crear billetera</button>
            </div>
          </div>
        </div>
      )}

      {/* Top-up modal */}
      {showTopup && (
        <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowTopup(false)}>
          <div className="rv-modal" style={{ maxWidth: 380 }}>
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Recargar Billetera</h2>
            </div>
            <div className="rv-modal-body">
              <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                Saldo actual: <strong style={{ color: 'var(--success)' }}>{fmt(selected?.balance)}</strong>
              </p>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Monto a recargar (COP)</label>
              <input type="number" className="rv-input text-xl font-bold" placeholder="50000"
                value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[50000, 100000, 200000].map(v => (
                  <button key={v} onClick={() => setTopupAmount(v)}
                    className="rv-btn-ghost text-sm py-2"
                    style={{ border: '1.5px solid var(--border)' }}>
                    {fmt(v)}
                  </button>
                ))}
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowTopup(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={topup} className="rv-btn-primary">
                <ArrowUpCircle className="w-4 h-4" /> Recargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
