"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

const PRIMARY_COLOR = '#2563EB'; // blue-600
const INCOME_COLOR = '#1E40AF'; // indigo-800
const EXPENSE_COLOR = '#1E3A8A'; // blue-900

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
        const d = new Date(txn.date);
        return `${d.getFullYear()}-${d.getMonth()}` === selectedMonth;
      });
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(txn => 
        txn.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, filterType, searchQuery, selectedMonth]);

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
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
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
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
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
      category: transaction.category._id,
      date: new Date(transaction.date).toISOString().split('T')[0],
      notes: transaction.notes || '',
    });
    setShowEditModal(true);
  };

  const handleDelete = async (transactionId) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) return;

    try {
      const token = localStorage.getItem('token');
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
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
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header + Date range pill (matches screenshot) */}
        <div className="mb-6 text-center">
                      <h1 className="text-2xl mb-4 font-semibold text-gray-900">รายการ</h1>

          <div className="w-full max-w-xs mx-auto bg-white rounded-2xl px-6 py-3 shadow-md border border-gray-100 flex items-center justify-between">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMonthMenuOpen(prev => !prev)}
                onBlur={() => setTimeout(() => setMonthMenuOpen(false), 120)}
                className="flex items-center gap-3 text-base font-semibold text-gray-900 bg-white outline-none"
              >
                <span>{selectedMonth ? (monthOptions.find(m => m.key === selectedMonth)?.label || 'ทุกเดือน') : 'ทุกเดือน'}</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>

              {monthMenuOpen && (
                <div className="absolute left-1/2 top-full mt-2 transform -translate-x-1/2 w-[36rem] max-w-[90vw] bg-white rounded-none shadow-md border border-gray-100 overflow-hidden z-50">
                  <div className="py-1">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setSelectedMonth(''); setMonthMenuOpen(false); }}
                      className={`block w-full text-left px-4 py-3 text-sm ${selectedMonth === '' ? 'bg-sky-50 text-sky-700 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      ทุกเดือน
                    </button>
                    {monthOptions.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setSelectedMonth(opt.key); setMonthMenuOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between ${selectedMonth === opt.key ? 'bg-sky-50 text-sky-700 font-semibold' : 'hover:bg-gray-50'}`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {selectedMonth === opt.key && (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: PRIMARY_COLOR }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
          </div>
        </div>

        {/* Summary cards removed */}

        {/* Filters & Search (styled like screenshot) */}
        <div className="mb-6 flex flex-col items-center">
          <div className="w-full max-w-7xl bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-800 mb-3">คัดกรองประเภทรายการ</div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${filterType === 'all' ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 border border-gray-100'}`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={`px-3 py-2 rounded-full text-sm font-semibold ${filterType === 'expense' ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 border border-gray-100'}`}
                >
                  รายจ่าย
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={`px-3 py-2 rounded-full text-sm font-semibold ${filterType === 'income' ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 border border-gray-100'}`}
                >
                  รายรับ
                </button>
              </div>

              <div className="mt-3">
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="เลือกหลายรายการ หรือ ค้นหา..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-100 bg-white text-sm placeholder-gray-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <button
                onClick={exportToCSV}
                className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm"
                title="ส่งออก"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12m0 0l-4-4m4 4l4-4M21 21H3"/></svg>
              </button>
            </div>
          </div>

        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <p className="text-red-700 font-medium text-sm">{error}</p>
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block w-10 h-10 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: PRIMARY_COLOR }}></div>
              <p className="text-gray-500 mt-4">กำลังโหลด...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-20 h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-gray-500 text-lg font-medium">ไม่พบธุรกรรม</p>
              <p className="text-gray-400 text-sm mt-1">ลองเปลี่ยนตัวกรองหรือเพิ่มรายการใหม่</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTransactions.map((txn) => (
                <div
                  key={txn._id}
                  className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                >
                  {/* Left */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-md"
                      style={{
                        background: txn.type === 'income'
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      }}
                    >
                      {txn.type === 'income' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"/>
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {txn.category?.name || 'ไม่ระบุ'}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {new Date(txn.date).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {txn.notes && <span className="hidden sm:inline">• {txn.notes}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-4">
                    <div className="text-xl font-bold text-gray-900">
                      {txn.type === 'expense' ? '-' : '+'}{txn.amount.toLocaleString()} ฿
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(txn)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                        title="แก้ไข"
                      >
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(txn._id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                        title="ลบ"
                      >
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Edit Modal */}
      {showEditModal && editingTransaction && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slideUp">
            <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white p-6 overflow-hidden">
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">หมายเหตุ</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all resize-none"
                  placeholder="เพิ่มรายละเอียด..."
                />
              </div>

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
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
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
