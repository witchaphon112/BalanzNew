"use client";
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Utensils, ShoppingBag, Car, Home, Zap, Heart, Gamepad2, Stethoscope, GraduationCap, Plane, Briefcase, Gift, Smartphone, Coffee, Music, Dumbbell, PawPrint, Scissors, CreditCard, Landmark, MoreHorizontal, Plus, Settings, Trash2, X, ChevronLeft, ChevronRight, LayoutGrid, Book, Bus, Train, Truck, Bicycle, Apple, Banana, Beer, Cake, Camera, Film, Globe, MapPin, Sun, Moon, Star, Tree, Flower, Leaf, Cloud, Snowflake, Droplet, Flame, Key, Lock, Bell, AlarmClock, Wallet, PiggyBank, ShoppingCart, Shirt, Glasses, Watch, Tablet, Tv, Speaker, Headphones, Printer, Cpu, MousePointer, Pen, Pencil, Paintbrush, Ruler, Calculator, Clipboard, Paperclip, Archive, Box, Package, Rocket, Medal, Trophy, Award, Flag, Target, Lightbulb, Battery, Plug, Wifi, Bluetooth, Signal, TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon } from 'lucide-react';

import Currency from '../currency/page';
import LoadingMascot from '@/components/LoadingMascot';
const CurrencyModalContent = ({ onClose }) => (
  <Currency onClose={onClose} />
);

// Brand tone (Blue product theme)
const PRIMARY_COLOR = '#2563EB'; // blue-600
const PRIMARY_COLOR_DARK = '#1D4ED8'; // blue-700
const INCOME_COLOR = '#22C55E'; // emerald-500
const EXPENSE_COLOR = '#F43F5E'; // rose-500
const NET_SAVING_COLOR = '#0F172A'; // slate-900
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const parseThaiMonthLabel = (label) => {
  if (!label || typeof label !== 'string') return null;
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const monthName = parts[0];
  const buddhistYear = Number(parts[1]);
  const monthIndex = MONTH_NAMES_TH.findIndex((m) => m === monthName);
  if (monthIndex < 0 || !Number.isFinite(buddhistYear)) return null;
  return { year: buddhistYear - 543, monthIndex };
};

const BANGKOK_TZ = 'Asia/Bangkok';

const getBangkokDateParts = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BANGKOK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const map = {};
    parts.forEach((p) => { if (p?.type) map[p.type] = p.value; });
    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return { year, monthIndex: month - 1, day };
  } catch {
    // Fallback: use local parts (may be inaccurate for users outside TH timezone)
    return { year: d.getFullYear(), monthIndex: d.getMonth(), day: d.getDate() };
  }
};

const toBangkokISODateKey = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  try {
    // en-CA yields YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: BANGKOK_TZ }).format(d);
  } catch {
    return toLocalISODateKey(d);
  }
};

const toLocalISODateKey = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ICON_MAP = {
  'food': Utensils, 'drink': Coffee, 'restaurant': Utensils,
  'shopping': ShoppingBag, 'gift': Gift, 'clothes': Scissors,
  'transport': Car, 'fuel': Zap, 'plane': Plane,
  'home': Home, 'bills': Zap, 'pet': PawPrint,
  'game': Gamepad2, 'music': Music, 'health': Stethoscope, 'sport': Dumbbell,
  'money': Landmark, 'salary': CreditCard, 'work': Briefcase,
  'education': GraduationCap, 'tech': Smartphone,
  'other': MoreHorizontal, 'love': Heart,
  'book': Book, 'bus': Bus, 'train': Train, 'truck': Truck, 'bicycle': Bicycle,
  'apple': Apple, 'banana': Banana, 'beer': Beer, 'cake': Cake, 'camera': Camera,
  'film': Film, 'globe': Globe, 'mappin': MapPin, 'sun': Sun, 'moon': Moon,
  'star': Star, 'tree': Tree, 'flower': Flower, 'leaf': Leaf, 'cloud': Cloud,
  'snowflake': Snowflake, 'water': Droplet, 'fire': Flame, 'key': Key, 'lock': Lock,
  'bell': Bell, 'alarmclock': AlarmClock, 'wallet': Wallet, 'piggybank': PiggyBank,
  'shoppingcart': ShoppingCart, 'shirt': Shirt, 'glasses': Glasses, 'watch': Watch,
  'tablet': Tablet, 'tv': Tv, 'speaker': Speaker, 'headphones': Headphones,
  'printer': Printer, 'cpu': Cpu, 'mousepointer': MousePointer, 'pen': Pen,
  'pencil': Pencil, 'paintbrush': Paintbrush, 'ruler': Ruler, 'calculator': Calculator,
  'clipboard': Clipboard, 'paperclip': Paperclip, 'archive': Archive, 'box': Box,
  'package': Package, 'truckdelivery': Truck, 'rocket': Rocket, 'medal': Medal,
  'trophy': Trophy, 'award': Award, 'flag': Flag, 'target': Target, 'lightbulb': Lightbulb,
  'battery': Battery, 'plug': Plug, 'wifi': Wifi, 'bluetooth': Bluetooth, 'signal': Signal,
};

