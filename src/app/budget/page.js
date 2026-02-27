"use client";
import { useState, useEffect, useMemo } from 'react';

// Utility for formatting currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount);
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const monthNamesTH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const monthLabelFromDate = (dateInput) => {
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '';
    return `${monthNamesTH[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return '';
  }
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));

const monthIndexFromThaiName = (thaiMonth) => {
  if (!thaiMonth) return -1;
  return monthNamesTH.findIndex((m) => m === thaiMonth);
};

const parseThaiMonthLabel = (label) => {
  // Expected: "มกราคม 2569" (Buddhist year)
  if (!label || typeof label !== 'string') return null;
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const monthIdx = monthIndexFromThaiName(parts[0]);
  const buddhistYear = Number(parts[1]);
  if (monthIdx < 0 || !Number.isFinite(buddhistYear)) return null;
  return { monthIndex: monthIdx, year: buddhistYear - 543 };
};

const buildSmoothSvgPath = (points) => {
  if (!Array.isArray(points) || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 2; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  d += ` Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`;
  return d;
};

const POPULAR_CATEGORY_PRESETS = {
  expense: [
    { name: 'อาหาร', icon: '🍽️' },
    { name: 'กาแฟ', icon: '☕' },
    { name: 'เดินทาง', icon: '🚌' },
    { name: 'ช้อปปิ้ง', icon: '🛍️' },
    { name: 'ผ่อนรถ', icon: '🚗' },
    { name: 'Subscriptions', icon: '📦' },
    { name: 'ผ่อนบ้าน', icon: '🏠' },
    { name: 'อินเตอร์เน็ต', icon: '📶' },
  ],
  income: [
    { name: 'เงินเดือน', icon: '💰' },
    { name: 'โบนัส', icon: '🎁' },
    { name: 'รายได้เสริม', icon: '💼' },
    { name: 'ลงทุน', icon: '📈' },
    { name: 'คืนเงิน', icon: '💸' },
    { name: 'อื่นๆ', icon: '🌐' },
  ],
};

export default function BudgetManager({ onClose, initialType = 'expense' }) {
  const normalizedInitialType = initialType === 'income' ? 'income' : 'expense';
  // --- State ---
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({}); // Map: { "Month Year": { categoryId: amount } }
  const [monthlyBudget, setMonthlyBudget] = useState({}); // Map: { "Month Year": totalAmount }
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [editMonthlyAmount, setEditMonthlyAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(12);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(normalizedInitialType); // 'expense' or 'income'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempMonthIndex, setTempMonthIndex] = useState(12);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState(() => {
    try {
      if (typeof window === 'undefined') return 'budget_desc';
      return localStorage.getItem('budget_sort_by') || 'budget_desc';
    } catch {
      return 'budget_desc';
    }
  });

  useEffect(() => {
    setSelectedType(normalizedInitialType);
  }, [normalizedInitialType]);
  
  // Modal State for Editing
  const [editingCategory, setEditingCategory] = useState(null); // The category object being edited
  const [editAmount, setEditAmount] = useState('');
  const [showQuickBudgetModal, setShowQuickBudgetModal] = useState(false);
  const [quickBudgetCategoryId, setQuickBudgetCategoryId] = useState('');
  const [quickBudgetAmount, setQuickBudgetAmount] = useState('');
  const [quickBudgetLoading, setQuickBudgetLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resumeQuickBudgetAfterAdd, setResumeQuickBudgetAfterAdd] = useState(false);
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
      m.push(`${monthNamesTH[monthIndex]} ${year}`);
    }
    return m;
  }, []);

  const selectedMonth = months[currentMonthIndex];

  const budgetSparkline = useMemo(() => {
    const parsed = parseThaiMonthLabel(selectedMonth);
    if (!parsed) return null;
    const { year, monthIndex } = parsed;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) return null;

    const daily = new Array(daysInMonth).fill(0);
    for (const t of transactions || []) {
      if (!t || t.type !== selectedType) continue;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const day = d.getDate();
      if (day < 1 || day > daysInMonth) continue;
      const amt = Number(t.amount) || 0;
      daily[day - 1] += Math.max(0, amt);
    }

    let running = 0;
    const cumulative = daily.map((v) => (running += v));
    const max = Math.max(0, ...cumulative);
    if (max <= 0) return null;

    const W = 100;
    const H = 40;
    const pad = 4;
    const usableH = H - pad * 2;
    const sampleCount = Math.min(14, cumulative.length);
    const denom = Math.max(1, sampleCount - 1);

    const points = [];
    for (let i = 0; i < sampleCount; i++) {
      const x = (i / denom) * W;
      const idx = Math.round((i / denom) * (cumulative.length - 1));
      const v = cumulative[idx] || 0;
      const y = pad + (1 - v / max) * usableH;
      points.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    }

    const dPath = buildSmoothSvgPath(points);
    if (!dPath) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = `${dPath} L ${last.x} ${H} L ${first.x} ${H} Z`;
    return { dPath, areaPath };
  }, [selectedMonth, transactions, selectedType]);

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
          fetch(`${API_BASE}/api/categories`, { headers }),
          fetch(`${API_BASE}/api/budgets`, { headers }),
          fetch(`${API_BASE}/api/transactions`, { headers }),
          fetch(`${API_BASE}/api/budgets/total`, { headers })
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
	             const month = b?.month;
	             if (!month) return;
	             if (!budgetMap[month]) budgetMap[month] = {};
	             const catId = (b?.category && typeof b.category === 'object')
	               ? (b.category?._id || '')
	               : (b?.category || '');
	             if (!catId) return;
	             budgetMap[month][catId] = b?.total ?? 0;
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

  useEffect(() => {
    try {
      localStorage.setItem('budget_sort_by', sortBy);
    } catch {
      // ignore
    }
  }, [sortBy]);

    // --- Process Data for Display ---
    // Combine Categories + Budgets + Transactions for the selected month
    const processedData = useMemo(() => {
    const currentMonthTrans = transactions.filter(t => {
      if (t.type !== selectedType) return false;
      return monthLabelFromDate(t.date) === selectedMonth;
    });
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
    const collator = new Intl.Collator('th-TH', { sensitivity: 'base', numeric: true });
    const sortedItems = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'budget_asc':
          return a.budget - b.budget;
        case 'name_asc':
          return collator.compare(a.name || '', b.name || '');
        case 'name_desc':
          return collator.compare(b.name || '', a.name || '');
        case 'spent_desc':
          return b.spent - a.spent;
        case 'remaining_desc':
          return b.remaining - a.remaining;
        case 'budget_desc':
        default:
          return b.budget - a.budget;
      }
    });
    // งบรวมต่อเดือน (monthlyBudget) จะถูกใช้ใน summary card
    const overallMonthly = monthlyBudget[selectedMonth] ?? 0;
    return {
      items: sortedItems,
      summary: {
        totalBudget,
        totalSpent,
        remaining: totalBudget - totalSpent,
        monthly: totalBudget,
        overallMonthly
      }
    };
    }, [categories, budgets, transactions, selectedMonth, monthlyBudget, selectedType, sortBy]);


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
      const res = await fetch(`${API_BASE}/api/budgets`, {
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

  const openSettings = () => {
    setIsSortOpen(false);
    setEditingCategory(null);
    setShowQuickBudgetModal(false);
    setShowAddModal(false);
    setResumeQuickBudgetAfterAdd(false);
    setTempMonthIndex(currentMonthIndex);
    setIsSettingsOpen(true);
  };

  const closeAddCategoryModal = () => {
    setShowAddModal(false);
    setNewCategoryName('');
    setNewCategoryIcon('');
    if (resumeQuickBudgetAfterAdd) {
      setResumeQuickBudgetAfterAdd(false);
      setShowQuickBudgetModal(true);
    }
  };

  const typeLabel = selectedType === 'expense' ? 'รายจ่าย' : 'รายรับ';
  const summaryProgress = processedData.summary.monthly > 0
    ? clamp01(processedData.summary.totalSpent / processedData.summary.monthly)
    : 0;

  const openQuickBudget = () => {
    setIsSortOpen(false);
    setIsSettingsOpen(false);
    setEditingCategory(null);
    setShowAddModal(false);
    const firstCat = (categories || []).find(c => c.type === selectedType);
    setQuickBudgetCategoryId(firstCat?._id || '');
    setQuickBudgetAmount('');
    setShowQuickBudgetModal(true);
  };

  const handleClose = () => {
    if (typeof onClose === 'function') onClose();
    else window.history.back();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 font-sans">
      {/* Top / Sticky header (removed sticky wrapper) */}
      <>
        <div className="mx-auto w-full max-w-lg px-4 pb-3">
          <div className="relative flex items-center justify-center">
            <div className="text-center pt-4">
              <div className="text-[11px] font-semibold tracking-wide text-slate-500">จัดการงบ{typeLabel}</div>
              <div className="text-lg font-extrabold text-slate-900">หมวดและงบประมาณ</div>
            </div>
          </div>

          {/* Month + Summary */}
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-full bg-white px-2 py-2 shadow-sm ring-1 ring-blue-200/70">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={currentMonthIndex <= 0}
                    onClick={() => setCurrentMonthIndex(v => Math.max(0, v - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                    aria-label="เดือนก่อนหน้า"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <div className="truncate text-sm font-extrabold text-blue-800">{selectedMonth}</div>
                  </div>
                  <button
                    type="button"
                    disabled={currentMonthIndex >= months.length - 1}
                    onClick={() => setCurrentMonthIndex(v => Math.min(months.length - 1, v + 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                    aria-label="เดือนถัดไป"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={openSettings}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                aria-label="ตั้งค่า"
                title="ตั้งค่า"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H21M10 12H21M10 18H21M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              </button>

              <button
                type="button"
                onClick={openQuickBudget}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700"
                aria-label="เพิ่มงบ"
                title="เพิ่มงบ"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-sm">
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500">งบรวมทั้งหมด</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <div className="text-3xl font-extrabold text-slate-900">{formatCurrency(processedData.summary.monthly)}</div>
                      <div className="text-xs font-bold text-slate-400">THB</div>
                    </div>
                  </div>

                  {processedData.summary.monthly > 0 && (
                    <div
                      className={[
                        'shrink-0 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold',
                        processedData.summary.remaining < 0 ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                      ].join(' ')}
                    >
                      {Math.max(0, Math.round((processedData.summary.totalSpent / processedData.summary.monthly) * 100))}% ใช้ไป
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${processedData.summary.remaining < 0 ? 'bg-rose-500' : 'bg-blue-600'}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, processedData.summary.monthly > 0 ? (processedData.summary.totalSpent / processedData.summary.monthly) * 100 : 0))}%`
                      }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[11px] font-semibold text-slate-500">ใช้ไป</div>
                      <div className="mt-0.5 font-extrabold text-slate-900">{formatCurrency(processedData.summary.totalSpent)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[11px] font-semibold text-slate-500">คงเหลือ</div>
                      <div className={`mt-0.5 font-extrabold ${processedData.summary.remaining < 0 ? 'text-rose-600' : 'text-blue-700'}`}>
                        {formatCurrency(processedData.summary.remaining)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {budgetSparkline && (
                <svg
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full"
                  viewBox="0 0 100 40"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="budgetSparklineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="budgetSparklineStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                      <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.55" />
                    </linearGradient>
                  </defs>

                  <path d={budgetSparkline.areaPath} fill="url(#budgetSparklineFill)" />
                  <path
                    d={budgetSparkline.dPath}
                    fill="none"
                    stroke="url(#budgetSparklineStroke)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            {/* Type toggle + sort */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex rounded-2xl bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setSelectedType('expense')}
                  className={`px-4 py-2 text-sm font-extrabold rounded-2xl transition ${selectedType === 'expense' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  รายจ่าย
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('income')}
                  className={`px-4 py-2 text-sm font-extrabold rounded-2xl transition ${selectedType === 'income' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  รายรับ
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortOpen(v => !v)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
                  aria-haspopup="menu"
                  aria-expanded={isSortOpen}
                >
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16"/></svg>
                  {sortBy === 'name_asc'
                    ? 'ชื่อ A - Z'
                    : sortBy === 'name_desc'
                      ? 'ชื่อ Z - A'
                      : sortBy === 'budget_asc'
                        ? 'งบน้อย → มาก'
                        : sortBy === 'spent_desc'
                          ? 'ใช้มาก → น้อย'
                          : sortBy === 'remaining_desc'
                            ? 'คงเหลือมาก → น้อย'
                            : 'งบมาก → น้อย'}
                </button>

                {isSortOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                    <div className="absolute right-0 mt-2 z-40 w-56 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                      {[
                        { key: 'budget_desc', label: 'งบมาก → น้อย' },
                        { key: 'budget_asc', label: 'งบน้อย → มาก' },
                        { key: 'spent_desc', label: 'ใช้มาก → น้อย' },
                        { key: 'remaining_desc', label: 'คงเหลือมาก → น้อย' },
                        { key: 'name_asc', label: 'ชื่อ A → Z' },
                        { key: 'name_desc', label: 'ชื่อ Z → A' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setSortBy(opt.key);
                            setIsSortOpen(false);
                          }}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${sortBy === opt.key ? 'bg-slate-50' : ''}`}
                          role="menuitem"
                        >
                          <span className="text-slate-700">{opt.label}</span>
                          {sortBy === opt.key && (
                            <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {processedData.summary.overallMonthly > 0 && (
              <div className="mt-3 text-[11px] font-semibold text-slate-500">
                งบรวมทุกหมวดในเดือนนี้: <span className="font-extrabold text-slate-700">{formatCurrency(processedData.summary.overallMonthly)}</span>
              </div>
            )}
          </div>
        </div>
      </>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[52] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md p-5 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">ตั้งค่า</h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-2">เดือนที่ต้องการตั้งงบ</label>
              <select
                className="w-full p-3 border border-slate-200 rounded-2xl text-slate-800 bg-white shadow-sm"
                value={tempMonthIndex}
                onChange={(e) => setTempMonthIndex(parseInt(e.target.value, 10))}
              >
                {months.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={tempMonthIndex <= 0}
                  onClick={() => setTempMonthIndex(v => Math.max(0, v - 1))}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-extrabold text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                >
                  เดือนก่อนหน้า
                </button>
                <button
                  type="button"
                  disabled={tempMonthIndex >= months.length - 1}
                  onClick={() => setTempMonthIndex(v => Math.min(months.length - 1, v + 1))}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-extrabold text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                >
                  เดือนถัดไป
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 font-extrabold text-slate-700 bg-white hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMonthIndex(tempMonthIndex);
                  setIsSettingsOpen(false);
                }}
                className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-extrabold shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 rounded-3xl bg-white shadow-sm">
                <div className="flex h-full items-center gap-4 px-4">
                  <div className="h-11 w-11 rounded-2xl bg-slate-100" />
                  <div className="flex-1">
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                    <div className="mt-2 h-2 w-1/2 rounded bg-slate-100" />
                  </div>
                  <div className="h-3 w-16 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          processedData.items.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-2xl">
                🗂️
              </div>
              <div className="text-base font-extrabold text-slate-900">ยังไม่มีหมวด{typeLabel}</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">กดปุ่มด้านล่างเพื่อเพิ่มหมวดใหม่</div>
            </div>
          ) : (
            <div className="space-y-3">
              {processedData.items.map((cat) => {
                const pct = cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0;
                const progress = cat.budget > 0 ? clamp01(cat.spent / cat.budget) : 0;
                const over = cat.isOverBudget && cat.budget > 0;
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => openEditModal(cat)}
                    className="w-full rounded-3xl bg-white p-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl ${cat.budget > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                          {cat.icon || '🏷️'}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-extrabold text-slate-900">{cat.name}</div>
                          <div className="mt-0.5 text-xs font-semibold text-slate-500">
                            ใช้ไป {formatCurrency(cat.spent)} • คงเหลือ{' '}
                            <span className={cat.remaining < 0 ? 'text-rose-600' : 'text-blue-700'}>
                              {formatCurrency(cat.remaining)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-semibold text-slate-500">งบ</div>
                        <div className="text-base font-extrabold text-slate-900">{cat.budget > 0 ? formatCurrency(cat.budget) : '-'}</div>
                        <div className={`mt-1 text-[11px] font-extrabold ${over ? 'text-rose-600' : 'text-blue-700'}`}>
                          {cat.budget > 0 ? `${Math.max(0, pct)}%` : '—'}
                        </div>
                        {over && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-extrabold text-rose-600">
                            เกินงบ
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${over ? 'bg-rose-500' : progress >= 0.85 ? 'bg-amber-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span className={over ? 'text-rose-600 font-extrabold' : 'text-blue-700 font-extrabold'}>{cat.budget > 0 ? `${Math.max(0, pct)}%` : ''}</span>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          แก้ไข
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        <div className="h-24" />
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeAddCategoryModal}>
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slideUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 pt-3">
              <div className="mx-auto h-1 w-12 rounded-full bg-slate-200" aria-hidden="true" />
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-slate-900">เพิ่มหมวด{typeLabel}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">ตั้งชื่อหมวด และเลือกไอคอนให้สวยงาม</p>
                </div>
                <button
                  type="button"
                  onClick={closeAddCategoryModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const token = localStorage.getItem('token');
              if (!token) { alert('กรุณาเข้าสู่ระบบ'); return; }
              try {
                setAddCategoryLoading(true);
                const res = await fetch(`${API_BASE}/api/categories`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ name: newCategoryName, icon: newCategoryIcon || '🌐', type: selectedType })
                });
                if (!res.ok) {
                  const text = await res.text();
                  throw new Error(text || 'ไม่สามารถสร้างหมวดได้');
                }
                let created = null;
                try {
                  created = await res.json();
                } catch {
                  created = null;
                }

                if (created && created._id) {
                  setCategories(prev => {
                    const list = Array.isArray(prev) ? prev : [];
                    if (list.some(c => c && c._id === created._id)) return list;
                    return [...list, created];
                  });
                } else {
                  const headers = { Authorization: `Bearer ${token}` };
                  const catRes = await fetch(`${API_BASE}/api/categories`, { headers });
                  if (catRes.ok) {
                    const cats = await catRes.json();
                    setCategories(cats);
                  }
                }

                setShowAddModal(false);
                setNewCategoryName('');
                setNewCategoryIcon('');

                if (resumeQuickBudgetAfterAdd) {
                  setResumeQuickBudgetAfterAdd(false);
                  if (created && created._id) setQuickBudgetCategoryId(created._id);
                  setShowQuickBudgetModal(true);
                }
              } catch (err) {
                console.error('Create category error', err);
                alert('ไม่สามารถสร้างหมวดได้: ' + (err.message || 'ข้อผิดพลาด'));
              } finally {
                setAddCategoryLoading(false);
              }
            }} className="px-5 pb-5">
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-2">ตั้งชื่อหมวด{typeLabel}</label>
                <div className="relative">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    required
                    placeholder={selectedType === 'expense' ? 'เช่น ค่าอาหารกลางวัน' : 'เช่น เงินเดือน'}
                  />
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-semibold text-slate-500">
                  พิมพ์ชื่อหมวด หรือเลือกจากตัวเลือกด้านล่าง
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-extrabold text-slate-900">ชื่อหมวดยอดฮิต</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500">กดเพื่อเลือกชื่อหมวด + ไอคอนให้อัตโนมัติ</div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(POPULAR_CATEGORY_PRESETS[selectedType] || POPULAR_CATEGORY_PRESETS.expense).map((p) => {
                    const selected = (newCategoryName || '').trim() === p.name && (newCategoryIcon || '').trim() === p.icon;
                    return (
                      <button
                        key={`${selectedType}-${p.name}`}
                        type="button"
                        onClick={() => {
                          setNewCategoryName(p.name);
                          setNewCategoryIcon(p.icon);
                        }}
                        className={[
                          'flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 text-left shadow-sm hover:bg-slate-50 transition',
                          selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                        ].join(' ')}
                      >
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-xl">
                          {p.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-slate-900">{p.name}</div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-500">แตะเพื่อเลือก</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-slate-700">เลือกไอคอน</label>
                  {newCategoryIcon?.trim() ? (
                    <div className="text-[11px] font-semibold text-slate-500">เลือกแล้ว: <span className="font-extrabold text-slate-700">{newCategoryIcon}</span></div>
                  ) : (
                    <div className="text-[11px] font-semibold text-slate-500">ยังไม่ได้เลือก</div>
                  )}
                </div>

                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {iconOptions.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewCategoryIcon(ic)}
                      className={[
                        'shrink-0 h-11 w-11 rounded-2xl border shadow-sm flex items-center justify-center text-xl transition',
                        newCategoryIcon === ic ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      ].join(' ')}
                      aria-label={`เลือกไอคอน ${ic}`}
                    >
                      {ic}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewCategoryIcon('')}
                    className={[
                      'shrink-0 h-11 px-4 rounded-2xl border shadow-sm flex items-center justify-center text-sm font-extrabold transition',
                      newCategoryIcon === '' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    ล้าง
                  </button>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">ไอคอน (กำหนดเอง หากต้องการ)</label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 px-4 text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={newCategoryIcon}
                    onChange={(e) => setNewCategoryIcon(e.target.value)}
                    placeholder="พิมพ์ไอคอนเพื่อใช้แทน (เช่น 🍽️)"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={addCategoryLoading || !newCategoryName.trim()}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-white font-extrabold shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {addCategoryLoading ? 'กำลังบันทึก...' : 'ต่อไป'}
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Budget Modal */}
      {showQuickBudgetModal && (
        <div className="fixed inset-0 z-[58] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowQuickBudgetModal(false)}>
          <div
            className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slideUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 pt-3">
              <div className="mx-auto h-1 w-12 rounded-full bg-slate-200" aria-hidden="true" />
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-slate-900">เพิ่มงบ{typeLabel}</h3>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{selectedMonth}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickBudgetModal(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const token = localStorage.getItem('token');
                if (!token) {
                  alert('กรุณาเข้าสู่ระบบ');
                  return;
                }
                if (!quickBudgetCategoryId) {
                  alert('กรุณาเลือกหมวด');
                  return;
                }

                const total = parseFloat(quickBudgetAmount) || 0;
                try {
                  setQuickBudgetLoading(true);
                  const res = await fetch(`${API_BASE}/api/budgets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ category: quickBudgetCategoryId, month: selectedMonth, total }),
                  });
                  if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || 'Failed to save budget');
                  }
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
                  setShowQuickBudgetModal(false);
                } catch (err) {
                  console.error('Quick add budget error', err);
                  alert('ไม่สามารถบันทึกงบได้: ' + (err.message || 'ข้อผิดพลาดจากเซิร์ฟเวอร์'));
                } finally {
                  setQuickBudgetLoading(false);
                }
              }}
              className="px-5 pb-5"
            >
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-2">หมวด</label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={quickBudgetCategoryId}
                  onChange={(e) => setQuickBudgetCategoryId(e.target.value)}
                >
                  <option value="" disabled>เลือกหมวด</option>
                  {(categories || [])
                    .filter(c => c.type === selectedType)
                    .map(c => (
                      <option key={c._id} value={c._id}>
                        {(c.icon ? `${c.icon} ` : '')}{c.name}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setResumeQuickBudgetAfterAdd(true);
                    setShowQuickBudgetModal(false);
                    setShowAddModal(true);
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-extrabold text-blue-700 shadow-sm hover:bg-blue-100"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/70 border border-blue-200">+</span>
                  เพิ่มหมวดใหม่
                </button>
              </div>

              <div className="mt-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1">วงเงิน (บาท)</label>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                  <input
                    type="number"
                    className="w-full bg-transparent text-3xl font-extrabold text-slate-900 outline-none placeholder-slate-300"
                    placeholder="0"
                    value={quickBudgetAmount}
                    onChange={(e) => setQuickBudgetAmount(e.target.value)}
                    inputMode="numeric"
                    min="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">THB</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickBudgetModal(false)}
                  className="py-3 rounded-2xl border border-slate-200 font-extrabold text-slate-700 bg-white hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={quickBudgetLoading}
                  className="py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                >
                  {quickBudgetLoading ? 'กำลังบันทึก...' : 'บันทึก'}
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
            className="bg-white w-full max-w-sm p-5 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slideUp" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-xl">
                {editingCategory.icon || '🏷️'}
              </div>
              <div>
                <p className="text-slate-500 text-xs">ตั้งงบประมาณสำหรับ</p>
                <h3 className="text-lg font-extrabold text-slate-900">{editingCategory.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedMonth}</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">ใช้ไป</div>
                <div className="mt-0.5 text-sm font-extrabold text-slate-900">{formatCurrency(editingCategory.spent || 0)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">คงเหลือ</div>
                <div className={`mt-0.5 text-sm font-extrabold ${(editingCategory.remaining || 0) < 0 ? 'text-rose-600' : 'text-blue-700'}`}>
                  {formatCurrency(editingCategory.remaining || 0)}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveBudget}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">วงเงินที่ต้องการ (บาท)</label>
              <div className="relative mb-6">
                <input 
                  type="number" 
                  className="w-full text-3xl font-extrabold text-slate-900 border-b-2 border-slate-200 py-2 focus:border-blue-600 outline-none bg-transparent placeholder-slate-300"
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
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 rounded-2xl bg-blue-600 text-white font-extrabold shadow-lg shadow-blue-600/20 hover:bg-blue-700"
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
