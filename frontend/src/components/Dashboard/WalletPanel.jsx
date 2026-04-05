import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Plus, ArrowUpCircle, ArrowDownCircle, QrCode, RefreshCw,
  X, CheckCircle, Wifi, Lock, RotateCcw, ChevronDown, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCOP, timeAgo } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function fmt(n) { return formatCOP(n); }

function QRDisplay({ data, size = 140 }) {
  // SVG pseudo-QR — deterministic pattern from data hash
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
      {[[0,0],[60,0],[0,60]].map(([cx, cy], i) => (
        <g key={i} transform={`translate(${cx},${cy})`}>
          <rect x="0" y="0" width="30" height="30" fill="none" stroke="#111" strokeWidth="3" rx="3" />
          <rect x="6" y="6" width="18" height="18" fill="#111" rx="2" />
        </g>
      ))}
    </svg>
  );
}

function NFCRings({ active }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      <Wifi className="w-10 h-10 relative z-10" style={{ color: 'var(--accent)', transform: 'rotate(90deg)' }} />
      {active && [80, 100, 120].map((s, i) => (
        <div key={i} className="absolute rounded-full nfc-ring"
          style={{
            width: s, height: s,
            border: '2px solid var(--accent)',
            opacity: 0,
            animation: `nfc-pulse 1.5s ease-out ${i * 0.4}s infinite`
          }} />
      ))}
    </div>
  );
}

const TX_ICONS = {
  topup: { icon: ArrowUpCircle, color: '#10B981', label: 'Recarga' },
  charge: { icon: ArrowDownCircle, color: '#EF4444', label: 'Consumo' },
  refund: { icon: RotateCcw, color: '#6366F1', label: 'Devolución' },
  purchase: { icon: ArrowDownCircle, color: '#EF4444', label: 'Compra' },
};

