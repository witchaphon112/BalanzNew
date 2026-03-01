"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Utensils,
  Coffee,
  ShoppingBag,
  Car,
  Home,
  Zap,
  Heart,
  Gamepad2,
  Stethoscope,
  GraduationCap,
  Gift,
  Smartphone,
  CreditCard,
  Landmark,
  Briefcase,
  PawPrint,
  Music,
  Dumbbell,
  MoreHorizontal,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

// Utility for formatting currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount);
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const monthNamesTH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const monthShortTH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
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

const ICON_MAP = {
  food: Utensils,
  drink: Coffee,
  shopping: ShoppingBag,
  transport: Car,
  home: Home,
  bills: Zap,
  health: Stethoscope,
  education: GraduationCap,
  tech: Smartphone,
  pet: PawPrint,
  game: Gamepad2,
  music: Music,
  sport: Dumbbell,
  gift: Gift,
  salary: CreditCard,
  money: Landmark,
  work: Briefcase,
  love: Heart,
  other: MoreHorizontal,
};

const CategoryIcon = ({ iconKey, className = 'w-6 h-6' }) => {
  const IconComp = ICON_MAP[iconKey];
  if (IconComp) return <IconComp className={className} aria-hidden="true" />;
  if (typeof iconKey === 'string' && iconKey.trim()) {
    return <span className="text-xl leading-none" aria-hidden="true">{iconKey}</span>;
  }
  return <MoreHorizontal className={className} aria-hidden="true" />;
};

const POPULAR_CATEGORY_PRESETS = {
  expense: [
    { name: 'อาหาร', icon: 'food' },
    { name: 'กาแฟ', icon: 'drink' },
    { name: 'เดินทาง', icon: 'transport' },
    { name: 'ช้อปปิ้ง', icon: 'shopping' },
    { name: 'ผ่อนรถ', icon: 'transport' },
    { name: 'ค่าสมาชิก/ซับสคริปชัน', icon: 'other' },
    { name: 'ผ่อนบ้าน', icon: 'home' },
    { name: 'อินเตอร์เน็ต', icon: 'tech' },
  ],
  income: [
    { name: 'เงินเดือน', icon: 'salary' },
    { name: 'โบนัส', icon: 'gift' },
    { name: 'รายได้เสริม', icon: 'work' },
    { name: 'ลงทุน', icon: 'money' },
    { name: 'คืนเงิน', icon: 'money' },
    { name: 'อื่นๆ', icon: 'other' },
  ],
};