function renderIcon(iconKey) {
  const IconComp = ICON_MAP[iconKey];
  if (IconComp) return <IconComp className="w-7 h-7" />;
  return <span className="text-2xl">{iconKey || '-'}</span>;
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Store JWT token from query string to localStorage (for LINE login)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      const profilePic = url.searchParams.get('profilePic');
      if (token) {
        localStorage.setItem('token', token);
      }
      if (profilePic) {
        try {
          localStorage.setItem('profilePic', profilePic);
        } catch {
          // ignore
        }
      }
      if (token || profilePic) {
        // Remove token/profilePic from URL for security
        url.searchParams.delete('token');
        url.searchParams.delete('profilePic');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    }
  }, []);

  // NOTE: Keep the first render identical between server and client to avoid hydration mismatch.
  // Load localStorage values in an effect instead of the useState initializer.
  const [userProfile, setUserProfile] = useState({ name: '', profilePic: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setUserProfile({
        name: localStorage.getItem('user_name') || '',
        profilePic: localStorage.getItem('profilePic') || '',
      });
    } catch {
      // ignore
    }
  }, []);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => getBangkokDateParts(Date.now())?.year || new Date().getFullYear());
  const [readNotifMap, setReadNotifMap] = useState(() => ({}));
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    recentTransactions: [],
    todayExpenseTotal: 0,
    currentMonthIncomeTotal: 0,
    currentMonthExpenseTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [categories, setCategories] = useState([]);
  const [budgetsByMonth, setBudgetsByMonth] = useState({}); // { [monthLabel]: { [categoryId]: number } }
  const [monthlyBudgetTotals, setMonthlyBudgetTotals] = useState({}); // { [monthLabel]: number }
  const [budgetCategoryTypeById, setBudgetCategoryTypeById] = useState({}); // { [categoryId]: 'expense'|'income'|... }
  const [editFormData, setEditFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    date: '',
    notes: '',
  });
  const [addFormData, setAddFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    date: toBangkokISODateKey(Date.now()),
    notes: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('dashboard_notif_read_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') setReadNotifMap(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('dashboard_notif_read_v1', JSON.stringify(readNotifMap || {}));
    } catch {
      // ignore
    }
  }, [readNotifMap]);

  useEffect(() => {
    if (!showNotifications) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowNotifications(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [showNotifications]);

  useEffect(() => {
    if (!showMonthPicker) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowMonthPicker(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [showMonthPicker]);

  /* --- Data & Logic Setup --- */
  const getMonths = () => {
    const currentDate = new Date();
    const nowParts = getBangkokDateParts(currentDate) || { year: currentDate.getFullYear(), monthIndex: currentDate.getMonth() };
    const currentYear = (nowParts.year || currentDate.getFullYear()) + 543; 
    const currentMonth = typeof nowParts.monthIndex === 'number' ? nowParts.monthIndex : currentDate.getMonth();
    const months = [];
    const span = 12;

    for (let i = -span; i <= span; i++) { 
      const monthIndex = (currentMonth + i) % 12;
      let yearOffset = Math.floor((currentMonth + i) / 12);
      if (monthIndex < 0) {
        yearOffset -= 1; 
      }
      const actualMonthIndex = (monthIndex + 12) % 12;
      const year = currentYear + yearOffset;
      months.push(`${MONTH_NAMES_TH[actualMonthIndex]} ${year}`);
    }
    return months;
  };

  const months = getMonths();
  const nowBkk = getBangkokDateParts(Date.now());
  const currentDate = new Date();
  const currentMonthYear = (() => {
    const p = nowBkk || getBangkokDateParts(currentDate) || { year: currentDate.getFullYear(), monthIndex: currentDate.getMonth() };
    return `${MONTH_NAMES_TH[p.monthIndex]} ${p.year + 543}`;
  })();
  
  const currentMonthInitialIndex = months.findIndex(m => m === currentMonthYear);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(currentMonthInitialIndex !== -1 ? currentMonthInitialIndex : Math.floor(months.length / 2));
  const selectedMonth = months[currentMonthIndex];

  const monthIndexMap = useMemo(() => {
    const map = new Map();
    months.forEach((label, idx) => {
      const p = parseThaiMonthLabel(label);
      if (!p) return;
      map.set(`${p.year}-${p.monthIndex}`, idx);
    });
    return map;
  }, [months]);

  const availableYears = useMemo(() => {
    const years = new Set();
    for (const key of monthIndexMap.keys()) {
      const y = Number(String(key).split('-')[0]);
      if (Number.isFinite(y)) years.add(y);
    }
    return Array.from(years.values()).sort((a, b) => b - a);
  }, [monthIndexMap]);

  const monthPickerMonthsForYear = useMemo(() => {
    const y = Number(monthPickerYear);
    const cells = MONTH_NAMES_TH.map((name, monthIndex) => {
      const idx = monthIndexMap.get(`${y}-${monthIndex}`);
      return { name, monthIndex, idx: typeof idx === 'number' ? idx : null };
    });
    return cells;
  }, [monthIndexMap, monthPickerYear]);

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error((await res.json()).message || 'Failed to fetch transactions');
      }     
      const transactions = await res.json();

      // Always compute "today spend" from ALL transactions (not only the selected month),
      // so the card stays correct even when viewing past/future months.
      const todayKey = toBangkokISODateKey(Date.now());
      const todayExpenseTotal = (Array.isArray(transactions) ? transactions : [])
        .filter((t) => t?.type === 'expense' && toBangkokISODateKey(t?.date) === todayKey)
        .reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);

      // Also compute current-month totals from ALL transactions (for "ต่อวัน" targets).
      const nowParts = getBangkokDateParts(Date.now());
      const cmIncome = (Array.isArray(transactions) ? transactions : [])
        .filter((t) => {
          if (t?.type !== 'income') return false;
          if (!nowParts) return false;
          const p = getBangkokDateParts(t?.date);
          return !!p && p.year === nowParts.year && p.monthIndex === nowParts.monthIndex;
        })
        .reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
      const cmExpense = (Array.isArray(transactions) ? transactions : [])
        .filter((t) => {
          if (t?.type !== 'expense') return false;
          if (!nowParts) return false;
          const p = getBangkokDateParts(t?.date);
          return !!p && p.year === nowParts.year && p.monthIndex === nowParts.monthIndex;
        })
        .reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
      
      const selectedMonthName = selectedMonth.split(' ')[0];
      const selectedYear = selectedMonth.split(' ')[1];

      const filteredTransactions = transactions.filter(t => {
        const p = getBangkokDateParts(t?.date);
        if (!p) return false;
        const tMonthIndex = p.monthIndex;
        const tYearBuddhist = p.year + 543;
        return MONTH_NAMES_TH[tMonthIndex] === selectedMonthName && String(tYearBuddhist) === String(selectedYear);
      });

      const sortedTransactions = filteredTransactions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      const totalIncome = filteredTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = filteredTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
      setStats({
        totalIncome,
        totalExpenses,
        netSavings: totalIncome - totalExpenses,
        recentTransactions: sortedTransactions.slice(0, 5),
        transactionsAll: filteredTransactions,
        todayExpenseTotal,
        currentMonthIncomeTotal: Number(cmIncome) || 0,
        currentMonthExpenseTotal: Number(cmExpense) || 0,
      });
      setError('');
      
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (error.message || 'Error'));
      setStats({ totalIncome: 0, totalExpenses: 0, netSavings: 0, recentTransactions: [], todayExpenseTotal: 0, currentMonthIncomeTotal: 0, currentMonthExpenseTotal: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    let refreshTimer = null;
    let refreshInFlight = false;

    const safeJson = async (res) => {
      try {
        const text = await res.text();
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    const fetchBudgets = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [budgetRes, totalRes] = await Promise.all([
          fetch(`${API_BASE}/api/budgets`, { headers }),
          fetch(`${API_BASE}/api/budgets/total`, { headers }),
        ]);

        const buds = await safeJson(budgetRes);
        const totals = await safeJson(totalRes);

        if (budgetRes.ok && Array.isArray(buds)) {
          const map = {};
          const typeMap = {};
          buds.forEach((b) => {
            const month = b?.month;
            if (!month) return;
            if (!map[month]) map[month] = {};
            const catId = (b?.category && typeof b.category === 'object')
              ? (b.category?._id || '')
              : (b?.category || '');
            if (!catId) return;
            map[month][catId] = Number(b?.total ?? 0) || 0;
            if (b?.category && typeof b.category === 'object') {
              const t = b.category?.type;
              if (typeof t === 'string' && t) typeMap[catId] = t;
            }
          });
          setBudgetsByMonth(map);
          setBudgetCategoryTypeById(typeMap);
        }

        if (totalRes.ok && Array.isArray(totals)) {
          const tMap = {};
          totals.forEach((tb) => {
            const month = tb?.month;
            if (!month) return;
            tMap[month] = Number(tb?.total ?? 0) || 0;
          });
          setMonthlyBudgetTotals(tMap);
        }
      } catch (e) {
        // ignore budgets load errors (dashboard can still work)
      }
    };

    if (!token) {
        window.location.href = '/login';
        return;
    }

    const refreshAll = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      Promise.allSettled([fetchStats(), fetchCategories(), fetchBudgets()])
        .finally(() => { refreshInFlight = false; });
    };

    const scheduleRefresh = () => {
      try {
        if (refreshTimer) clearTimeout(refreshTimer);
      } catch {}
      refreshTimer = setTimeout(() => refreshAll(), 120);
    };

    refreshAll();

    const onFocus = () => scheduleRefresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    
    return () => {
      try {
        if (refreshTimer) clearTimeout(refreshTimer);
      } catch {}
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [selectedMonth]);

  // Fetch profile from backend (LINE user is linked to our User model)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) return;

    let cancelled = false;
    const loadMe = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // token expired/invalid
          if (res.status === 401) {
            try { localStorage.removeItem('token'); } catch {}
            if (!cancelled) window.location.href = '/login';
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const next = {
          name: data?.name || '',
          profilePic: data?.profilePic || (typeof window !== 'undefined' ? (localStorage.getItem('profilePic') || '') : ''),
        };
        setUserProfile(next);
        try {
          localStorage.setItem('user_name', next.name || '');
          if (next.profilePic) localStorage.setItem('profilePic', next.profilePic);
        } catch {
          // ignore
        }
      } catch (err) {
        // ignore profile load errors (dashboard can still work)
      }
    };

    loadMe();
    return () => { cancelled = true; };
  }, []);

  const handleView = (transaction) => {
    setViewingTransaction(transaction);
    setShowViewModal(true);
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setEditFormData({
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category?._id || '',
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

      if (!res.ok) {
        throw new Error('Failed to delete transaction');
      }

      fetchStats();
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการลบ: ' + error.message);
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
      if (!res.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาด');
      }

      setShowEditModal(false);
      setEditingTransaction(null);
      fetchStats();
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!addFormData.amount || parseFloat(addFormData.amount) <= 0) {
      setError('กรุณากรอกจำนวนเงินที่มากกว่า 0');
      return;
    }

    if (!addFormData.category) {
      setError('กรุณาเลือกหมวดหมู่');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...addFormData,
          amount: parseFloat(addFormData.amount),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาด');
      }

      setShowAddModal(false);
      setAddFormData({
        amount: '',
        type: 'expense',
        category: '',
        date: toBangkokISODateKey(Date.now()),
        notes: '',
      });
      fetchStats();
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const formatCurrentDate = () => {
    const p = getBangkokDateParts(Date.now());
    if (!p) {
      const d = new Date();
      const m = MONTH_NAMES_TH[d.getMonth()];
      const day = d.getDate();
      const year = d.getFullYear() + 543;
      return `${m} ${day}, ${year}`;
    }
    const m = MONTH_NAMES_TH[p.monthIndex];
    return `${m} ${p.day}, ${p.year + 543}`;
  };

  const formatTHB = (value) => {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('th-TH');
    return `${n < 0 ? '-' : ''}฿${formatted}`;
  };

  const selectedParsed = useMemo(() => parseThaiMonthLabel(selectedMonth), [selectedMonth]);
  const monthExpenseBudgetTotal = useMemo(() => {
    const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
    const entries = Object.entries(monthBudgets || {});
    if (!entries.length) return 0;
    let sum = 0;
    for (const [categoryId, total] of entries) {
      const cat = (categories || []).find((c) => c?._id === categoryId);
      const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
      if (type && type !== 'expense') continue;
      sum += Number(total) || 0;
    }
    return Number(sum) || 0;
  }, [budgetsByMonth, selectedMonth, categories, budgetCategoryTypeById]);

  const currentMonthIncomeBudgetTotal = useMemo(() => {
    const monthBudgets = budgetsByMonth?.[currentMonthYear] || {};
    const entries = Object.entries(monthBudgets || {});
    if (!entries.length) return 0;
    let sum = 0;
    for (const [categoryId, total] of entries) {
      const cat = (categories || []).find((c) => c?._id === categoryId);
      const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
      if (type && type !== 'income') continue;
      sum += Number(total) || 0;
    }
    return Number(sum) || 0;
  }, [budgetsByMonth, currentMonthYear, categories, budgetCategoryTypeById]);

  const monthIncomeBudgetTotal = useMemo(() => {
    const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
    const entries = Object.entries(monthBudgets || {});
    if (!entries.length) return 0;
    let sum = 0;
    for (const [categoryId, total] of entries) {
      const cat = (categories || []).find((c) => c?._id === categoryId);
      const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
      if (type && type !== 'income') continue;
      sum += Number(total) || 0;
    }
    return Number(sum) || 0;
  }, [budgetsByMonth, selectedMonth, categories, budgetCategoryTypeById]);

  const monthIncomeTotal = useMemo(() => {
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    return src.filter((t) => t?.type === 'income').reduce((s, t) => s + (Number(t?.amount) || 0), 0);
  }, [stats.transactionsAll]);

  const monthExpenseTotal = useMemo(() => {
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    return src.filter((t) => t?.type === 'expense').reduce((s, t) => s + (Number(t?.amount) || 0), 0);
  }, [stats.transactionsAll]);

  const todaySpend = useMemo(() => Number(stats?.todayExpenseTotal) || 0, [stats?.todayExpenseTotal]);

  const daysInSelectedMonth = useMemo(() => {
    const parsed = selectedParsed;
    if (!parsed) return 30;
    const d = new Date(parsed.year, parsed.monthIndex + 1, 0);
    const n = d.getDate();
    return Number.isFinite(n) && n > 0 ? n : 30;
  }, [selectedParsed]);

  const daysInCurrentMonth = useMemo(() => {
    const p = nowBkk;
    if (!p) return 30;
    const d = new Date(p.year, p.monthIndex + 1, 0);
    const n = d.getDate();
    return Number.isFinite(n) && n > 0 ? n : 30;
  }, [nowBkk]);

  const daysUntilReset = useMemo(() => {
    const parsed = selectedParsed;
    if (!parsed) return 0;
    const nowParts = nowBkk;
    if (!nowParts || nowParts.year !== parsed.year || nowParts.monthIndex !== parsed.monthIndex) return 0;
    return Math.max(0, (Number(daysInSelectedMonth) || 0) - (Number(nowParts.day) || 0) + 1);
  }, [selectedParsed, nowBkk, daysInSelectedMonth]);

  const dailyTargetToday = useMemo(() => {
    const incomeActual = Number(stats?.currentMonthIncomeTotal) || 0;
    const incomeBudget = Number(currentMonthIncomeBudgetTotal) || 0;
    const base = incomeActual > 0 ? incomeActual : incomeBudget;
    if (base > 0) return base / Math.max(1, daysInCurrentMonth);
    return 0;
  }, [stats?.currentMonthIncomeTotal, currentMonthIncomeBudgetTotal, daysInCurrentMonth]);

  const monthRemaining = useMemo(() => {
    const incomeActual = Number(monthIncomeTotal) || 0;
    const expenseActual = Number(monthExpenseTotal) || 0;
    const incomeBudget = Number(monthIncomeBudgetTotal) || 0;
    const expenseBudget = Number(monthExpenseBudgetTotal) || 0;

    // Prefer actual income as the base for "remaining this month".
    // If the user has no income transactions yet, fall back to income budget (if any),
    // then to expense budget (classic budget mode).
    const base = incomeActual > 0 ? incomeActual : incomeBudget > 0 ? incomeBudget : expenseBudget;
    return base - expenseActual;
  }, [monthExpenseBudgetTotal, monthExpenseTotal, monthIncomeTotal, monthIncomeBudgetTotal]);

  const healthAnalysis = useMemo(() => {
    const income = Number(monthIncomeTotal) || 0;
    const expense = Math.max(0, Number(monthExpenseTotal) || 0);
    const budgetTotal = Number(monthExpenseBudgetTotal) || 0;
    const hasBudget = budgetTotal > 0;

    const savings = income - expense;
    const savingsRate = income > 0 ? savings / income : null; // -inf..1
    const expenseRatio = income > 0 ? expense / income : null; // 0..inf

    const parsed = selectedParsed;
    const nowParts = nowBkk;
    const isCurrentMonth = !!parsed && !!nowParts && nowParts.year === parsed.year && nowParts.monthIndex === parsed.monthIndex;
    const progress = isCurrentMonth ? Math.max(0.05, Math.min(1, (Number(nowParts?.day) || 1) / Math.max(1, daysInSelectedMonth))) : 1;

    const expectedSpendSoFar = hasBudget ? budgetTotal * progress : null;
    const paceRatio = hasBudget && expectedSpendSoFar && expectedSpendSoFar > 0 ? expense / expectedSpendSoFar : null;

    let score = 0;
    if (income <= 0) {
      score = expense > 0 ? 10 : 0;
    } else {
      const s = Math.max(0, Math.min(1, (Number.isFinite(savingsRate) ? savingsRate : 0) / 0.3)); // 30%+ => full
      const savingsComponent = 50 * s;

      let budgetComponent = 0;
      let paceComponent = 0;

      if (hasBudget && expectedSpendSoFar && expectedSpendSoFar > 0) {
        const pr = Number(paceRatio) || 0;
        const paceScore = pr <= 1 ? 1 : Math.max(0, 1 - (pr - 1) / 0.6); // 0 at 1.6x pace
        budgetComponent = 30 * paceScore;

        if (isCurrentMonth) {
          const remainingDays = Math.max(1, daysInSelectedMonth - (Number(nowParts?.day) || 1) + 1);
          const remainingBudget = budgetTotal - expense;
          const neededPerDay = remainingBudget / remainingDays;
          const targetPerDay = budgetTotal / Math.max(1, daysInSelectedMonth);
          const dpRatio = targetPerDay > 0 ? neededPerDay / targetPerDay : 1;
          const dailyScore = dpRatio <= 1 ? 1 : Math.max(0, 1 - (dpRatio - 1) / 1); // 0 at 2x
          paceComponent = 20 * dailyScore;
        } else {
          paceComponent = 20;
        }
      } else {
        const er = Number(expenseRatio);
        const expenseScore = !Number.isFinite(er) ? 0 : er <= 0.55 ? 1 : er >= 1 ? 0 : 1 - (er - 0.55) / 0.45;
        budgetComponent = 30 * expenseScore;
        paceComponent = 20 * (isCurrentMonth ? Math.max(0, Math.min(1, (Number.isFinite(savingsRate) ? savingsRate : 0) / 0.2)) : 1);
      }

      score = Math.round(Math.max(0, Math.min(100, savingsComponent + budgetComponent + paceComponent)));
    }

    let label = 'ควรปรับปรุง';
    let tone = 'text-rose-200';
    let ringColor = '#FB7185'; // rose-400

    if (income <= 0 && expense > 0) {
      label = 'ยังไม่มีรายรับ';
      tone = 'text-rose-200';
      ringColor = '#FB7185';
    } else if (hasBudget && expense > budgetTotal) {
      label = 'เกินงบแล้ว';
      tone = 'text-rose-200';
      ringColor = '#FB7185';
    } else if (score >= 80) {
      label = 'ดีเยี่ยม';
      tone = 'text-emerald-200';
      ringColor = '#34D399'; // emerald-400
    } else if (score >= 60) {
      label = 'ดี';
      tone = 'text-sky-200';
      ringColor = '#38BDF8'; // sky-400
    } else if (score >= 40) {
      label = 'พอใช้';
      tone = 'text-amber-200';
      ringColor = '#FACC15'; // amber-400
    }

    const parts = [];
    if (income > 0 && Number.isFinite(savingsRate)) {
      parts.push(`ออม ${Math.round(savingsRate * 100)}%`);
    } else if (income <= 0) {
      parts.push('ไม่มีรายรับ');
    }

    if (hasBudget) {
      parts.push(`ใช้งบ ${Math.round((expense / Math.max(1, budgetTotal)) * 100)}%`);
      if (isCurrentMonth && expectedSpendSoFar && expectedSpendSoFar > 0) {
        const pr = Number(paceRatio) || 0;
        if (pr >= 1.15) parts.push('ใช้เร็วกว่าแผน');
        else if (pr <= 0.85) parts.push('คุมงบได้ดี');
        else parts.push('ตามแผน');
      }
    } else if (income > 0 && Number.isFinite(expenseRatio)) {
      parts.push(`รายจ่าย ${Math.round(expenseRatio * 100)}% ของรายรับ`);
    }

    let hint = '';
    if (!hasBudget) hint = 'แนะนำ: ตั้งงบประมาณรายเดือนเพื่อประเมินได้แม่นขึ้น';
    else if (income > 0 && Number.isFinite(savingsRate) && savingsRate < 0.1) hint = 'แนะนำ: พยายามเหลือออมอย่างน้อย 10%';
    else if (hasBudget && expense > budgetTotal) hint = 'แนะนำ: ลดรายจ่ายหรือปรับงบให้เหมาะกับเดือนนี้';
    else hint = 'ดูแนวโน้มรายจ่ายและจุดรั่วไหลเพื่อปรับพฤติกรรม';

    return {
      score,
      label,
      tone,
      ringColor,
      summary: parts.join(' • '),
      hint,
    };
  }, [monthIncomeTotal, monthExpenseTotal, monthExpenseBudgetTotal, selectedParsed, daysInSelectedMonth, nowBkk]);

  const leakItems = useMemo(() => {
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    const map = new Map();
    for (const t of src) {
      if (!t || t.type !== 'expense') continue;
      const amt = Number(t.amount) || 0;
      if (amt <= 0) continue;
      const id = t.category?._id || t.category || '_none';
      const name = t.category?.name || 'ไม่ระบุ';
      const icon = t.category?.icon || 'other';
      const prev = map.get(id) || { id, name, icon, amount: 0 };
      prev.amount += amt;
      map.set(id, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [stats.transactionsAll]);

  const notifications = useMemo(() => {
    if (loading) return [];

    const income = Number(monthIncomeTotal) || 0;
    const expense = Math.max(0, Number(monthExpenseTotal) || 0);
    const budgetTotal = Number(monthExpenseBudgetTotal) || 0;
    const hasBudget = budgetTotal > 0;

    const parsed = selectedParsed;
    const nowParts = nowBkk;
    const isCurrentMonth = !!parsed && !!nowParts && nowParts.year === parsed.year && nowParts.monthIndex === parsed.monthIndex;
    const progress = isCurrentMonth ? Math.max(0.05, Math.min(1, (Number(nowParts?.day) || 1) / Math.max(1, daysInSelectedMonth))) : 1;
    const expectedSpendSoFar = hasBudget ? budgetTotal * progress : 0;

    const list = [];
    const push = (n) => { if (n && n.id) list.push(n); };

    if (hasBudget && expense > budgetTotal) {
      push({
        id: `budget_over_${selectedMonth}`,
        tone: 'rose',
        icon: TrendingDownIcon,
        title: 'ใช้จ่ายเกินงบเดือนนี้แล้ว',
        body: `ใช้งบไป ${Math.round((expense / Math.max(1, budgetTotal)) * 100)}% • เกิน ${formatTHB(expense - budgetTotal)}`,
        href: '/budget',
        cta: 'ไปหน้างบประมาณ',
      });
    } else if (hasBudget && expense / Math.max(1, budgetTotal) >= 0.85) {
      push({
        id: `budget_near_${selectedMonth}`,
        tone: 'amber',
        icon: Target,
        title: 'ใกล้ถึงงบประมาณเดือนนี้',
        body: `ใช้งบไป ${Math.round((expense / Math.max(1, budgetTotal)) * 100)}% • เหลือ ${formatTHB(Math.max(0, budgetTotal - expense))}`,
        href: '/budget',
        cta: 'ดูงบประมาณ',
      });
    }

    if (hasBudget && isCurrentMonth && expectedSpendSoFar > 0 && expense / expectedSpendSoFar >= 1.15) {
      push({
        id: `budget_pace_${selectedMonth}`,
        tone: 'amber',
        icon: Zap,
        title: 'ใช้จ่ายเร็วกว่าแผน',
        body: `ควรใช้ราว ${formatTHB(expectedSpendSoFar)} แต่ตอนนี้ใช้ไป ${formatTHB(expense)}`,
        href: '/analytics',
        cta: 'ดูสถิติรายจ่าย',
      });
    }

    if (income <= 0 && expense > 0) {
      push({
        id: `no_income_${selectedMonth}`,
        tone: 'rose',
        icon: Wallet,
        title: 'เดือนนี้ยังไม่มีรายรับ',
        body: `แต่มีรายจ่าย ${formatTHB(expense)} ลองบันทึกรายรับเพื่อให้วิเคราะห์แม่นขึ้น`,
        href: '/transactions',
        cta: 'ไปหน้ารายการ',
      });
    }

    if (Number.isFinite(healthAnalysis?.score) && healthAnalysis.score < 40 && income > 0) {
      push({
        id: `health_low_${selectedMonth}`,
        tone: 'rose',
        icon: Lightbulb,
        title: 'สุขภาพการเงินควรปรับปรุง',
        body: healthAnalysis.summary || 'ลองลดรายจ่ายหรือเพิ่มรายรับเพื่อให้เหลือออมมากขึ้น',
        href: '/analytics',
        cta: 'ดูภาพรวม',
      });
    }

    if (isCurrentMonth && dailyTargetToday > 0 && todaySpend > dailyTargetToday * 1.25) {
      push({
        id: `daily_over_${selectedMonth}`,
        tone: 'amber',
        icon: TrendingDownIcon,
        title: 'วันนี้ใช้เกินเป้าที่ตั้งไว้',
        body: `ใช้ไป ${formatTHB(todaySpend)} จากเป้า ${formatTHB(dailyTargetToday)}`,
        href: '/transactions',
        cta: 'ดูรายการวันนี้',
      });
    }

    if (Array.isArray(leakItems) && leakItems[0] && expense > 0) {
      const top = leakItems[0];
      const pct = top.amount / Math.max(1, expense);
      if (pct >= 0.35) {
        push({
          id: `leak_top_${selectedMonth}`,
          tone: 'sky',
          icon: TrendingDownIcon,
          title: 'หมวดนี้ใช้เยอะเป็นพิเศษ',
          body: `${top.name} คิดเป็น ${Math.round(pct * 100)}% ของรายจ่ายเดือนนี้`,
          href: '/analytics',
          cta: 'ดูสัดส่วนรายจ่าย',
        });
      }
    }

    if (isCurrentMonth && daysUntilReset > 0 && daysUntilReset <= 3 && hasBudget) {
      push({
        id: `reset_soon_${selectedMonth}`,
        tone: 'sky',
        icon: AlarmClock,
        title: 'งบประมาณใกล้รีเซ็ต',
        body: `เหลืออีก ${daysUntilReset} วัน งบเดือนนี้จะรีเซ็ต`,
        href: '/budget',
        cta: 'ตรวจงบเดือนนี้',
      });
    }

    if (list.length === 0) {
      push({
        id: `all_good_${selectedMonth}`,
        tone: 'emerald',
        icon: TrendingUpIcon,
        title: 'ทุกอย่างดูโอเค',
        body: 'ยังไม่พบสิ่งที่ควรแจ้งเตือนในตอนนี้',
        href: '/analytics',
        cta: 'ดูสรุปการเงิน',
      });
    }

    return list;
  }, [
    loading,
    monthIncomeTotal,
    monthExpenseTotal,
    monthExpenseBudgetTotal,
    selectedParsed,
    daysInSelectedMonth,
    daysUntilReset,
    todaySpend,
    dailyTargetToday,
    leakItems,
    healthAnalysis,
    selectedMonth,
    nowBkk,
  ]);

  const unreadNotifCount = useMemo(() => {
    const read = readNotifMap || {};
    return (notifications || []).reduce((acc, n) => acc + (read?.[n.id] ? 0 : 1), 0);
  }, [notifications, readNotifMap]);

  const markNotifRead = (id) => {
    if (!id) return;
    setReadNotifMap((prev) => {
      const curr = prev && typeof prev === 'object' ? prev : {};
      if (curr[id]) return curr;
      return { ...curr, [id]: Date.now() };
    });
  };

  const markAllNotifsRead = () => {
    setReadNotifMap((prev) => {
      const curr = prev && typeof prev === 'object' ? prev : {};
      const next = { ...curr };
      (notifications || []).forEach((n) => {
        if (n?.id && !next[n.id]) next[n.id] = Date.now();
      });
      return next;
    });
  };

  const notifToneUI = (tone) => {
    if (tone === 'rose') return { iconBg: 'bg-rose-500/15 text-rose-200 ring-rose-400/20', border: 'border-rose-400/15' };
    if (tone === 'amber') return { iconBg: 'bg-amber-500/15 text-amber-200 ring-amber-400/20', border: 'border-amber-400/15' };
    if (tone === 'sky') return { iconBg: 'bg-sky-500/15 text-sky-200 ring-sky-400/20', border: 'border-sky-400/15' };
    return { iconBg: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20', border: 'border-emerald-400/15' };
  };

  const budgetRows = useMemo(() => {
    const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
    const entries = Object.entries(monthBudgets || {});
    if (!entries.length) return [];

    const spentByCategory = new Map();
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    for (const t of src) {
      if (!t || t.type !== 'expense') continue;
      const id = t.category?._id || t.category || '';
      if (!id) continue;
      spentByCategory.set(id, (spentByCategory.get(id) || 0) + (Number(t.amount) || 0));
    }

    const colors = ['#38BDF8', '#FACC15', '#A78BFA']; // sky, yellow, violet
    const rows = entries
      .map(([categoryId, total], idx) => {
        const cat = (categories || []).find((c) => c?._id === categoryId);
        const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
        if (type && type !== 'expense') return null;
        const budget = Number(total) || 0;
        const spent = Math.max(0, Number(spentByCategory.get(categoryId) || 0));
        return {
          id: categoryId,
          name: cat?.name || 'หมวดหมู่',
          icon: cat?.icon || 'other',
          spent,
          budget,
          pct: budget > 0 ? Math.max(0, Math.min(1, spent / budget)) : 0,
          color: colors[idx % colors.length],
        };
      })
      .filter(Boolean)
      .filter((r) => r.budget > 0)
      .sort((a, b) => b.pct - a.pct);

    return rows.slice(0, 2);
  }, [budgetsByMonth, selectedMonth, stats.transactionsAll, categories, budgetCategoryTypeById]);

  /* --- JSX Rendering --- */

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[color:var(--app-text)]">
      <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+88px)] space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-[var(--app-surface)] shadow-sm shadow-black/10 border border-[color:var(--app-border)] flex items-center justify-center shrink-0">
              {userProfile.profilePic ? (
                <img
                  src={userProfile.profilePic}
                  alt={userProfile.name || 'Profile'}
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/25 flex items-center justify-center font-extrabold">
                  {(userProfile.name || 'B').trim().slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[color:var(--app-muted)] truncate">Welcome back</div>
              <div className="text-lg font-extrabold text-[color:var(--app-text)] truncate">{userProfile.name || 'Balanz'}</div>
              <div className="text-[11px] font-semibold text-[color:var(--app-muted-2)]">{formatCurrentDate()}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCurrencyModal(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-surface)] shadow-sm shadow-black/10 border border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition"
              aria-label="อัตราแลกเปลี่ยน"
              title="อัตราแลกเปลี่ยน"
            >
              <svg className="h-5 w-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m-5 3H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setShowNotifications(true)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-surface)] shadow-sm shadow-black/10 border border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition"
              aria-label="การแจ้งเตือน"
              title="การแจ้งเตือน"
            >
              {unreadNotifCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-[color:var(--app-bg)]"
                  aria-label={`มีการแจ้งเตือนใหม่ ${unreadNotifCount} รายการ`}
                >
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-2 shadow-sm shadow-black/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonthIndex((p) => Math.max(0, p - 1))}
                disabled={currentMonthIndex === 0}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const p = parseThaiMonthLabel(selectedMonth);
                  setMonthPickerYear(p?.year || new Date().getFullYear());
                  setShowMonthPicker(true);
                }}
                className="min-w-0 flex-1 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2 text-center hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                aria-label="เปิดปฏิทินเลือกเดือน"
              >
                <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">เดือนที่เลือก</div>
                <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">{selectedMonth}</div>
              </button>

              <button
                type="button"
                onClick={() => setCurrentMonthIndex((p) => Math.min(months.length - 1, p + 1))}
                disabled={currentMonthIndex === months.length - 1}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <Link
            href="/budget"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 text-sm font-extrabold text-[color:var(--app-text)] shadow-sm shadow-black/10 hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
          >
            <Plus className="h-4 w-4" />
            งบประมาณ
          </Link>
        </div>

        {/* Currency Modal */}
        {showCurrencyModal && (
          <CurrencyModalContent onClose={() => setShowCurrencyModal(false)} />
        )}

        {/* Month Picker Modal */}
        {showMonthPicker && (
          <div
            className="fixed inset-0 z-[75] bg-slate-950/45 backdrop-blur-sm flex items-start justify-center p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+88px)]"
            onClick={(e) => e.target === e.currentTarget && setShowMonthPicker(false)}
          >
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-5 py-4">
                <div>
                  <div className="text-sm font-extrabold text-[color:var(--app-text)]">เลือกเดือน</div>
                  <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">แตะเพื่อดูสรุปของเดือนนั้น</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMonthPicker(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableYears.indexOf(monthPickerYear);
                      const next = idx >= 0 ? availableYears[idx + 1] : null;
                      if (typeof next === 'number') setMonthPickerYear(next);
                    }}
                    disabled={availableYears.indexOf(monthPickerYear) >= availableYears.length - 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                    aria-label="ปีก่อนหน้า"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="min-w-0 flex-1 text-center">
                    <div className="text-sm font-extrabold text-[color:var(--app-text)]">
                      {Number(monthPickerYear) + 543}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">พ.ศ.</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableYears.indexOf(monthPickerYear);
                      const prev = idx > 0 ? availableYears[idx - 1] : null;
                      if (typeof prev === 'number') setMonthPickerYear(prev);
                    }}
                    disabled={availableYears.indexOf(monthPickerYear) <= 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                    aria-label="ปีถัดไป"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {monthPickerMonthsForYear.map((m) => {
                    const isActive = typeof m.idx === 'number' && m.idx === currentMonthIndex;
                    const disabled = m.idx == null;
                    return (
                      <button
                        key={`${monthPickerYear}-${m.monthIndex}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (typeof m.idx === 'number') setCurrentMonthIndex(m.idx);
                          setShowMonthPicker(false);
                        }}
                        className={[
                          'h-11 rounded-2xl border px-3 text-sm font-extrabold transition',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
                          disabled
                            ? 'border-white/10 bg-white/5 text-[color:var(--app-muted-2)] opacity-50 cursor-not-allowed'
                            : isActive
                              ? 'border-emerald-400/30 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                              : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
                        ].join(' ')}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const idx = currentMonthInitialIndex !== -1 ? currentMonthInitialIndex : currentMonthIndex;
                    setCurrentMonthIndex(idx);
                    setShowMonthPicker(false);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-slate-100 hover:bg-white/10"
                >
                  เดือนนี้
                </button>
                <button
                  type="button"
                  onClick={() => setShowMonthPicker(false)}
                  className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Modal */}
        {showNotifications && (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm flex items-start justify-center p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+88px)]"
            onClick={(e) => e.target === e.currentTarget && setShowNotifications(false)}
          >
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-[color:var(--app-text)]">การแจ้งเตือน</div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      {unreadNotifCount > 0 ? `ยังไม่อ่าน ${unreadNotifCount} รายการ` : 'ไม่มีรายการที่ยังไม่อ่าน'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[62dvh] overflow-y-auto p-4 space-y-3">
                {notifications.map((n) => {
                  const read = !!readNotifMap?.[n.id];
                  const Icon = n.icon || Bell;
                  const ui = notifToneUI(n.tone);
                  const row = (
                    <div
                      className={[
                        'rounded-3xl border bg-white/0 p-4 transition',
                        'hover:bg-white/5',
                        ui.border,
                        read ? 'opacity-80' : 'opacity-100',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={[
                            'h-11 w-11 rounded-2xl shrink-0 ring-1 flex items-center justify-center',
                            ui.iconBg,
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">{n.title}</div>
                              <div className="mt-1 text-xs font-semibold text-slate-400">{n.body}</div>
                            </div>
                            {!read && <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />}
                          </div>

                          {n.cta && (
                            <div className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-emerald-200">
                              {n.cta}
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  if (n.href) {
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => {
                          markNotifRead(n.id);
                          setShowNotifications(false);
                        }}
                        className="block focus:outline-none focus:ring-2 focus:ring-emerald-400/30 rounded-3xl"
                      >
                        {row}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markNotifRead(n.id)}
                      className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-emerald-400/30 rounded-3xl"
                    >
                      {row}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => { markAllNotifsRead(); }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-slate-100 hover:bg-white/10"
                >
                  อ่านแล้วทั้งหมด
                </button>
                <Link
                  href="/transactions"
                  onClick={() => setShowNotifications(false)}
                  className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
                >
                  ไปหน้ารายการ
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-200 shadow-sm">
            <svg className="w-5 h-5 text-rose-200 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <p className="text-rose-200 font-semibold text-sm">{error}</p>
          </div>
        )}

        {/* Summary grid (match reference UI) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Financial health */}
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/10">
            <div className="flex items-start justify-between">
              <div className="relative h-14 w-14">
                {(() => {
                  const r = 22;
                  const circ = 2 * Math.PI * r;
                  const pct = Math.max(0, Math.min(100, Number(healthAnalysis.score) || 0));
                  const dash = (pct / 100) * circ;
                  return (
                    <svg viewBox="0 0 56 56" className="h-14 w-14">
                      <g transform="rotate(-90 28 28)">
                        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--app-border)" strokeWidth="6" />
                        <circle
                          cx="28"
                          cy="28"
                          r={r}
                          fill="none"
                          stroke={healthAnalysis.ringColor}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${Math.max(0, circ - dash)}`}
                        />
                      </g>
                      <text x="28" y="33" textAnchor="middle" fontSize="16" fill="var(--app-text)" fontWeight="800">
                        {pct}
                      </text>
                    </svg>
                  );
                })()}
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                <Lightbulb className="h-6 w-6 text-[color:var(--app-muted-2)]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 text-base font-extrabold text-[color:var(--app-text)]">สุขภาพการเงิน</div>
            <div className={`mt-1 text-xs font-semibold ${healthAnalysis.tone}`}>{healthAnalysis.label}</div>
            <div className="mt-2 text-[11px] font-semibold text-slate-400">{healthAnalysis.summary}</div>
            <div className="mt-2 line-clamp-2 text-[11px] font-semibold text-[color:var(--app-muted-2)]">{healthAnalysis.hint}</div>
          </div>

          {/* Right column */}
          <div className="grid grid-rows-2 gap-3">
            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/10">
              <div className="text-xs font-semibold text-slate-400">ใช้ไปวันนี้</div>
              <div className="mt-1 flex items-end gap-2">
                <div className="text-2xl font-extrabold text-[color:var(--app-text)]">{formatTHB(todaySpend)}</div>
                <div className="pb-1 text-sm font-semibold text-[color:var(--app-muted-2)]">
                  {dailyTargetToday > 0 ? `ใช้ได้ต่อวัน ${formatTHB(dailyTargetToday)}` : 'ยังไม่มีรายรับเดือนนี้'}
                </div>
              </div>
              <div className="mt-3 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${dailyTargetToday > 0 ? Math.max(0, Math.min(100, (todaySpend / dailyTargetToday) * 100)) : 0}%` }}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/10">
              <div className="text-xs font-semibold text-slate-400">คงเหลือเดือนนี้</div>
              <div className={`mt-1 text-3xl font-extrabold ${monthRemaining < 0 ? 'text-rose-300' : 'text-[color:var(--app-text)]'}`}>
                {loading ? '—' : formatTHB(monthRemaining)}
              </div>
            </div>
          </div>
        </div>

        {/* Leak points */}
        {leakItems.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[color:var(--app-text)]">จุดรั่วไหล</h2>
              <Link href="/analytics" className="text-sm font-extrabold text-sky-300 hover:text-sky-200">
                ดูทั้งหมด
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {leakItems.map((it) => (
                <div key={it.id} className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/10">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-rose-200">
                    <div className="scale-90">{renderIcon(it.icon)}</div>
                  </div>
                  <div className="mt-3 text-center text-sm font-extrabold text-[color:var(--app-text)] truncate">{it.name}</div>
                  <div className="mt-1 text-center text-sm font-extrabold text-rose-300">
                    -{formatTHB(it.amount)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Budget */}
        <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm shadow-black/10">
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold text-[color:var(--app-text)]">งบประมาณ</div>
            <div className="text-xs font-semibold text-[color:var(--app-muted-2)]">รีเซ็ตใน {daysUntilReset} วัน</div>
          </div>

          {budgetRows.length === 0 ? (
            <div className="mt-4">
              <div className="text-sm font-semibold text-slate-400">ยังไม่มีการตั้งงบประมาณ</div>
              <Link
                href="/budget"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-slate-100 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                ตั้งงบประมาณ
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {budgetRows.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                      <div className="text-sm font-extrabold text-[color:var(--app-text)] truncate">{r.name}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-200">
                      {formatTHB(r.spent)} <span className="text-[color:var(--app-muted-2)]">/ {formatTHB(r.budget)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(r.pct * 100)}%`, backgroundColor: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions Section */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-emerald-400" />
              <h2 className="text-lg sm:text-xl font-extrabold text-[color:var(--app-text)]">ธุรกรรมล่าสุด</h2>
            </div>
            <Link href="/transactions" className="text-sm font-extrabold text-emerald-300 hover:text-emerald-200">
              ดูทั้งหมด
            </Link>
          </div>
          
          <div className="mt-3 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm shadow-black/10">
            
            {loading ? (
              <div className="text-center py-10">
                <LoadingMascot label="กำลังโหลด..." size={72} />
              </div>
            ) : stats.recentTransactions.length === 0 ? (
              <div className="text-center py-10">
                <svg className="w-16 h-16 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <p className="text-slate-200 text-sm font-extrabold">ไม่มีธุรกรรมในเดือนนี้</p>
                <p className="text-slate-400 text-xs mt-1 font-semibold">ลองเพิ่มรายการ หรือเปลี่ยนช่วงเดือน</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentTransactions.map((txn, index) => (
                  <div
                    key={txn._id}
                    onClick={() => handleView(txn)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleView(txn);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="group w-full cursor-pointer rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-3)] p-4 text-left shadow-sm shadow-black/10 hover:bg-[var(--app-surface-3)] hover:shadow-md transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={[
                            'h-11 w-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0',
                            txn.type === 'income'
                              ? 'bg-gradient-to-br from-emerald-500 to-green-500'
                              : 'bg-gradient-to-br from-rose-500 to-rose-600',
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          {renderIcon(txn.category?.icon)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">
                                {txn.category?.name || 'หมวดหมู่ไม่ระบุ'}
                              </div>
                              <div className="mt-1 truncate text-xs font-semibold text-slate-400">
                                {txn.notes || '—'}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                            {new Date(txn.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-extrabold" style={{ color: txn.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }}>
                          {txn.type === 'expense' ? '-' : '+'}{txn.amount.toLocaleString()} ฿
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEdit(txn); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 shadow-sm shadow-black/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                            title="แก้ไข"
                            aria-label="แก้ไข"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(txn._id); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 shadow-sm shadow-black/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-rose-400/25"
                            title="ลบ"
                            aria-label="ลบ"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      
    

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div className="bg-[var(--app-surface)] text-[color:var(--app-text)] border border-[color:var(--app-border)] rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="relative bg-gradient-to-br from-teal-500 via-teal-600 to-teal-700 text-white p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">เพิ่มรายการใหม่</h2>
                    <p className="text-white/80 text-sm">บันทึกรายรับหรือรายจ่าย</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:rotate-90"
                  aria-label="ปิด"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-120px)]">
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-400/20 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-rose-200 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-rose-200 font-semibold text-sm">{error}</p>
                </div>
              )}

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">ประเภท</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAddFormData(prev => ({ 
                      ...prev, 
                      type: 'income',
                      category: categories.find(cat => cat.type === 'income')?._id || ''
                    }))}
                    className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                      addFormData.type === 'income'
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    รายรับ
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddFormData(prev => ({ 
                      ...prev, 
                      type: 'expense',
                      category: categories.find(cat => cat.type === 'expense')?._id || ''
                    }))}
                    className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                      addFormData.type === 'expense'
                        ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    รายจ่าย
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">จำนวนเงิน</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={addFormData.amount}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                    placeholder="0.00"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--app-muted-2)] font-semibold">฿</span>
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">หมวดหมู่</label>
                <select
                  value={addFormData.category}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                  required
                >
                  <option value="">เลือกหมวดหมู่</option>
                  {categories
                    .filter(cat => cat.type === addFormData.type)
                    .map(cat => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">วันที่</label>
                <input
                  type="date"
                  value={addFormData.date}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                  required
                />
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">หมายเหตุ</label>
                <textarea
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all resize-none"
                  placeholder="เพิ่มรายละเอียด..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border border-white/10 bg-white/5 text-slate-100 font-semibold rounded-xl hover:bg-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-slate-950 font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
                >
                  เพิ่มรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editingTransaction && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div className="bg-[var(--app-surface)] text-[color:var(--app-text)] border border-[color:var(--app-border)] rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slideUp">
            {/* Modal Header */}
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
                  aria-label="ปิด"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-120px)]">
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-400/20 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-rose-200 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-rose-200 font-semibold text-sm">{error}</p>
                </div>
              )}

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">ประเภท</label>
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
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
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
                        ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    รายจ่าย
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">จำนวนเงิน</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--app-muted-2)] font-semibold">฿</span>
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">หมวดหมู่</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                  required
                >
                  <option value="">กรุณาเลือกหมวดหมู่</option>
                  {categories
                    .filter(cat => cat.type === editFormData.type)
                    .map(cat => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">วันที่</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                  required
                />
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">หมายเหตุ</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all resize-none"
                  placeholder="เพิ่มรายละเอียด..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 border border-white/10 bg-white/5 text-slate-100 font-semibold rounded-xl hover:bg-white/10 transition-colors"
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

      {/* View Transaction Modal */}
      {mounted && showViewModal && viewingTransaction && createPortal((
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}
        >
          <div
            className="bg-[var(--app-surface)] text-[color:var(--app-text)] border border-[color:var(--app-border)] w-full max-w-none sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/40 overflow-hidden animate-slideUp flex flex-col max-h-[92dvh] sm:max-h-[85dvh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="ดูรายละเอียดธุรกรรม"
          >
            <div className="relative border-b border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-5 pb-4 pt-3 sm:pt-4">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/10 ring-1 ring-black/10 sm:hidden" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                aria-label="ปิด"
                title="ปิด"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex items-center gap-3 pr-12">
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                  style={{
                    background: viewingTransaction.type === 'income'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  }}
                  aria-hidden="true"
                >
                  {renderIcon(viewingTransaction.category?.icon)}
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold tracking-wide text-[color:var(--app-muted-2)]">
                    {viewingTransaction.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                  </div>
                  <h3 className="mt-0.5 truncate text-lg font-extrabold text-[color:var(--app-text)]">
                    {viewingTransaction.category?.name || 'หมวดหมู่ไม่ระบุ'}
                  </h3>
                  <div className="mt-0.5 text-xs font-semibold text-[color:var(--app-muted)] truncate">
                    {new Date(viewingTransaction.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-4">
              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-[color:var(--app-muted)]">จำนวนเงิน</div>
                  <div className="text-2xl font-extrabold" style={{ color: viewingTransaction.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }}>
                    {viewingTransaction.type === 'expense' ? '-' : '+'}{formatTHB(viewingTransaction.amount)}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-4">
                <div className="text-xs font-semibold text-[color:var(--app-muted)]">หมายเหตุ</div>
                <div className="mt-2 text-sm font-semibold text-[color:var(--app-text)] whitespace-pre-wrap break-words">
                  {String(viewingTransaction.notes || '').trim() ? viewingTransaction.notes : '—'}
                </div>
              </div>
            </div>

            <div className="border-t border-[color:var(--app-border)] bg-[var(--app-surface)] p-4">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="w-full rounded-2xl bg-emerald-500 py-3 text-slate-950 font-extrabold hover:brightness-95 transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </main>
  );
}