export default function WalletPanel() {
  const { authHeaders, propertyId } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [nfcScan, setNfcScan] = useState(false);
  const [nfcPulse, setNfcPulse] = useState(false);
  const [newWallet, setNewWallet] = useState({ guest_name: '', wristband_code: '', initial_balance: '' });
  const [actionLoading, setActionLoading] = useState('');
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/wallets`, { headers: authHeaders });
      const data = await res.json();
      setWallets(data.wallets || []);
    } catch {}
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function loadTransactions(walletId, page = 1) {
    setTxLoading(true);
    try {
      const res = await fetch(`${API}/api/wallets/${walletId}/transactions?page=${page}&limit=15`, { headers: authHeaders });
      const data = await res.json();
      if (page === 1) setTransactions(data.data || []);
      else setTransactions(t => [...t, ...(data.data || [])]);
      setTxTotal(data.total || 0);
      setTxPage(page);
    } catch {}
    setTxLoading(false);
  }

  async function selectWallet(w) {
    setSelected(w);
    setTransactions([]);
    setTxPage(1);
    await loadTransactions(w.id, 1);
  }

  async function createWallet() {
    if (!newWallet.guest_name) return;
    try {
      await fetch(`${API}/api/wallets`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newWallet, initial_balance: parseFloat(newWallet.initial_balance) || 0 })
      });
      setShowNew(false);
      setNewWallet({ guest_name: '', wristband_code: '', initial_balance: '' });
      load();
    } catch {}
  }

  async function topup() {
    if (!selected || !topupAmount) return;
    setActionLoading('topup');
    try {
      await fetch(`${API}/api/wallets/${selected.id}/topup`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(topupAmount), description: 'Recarga manual' })
      });
      setShowTopup(false);
      setTopupAmount('');
      const updated = { ...selected, balance: selected.balance + parseFloat(topupAmount) };
      setSelected(updated);
      setWallets(ws => ws.map(w => w.id === selected.id ? updated : w));
      await loadTransactions(selected.id, 1);
      showToast('Recarga exitosa');
    } catch {}
    setActionLoading('');
  }

  async function freezeWallet() {
    if (!selected || !confirm('¿Congelar esta billetera? No podrá usarse hasta que se reactive.')) return;
    setActionLoading('freeze');
    try {
      const res = await fetch(`${API}/api/wallets/${selected.id}/freeze`, {
        method: 'POST', headers: authHeaders
      });
      if (res.ok) {
        const updated = { ...selected, is_active: false };
        setSelected(updated);
        setWallets(ws => ws.map(w => w.id === selected.id ? updated : w));
        showToast('Billetera congelada');
      }
    } catch {}
    setActionLoading('');
  }

  async function refundWallet() {
    if (!selected || !confirm(`¿Devolver ${fmt(selected.balance)} al huésped? El saldo quedará en $0.`)) return;
    setActionLoading('refund');
    try {
      const res = await fetch(`${API}/api/wallets/${selected.id}/refund`, {
        method: 'POST', headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        const updated = { ...selected, balance: 0, is_active: false };
        setSelected(updated);
        setWallets(ws => ws.map(w => w.id === selected.id ? updated : w));
        await loadTransactions(selected.id, 1);
        showToast(`Devolución de ${fmt(data.refunded_amount || selected.balance)} procesada`);
      }
    } catch {}
    setActionLoading('');
  }

  async function simulateNFC() {
    if (!selected) return;
    setNfcScan(true);
    setNfcPulse(true);
    try {
      const res = await fetch(`${API}/api/wallets/${selected.id}/simulate-nfc`, {
        method: 'POST', headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setTimeout(() => {
          setNfcScan(false);
          setNfcPulse(false);
          const updated = { ...selected, wristband_code: data.simulated_uid || selected.wristband_code };
          setSelected(updated);
          setWallets(ws => ws.map(w => w.id === selected.id ? updated : w));
          showToast(`UID NFC asignado: ${data.simulated_uid}`);
        }, 2000);
      } else {
        setNfcScan(false);
        setNfcPulse(false);
      }
    } catch {
      setNfcScan(false);
      setNfcPulse(false);
    }
  }

  // NFC tap area — simulate scan of wallets list
  function handleNFCTap() {
    if (nfcScan) return;
    setNfcScan(true);
    setNfcPulse(true);
    setTimeout(() => {
      setNfcScan(false);
      setNfcPulse(false);
      const active = wallets.find(w => w.is_active);
      if (active) selectWallet(active);
    }, 2000);
  }

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: 0 }}>
      {/* NFC pulse overlay */}
      {nfcPulse && !selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(99,102,241,0.08)' }}>
          <div className="text-center">
            <NFCRings active={true} />
            <p className="text-sm font-medium mt-3" style={{ color: 'var(--accent)' }}>Leyendo brazalete...</p>
          </div>
        </div>
      )}

      {/* Wallet list */}
      <div className="flex flex-col" style={{ width: 300, flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Billeteras NFC</h1>
          <div className="flex gap-2">
            <button onClick={load} className="rv-btn-ghost p-2">
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-2)' }} />
            </button>
            <button onClick={() => setShowNew(true)} className="rv-btn-primary py-2 px-3 text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Nueva
            </button>
          </div>
        </div>

        {/* NFC tap area */}
        <div className="rv-card mb-4 flex flex-col items-center gap-3 py-6 cursor-pointer"
          onClick={handleNFCTap}
          style={{ borderColor: nfcScan ? 'var(--accent)' : 'var(--border)' }}>
          {nfcScan ? (
            <>
              <NFCRings active={true} />
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
              <div key={w.id} onClick={() => selectWallet(w)}
                className="rv-card cursor-pointer transition-all"
                style={{
                  borderColor: selected?.id === w.id ? 'var(--accent)' : 'var(--border)',
                  background: selected?.id === w.id
                    ? 'color-mix(in srgb, var(--accent) 5%, var(--card))'
                    : 'var(--card)'
                }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    {w.wristband_code}
                  </span>
                  <span className={`rv-badge ${w.is_active ? 'rv-badge-green' : 'rv-badge-gray'}`}>
                    {w.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                  {w.guests
                    ? `${w.guests.first_name} ${w.guests.last_name || ''}`
                    : w.guest_name || 'Huésped'
                  }
                </div>
                <div className="text-sm font-bold mt-1" style={{ color: w.balance > 0 ? '#10B981' : 'var(--text-3)' }}>
                  {fmt(w.balance)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Wallet detail */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selected ? (
          <div className="rv-card h-64 flex flex-col items-center justify-center gap-4">
            <Wallet className="w-16 h-16" style={{ color: 'var(--text-3)' }} />
            <p style={{ color: 'var(--text-3)' }}>Selecciona o escanea una billetera</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header card */}
            <div className="rv-card" style={{
              background: selected.is_active
                ? 'linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #818CF8 100%)'
                : 'linear-gradient(135deg, #374151 0%, #4B5563 100%)',
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
                  {!selected.is_active && (
                    <div className="text-white/60 text-xs mt-1">Congelada</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                {selected.is_active && (
                  <button onClick={() => setShowTopup(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                    <ArrowUpCircle className="w-4 h-4" /> Recargar
                  </button>
                )}
                {selected.is_active && selected.balance > 0 && (
                  <button onClick={refundWallet} disabled={actionLoading === 'refund'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                    {actionLoading === 'refund'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <RotateCcw className="w-4 h-4" />}
                    Devolver saldo
                  </button>
                )}
                {selected.is_active && (
                  <button onClick={freezeWallet} disabled={actionLoading === 'freeze'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ background: 'rgba(239,68,68,0.3)', color: 'white' }}>
                    {actionLoading === 'freeze'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Lock className="w-4 h-4" />}
                    Congelar
                  </button>
                )}
                <button onClick={simulateNFC} disabled={nfcScan}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                  {nfcScan
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Wifi className="w-4 h-4" />}
                  Simular NFC
                </button>
              </div>
            </div>

            {/* QR code */}
            <div className="rv-card flex items-center gap-6">
              <QRDisplay data={selected.qr_data || selected.wristband_code} size={120} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Código QR</h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Presenta este código para identificar<br />el brazalete en el punto de venta.
                </p>
                <p className="font-mono text-xs mt-2 select-all" style={{ color: 'var(--text-3)' }}>
                  {selected.qr_data || selected.wristband_code}
                </p>
              </div>
            </div>

            {/* Transaction history */}
            <div className="rv-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ color: 'var(--text-1)' }}>
                  Movimientos
                </h3>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {transactions.length} de {txTotal}
                </span>
              </div>
              {txLoading && transactions.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-3)' }}>Sin movimientos</p>
              ) : (
                <>
                  <div className="space-y-1">
                    {transactions.map(t => {
                      const meta = TX_ICONS[t.type] || TX_ICONS.charge;
                      const TxIcon = meta.icon;
                      return (
                        <div key={t.id} className="flex items-center gap-3 py-2"
                          style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: `${meta.color}20` }}>
                            <TxIcon className="w-4 h-4" style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate" style={{ color: 'var(--text-1)' }}>
                              {t.description || meta.label}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                              {new Date(t.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          </div>
                          <div className="text-sm font-semibold"
                            style={{ color: t.amount >= 0 ? '#10B981' : '#EF4444' }}>
                            {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                          </div>
                          <div className="text-xs w-24 text-right" style={{ color: 'var(--text-3)' }}>
                            {fmt(t.balance_after)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {transactions.length < txTotal && (
                    <button
                      onClick={() => loadTransactions(selected.id, txPage + 1)}
                      disabled={txLoading}
                      className="w-full mt-3 rv-btn-ghost text-sm flex items-center justify-center gap-2">
                      {txLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <ChevronDown className="w-4 h-4" />
                      }
                      Cargar más
                    </button>
                  )}
                </>
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
              <button onClick={() => setShowTopup(false)} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="rv-modal-body">
              <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                Saldo actual: <strong style={{ color: '#10B981' }}>{fmt(selected?.balance)}</strong>
              </p>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Monto a recargar (COP)</label>
              <input type="number" className="rv-input text-xl font-bold" placeholder="50000"
                value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[50000, 100000, 200000].map(v => (
                  <button key={v} onClick={() => setTopupAmount(v)}
                    className="rv-btn-ghost text-sm py-2" style={{ border: '1.5px solid var(--border)' }}>
                    {fmt(v)}
                  </button>
                ))}
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowTopup(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={topup} disabled={actionLoading === 'topup'} className="rv-btn-primary flex items-center gap-2">
                {actionLoading === 'topup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                Recargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl"
          style={{ background: '#10B981', color: 'white' }}>
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}
