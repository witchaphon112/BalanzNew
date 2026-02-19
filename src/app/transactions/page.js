"use client";
import { useState, useEffect, useMemo } from 'react';
import ExportButton from '../../components/ExportButton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
const PRIMARY_COLOR = '#2563EB'; // blue-600

// Utility: format numbers (Thai locale)
const formatCurrency = (v) => {
  if (typeof v !== 'number') return v;
  try { return new Intl.NumberFormat('th-TH').format(v); } catch { return String(v); }
};

const toYearMonthKey = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}`;
};

const toLocalISODateKey = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getTxnCategoryId = (txn) => {
  if (!txn?.category) return '';
  return typeof txn.category === 'object' ? (txn.category._id || '') : txn.category;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, income, expense
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // format: `${year}-${monthIndex}`
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    date: '',
    notes: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    fetchTransactions(token);
    fetchCategories(token);
  }, []);

  useEffect(() => {
    let filtered = transactions;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(txn => txn.type === filterType);
    }

    // Filter by selected month (year-month key)
    if (selectedMonth) {
      filtered = filtered.filter(txn => {
        return toYearMonthKey(txn.date) === selectedMonth;
      });
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(txn => 
        (txn.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (txn.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (filterCategory && filterCategory !== 'all') {
      if (filterCategory === 'other') {
        const knownIds = new Set((categories || []).map(c => c._id));
        filtered = filtered.filter(txn => {
          const id = getTxnCategoryId(txn);
          return !id || !knownIds.has(id);
        });
      } else {
        filtered = filtered.filter(txn => getTxnCategoryId(txn) === filterCategory);
      }
    }

    setFilteredTransactions(filtered);
  }, [transactions, filterType, searchQuery, selectedMonth, filterCategory, categories]);

  // Export filtered transactions to CSV (Excel-compatible)
  const exportToCSV = () => {
    try {
      if (!filteredTransactions || filteredTransactions.length === 0) {
        alert('ไม่มีรายการให้ส่งออก');
        return;
      }
      const headers = ['วันที่', 'ประเภท', 'หมวดหมู่', 'จำนวนเงิน', 'หมายเหตุ'];
      const rows = filteredTransactions.map(t => [
        new Date(t.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
        t.type,
        t.category?.name || '',
        t.amount,
        (t.notes || '').replace(/\n/g, ' ')
      ]);

      const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export CSV error', err);
      alert('เกิดข้อผิดพลาดในการส่งออก');
    }
  };

  const fetchTransactions = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      
      const data = await res.json();
      const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(sorted);
      setFilteredTransactions(sorted);
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setEditFormData({
      amount: transaction.amount,
      type: transaction.type,
      category: typeof transaction.category === 'object' ? transaction.category._id : transaction.category,
      date: new Date(transaction.date).toISOString().split('T')[0],
      notes: transaction.notes || '',
    });
    setShowEditModal(true);
  };

  const handleDelete = async (transactionId) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete');
      
      fetchTransactions(token);
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!editFormData.amount || parseFloat(editFormData.amount) <= 0) {
      setError('กรุณากรอกจำนวนเงินที่มากกว่า 0');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/transactions/${editingTransaction._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editFormData,
          amount: parseFloat(editFormData.amount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'เกิดข้อผิดพลาด');

      setShowEditModal(false);
      setEditingTransaction(null);
      fetchTransactions(token);
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netTotal = totalIncome - totalExpenses;

  const formatTimeHHmm = (dateInput) => {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderTxnIcon = (txn) => {
    const raw = txn?.category?.icon;
    if (typeof raw === 'string' && raw.trim()) {
      return <span className="text-xl leading-none">{raw}</span>;
    }
    return txn?.type === 'income' ? (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    ) : (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    );
  };

  const getGroupDateLabel = (isoKey) => {
    try {
      const d = new Date(isoKey);
      if (Number.isNaN(d.getTime())) return isoKey;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const todayKey = toLocalISODateKey(today);
      const yesterdayKey = toLocalISODateKey(yesterday);

      if (isoKey === todayKey) return 'วันนี้ (Today)';
      if (isoKey === yesterdayKey) return 'เมื่อวาน (Yesterday)';

      const th = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      const en = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      return `${th} (${en})`;
    } catch {
      return isoKey;
    }
  };

  // Build month options as ranges (e.g. "1 ก.พ. - 28 ก.พ. 2569")
  const monthOptions = (() => {
    const map = new Map();
    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) map.set(key, { year: d.getFullYear(), month: d.getMonth() });
    });

    return Array.from(map.keys())
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        const d = new Date(y, m, 1);
        const monthShort = d.toLocaleDateString('th-TH', { month: 'short' });
        const yearThai = d.toLocaleDateString('th-TH', { year: 'numeric' });
        const endDay = new Date(y, m + 1, 0).getDate();
        const label = `1 ${monthShort} - ${endDay} ${monthShort} ${yearThai}`;
        return { key, label, y, m };
      })
      .sort((a, b) => (b.y * 12 + b.m) - (a.y * 12 + a.m));
  })();

  // Group filtered transactions by ISO date (yyyy-mm-dd) for daily headers and totals
  const groupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(txn => {
      const key = toLocalISODateKey(txn.date);
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(txn);
    });

    return Object.keys(groups)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(key => {
        const items = groups[key];
        const dateLabel = getGroupDateLabel(key);
        const net = items.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
        return { key, dateLabel, items, net };
      });
  }, [filteredTransactions]);

  const displayedCategories = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    if (filterType === 'all') return categories;
    return categories.filter(c => c.type === filterType);
  }, [categories, filterType]);

  return (
    <main className="h-[100dvh] bg-slate-50 overflow-hidden">
      <div className="mx-auto w-full max-w-lg h-full flex flex-col">
        {/* Sticky header */}
        <div className="shrink-0 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
          <div className="px-4 pt-4 pb-3">
            <div className="relative flex items-center justify-between gap-3">
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center max-w-[70%]">
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">ธุรกรรม</div>
                <h1 className="truncate text-lg font-extrabold text-slate-900">รายการ</h1>
              </div>

              <div className="ml-auto shrink-0">
                <ExportButton
                  onClick={exportToCSV}
                  className="flex-row gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus-visible:ring-blue-200"
                />
              </div>
            </div>

          <div className="mt-4 rounded-3xl border border-slate-200/60 bg-white p-3 shadow-sm">
            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหา: หมวด หรือ หมายเหตุ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="button"
                onClick={() => setMonthMenuOpen(true)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                aria-label="เลือกช่วงเวลา"
                title="เลือกช่วงเวลา"
              >
                <svg className="h-5 w-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            {/* Type pills */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { key: 'all', label: 'ทั้งหมด' },
                { key: 'expense', label: 'รายจ่าย' },
                { key: 'income', label: 'รายรับ' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilterType(opt.key)}
                  className={[
                    'shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition',
                    filterType === opt.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Category pills */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={[
                  'shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition',
                  filterCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                ].join(' ')}
              >
                ทั้งหมด
              </button>
              {displayedCategories.slice(0, 12).map(cat => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setFilterCategory(cat._id)}
                  className={[
                    'shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition',
                    filterCategory === cat._id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  ].join(' ')}
                >
                  {cat.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilterCategory('other')}
                className={[
                  'shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition',
                  filterCategory === 'other'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                ].join(' ')}
              >
                อื่นๆ
              </button>
            </div>
          </div>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm font-semibold">{error}</p>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="overflow-hidden">
	          {loading ? (
	            <div className="space-y-3">
	              {[...Array(6)].map((_, i) => (
	                <div key={i} className="loading rounded-2xl border border-slate-200/60 bg-white shadow-sm">
	                  <div className="flex items-center gap-4 px-4 py-4">
	                    <div className="h-11 w-11 rounded-2xl bg-slate-100" />
	                    <div className="min-w-0 flex-1">
	                      <div className="h-3 w-1/3 rounded bg-slate-100" />
	                      <div className="mt-2 h-2 w-1/2 rounded bg-slate-100" />
	                    </div>
	                    <div className="flex flex-col items-end gap-2">
	                      <div className="h-3 w-20 rounded bg-slate-100" />
	                      <div className="h-2 w-12 rounded bg-slate-100" />
	                    </div>
	                  </div>
	                </div>
	              ))}
	            </div>
	          ) : groupedTransactions.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-2xl">
                🧾
              </div>
              <p className="text-slate-900 text-lg font-extrabold">ไม่พบธุรกรรม</p>
              <p className="text-slate-500 text-sm font-semibold mt-1">ลองเปลี่ยนตัวกรอง หรือเพิ่มรายการใหม่</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => { setFilterType('all'); setFilterCategory('all'); setSelectedMonth(''); setSearchQuery(''); }}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  ล้างตัวกรอง
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedTransactions.map(group => (
                <div key={group.key}>
                  <div className="flex items-center justify-between px-1">
                    <div className="text-base font-extrabold text-slate-900">{group.dateLabel}</div>
                    <div className={`text-sm font-extrabold ${group.net < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      รวม: {group.net < 0 ? '-' : '+'}฿{formatCurrency(Math.abs(group.net))}
                    </div>
                  </div>

                  <div className="mt-2 space-y-3">
                    {group.items.map(txn => (
                      <button
                        key={txn._id}
                        type="button"
                        onClick={() => handleEdit(txn)}
                        className="w-full rounded-3xl border border-slate-200/60 bg-white p-4 text-left shadow-sm hover:shadow-md transition active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={[
                              'h-12 w-12 rounded-3xl flex items-center justify-center shrink-0',
                              txn.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                            ].join(' ')}
                            aria-hidden="true"
                          >
                            {renderTxnIcon(txn)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-base font-extrabold text-slate-900">
                                  {(txn.notes && txn.notes.trim()) ? txn.notes : (txn.category?.name || 'ไม่ระบุ')}
                                </div>
                                <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                                  {(txn.category?.name || 'ไม่ระบุ')} • {formatTimeHHmm(txn.date) || '—'}
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <div className={`text-base font-extrabold ${txn.type === 'expense' ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {txn.type === 'expense' ? '-' : '+'}฿{formatCurrency(txn.amount)}
                                </div>
                                <div className="mt-1 flex items-center justify-end gap-1 text-slate-400">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-24" />
        </div>
      </div>

      {/* Month Picker Bottom Sheet */}
      {monthMenuOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setMonthMenuOpen(false)}>
          <div
            className="bg-white w-full max-w-md p-5 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slideUp border border-slate-200/60"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">ช่วงเวลา</div>
                <div className="text-lg font-extrabold text-slate-900">เลือกเดือน</div>
              </div>
              <button
                type="button"
                onClick={() => setMonthMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="ปิด"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => { setSelectedMonth(''); setMonthMenuOpen(false); }}
                className={`block w-full px-4 py-3 text-left text-sm font-semibold ${selectedMonth === '' ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                ทุกเดือน
              </button>
              {monthOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { setSelectedMonth(opt.key); setMonthMenuOpen(false); }}
                  className={`w-full px-4 py-3 text-left text-sm font-semibold flex items-center justify-between gap-3 ${selectedMonth === opt.key ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {selectedMonth === opt.key && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: PRIMARY_COLOR }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingTransaction && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slideUp border border-slate-200/60" role="dialog" aria-modal="true">
            <div className="relative bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">แก้ไขรายการ</h2>
                    <p className="text-white/80 text-sm">อัปเดตข้อมูลธุรกรรม</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:rotate-90"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

	            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-120px)]">
              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-red-700 font-medium text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ประเภท</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditFormData(prev => ({
                      ...prev,
                      type: 'income',
                      category: categories.find(cat => cat.type === 'income')?._id || prev.category
                    }))}
                    className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                      editFormData.type === 'income'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    รายรับ
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormData(prev => ({
                      ...prev,
                      type: 'expense',
                      category: categories.find(cat => cat.type === 'expense')?._id || prev.category
                    }))}
                    className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                      editFormData.type === 'expense'
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    รายจ่าย
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">จำนวนเงิน</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 outline-none transition-all"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">฿</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">หมวดหมู่</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 outline-none transition-all"
                  required
                >
                  {categories
                    .filter(cat => cat.type === editFormData.type)
                    .map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">วันที่</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 outline-none transition-all"
                  required
                />
              </div>

	              <div>
	                <label className="block text-sm font-semibold text-gray-700 mb-2">หมายเหตุ</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 outline-none transition-all resize-none"
                  placeholder="เพิ่มรายละเอียด..."
	                />
	              </div>

                <button
                  type="button"
                  onClick={() => handleDelete(editingTransaction._id)}
                  className="w-full rounded-xl border-2 border-rose-200 bg-rose-50 px-6 py-3 text-rose-700 font-extrabold hover:bg-rose-100 transition-colors"
                >
                  ลบรายการนี้
                </button>

	              <div className="flex gap-3 pt-2">
	                <button
	                  type="button"
	                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