export default function BudgetManager({ onClose, initialType = 'expense' }) {
  const normalizedInitialType = initialType === 'income' ? 'income' : 'expense';
  // --- State ---
  const [mounted, setMounted] = useState(false);
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
  const [monthScroll, setMonthScroll] = useState({ canLeft: false, canRight: false });
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

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Modal State for Editing
  const [editingCategory, setEditingCategory] = useState(null); // The category object being edited
  const [editAmount, setEditAmount] = useState('');
  const [deleteCategory, setDeleteCategory] = useState(null);
  const [deleteCategoryLoading, setDeleteCategoryLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const iconOptions = ['food', 'drink', 'shopping', 'transport', 'home', 'bills', 'health', 'education', 'tech', 'pet', 'game', 'music', 'gift', 'salary', 'work', 'money', 'love', 'other'];
  const [toast, setToast] = useState(null); // { id, tone: 'success'|'error'|'info'|'warning', message }
  const toastTimerRef = useRef(null);

  const dismissToast = useCallback(() => {
    setToast(null);
    try {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    } catch {
      // ignore
    }
  }, []);

  const showToast = useCallback((tone, message) => {
    const id = Date.now();
    setToast({ id, tone: tone || 'info', message: String(message || '') });
    try {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 2600);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      } catch {
        // ignore
      }
    };
  }, []);

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
  const monthTabsRef = useRef(null);
  const activeMonthRef = useRef(null);
  const monthDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const suppressMonthClickRef = useRef(false);
  const monthScrollRafRef = useRef(0);

  const updateMonthScroll = useCallback(() => {
    const el = monthTabsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setMonthScroll((prev) => (prev.canLeft === left && prev.canRight === right ? prev : { canLeft: left, canRight: right }));
  }, []);

  const scheduleUpdateMonthScroll = useCallback(() => {
    if (monthScrollRafRef.current) return;
    monthScrollRafRef.current = window.requestAnimationFrame(() => {
      monthScrollRafRef.current = 0;
      updateMonthScroll();
    });
  }, [updateMonthScroll]);

  useEffect(() => {
    const el = activeMonthRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } catch {
      // ignore
    }
    scheduleUpdateMonthScroll();
  }, [currentMonthIndex, selectedType, scheduleUpdateMonthScroll]);

  useEffect(() => {
    updateMonthScroll();
    return () => {
      if (monthScrollRafRef.current) window.cancelAnimationFrame(monthScrollRafRef.current);
    };
  }, [currentMonthIndex, months.length, updateMonthScroll]);

  const scrollMonthTabsBy = (deltaX) => {
    const el = monthTabsRef.current;
    if (!el) return;
    try {
      el.scrollBy({ left: deltaX, behavior: 'smooth' });
    } catch {
      el.scrollLeft += deltaX;
    }
  };

  const onMonthWheel = (e) => {
    const el = monthTabsRef.current;
    if (!el) return;
    if (e.shiftKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (!e.deltaY) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
    scheduleUpdateMonthScroll();
  };

  const onMonthPointerDown = (e) => {
    const el = monthTabsRef.current;
    if (!el) return;
    if (e.pointerType === 'touch') return; // keep native swipe scrolling on touch devices
    if (e.button != null && e.button !== 0) return; // left click only (mouse)
    suppressMonthClickRef.current = false;
    monthDragRef.current = { active: true, startX: e.clientX, startScrollLeft: el.scrollLeft };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onMonthPointerMove = (e) => {
    const el = monthTabsRef.current;
    const st = monthDragRef.current;
    if (!el || !st.active) return;
    const dx = e.clientX - st.startX;
    if (Math.abs(dx) > 4) suppressMonthClickRef.current = true;
    el.scrollLeft = st.startScrollLeft - dx;
    scheduleUpdateMonthScroll();
  };

  const onMonthPointerUp = () => {
    monthDragRef.current.active = false;
    // allow click again after this tick
    setTimeout(() => { suppressMonthClickRef.current = false; }, 0);
    scheduleUpdateMonthScroll();
  };

  const onMonthClickCapture = (e) => {
    if (!suppressMonthClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
  };

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
        percent,
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

    // Summary headline: prefer "รายรับ" as the main base, and subtract actual expenses.
    // If no income budget is set, fall back to expense budgets (classic budget mode).
    const headlineSummary = useMemo(() => {
      const monthBudgets = (budgets && selectedMonth) ? (budgets[selectedMonth] || {}) : {};
      const incomeCats = (categories || []).filter((c) => c?.type === 'income');
      const expenseCats = (categories || []).filter((c) => c?.type === 'expense');

      const sumBudgetByCats = (cats) => {
        if (!Array.isArray(cats) || !cats.length) return 0;
        return cats.reduce((s, c) => s + (Number(monthBudgets?.[c._id]) || 0), 0);
      };

      const incomeBudgetTotal = sumBudgetByCats(incomeCats);
      const expenseBudgetTotal = sumBudgetByCats(expenseCats);

      const monthTxns = (transactions || []).filter((t) => monthLabelFromDate(t?.date) === selectedMonth);
      const incomeActualTotal = monthTxns
        .filter((t) => t?.type === 'income')
        .reduce((s, t) => s + (Number(t?.amount) || 0), 0);
      const expenseSpentTotal = monthTxns
        .filter((t) => t?.type === 'expense')
        .reduce((s, t) => s + (Number(t?.amount) || 0), 0);

      const baseTotal = incomeActualTotal > 0
        ? incomeActualTotal
        : incomeBudgetTotal > 0
          ? incomeBudgetTotal
          : expenseBudgetTotal;
      const baseMode = incomeActualTotal > 0 ? 'income_actual' : incomeBudgetTotal > 0 ? 'income_budget' : 'expense_budget';
      const remaining = baseTotal - expenseSpentTotal;
      const spentPct = baseTotal > 0 ? Math.round((expenseSpentTotal / baseTotal) * 100) : 0;
      const spentPctClamped = baseTotal > 0 ? Math.min(100, Math.max(0, (expenseSpentTotal / baseTotal) * 100)) : 0;

      return {
        baseMode,
        incomeBudgetTotal,
        incomeActualTotal,
        expenseBudgetTotal,
        expenseSpentTotal,
        baseTotal,
        remaining,
        spentPct,
        spentPctClamped,
      };
    }, [budgets, categories, transactions, selectedMonth]);


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

  const openDeleteCategoryModal = (category) => {
    if (!category) return;
    if (String(category?.name || '').trim() === 'อื่นๆ') {
      showToast('warning', 'ไม่สามารถลบหมวด "อื่นๆ" ได้');
      return;
    }
    setIsSortOpen(false);
    setIsSettingsOpen(false);
    setShowAddModal(false);
    setEditingCategory(null);
    setDeleteCategory(category);
  };

  const closeDeleteCategoryModal = () => {
    if (deleteCategoryLoading) return;
    setDeleteCategory(null);
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory?._id) return;
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('warning', 'กรุณาเข้าสู่ระบบ');
      return;
    }

    setDeleteCategoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/categories/${deleteCategory._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'ไม่สามารถลบหมวดได้');
      }

      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      const deletedId = deleteCategory._id;
      const reassignedTo = payload?.reassignedTo || null;

      setCategories((prev) => (Array.isArray(prev) ? prev.filter((c) => c && c._id !== deletedId) : []));
      setBudgets((prev) => {
        const next = { ...(prev || {}) };
        for (const m of Object.keys(next)) {
          const monthMap = next[m];
          if (!monthMap || typeof monthMap !== 'object') continue;
          if (Object.prototype.hasOwnProperty.call(monthMap, deletedId)) {
            const { [deletedId]: _removed, ...rest } = monthMap;
            next[m] = rest;
          }
        }
        return next;
      });
      if (reassignedTo) {
        setTransactions((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          return list.map((t) => {
            if (!t) return t;
            const catVal = t.category && typeof t.category === 'object' ? t.category._id : t.category;
            if (String(catVal || '') !== String(deletedId)) return t;
            return { ...t, category: reassignedTo };
          });
        });
      }

      setDeleteCategory(null);
      showToast('success', 'ลบหมวดเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Delete category error', err);
      showToast('error', 'ไม่สามารถลบหมวดได้: ' + (err.message || 'ข้อผิดพลาด'));
    } finally {
      setDeleteCategoryLoading(false);
    }
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
      showToast('success', 'บันทึกงบประมาณแล้ว');
    } catch (error) {
      console.error('Save budget error', error);
      showToast('error', 'ไม่สามารถบันทึกงบได้: ' + (error.message || 'ข้อผิดพลาดจากเซิร์ฟเวอร์'));
    }
  };

  const openSettings = () => {
    setIsSortOpen(false);
    setEditingCategory(null);
    setShowAddModal(false);
    setTempMonthIndex(currentMonthIndex);
    setIsSettingsOpen(true);
  };

  const openAddCategoryModal = () => {
    setIsSortOpen(false);
    setIsSettingsOpen(false);
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryIcon('');
    setShowAddModal(true);
  };

  const closeAddCategoryModal = () => {
    setShowAddModal(false);
    setNewCategoryName('');
    setNewCategoryIcon('');
  };

  const typeLabel = selectedType === 'expense' ? 'รายจ่าย' : 'รายรับ';
  const budgetedItemCount = (processedData.items || []).filter((c) => (Number(c?.budget) || 0) > 0).length;
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'budgeted' | 'unbudgeted' | 'over'

  const filteredCategories = useMemo(() => {
    const list = Array.isArray(processedData.items) ? processedData.items : [];
    const q = String(categoryQuery || '').trim();
    let out = list;
    if (q) {
      const qLower = q.toLowerCase();
      out = out.filter((c) => String(c?.name || '').toLowerCase().includes(qLower));
    }
    switch (categoryFilter) {
      case 'budgeted':
        out = out.filter((c) => (Number(c?.budget) || 0) > 0);
        break;
      case 'unbudgeted':
        out = out.filter((c) => (Number(c?.budget) || 0) <= 0);
        break;
      case 'over':
        out = out.filter((c) => Boolean(c?.isOverBudget) && (Number(c?.budget) || 0) > 0);
        break;
      case 'all':
      default:
        break;
    }
    return out;
  }, [processedData.items, categoryQuery, categoryFilter]);

  const handleClose = () => {
    if (typeof onClose === 'function') onClose();
    else window.history.back();
  };

  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] min-h-0 flex-col overflow-y-auto [-webkit-overflow-scrolling:touch] bg-[var(--app-bg)] text-[color:var(--app-text)] font-sans">
      {/* Top / Sticky header (removed sticky wrapper) */}
      <>
	        <div className="mx-auto w-full max-w-lg px-4 pb-4 pt-[calc(env(safe-area-inset-top)+20px)]">
          {/* Title row */}
          <div className="relative flex items-center justify-center">
            <div className="text-center">
              <div className="text-[11px] font-semibold tracking-wide text-[color:var(--app-muted)]">งบประมาณ{typeLabel}</div>
              <div className="text-lg font-extrabold text-[color:var(--app-text)]">งบที่ตั้งไว้</div>
            </div>

            <div className="absolute right-0 flex items-center gap-2">
            </div>
          </div>

          {/* Month tabs */}
          {(() => {
            const selectedYear = String((selectedMonth || '').split(' ')[1] || '');
            const yearMonths = months
              .map((label, idx) => ({ label, idx }))
              .filter((x) => String(x.label.split(' ')[1] || '') === selectedYear);
            const tabs = yearMonths.length ? yearMonths : months.map((label, idx) => ({ label, idx }));
            return (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-[color:var(--app-muted)]">เดือน</div>
                  <div className="text-xs font-extrabold text-[color:var(--app-text)]">พ.ศ. {selectedYear || '—'}</div>
                </div>

                <div className="relative rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-2 shadow-sm shadow-black/5">
                  <div
                    ref={monthTabsRef}
                    className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-proximity pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
                    onPointerDown={onMonthPointerDown}
                    onPointerMove={onMonthPointerMove}
                    onPointerUp={onMonthPointerUp}
                    onPointerCancel={onMonthPointerUp}
                    onPointerLeave={onMonthPointerUp}
                    onClickCapture={onMonthClickCapture}
                    onWheel={onMonthWheel}
                    onScroll={scheduleUpdateMonthScroll}
                  >
                    {tabs.map(({ label, idx }) => {
                      const monthName = String(label.split(' ')[0] || '');
                      const mIdx = monthIndexFromThaiName(monthName);
                      const short = mIdx >= 0 ? monthShortTH[mIdx] : monthName;
                      const active = idx === currentMonthIndex;
                      return (
                        <button
                          key={label}
                          ref={active ? activeMonthRef : null}
                          type="button"
                          onClick={() => setCurrentMonthIndex(idx)}
                          className={[
                            'shrink-0 snap-center px-4 py-2 rounded-2xl text-sm font-extrabold transition',
                            'border ring-1 shadow-sm shadow-black/10 focus:outline-none focus:ring-2',
                            active
                              ? [
                                  'border-emerald-300/60 bg-emerald-500/15 text-emerald-200 ring-emerald-400/25',
                                  'shadow-[0_10px_25px_-18px_rgba(16,185,129,0.9)]',
                                  'focus:ring-emerald-300/40',
                                ].join(' ')
                              : [
                                  'border-white/10 bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10',
                                  'focus:ring-emerald-400/20',
                                ].join(' '),
                          ].join(' ')}
                          aria-current={active ? 'date' : undefined}
                          title={label}
                        >
                          {short}
                        </button>
                      );
                    })}
                  </div>

                  {/* Edge fades */}
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-3xl"
                    style={{ background: 'linear-gradient(to right, var(--app-surface-2), rgba(0,0,0,0))' }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-3xl"
                    style={{ background: 'linear-gradient(to left, var(--app-surface-2), rgba(0,0,0,0))' }}
                  />
                </div>
              </div>
            );
          })()}

	          {/* Summary card */}
	          <div className="mt-4 relative overflow-hidden rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-400 via-emerald-400 to-green-500 text-slate-950 shadow-[0_20px_60px_-40px_rgba(16,185,129,0.85)]">
	            <div className="absolute inset-0 opacity-25 [background:radial-gradient(800px_circle_at_10%_20%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(700px_circle_at_70%_80%,rgba(0,0,0,0.2),transparent_55%)]" />
	            <div className="relative p-5">
	              <div className="text-sm font-extrabold">
                  {headlineSummary.baseMode !== 'expense_budget' ? 'คงเหลือจากรายรับ' : 'งบที่เหลือทั้งหมด'}
                </div>
	              <div className="mt-1 text-4xl font-extrabold tracking-tight">
	                {formatCurrency(headlineSummary.remaining)}
	              </div>

	              <div className="mt-4 flex items-center justify-between text-sm font-extrabold">
	                <div>ใช้ไปแล้ว {headlineSummary.spentPct}%</div>
	                <div>เหลือ {formatCurrency(headlineSummary.remaining)}</div>
	              </div>

	              <div className="mt-2 h-3 w-full rounded-full bg-black/15 overflow-hidden">
	                <div
	                  className="h-full rounded-full bg-white shadow-[0_10px_25px_-10px_rgba(255,255,255,0.95)]"
	                  style={{ width: `${headlineSummary.spentPctClamped}%` }}
	                />
	              </div>

	              <div className="mt-3 text-sm font-semibold text-slate-950/80">
                  {headlineSummary.baseMode === 'income_actual'
                    ? 'จากรายรับเดือนนี้ '
                    : headlineSummary.baseMode === 'income_budget'
                      ? 'จากรายรับที่ตั้งไว้ '
                      : 'จากงบทั้งหมด '}
	                {formatCurrency(headlineSummary.baseTotal)}
	              </div>
	            </div>
	          </div>

          {/* Type toggle + sort */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1 shadow-sm shadow-black/10">
              <button
                type="button"
                onClick={() => setSelectedType('expense')}
                className={[
                  'px-4 py-2 text-sm font-extrabold rounded-2xl transition',
                  selectedType === 'expense'
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25'
                    : 'text-slate-300 hover:text-slate-100',
                ].join(' ')}
              >
                รายจ่าย
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('income')}
                className={[
                  'px-4 py-2 text-sm font-extrabold rounded-2xl transition',
                  selectedType === 'income'
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25'
                    : 'text-slate-300 hover:text-slate-100',
                ].join(' ')}
              >
                รายรับ
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSortOpen(v => !v)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-extrabold text-slate-200 shadow-sm shadow-black/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                aria-haspopup="menu"
                aria-expanded={isSortOpen}
              >
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16"/>
                </svg>
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
                    <div className="absolute right-0 mt-2 z-40 w-56 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-1 shadow-xl shadow-black/20">
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
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold flex items-center justify-between hover:bg-white/5 ${sortBy === opt.key ? 'bg-white/5' : ''}`}
                          role="menuitem"
                        >
                          <span className="text-slate-100">{opt.label}</span>
                          {sortBy === opt.key && (
                            <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {(headlineSummary.incomeActualTotal > 0 || headlineSummary.incomeBudgetTotal > 0 || headlineSummary.expenseBudgetTotal > 0) && (
              <div className="mt-3 text-[11px] font-semibold text-[color:var(--app-muted)]">
                {headlineSummary.baseMode === 'income_actual'
                  ? 'รายรับเดือนนี้: '
                  : headlineSummary.baseMode === 'income_budget'
                    ? 'รายรับที่ตั้งไว้เดือนนี้: '
                    : 'งบรายจ่ายรวมเดือนนี้: '}
                <span className="font-extrabold text-slate-200">
                  {formatCurrency(
                    headlineSummary.baseMode === 'income_actual'
                      ? headlineSummary.incomeActualTotal
                      : headlineSummary.baseMode === 'income_budget'
                        ? headlineSummary.incomeBudgetTotal
                        : headlineSummary.expenseBudgetTotal
                  )}
                </span>
              </div>
            )}
        </div>
      </>

      {/* Settings Modal */}
      {mounted && isSettingsOpen && createPortal((
        <div
          className="fixed inset-0 z-[52] flex items-end sm:items-center justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setIsSettingsOpen(false)}
        >
          <div
            className="bg-[var(--app-surface)] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/40 animate-slideUp border border-[color:var(--app-border)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-500 text-slate-950 px-5 pb-4 pt-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -mr-14 -mt-14" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" aria-hidden="true" />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 hover:bg-white/25 transition"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="mx-auto max-w-[70%] text-center">
                  <div className="text-[11px] font-extrabold tracking-wide text-slate-950/70">ตั้งค่า</div>
                  <div className="mt-1 truncate text-lg font-extrabold">ตั้งค่างบประมาณ</div>
                </div>
              </div>
            </div>

            <div className="p-5">
              {(() => {
                const selectedLabel = months[tempMonthIndex] || '';
                const selectedYear = String((selectedLabel || '').split(' ')[1] || '');
                const yearMonths = months
                  .map((label, idx) => ({ label, idx }))
                  .filter((x) => String(x.label.split(' ')[1] || '') === selectedYear);
                const tabs = yearMonths.length ? yearMonths : months.map((label, idx) => ({ label, idx }));
                return (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-[color:var(--app-muted)]">เดือนที่ต้องการตั้งงบ</div>
                      <div className="text-xs font-extrabold text-[color:var(--app-text)]">พ.ศ. {selectedYear || '—'}</div>
                    </div>

                    <div className="mt-2 relative rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-2 shadow-sm shadow-black/5">
                      <div className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-proximity pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none">
                        {tabs.map(({ label, idx }) => {
                          const monthName = String(label.split(' ')[0] || '');
                          const mIdx = monthIndexFromThaiName(monthName);
                          const short = mIdx >= 0 ? monthShortTH[mIdx] : monthName;
                          const active = idx === tempMonthIndex;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setTempMonthIndex(idx)}
                              className={[
                                'shrink-0 snap-center px-4 py-2 rounded-2xl text-sm font-extrabold transition',
                                'border ring-1 shadow-sm shadow-black/10 focus:outline-none focus:ring-2',
                                active
                                  ? [
                                      'border-emerald-300/60 bg-emerald-500/15 text-emerald-200 ring-emerald-400/25',
                                      'shadow-[0_10px_25px_-18px_rgba(16,185,129,0.9)]',
                                      'focus:ring-emerald-300/40',
                                    ].join(' ')
                                  : [
                                      'border-white/10 bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10',
                                      'focus:ring-emerald-400/20',
                                    ].join(' '),
                              ].join(' ')}
                              aria-current={active ? 'date' : undefined}
                              title={label}
                            >
                              {short}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-3xl"
                        style={{ background: 'linear-gradient(to right, var(--app-surface-2), rgba(0,0,0,0))' }}
                      />
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-3xl"
                        style={{ background: 'linear-gradient(to left, var(--app-surface-2), rgba(0,0,0,0))' }}
                      />
                    </div>

                    <div className="mt-2 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                      เลือกเดือนจากรายการด้านบน หรือใช้ปุ่มเลื่อนเดือน
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={tempMonthIndex <= 0}
                  onClick={() => setTempMonthIndex(v => Math.max(0, v - 1))}
                  className="flex-1 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm font-extrabold text-slate-100 disabled:opacity-40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                >
                  เดือนก่อนหน้า
                </button>
                <button
                  type="button"
                  disabled={tempMonthIndex >= months.length - 1}
                  onClick={() => setTempMonthIndex(v => Math.min(months.length - 1, v + 1))}
                  className="flex-1 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm font-extrabold text-slate-100 disabled:opacity-40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                >
                  เดือนถัดไป
                </button>
              </div>

              <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-3 rounded-2xl border border-white/10 font-extrabold text-slate-100 bg-white/5 hover:bg-white/10"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMonthIndex(tempMonthIndex);
                  setIsSettingsOpen(false);
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 hover:brightness-95"
              >
                บันทึก
              </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Category list */}
      <div>
        <div className="mx-auto w-full max-w-lg p-4">
        {/* Categories header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-extrabold text-[color:var(--app-text)]">หมวดหมู่</div>
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-slate-200">
            {filteredCategories.length}/{processedData.items.length} รายการ
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-sm shadow-black/10">
                <div className="flex h-full items-center gap-4 px-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 ring-1 ring-white/10" />
                  <div className="flex-1">
                    <div className="h-3 w-2/3 rounded bg-white/10" />
                    <div className="mt-2 h-2 w-1/2 rounded bg-white/10" />
                  </div>
                  <div className="h-3 w-16 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          processedData.items.length === 0 ? (
            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-8 text-center shadow-sm shadow-black/10">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10 text-2xl">
                🗂️
              </div>
              <div className="text-base font-extrabold text-[color:var(--app-text)]">ยังไม่มีหมวด{typeLabel}</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--app-muted)]">กดปุ่ม “เพิ่มงบ” ด้านบนเพื่อเพิ่มหมวดใหม่</div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Filter */}
              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm shadow-black/10">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--app-muted-2)]">
                    <Search className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <input
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                    placeholder="ค้นหาหมวดหมู่…"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-10 text-sm font-extrabold text-[color:var(--app-text)] placeholder-[color:var(--app-muted-2)] shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                  />
                  {String(categoryQuery || '').trim() ? (
                    <button
                      type="button"
                      onClick={() => setCategoryQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                      aria-label="ล้างคำค้นหา"
                      title="ล้าง"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: 'ทั้งหมด' },
                    { key: 'budgeted', label: 'ตั้งงบแล้ว' },
                    { key: 'unbudgeted', label: 'ยังไม่ตั้งงบ' },
                    { key: 'over', label: 'เกินงบ' },
                  ].map((opt) => {
                    const active = categoryFilter === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCategoryFilter(opt.key)}
                        className={[
                          'rounded-2xl px-3 py-2 text-xs font-extrabold transition border ring-1 shadow-sm shadow-black/10 focus:outline-none focus:ring-2',
                          active
                            ? 'border-emerald-300/60 bg-emerald-500/15 text-emerald-200 ring-emerald-400/25 focus:ring-emerald-300/30'
                            : 'border-white/10 bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10 focus:ring-emerald-400/20',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                  {budgetedItemCount > 0 ? `ตั้งงบแล้ว ${budgetedItemCount} หมวด` : 'ยังไม่มีหมวดที่ตั้งงบ'}
                </div>
              </div>

              {filteredCategories.length === 0 ? (
                <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 text-center shadow-sm shadow-black/10">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10 text-xl">
                    🔎
                  </div>
                  <div className="text-sm font-extrabold text-[color:var(--app-text)]">ไม่พบหมวดที่ตรงกับตัวกรอง</div>
                  <div className="mt-1 text-xs font-semibold text-[color:var(--app-muted)]">ลองค้นหาใหม่ หรือกดล้างตัวกรอง</div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryQuery('');
                        setCategoryFilter('all');
                      }}
                      className="flex-1 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-xs font-extrabold text-slate-100 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                    >
                      ล้างตัวกรอง
                    </button>
                    <button
                      type="button"
                      onClick={openAddCategoryModal}
                      className="flex-1 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                    >
                      เพิ่มหมวด
                    </button>
                  </div>
                </div>
              ) : null}

              {filteredCategories.map((cat) => {
                const pct = cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0;
                const progress = cat.budget > 0 ? clamp01(cat.spent / cat.budget) : 0;
                const over = cat.isOverBudget && cat.budget > 0;
                const pctText = cat.budget > 0 ? `${Math.max(0, pct)}%` : '—';
                const pctColor = over ? 'text-rose-300' : progress >= 0.85 ? 'text-amber-200' : 'text-emerald-200';
                const barColor = over ? '#FB7185' : progress >= 0.85 ? '#FACC15' : '#22C55E';
                return (
                  <div
                    key={cat._id}
                    onClick={() => openEditModal(cat)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEditModal(cat);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={[
                      'w-full rounded-3xl border p-4 text-left shadow-sm shadow-black/10 transition',
                      'cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/25',
                      over ? 'border-rose-500/25 bg-[var(--app-surface)]' : 'border-[color:var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-3)]',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-xl bg-white/5 ring-1 ring-white/10">
                          <CategoryIcon iconKey={cat.icon} className="w-6 h-6 text-slate-200" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-extrabold text-[color:var(--app-text)]">{cat.name}</div>
                          <div className="mt-0.5 text-xs font-semibold text-[color:var(--app-muted)]">
                            เหลือ{' '}
                            <span className={cat.remaining < 0 ? 'text-rose-300' : 'text-emerald-200'}>
                              {formatCurrency(cat.remaining)}
                            </span>
                          </div>
                        </div>
                      </div>

	                      <div className="shrink-0 flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
	                          <button
	                            type="button"
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              openEditModal(cat);
	                            }}
	                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
	                          >
	                            แก้ไข
	                          </button>
                          </div>
	                        <div className={`text-sm font-extrabold ${pctColor}`}>{pctText}</div>
	                      </div>
	                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm font-extrabold text-slate-200">
                        <div className="truncate">
                          {formatCurrency(cat.spent)} <span className="text-[color:var(--app-muted-2)]">/ {formatCurrency(cat.budget)}</span>
                        </div>
                      </div>
                      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-black/25 ring-1 ring-white/10">
                        <div
                          className="h-full rounded-full shadow-[0_10px_22px_-14px_rgba(34,197,94,0.8)]"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

	              <button
	                type="button"
	                onClick={openAddCategoryModal}
	                className={[
	                  'w-full cursor-pointer rounded-3xl border border-dashed border-white/20 bg-white/0 p-5 text-left',
	                  'transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-400/25',
	                ].join(' ')}
	                aria-label={`เพิ่มหมวด${typeLabel}`}
	              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl border border-dashed border-white/20 bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-slate-200">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m7-7H5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-[color:var(--app-text)]">เพิ่มหมวด{typeLabel}</div>
                    <div className="mt-1 text-xs font-semibold text-[color:var(--app-muted)]">แตะเพื่อเพิ่มหมวดใหม่</div>
                  </div>
                </div>
              </button>
            </div>
          )
        )}

        <div className="h-24" />
        </div>
      </div>

      {/* Add Category Modal */}
      {mounted && showAddModal && createPortal((
        <div
          className="fixed inset-0 z-[90] flex items-stretch sm:items-center justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && closeAddCategoryModal()}
        >
	          <div
	            className="bg-[var(--app-surface)] w-full max-w-none rounded-none sm:max-w-md sm:rounded-3xl shadow-2xl shadow-black/40 animate-slideUp overflow-hidden border border-[color:var(--app-border)] flex flex-col h-[100dvh] sm:h-auto sm:max-h-[85dvh]"
	            onClick={(e) => e.stopPropagation()}
	            role="dialog"
	            aria-modal="true"
	          >
            <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-500 text-slate-950 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] sm:pt-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -mr-14 -mt-14" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" aria-hidden="true" />

              <div className="relative">
                <button
                  type="button"
                  onClick={closeAddCategoryModal}
                  className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 hover:bg-white/25 transition"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="mx-auto max-w-[78%] text-center">
                  <div className="text-[11px] font-extrabold tracking-wide text-slate-950/70">เพิ่มหมวด{typeLabel}</div>
                  <h3 className="mt-1 truncate text-lg font-extrabold">สร้างหมวดใหม่</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-950/70">ตั้งชื่อหมวด และเลือกไอคอน</p>
                </div>
              </div>
            </div>

		            <form onSubmit={async (e) => {
		              e.preventDefault();
		              const token = localStorage.getItem('token');
		              if (!token) { showToast('warning', 'กรุณาเข้าสู่ระบบ'); return; }
		              try {
                setAddCategoryLoading(true);
                const res = await fetch(`${API_BASE}/api/categories`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ name: newCategoryName, icon: newCategoryIcon || 'other', type: selectedType })
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
                showToast('success', 'สร้างหมวดเรียบร้อยแล้ว');
              } catch (err) {
                console.error('Create category error', err);
                showToast('error', 'ไม่สามารถสร้างหมวดได้: ' + (err.message || 'ข้อผิดพลาด'));
              } finally {
                setAddCategoryLoading(false);
              }
		            }} className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] p-5 pb-[calc(env(safe-area-inset-bottom)+96px)] sm:pb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">ตั้งชื่อหมวด{typeLabel}</label>
                <div className="relative">
                  <input
                    className="w-full h-12 rounded-2xl border border-white/10 bg-white/5 py-3 pl-4 pr-11 text-sm font-extrabold text-slate-100 placeholder-slate-500 shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
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
                <div className="mt-2 text-[11px] font-semibold text-[color:var(--app-muted-2)]">พิมพ์ชื่อหมวด หรือเลือกจากตัวอย่างด้านล่าง</div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-extrabold text-[color:var(--app-text)]">ตัวอย่างยอดฮิต</div>
                <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-muted-2)]">กดเพื่อเลือกชื่อหมวด + ไอคอนอัตโนมัติ</div>

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
                          'flex items-center gap-3 rounded-2xl border px-3 py-3 text-left shadow-sm transition',
                          selected
                            ? 'border-emerald-400/30 bg-emerald-500/10 ring-2 ring-emerald-400/20'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        ].join(' ')}
                      >
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200">
                          <CategoryIcon iconKey={p.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">{p.name}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted-2)]">แตะเพื่อเลือก</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-slate-300">เลือกไอคอน</label>
                  {newCategoryIcon?.trim() ? (
                    <div className="text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                      เลือกแล้ว:{' '}
                      <span className="font-extrabold text-slate-200">{newCategoryIcon}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold text-[color:var(--app-muted-2)]">ยังไม่ได้เลือก</div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-6 gap-2">
                  {iconOptions.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewCategoryIcon(ic)}
                      className={[
                        'h-11 w-11 rounded-2xl border shadow-sm flex items-center justify-center transition',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
                        newCategoryIcon === ic
                          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20'
                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                      ].join(' ')}
                      aria-label={`เลือกไอคอน ${ic}`}
                    >
                      <CategoryIcon iconKey={ic} className="w-5 h-5" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewCategoryIcon('')}
                    className={[
                      'col-span-2 h-11 rounded-2xl border shadow-sm flex items-center justify-center text-sm font-extrabold transition',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
                      newCategoryIcon === ''
                        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20'
                        : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                    ].join(' ')}
                  >
                    ล้าง
                  </button>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">ไอคอน (กำหนดเอง)</label>
                  <input
                    className="w-full h-12 rounded-2xl border border-white/10 bg-white/5 py-3 px-4 text-sm font-extrabold text-slate-100 placeholder-slate-500 shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                    value={newCategoryIcon}
                    onChange={(e) => setNewCategoryIcon(e.target.value)}
                    placeholder="พิมพ์คีย์ไอคอน (เช่น food, shopping) หรือใส่ Emoji ก็ได้"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={addCategoryLoading || !newCategoryName.trim()}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 hover:brightness-95 disabled:opacity-50"
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
      ), document.body)}

      {/* Delete Category Confirm Modal */}
      {mounted && deleteCategory && createPortal((
        <div
          className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && closeDeleteCategoryModal()}
        >
          <div
            className="bg-[var(--app-surface)] w-full max-w-none sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/40 animate-slideUp overflow-hidden border border-[color:var(--app-border)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="ยืนยันการลบหมวดหมู่"
          >
            <div className="relative px-5 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] sm:pt-4 border-b border-[color:var(--app-border)] bg-[var(--app-surface-2)]">
              <button
                type="button"
                onClick={closeDeleteCategoryModal}
                disabled={deleteCategoryLoading}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                aria-label="ปิด"
                title="ปิด"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex items-center gap-3 pr-12">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-[color:var(--app-danger)] ring-1 ring-rose-400/20">
                  <Trash2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold tracking-wide text-[color:var(--app-muted-2)]">ลบหมวดหมู่</div>
                  <div className="mt-0.5 truncate text-lg font-extrabold text-[color:var(--app-text)]">
                    {deleteCategory.name}
                  </div>
                 
                </div>
              </div>
            </div>

            <div className="p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] sm:pb-5">
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 ring-1 ring-rose-400/10">
                <div className="text-xs font-extrabold text-[color:var(--app-danger)]">คำเตือน</div>
                <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-text)]">
                  การลบหมวดหมู่ไม่สามารถย้อนกลับได้
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeDeleteCategoryModal}
                  disabled={deleteCategoryLoading}
                  className="py-3 rounded-2xl border border-[color:var(--app-border)] font-extrabold text-[color:var(--app-text)] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCategory}
                  disabled={deleteCategoryLoading}
                  className="py-3 rounded-2xl bg-rose-500 text-white font-extrabold shadow-lg shadow-rose-500/20 hover:brightness-95 disabled:opacity-50"
                >
                  {deleteCategoryLoading ? 'กำลังลบ...' : 'ลบหมวด'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* 4. Edit Budget Bottom Sheet / Modal */}
        {mounted && editingCategory && createPortal((
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setEditingCategory(null)}
        >
          <div 
            className="bg-[var(--app-surface)] w-full max-w-none sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/40 animate-slideUp overflow-hidden border border-[color:var(--app-border)] flex flex-col max-h-[90dvh] sm:max-h-[85dvh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-500 text-slate-950 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] sm:pt-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -mr-14 -mt-14" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" aria-hidden="true" />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 hover:bg-white/25 transition"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="flex items-center gap-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/25">
                    <CategoryIcon iconKey={editingCategory.icon} className="w-6 h-6 text-slate-950" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold tracking-wide text-slate-950/70">{selectedMonth}</div>
                    <h3 className="mt-0.5 truncate text-lg font-extrabold">ตั้งงบ: {editingCategory.name}</h3>
                    <div className="mt-0.5 text-xs font-semibold text-slate-950/70">ปรับวงเงินสำหรับหมวดนี้</div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveBudget} className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] p-5 pb-[calc(env(safe-area-inset-bottom)+32px)] sm:pb-6">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-3 shadow-sm shadow-black/5">
                  <div className="text-[11px] font-semibold text-[color:var(--app-muted-2)]">ใช้ไป</div>
                  <div className="mt-0.5 text-sm font-extrabold text-[color:var(--app-text)]">{formatCurrency(editingCategory.spent || 0)}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-3 shadow-sm shadow-black/5">
                  <div className="text-[11px] font-semibold text-[color:var(--app-muted-2)]">คงเหลือ</div>
                  <div className={['mt-0.5 text-sm font-extrabold', (editingCategory.remaining || 0) < 0 ? 'text-rose-500' : 'text-emerald-500'].join(' ')}>
                    {formatCurrency(editingCategory.remaining || 0)}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-xs font-semibold text-[color:var(--app-muted)] mb-2">วงเงินที่ต้องการ (บาท)</label>
                <div className="relative rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 shadow-sm shadow-black/5 focus-within:ring-2 focus-within:ring-emerald-400/25">
                  <input
                    type="number"
                    className="w-full bg-transparent text-3xl font-extrabold text-[color:var(--app-text)] outline-none placeholder-[color:var(--app-muted-2)]"
                    placeholder="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    inputMode="numeric"
                    min="0"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[color:var(--app-muted-2)]">THB</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="py-3 rounded-2xl border border-[color:var(--app-border)] font-extrabold text-[color:var(--app-text)] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 hover:brightness-95"
                >
                  บันทึก
                </button>
              </div>

              <button
                type="button"
                onClick={() => openDeleteCategoryModal(editingCategory)}
                disabled={String(editingCategory?.name || '').trim() === 'อื่นๆ'}
                className="mt-3 w-full rounded-2xl border border-rose-500/25 bg-rose-500/10 py-3 text-rose-600 font-extrabold hover:bg-rose-500/15 disabled:opacity-40"
              >
                ลบหมวดนี้
              </button>
            </form>
          </div>
        </div>
        ), document.body)}

      {/* Toast */}
      {mounted && toast && createPortal((() => {
        const tone = toast.tone || 'info';
        const meta =
          tone === 'success'
            ? { Icon: CheckCircle2, ring: 'ring-emerald-400/20', border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', text: 'text-emerald-600' }
            : tone === 'warning'
              ? { Icon: AlertTriangle, ring: 'ring-amber-400/20', border: 'border-amber-400/25', bg: 'bg-amber-500/10', text: 'text-amber-600' }
              : tone === 'error'
                ? { Icon: AlertTriangle, ring: 'ring-rose-400/20', border: 'border-rose-400/25', bg: 'bg-rose-500/10', text: 'text-rose-600' }
                : { Icon: Info, ring: 'ring-sky-400/20', border: 'border-sky-400/25', bg: 'bg-sky-500/10', text: 'text-sky-600' };
        const IconComp = meta.Icon;
        return (
          <div
            key={toast.id}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[90] flex justify-center px-4"
            aria-live="polite"
            role="status"
          >
            <div
              className={[
                'pointer-events-auto w-full max-w-md rounded-2xl border shadow-2xl shadow-black/40',
                'bg-[var(--app-surface)] backdrop-blur-md',
                'ring-1',
                meta.border,
                meta.ring,
              ].join(' ')}
            >
              <div className="flex items-start gap-3 p-3.5">
                <div className={['mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl ring-1', meta.bg, meta.ring].join(' ')}>
                  <IconComp className={['h-5 w-5', meta.text].join(' ')} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold text-[color:var(--app-text)]">แจ้งเตือน</div>
                  <div className="mt-0.5 text-sm font-semibold text-[color:var(--app-muted)] break-words">{toast.message}</div>
                </div>
                <button
                  type="button"
                  onClick={dismissToast}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                  aria-label="ปิดแจ้งเตือน"
                  title="ปิด"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}
