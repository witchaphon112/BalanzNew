"use client";
import { useState, useEffect, useMemo } from 'react';

// Utility for formatting currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount);
};

export default function BudgetManager({ onClose }) {
  // --- State ---
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({}); // Map: { "Month Year": { categoryId: amount } }
  const [monthlyBudget, setMonthlyBudget] = useState({}); // Map: { "Month Year": totalAmount }
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [editMonthlyAmount, setEditMonthlyAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(12);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('expense'); // 'expense' or 'income'
  
  // Modal State for Editing
  const [editingCategory, setEditingCategory] = useState(null); // The category object being edited
  const [editAmount, setEditAmount] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const iconOptions = ['🍽️','🍩','🧴','🚗','🏠','🎬','🛒','🏥','📚','💰','📈','🎁','🏦','🌐','💡','🎯'];

  // --- Date Logic ---
  const months = useMemo(() => {
    const m = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() + 543;
    const currentMonth = currentDate.getMonth();
    
    for (let i = -12; i <= 12; i++) {
      const monthIndex = (currentMonth + i + 12) % 12;
      const yearOffset = Math.floor((currentMonth + i) / 12);
      const year = currentYear + yearOffset;
      const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
      m.push(`${monthNames[monthIndex]} ${year}`);
    }
    return m;
  }, []);

  const selectedMonth = months[currentMonthIndex];

  // --- Data Fetching ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        
        // Parallel Fetching for speed


        const [catRes, budgetRes, transRes, totalRes] = await Promise.all([
          fetch('http://localhost:5050/api/categories', { headers }),
          fetch('http://localhost:5050/api/budgets', { headers }),
          fetch('http://localhost:5050/api/transactions', { headers }),
          fetch('http://localhost:5050/api/budgets/total', { headers })
        ]);

        // Helper: parse JSON safely
        const safeJson = async (res) => {
          try {
            const text = await res.text();
            return JSON.parse(text);
          } catch {
            return [];
          }
        };

        const cats = await safeJson(catRes);
        const buds = await safeJson(budgetRes);
        const trans = await safeJson(transRes);
        const totalBudgets = await safeJson(totalRes);

        // Debug logging for budgets response
        try {
          console.log('GET /api/budgets response', { ok: budgetRes.ok, status: budgetRes.status, parsed: buds });
        } catch (e) {
          console.warn('Failed to log budgets response', e);
        }

        if (catRes.ok) setCategories(cats);

        if (budgetRes.ok) {
          const budgetMap = {};
          buds.forEach(b => {
             if (!budgetMap[b.month]) budgetMap[b.month] = {};
             const catId = typeof b.category === 'object' ? b.category._id : b.category;
             budgetMap[b.month][catId] = b.total;
          });
          setBudgets(budgetMap);
        }

        if (transRes.ok) setTransactions(trans);

        // สมมติ totalBudgets เป็น [{ month: '...', total: 10000 }, ...]
        if (Array.isArray(totalBudgets)) {
          const map = {};
          totalBudgets.forEach(tb => { map[tb.month] = tb.total; });
          setMonthlyBudget(map);
        }

      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

    // --- Process Data for Display ---
    // Combine Categories + Budgets + Transactions for the selected month
    const processedData = useMemo(() => {
    const currentMonthTrans = transactions.filter(t => t.type === selectedType);
    let totalBudget = 0;
    let totalSpent = 0;
    const list = categories
      .filter(c => c.type === selectedType)
      .map(cat => {
      const budgetAmount = budgets[selectedMonth]?.[cat._id] || 0;
      const spentAmount = currentMonthTrans
        .filter(t => {
          const catVal = t.category && typeof t.category === 'object' ? t.category._id : t.category;
          return catVal === cat._id;
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      totalBudget += budgetAmount;
      totalSpent += spentAmount;
      const percent = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
      return {
        ...cat,
        budget: budgetAmount,
        spent: spentAmount,
        remaining: budgetAmount - spentAmount,
        percent: Math.min(percent, 100),
        isOverBudget: spentAmount > budgetAmount
      };
    });
    // งบรวมต่อเดือน (monthlyBudget) จะถูกใช้ใน summary card
    return {
      items: list.sort((a, b) => b.budget - a.budget),
      summary: {
        totalBudget,
        totalSpent,
        remaining: (monthlyBudget[selectedMonth] ?? totalBudget) - totalSpent,
        monthly: monthlyBudget[selectedMonth] ?? 0
      }
    };
    }, [categories, budgets, transactions, selectedMonth, monthlyBudget, selectedType]);


  // --- Handlers ---
    // Debug: log budgets/categories/month when they change
    useEffect(() => {
      try {
        console.log('BudgetManager debug:', {
          selectedMonth,
          budgetMonths: Object.keys(budgets || {}),
          categoriesCount: (categories || []).length,
        });
      } catch (e) {
        // noop
      }
    }, [budgets, categories, selectedMonth]);
  const openEditModal = (category) => {
    setEditingCategory(category);
    setEditAmount(category.budget === 0 ? '' : category.budget.toString());
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const total = parseFloat(editAmount) || 0;

    try {
      const res = await fetch('http://localhost:5050/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: editingCategory._id, month: selectedMonth, total }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save budget');
      }

      // Prefer using the created/updated budget returned by the server to update UI immediately.
      // This keeps the UI consistent even if a subsequent full re-fetch fails (e.g., auth issues).
      try {
        const saved = await res.json();
        const savedMonth = saved.month || selectedMonth;
        const savedCatId = typeof saved.category === 'object' ? saved.category._id : saved.category;
        const savedTotal = saved.total != null ? saved.total : total;
        setBudgets(prev => ({
          ...prev,
          [savedMonth]: {
            ...(prev[savedMonth] || {}),
            [savedCatId]: savedTotal
          }
        }));
      } catch (err) {
        // if parsing fails, fall back to optimistic update
        setBudgets(prev => ({
          ...prev,
          [selectedMonth]: {
            ...(prev[selectedMonth] || {}),
            [editingCategory._id]: total
          }
        }));
      }

      setEditingCategory(null);
    } catch (error) {
      console.error('Save budget error', error);
      alert('ไม่สามารถบันทึกงบได้: ' + (error.message || 'ข้อผิดพลาดจากเซิร์ฟเวอร์'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col animate-fadeIn font-sans">
      {/* Top header */}
      <div className="bg-white shadow-sm px-4 pt-4 pb-3 rounded-b-2xl z-10 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between">
          <button onClick={() => window.history.back()} className="p-2 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h2 className="text-lg font-bold text-slate-800">จัดการหมวดและงบ</h2>
           <button onClick={onClose} className="p-2 text-slate-500">
          </button>
        </div>

        <div className="mt-3 bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">รอบตัดงบ</p>
            <p className="font-semibold">รายเดือน (วันที่ 1)</p>
          </div>
          <button onClick={() => alert('ตั้งค่า')} className="inline-flex items-center gap-2 px-3 py-2 border rounded-xl text-sm text-slate-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5h2M12 7v2M12 11v6M7 12h10"/></svg>
            ตั้งค่า
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedType('expense')}
              className={`px-4 py-2 rounded-xl border-2 font-semibold ${selectedType === 'expense' ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              รายจ่าย
            </button>
            <button
              onClick={() => setSelectedType('income')}
              className={`px-4 py-2 rounded-xl border-2 font-semibold ${selectedType === 'income' ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              รายรับ
            </button>
          </div>
          <button className="px-3 py-2 bg-white border rounded-lg inline-flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16"/></svg>
            จัดเรียง
          </button>
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-lg mx-auto w-full">
        {isLoading ? (
          <div className="text-center py-10 text-slate-400">กำลังโหลดข้อมูล...</div>
        ) : (
          processedData.items.map((cat) => (
            <div 
              key={cat._id}
              onClick={() => openEditModal(cat)}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${cat.budget > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                  {cat.icon || '🏷️'}
                </div>
                <div>
                  <div className="font-bold text-slate-800">{cat.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-500">งบ</div>
                <div className="font-semibold text-slate-800">{cat.budget > 0 ? formatCurrency(cat.budget) : '-'}</div>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          ))
        )}

        <div className="h-6" />

        <div className="px-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700"
          >
            + เพิ่มหมวด{selectedType === 'expense' ? 'รายจ่าย' : 'รายรับ'}
          </button>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-800">เพิ่มหมวดใหม่</h3>
                <p className="text-sm text-slate-500 mt-1">{selectedType === 'expense' ? 'ประเภท: รายจ่าย' : 'ประเภท: รายรับ'}</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const token = localStorage.getItem('token');
              if (!token) { alert('กรุณาเข้าสู่ระบบ'); return; }
              try {
                setAddCategoryLoading(true);
                const res = await fetch('http://localhost:5050/api/categories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ name: newCategoryName, icon: newCategoryIcon || '🌐', type: selectedType })
                });
                if (!res.ok) {
                  const text = await res.text();
                  throw new Error(text || 'ไม่สามารถสร้างหมวดได้');
                }
                // re-fetch categories
                const headers = { Authorization: `Bearer ${token}` };
                const catRes = await fetch('http://localhost:5050/api/categories', { headers });
                if (catRes.ok) {
                  const cats = await catRes.json();
                  setCategories(cats);
                }
                setShowAddModal(false);
                setNewCategoryName('');
                setNewCategoryIcon('');
              } catch (err) {
                console.error('Create category error', err);
                alert('ไม่สามารถสร้างหมวดได้: ' + (err.message || 'ข้อผิดพลาด'));
              } finally {
                setAddCategoryLoading(false);
              }
            }} className="mt-5">
              <label className="block text-xs font-semibold text-slate-700 mb-2">ชื่อหมวด</label>
              <input
                className="w-full mb-4 p-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
                placeholder="เช่น อาหาร, เงินเดือน"
              />

              <label className="block text-xs font-semibold text-slate-700 mb-3">เลือกไอคอน</label>
              <div className="grid grid-cols-8 gap-2 mb-3">
                {iconOptions.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setNewCategoryIcon(ic)}
                    className={`py-2 rounded-lg flex items-center justify-center text-lg border ${newCategoryIcon === ic ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                    {ic}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewCategoryIcon('')}
                  className={`py-2 rounded-lg flex items-center justify-center text-sm border ${newCategoryIcon === '' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  ล้าง
                </button>
              </div>

              <label className="block text-xs font-semibold text-slate-700 mb-2">ไอคอน (กำหนดเอง หากต้องการ)</label>
              <input
                className="w-full mb-6 p-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300"
                value={newCategoryIcon}
                onChange={(e) => setNewCategoryIcon(e.target.value)}
                placeholder="พิมพ์ไอคอนเพื่อใช้แทน (เช่น 🍽️)"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 bg-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={addCategoryLoading || !newCategoryName.trim()}
                  className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold shadow-md hover:bg-blue-600"
                >
                  {addCategoryLoading ? 'กำลังบันทึก...' : 'เพิ่ม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit Budget Bottom Sheet / Modal */}
        {editingCategory && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingCategory(null)}>
          <div 
            className="bg-white w-full max-w-xs p-4 rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-xl">
                {editingCategory.icon || '🏷️'}
              </div>
              <div>
                <p className="text-slate-500 text-xs">ตั้งงบประมาณสำหรับ</p>
                <h3 className="text-lg font-bold text-slate-800">{editingCategory.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedMonth}</p>
              </div>
            </div>

            <form onSubmit={handleSaveBudget}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">วงเงินที่ต้องการ (บาท)</label>
              <div className="relative mb-6">
                <input 
                  type="number" 
                  className="w-full text-2xl font-bold text-slate-800 border-b-2 border-slate-200 py-1.5 focus:border-[#299D91] outline-none bg-transparent placeholder-slate-300"
                  placeholder="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  autoFocus
                />
                <span className="absolute right-0 bottom-2 text-slate-400">THB</span>
              </div>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setEditingCategory(null)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
        )}
    </div>
  );
}