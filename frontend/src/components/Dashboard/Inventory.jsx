import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Search, Plus, RefreshCw, X, AlertTriangle,
  ChevronDown, ChevronRight, Edit2, Check, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCOP } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TABS = ['Productos', 'Alertas'];

function StockEditor({ product, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(product.stock ?? 0);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(product.id, parseInt(value) || 0);
    setSaving(false);
    setEditing(false);
  }

  const stock = product.stock ?? 0;
  const isLow = product.track_stock && stock <= (product.min_stock || 0);
  const color = stock <= 0 ? '#EF4444' : isLow ? '#F59E0B' : '#10B981';

  if (!editing) {
    return (
      <span
        className="flex items-center gap-1 cursor-pointer group"
        onClick={() => setEditing(true)}
        title="Clic para editar"
      >
        <span className="font-semibold text-sm" style={{ color }}>{stock}</span>
        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-3)' }} />
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="rv-input w-16 text-xs py-1 px-2 text-center"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="p-1 text-emerald-400 hover:text-emerald-300">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
      <button onClick={() => setEditing(false)} className="p-1 text-red-400 hover:text-red-300">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function NewProductModal({ centers, onClose, onSave }) {
  const [form, setForm] = useState({
    revenue_center_id: centers[0]?.id || '',
    name: '', category: '', price: '', cost: '',
    stock: 0, min_stock: 5, track_stock: true, unit: 'unidad'
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name || !form.price) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rv-modal" style={{ maxWidth: 480 }}>
        <div className="rv-modal-header">
          <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Nuevo Producto</h2>
          <button onClick={onClose} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="rv-modal-body space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Centro de revenue *</label>
            <select className="rv-select" value={form.revenue_center_id}
              onChange={e => setForm(f => ({ ...f, revenue_center_id: e.target.value }))}>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Nombre *</label>
              <input className="rv-input" placeholder="Ej: Cerveza Águila"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Categoría</label>
              <input className="rv-input" placeholder="Ej: bebida"
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Precio COP *</label>
              <input type="number" className="rv-input" placeholder="8000"
                value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Costo COP</label>
              <input type="number" className="rv-input" placeholder="4000"
                value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Stock inicial</label>
              <input type="number" className="rv-input" placeholder="0"
                value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Stock mín.</label>
              <input type="number" className="rv-input" placeholder="5"
                value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Unidad</label>
              <input className="rv-input" placeholder="unidad"
                value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.track_stock}
              onChange={e => setForm(f => ({ ...f, track_stock: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm" style={{ color: 'var(--text-2)' }}>Controlar inventario</span>
          </label>
        </div>
        <div className="rv-modal-footer">
          <button onClick={onClose} className="rv-btn-ghost">Cancelar</button>
          <button onClick={submit} disabled={saving || !form.name || !form.price}
            className="rv-btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear producto
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductGroup({ center, products, onStockSave }) {
  const [expanded, setExpanded] = useState(true);

  const byCategory = products.reduce((acc, p) => {
    const cat = p.category || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="rv-card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-3)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-3)' }} />}
          <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{center.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}>
            {products.length} productos
          </span>
        </div>
      </button>

      {expanded && (
        <div>
          {Object.entries(byCategory).map(([cat, catProducts]) => (
            <div key={cat}>
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                {cat}
              </div>
              {catProducts.map(p => {
                const margin = p.cost > 0 && p.price > 0
                  ? Math.round(((p.price - p.cost) / p.price) * 100)
                  : null;
                return (
                  <div key={p.id}
                    className="flex items-center gap-3 px-4 py-3 text-sm border-t"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                      style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}>
                      {p.category === 'bebida' ? '🍺' : p.category === 'comida' ? '🍽️' : '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" style={{ color: 'var(--text-1)' }}>{p.name}</div>
                      {p.sku && <div className="text-xs" style={{ color: 'var(--text-3)' }}>{p.sku}</div>}
                    </div>
                    <div className="w-28 text-right">
                      {p.track_stock ? (
                        <StockEditor product={p} onSave={onStockSave} />
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>Sin control</span>
                      )}
                      {p.track_stock && p.min_stock > 0 && (
                        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>mín: {p.min_stock}</div>
                      )}
                    </div>
                    <div className="w-24 text-right">
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                        {formatCOP(p.price)}
                      </div>
                      {p.cost > 0 && (
                        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                          costo: {formatCOP(p.cost)}
                        </div>
                      )}
                    </div>
                    {margin !== null && (
                      <div className="w-16 text-right">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            background: margin >= 50 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            color: margin >= 50 ? '#10B981' : '#F59E0B'
                          }}>
                          {margin}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Inventory() {
  const { authHeaders, propertyId } = useAuth();
  const [centers, setCenters] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Productos');
  const [showNew, setShowNew] = useState(false);
  const [filterCenter, setFilterCenter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API}/api/pos/revenue-centers`, { headers: authHeaders }),
        fetch(`${API}/api/pos/products?limit=500`, { headers: authHeaders }),
      ]);
      const [cData, pData] = await Promise.all([cRes.json(), pRes.json()]);
      setCenters(cData.revenue_centers || []);
      setProducts(pData.products || []);
    } catch {}
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function updateStock(productId, stock) {
    try {
      await fetch(`${API}/api/pos/products/${productId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock })
      });
      setProducts(ps => ps.map(p => p.id === productId ? { ...p, stock } : p));
    } catch {}
  }

  async function createProduct(form) {
    try {
      const res = await fetch(`${API}/api/pos/products`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: parseFloat(form.price), cost: parseFloat(form.cost) || 0 })
      });
      if (res.ok) load();
    } catch {}
  }

  const filtered = products.filter(p => {
    const matchCenter = filterCenter === 'all' || p.revenue_center_id === filterCenter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase());
    return matchCenter && matchSearch;
  });

  const byCenter = centers.map(c => ({
    center: c,
    products: filtered.filter(p => p.revenue_center_id === c.id)
  })).filter(g => g.products.length > 0);

  const lowStock = products.filter(p => p.track_stock && (p.stock ?? 0) <= (p.min_stock || 0));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Inventario</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {products.length} productos · {lowStock.length > 0 && <span className="text-amber-400">{lowStock.length} alertas de stock</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rv-btn-ghost p-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowNew(true)} className="rv-btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === t ? 'var(--surface)' : 'transparent',
              color: activeTab === t ? 'var(--text-1)' : 'var(--text-3)',
              boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
            }}>
            {t === 'Alertas' && lowStock.length > 0 ? `${t} (${lowStock.length})` : t}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {activeTab === 'Productos' && (
        <>
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
              <input className="rv-input pl-9 text-sm" placeholder="Buscar producto o categoría..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="rv-select text-sm" value={filterCenter}
              onChange={e => setFilterCenter(e.target.value)}>
              <option value="all">Todos los centros</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Products */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : byCenter.length === 0 ? (
            <div className="rv-card text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
              <p className="font-medium" style={{ color: 'var(--text-1)' }}>
                {search ? 'Sin resultados' : 'No hay productos configurados'}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                {!search && 'Agrega productos desde el botón "Nuevo producto"'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {byCenter.map(({ center, products: ps }) => (
                <ProductGroup key={center.id} center={center} products={ps} onStockSave={updateStock} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Alerts Tab */}
      {activeTab === 'Alertas' && (
        <div className="space-y-2">
          {lowStock.length === 0 ? (
            <div className="rv-card text-center py-12">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold" style={{ color: 'var(--text-1)' }}>Todo el inventario está en buen nivel</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>No hay productos por debajo del stock mínimo</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                  {lowStock.length} producto{lowStock.length !== 1 ? 's' : ''} con stock bajo o agotado
                </span>
              </div>
              {lowStock.map(p => {
                const isOut = (p.stock ?? 0) <= 0;
                return (
                  <div key={p.id} className="rv-card p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ background: isOut ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }}>
                      {isOut ? '🚫' : '⚠️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{p.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {centers.find(c => c.id === p.revenue_center_id)?.name || '—'} · {p.category}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold" style={{ color: isOut ? '#EF4444' : '#F59E0B' }}>
                        {p.stock ?? 0} u.
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-3)' }}>mín: {p.min_stock || 0}</div>
                    </div>
                    <StockEditor product={p} onSave={updateStock} />
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {showNew && centers.length > 0 && (
        <NewProductModal centers={centers} onClose={() => setShowNew(false)} onSave={createProduct} />
      )}
      {showNew && centers.length === 0 && (
        <div className="rv-card text-center py-8">
          <p style={{ color: 'var(--text-3)' }}>Primero configura centros de revenue en POS Terminal</p>
          <button onClick={() => setShowNew(false)} className="rv-btn-ghost mt-3">Cerrar</button>
        </div>
      )}
    </div>
  );
}
