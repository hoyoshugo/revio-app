import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Trash2, Plus, Minus, CreditCard, Wallet,
  Banknote, RefreshCw, Search, ChevronRight, Receipt, X, CheckCircle
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('revio_token'); }

function fmt(n) { return `$ ${Number(n || 0).toLocaleString('es-CO')}`; }

export default function POSTerminal() {
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
  const [lastOrder, setLastOrder] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadCenters = useCallback(async () => {
    const res = await fetch(`${API}/api/pos/revenue-centers`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    const list = data.revenue_centers || [];
    setCenters(list);
    if (list.length > 0 && !activeCenter) setActiveCenter(list[0].id);
  }, []);

  const loadProducts = useCallback(async () => {
    if (!activeCenter) return;
    setLoading(true);
    const res = await fetch(`${API}/api/pos/products?revenue_center_id=${activeCenter}`,
      { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    setProducts(data.products || []);
    setActiveCategory('all');
    setLoading(false);
  }, [activeCenter]);

  useEffect(() => { loadCenters(); }, [loadCenters]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

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

  async function pay() {
    if (cart.length === 0 || paying) return;
    setPaying(true);
    try {
      const res = await fetch(`${API}/api/pos/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ revenue_center_id: activeCenter, items: cart, notes: '' })
      });
      const order = await res.json();
      // Pay immediately
      await fetch(`${API}/api/pos/orders/${order.id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ payment_method: payMethod })
      });
      setLastOrder(order);
      setCart([]);
      setShowPayModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      alert('Error procesando pago: ' + err.message);
    } finally {
      setPaying(false);
    }
  }

  const centerIcons = { bar: '🍺', restaurant: '🍽️', tours: '🏄', store: '🛍️', spa: '💆', other: '📦' };

  return (
    <div className="pos-layout" style={{ height: 'calc(100vh - 56px)', margin: '-1.5rem' }}>

      {/* ── Left: Products ── */}
      <div className="pos-products-panel">
        {/* Center tabs */}
        <div className="flex gap-2 p-4 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          {centers.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCenter(c.id)}
              className={`pos-category-tab flex items-center gap-1.5 flex-shrink-0 ${activeCenter === c.id ? 'active' : ''}`}
            >
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
            <input
              className="rv-input pl-9"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`pos-category-tab flex-shrink-0 text-xs ${activeCategory === cat ? 'active' : ''}`}
              >
                {cat === 'all' ? 'Todo' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rv-skeleton h-24 rounded-xl" />
              ))}
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
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="pos-product-card text-left relative"
                    style={{ borderColor: inCart ? 'var(--accent)' : 'var(--border)' }}
                  >
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
                    <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
                      {fmt(p.price)}
                    </div>
                    {p.category && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{p.category}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Order panel ── */}
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
                  <button onClick={() => updateQty(item.product_id, -1)} className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: 'var(--card)' }}>
                    <Minus className="w-3 h-3" style={{ color: 'var(--text-2)' }} />
                  </button>
                  <span className="w-5 text-center text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    {item.quantity}
                  </span>
                  <button onClick={() => updateQty(item.product_id, 1)} className="w-6 h-6 rounded-md flex items-center justify-center"
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
            <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-1)' }}>Total</span>
              <span style={{ color: 'var(--accent)' }}>{fmt(total)}</span>
            </div>
          </div>

          {/* Payment method buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { id: 'cash', label: 'Efectivo', icon: Banknote },
              { id: 'card', label: 'Tarjeta', icon: CreditCard },
              { id: 'wallet', label: 'Billetera', icon: Wallet },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPayMethod(id)}
                className="flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition-all"
                style={{
                  border: `1.5px solid ${payMethod === id ? 'var(--accent)' : 'var(--border)'}`,
                  background: payMethod === id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--card)',
                  color: payMethod === id ? 'var(--accent)' : 'var(--text-2)'
                }}
              >
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
            }}
          >
            {paying ? 'Procesando...' : `Cobrar ${fmt(total)}`}
          </button>
        </div>
      </div>

      {/* Pay confirmation modal */}
      {showPayModal && (
        <div className="rv-modal-overlay">
          <div className="rv-modal" style={{ maxWidth: 380 }}>
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Confirmar Pago</h2>
            </div>
            <div className="rv-modal-body text-center space-y-4">
              <div className="text-4xl font-bold" style={{ color: 'var(--accent)' }}>{fmt(total)}</div>
              <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                Método: {payMethod === 'cash' ? 'Efectivo' : payMethod === 'card' ? 'Tarjeta' : 'Billetera NFC'}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-3)' }}>
                {cart.length} producto{cart.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowPayModal(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={pay} disabled={paying} className="rv-btn-primary">
                {paying ? 'Procesando...' : 'Confirmar cobro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl"
          style={{ background: 'var(--success)', color: 'white' }}>
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">¡Pago procesado exitosamente!</span>
        </div>
      )}
    </div>
  );
}
