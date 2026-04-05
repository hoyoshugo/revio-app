import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Trash2, Plus, Minus, CreditCard, Wallet,
  Banknote, RefreshCw, Search, Receipt, X, CheckCircle,
  Loader2, Wifi, Home, Printer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCOP } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function fmt(n) { return formatCOP(n); }

function ReceiptModal({ order, onClose }) {
  return (
    <div className="rv-modal-overlay">
      <div className="rv-modal" style={{ maxWidth: 360 }}>
        <div className="rv-modal-header">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Recibo de Pago</h2>
          </div>
          <button onClick={onClose} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="rv-modal-body" id="receipt-content">
          <div className="text-center mb-4">
            <div className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>Revio PMS</div>
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>
              {new Date().toLocaleString('es-CO')}
            </div>
            {order?.order_number && (
              <div className="text-xs mt-1 font-mono" style={{ color: 'var(--text-3)' }}>
                #{order.order_number}
              </div>
            )}
          </div>
          <div className="space-y-1 mb-3">
            {(order?.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-2)' }}>
                  {item.quantity}x {item.product_name || item.name}
                </span>
                <span style={{ color: 'var(--text-1)' }}>
                  {fmt(item.unit_price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-2)' }}>Subtotal</span>
              <span style={{ color: 'var(--text-1)' }}>{fmt(order?.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-2)' }}>IVA (8%)</span>
              <span style={{ color: 'var(--text-1)' }}>{fmt(order?.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--text-1)' }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>{fmt(order?.total)}</span>
            </div>
          </div>
          <div className="mt-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>
            Método: {order?.payment_method === 'cash' ? 'Efectivo' : order?.payment_method === 'card' ? 'Tarjeta' : order?.payment_method === 'wristband' ? 'Billetera NFC' : 'Cargo a habitación'}
          </div>
        </div>
        <div className="rv-modal-footer">
          <button onClick={onClose} className="rv-btn-ghost">Cerrar</button>
          <button
            onClick={() => window.print()}
            className="rv-btn-primary flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POSTerminal() {
  const { authHeaders, propertyId } = useAuth();
  const [centers, setCenters] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCenter, setActiveCenter] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Cash payment state
  const [cashReceived, setCashReceived] = useState('');

  // NFC/Wristband state
  const [nfcUid, setNfcUid] = useState('');
  const [nfcWallet, setNfcWallet] = useState(null);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState('');

  // Room charge state
  const [roomSearch, setRoomSearch] = useState('');
  const [roomResults, setRoomResults] = useState([]);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [roomSearchLoading, setRoomSearchLoading] = useState(false);

  const loadCenters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/pos/revenue-centers`, { headers: authHeaders });
      const data = await res.json();
      const list = data.revenue_centers || [];
      setCenters(list);
      if (list.length > 0) setActiveCenter(list[0].id);
    } catch {}
  }, [authHeaders]);

  const loadProducts = useCallback(async () => {
    if (!activeCenter) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/pos/products?revenue_center_id=${activeCenter}`, { headers: authHeaders });
      const data = await res.json();
      setProducts(data.products || []);
      setActiveCategory('all');
    } catch {}
    setLoading(false);
  }, [activeCenter, authHeaders]);

  useEffect(() => { loadCenters(); }, [loadCenters]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Room search debounce
  useEffect(() => {
    if (payMethod !== 'room_charge' || roomSearch.length < 2) { setRoomResults([]); return; }
    const t = setTimeout(async () => {
      setRoomSearchLoading(true);
      try {
        const res = await fetch(`${API}/api/reservations?search=${encodeURIComponent(roomSearch)}&status=checked_in`, { headers: authHeaders });
        const data = await res.json();
        setRoomResults(data.reservations || []);
      } catch {}
      setRoomSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [roomSearch, payMethod, authHeaders]);

  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(product) {
    setCart(c => {
      const existing = c.find(i => i.product_id === product.id);
      if (existing) return c.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product_id: product.id, product_name: product.name, unit_price: product.price, quantity: 1 }];
    });
  }

  function updateQty(productId, delta) {
    setCart(c => c
      .map(i => i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    );
  }

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const taxes = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + taxes;
  const cashChange = cashReceived ? Math.max(0, parseFloat(cashReceived) - total) : 0;

  async function scanNfc() {
    if (!nfcUid.trim()) return;
    setNfcScanning(true);
    setNfcError('');
    setNfcWallet(null);
    try {
      const res = await fetch(`${API}/api/wallets/scan`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: nfcUid.trim() })
      });
      const data = await res.json();
      if (res.ok && data.wallet) {
        setNfcWallet(data.wallet);
        if (data.wallet.balance < total) {
          setNfcError(`Saldo insuficiente. Disponible: ${fmt(data.wallet.balance)}`);
        }
      } else {
        setNfcError(data.error || 'Billetera no encontrada');
      }
    } catch {
      setNfcError('Error de conexión');
    }
    setNfcScanning(false);
  }

  async function pay() {
    if (cart.length === 0 || paying) return;
    // Validations
    if (payMethod === 'wristband' && !nfcWallet) { setNfcError('Escanea primero el brazalete'); return; }
    if (payMethod === 'wristband' && nfcWallet.balance < total) return;
    if (payMethod === 'room_charge' && !selectedReservation) { alert('Selecciona una habitación'); return; }

    setPaying(true);
    try {
      const body = {
        revenue_center_id: activeCenter,
        items: cart,
        payment_method: payMethod,
        subtotal,
        tax_amount: taxes,
        total,
        notes: ''
      };
      if (payMethod === 'wristband' && nfcWallet) {
        body.wallet_id = nfcWallet.id;
      }
      if (payMethod === 'room_charge' && selectedReservation) {
        body.reservation_id = selectedReservation.id;
      }
      if (payMethod === 'cash' && cashReceived) {
        body.cash_received = parseFloat(cashReceived);
        body.cash_change = cashChange;
      }

      const res = await fetch(`${API}/api/pos/orders`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const order = await res.json();
        setLastOrder({ ...order, items: cart, subtotal, tax_amount: taxes, total, payment_method: payMethod });
        setCart([]);
        setShowPayModal(false);
        setNfcWallet(null);
        setNfcUid('');
        setSelectedReservation(null);
        setCashReceived('');
        setShowSuccess(true);
        setTimeout(() => { setShowSuccess(false); setShowReceipt(true); }, 1500);
      } else {
        const err = await res.json();
        if (res.status === 402) {
          setNfcError(`Saldo insuficiente: ${err.error || ''}`);
        } else {
          alert(err.error || 'Error procesando pago');
        }
      }
    } catch (err) {
      alert('Error procesando pago: ' + err.message);
    } finally {
      setPaying(false);
    }
  }

  const centerIcons = { bar: '🍺', restaurant: '🍽️', tours: '🏄', store: '🛍️', spa: '💆', other: '📦' };

  return (
    <div className="pos-layout" style={{ height: 'calc(100vh - 56px)', margin: '-1.5rem' }}>

      {/* Left: Products */}
      <div className="pos-products-panel">
        {/* Center tabs */}
        <div className="flex gap-2 p-4 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          {centers.map(c => (
            <button key={c.id} onClick={() => setActiveCenter(c.id)}
              className={`pos-category-tab flex items-center gap-1.5 flex-shrink-0 ${activeCenter === c.id ? 'active' : ''}`}>
              <span>{centerIcons[c.type] || '📦'}</span>
              <span>{c.name}</span>
            </button>
          ))}
          {centers.length === 0 && (
            <span className="text-sm" style={{ color: 'var(--text-3)' }}>No hay centros de revenue configurados</span>
          )}
        </div>

        {/* Search + category filter */}
        <div className="flex gap-3 p-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
            <input className="rv-input pl-9" placeholder="Buscar producto..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`pos-category-tab flex-shrink-0 text-xs ${activeCategory === cat ? 'active' : ''}`}>
                {cat === 'all' ? 'Todo' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="rv-skeleton h-24 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-3)' }}>
              No hay productos
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(p => {
                const inCart = cart.find(i => i.product_id === p.id);
                return (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="pos-product-card text-left relative"
                    style={{ borderColor: inCart ? 'var(--accent)' : 'var(--border)' }}>
                    {inCart && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'var(--accent)' }}>
                        {inCart.quantity}
                      </div>
                    )}
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                    ) : (
                      <div className="w-full h-16 rounded-lg mb-2 flex items-center justify-center text-3xl"
                        style={{ background: 'var(--bg)' }}>
                        {p.category === 'bebida' ? '🍺' : p.category === 'comida' ? '🍽️' : '📦'}
                      </div>
                    )}
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{p.name}</div>
                    <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--accent)' }}>{fmt(p.price)}</div>
                    {p.category && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{p.category}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Order panel */}
      <div className="pos-order-panel">
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>
              <ShoppingCart className="inline w-4 h-4 mr-2" />
              Orden actual
            </h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="rv-btn-ghost p-1.5 text-xs">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Order items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <ShoppingCart className="w-10 h-10" style={{ color: 'var(--text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Selecciona productos</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product_id} className="pos-order-item">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{item.product_name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-2)' }}>{fmt(item.unit_price)} c/u</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateQty(item.product_id, -1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: 'var(--card)' }}>
                    <Minus className="w-3 h-3" style={{ color: 'var(--text-2)' }} />
                  </button>
                  <span className="w-5 text-center text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    {item.quantity}
                  </span>
                  <button onClick={() => updateQty(item.product_id, 1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: 'var(--card)' }}>
                    <Plus className="w-3 h-3" style={{ color: 'var(--text-2)' }} />
                  </button>
                </div>
                <div className="text-sm font-semibold w-20 text-right" style={{ color: 'var(--text-1)' }}>
                  {fmt(item.unit_price * item.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & payment */}
        <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-2)' }}>Subtotal</span>
              <span style={{ color: 'var(--text-1)' }}>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-2)' }}>IVA (8%)</span>
              <span style={{ color: 'var(--text-1)' }}>{fmt(taxes)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2"
              style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-1)' }}>Total</span>
              <span style={{ color: 'var(--accent)' }}>{fmt(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[
              { id: 'cash', label: 'Efectivo', icon: Banknote },
              { id: 'card', label: 'Tarjeta', icon: CreditCard },
              { id: 'wristband', label: 'NFC', icon: Wifi },
              { id: 'room_charge', label: 'Habitación', icon: Home },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setPayMethod(id)}
                className="flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition-all"
                style={{
                  border: `1.5px solid ${payMethod === id ? 'var(--accent)' : 'var(--border)'}`,
                  background: payMethod === id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--card)',
                  color: payMethod === id ? 'var(--accent)' : 'var(--text-2)'
                }}>
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => cart.length > 0 && setShowPayModal(true)}
            disabled={cart.length === 0 || paying}
            className="w-full py-3 rounded-xl font-semibold text-base text-white transition-all"
            style={{
              background: cart.length === 0 ? 'var(--card)' : 'var(--accent)',
              color: cart.length === 0 ? 'var(--text-3)' : 'white',
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer'
            }}>
            {paying ? 'Procesando...' : `Cobrar ${fmt(total)}`}
          </button>
        </div>
      </div>

      {/* Pay modal */}
      {showPayModal && (
        <div className="rv-modal-overlay">
          <div className="rv-modal" style={{ maxWidth: 420 }}>
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Confirmar Pago</h2>
              <button onClick={() => setShowPayModal(false)} className="rv-btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rv-modal-body space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold" style={{ color: 'var(--accent)' }}>{fmt(total)}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                  {cart.length} producto{cart.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Cash change */}
              {payMethod === 'cash' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                    Dinero recibido (COP)
                  </label>
                  <input
                    type="number"
                    className="rv-input text-lg font-bold"
                    placeholder={String(Math.ceil(total / 1000) * 1000)}
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[Math.ceil(total / 10000) * 10000, Math.ceil(total / 20000) * 20000, Math.ceil(total / 50000) * 50000].map(v => (
                      <button key={v} onClick={() => setCashReceived(v)}
                        className="rv-btn-ghost text-xs py-1.5" style={{ border: '1.5px solid var(--border)' }}>
                        {fmt(v)}
                      </button>
                    ))}
                  </div>
                  {cashReceived && parseFloat(cashReceived) >= total && (
                    <div className="flex justify-between font-bold p-2 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                      <span style={{ color: 'var(--text-2)' }}>Cambio</span>
                      <span style={{ color: 'var(--success)' }}>{fmt(cashChange)}</span>
                    </div>
                  )}
                  {cashReceived && parseFloat(cashReceived) < total && (
                    <div className="text-xs text-center" style={{ color: 'var(--danger)' }}>
                      Falta: {fmt(total - parseFloat(cashReceived))}
                    </div>
                  )}
                </div>
              )}

              {/* Card animation */}
              {payMethod === 'card' && (
                <div className="text-center py-3">
                  <CreditCard className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                    Inserta o pasa la tarjeta en el terminal
                  </p>
                </div>
              )}

              {/* NFC scan */}
              {payMethod === 'wristband' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      className="rv-input font-mono flex-1"
                      placeholder="UID del brazalete..."
                      value={nfcUid}
                      onChange={e => setNfcUid(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && scanNfc()}
                    />
                    <button onClick={scanNfc} disabled={nfcScanning || !nfcUid.trim()}
                      className="rv-btn-primary px-3 flex items-center gap-1.5">
                      {nfcScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                      Escanear
                    </button>
                  </div>
                  {nfcError && (
                    <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                      {nfcError}
                    </div>
                  )}
                  {nfcWallet && !nfcError && (
                    <div className="p-3 rounded-xl space-y-1" style={{ background: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                        {nfcWallet.guests
                          ? `${nfcWallet.guests.first_name} ${nfcWallet.guests.last_name || ''}`
                          : nfcWallet.guest_name || 'Huésped'
                        }
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-3)' }}>Saldo disponible</span>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(nfcWallet.balance)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-3)' }}>Saldo después del cobro</span>
                        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                          {fmt(nfcWallet.balance - total)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Room charge */}
              {payMethod === 'room_charge' && (
                <div className="space-y-3">
                  {selectedReservation ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                      <Home className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm flex-1" style={{ color: 'var(--text-1)' }}>
                        Hab. {selectedReservation.rooms?.number || '—'} —{' '}
                        {selectedReservation.guests?.first_name} {selectedReservation.guests?.last_name || ''}
                      </span>
                      <button onClick={() => setSelectedReservation(null)} className="p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
                      <input
                        className="rv-input pl-8"
                        placeholder="Buscar habitación o huésped..."
                        value={roomSearch}
                        onChange={e => setRoomSearch(e.target.value)}
                      />
                      {roomResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-xl shadow-lg overflow-hidden"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          {roomResults.map(r => (
                            <button key={r.id} onClick={() => { setSelectedReservation(r); setRoomSearch(''); setRoomResults([]); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                              style={{ color: 'var(--text-1)' }}>
                              Hab. {r.rooms?.number} — {r.guests?.first_name} {r.guests?.last_name || ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedReservation && (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      El cobro se agregará a la cuenta de la habitación
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowPayModal(false)} className="rv-btn-ghost">Cancelar</button>
              <button
                onClick={pay}
                disabled={paying || (payMethod === 'wristband' && (!nfcWallet || nfcError)) || (payMethod === 'cash' && cashReceived && parseFloat(cashReceived) < total)}
                className="rv-btn-primary flex items-center gap-2">
                {paying
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                  : <><CheckCircle className="w-4 h-4" /> Confirmar cobro</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl"
          style={{ background: '#10B981', color: 'white' }}>
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">¡Pago procesado exitosamente!</span>
        </div>
      )}

      {/* Receipt modal */}
      {showReceipt && lastOrder && (
        <ReceiptModal order={lastOrder} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
}
