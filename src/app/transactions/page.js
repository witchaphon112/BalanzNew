"use client";
import { useRef, useState, useEffect, useMemo } from 'react';
import ExportButton from '../../components/ExportButton';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CalendarDays,
  Tag,
  ArrowUpDown,
  Utensils,
  ShoppingBag,
  Car,
  Home,
  Zap,
  Heart,
  Gamepad2,
  Stethoscope,
  GraduationCap,
  Plane,
  Briefcase,
  Gift,
  Smartphone,
  Coffee,
  Music,
  Dumbbell,
  PawPrint,
  Scissors,
  CreditCard,
  Landmark,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const moneyFormatter = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  try { return moneyFormatter.format(n); } catch { return String(n); }
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

const ICON_MAP = {
  food: Utensils,
  drink: Coffee,
  restaurant: Utensils,
  shopping: ShoppingBag,
  gift: Gift,
  clothes: Scissors,
  transport: Car,
  fuel: Zap,
  plane: Plane,
  home: Home,
  bills: Zap,
  pet: PawPrint,
  game: Gamepad2,
  music: Music,
  health: Stethoscope,
  sport: Dumbbell,
  money: Landmark,
  salary: CreditCard,
  work: Briefcase,
  education: GraduationCap,
  tech: Smartphone,
  other: MoreHorizontal,
  love: Heart,
};

const CategoryIcon = ({ iconName, className = 'w-6 h-6' }) => {
  const IconComp = ICON_MAP[iconName];
  if (IconComp) return <IconComp className={className} aria-hidden="true" />;
  if (typeof iconName === 'string' && iconName.trim()) {
    return <span className="text-xl leading-none" aria-hidden="true">{iconName}</span>;
  }
  return <MoreHorizontal className={className} aria-hidden="true" />;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, income, expense
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // format: `${year}-${monthIndex}`
  const [dayFilter, setDayFilter] = useState('all'); // all | today | yesterday
  const [dateRange, setDateRange] = useState({ start: '', end: '' }); // yyyy-mm-dd (local)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'category' | 'date' | 'type' | null
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [categories, setCategories] = useState([]);
  // Multi-select: [] means "ทั้งหมด"
  const [filterCategory, setFilterCategory] = useState([]); // string[] (categoryId | 'other')
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const filtersRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, id: null, moved: false });
  const touchClearRef = useRef(null);
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
    if (!openDropdown) return;
    const onDown = (e) => {
      const root = filtersRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpenDropdown(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('touchstart', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('touchstart', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [openDropdown]);

  useEffect(() => {
    if (!showFilters) setOpenDropdown(null);
  }, [showFilters]);

  useEffect(() => {
    let filtered = transactions;

    // Filter by explicit date range (takes precedence)
    if (dateRange?.start) {
      const startKey = dateRange.start;
      const endKey = dateRange.end || dateRange.start;
      filtered = filtered.filter(txn => {
        const key = toLocalISODateKey(txn?.date);
        return key && key >= startKey && key <= endKey;
      });
    } else {
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(txn => txn.type === filterType);
    }

    // Filter by day preset
    if (dayFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const targetKey = dayFilter === 'today' ? toLocalISODateKey(today) : toLocalISODateKey(yesterday);
      filtered = filtered.filter(txn => toLocalISODateKey(txn.date) === targetKey);
    }

    // Filter by selected month (year-month key)
    if (selectedMonth) {
      filtered = filtered.filter(txn => {
        return toYearMonthKey(txn.date) === selectedMonth;
      });
    }
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(txn => 
        (txn.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (txn.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category (multi-select)
    if (Array.isArray(filterCategory) && filterCategory.length > 0) {
      const pickedIds = new Set(filterCategory.filter((x) => x && x !== 'other'));
      const pickedOther = filterCategory.includes('other');
      const knownIds = pickedOther ? new Set((categories || []).map(c => c._id)) : null;

      filtered = filtered.filter((txn) => {
        const id = getTxnCategoryId(txn);
        const matchesPickedId = id && pickedIds.has(id);
        if (matchesPickedId) return true;
        if (!pickedOther) return false;
        return !id || (knownIds && !knownIds.has(id));
      });
    }

    setFilteredTransactions(filtered);
  }, [transactions, filterType, searchQuery, selectedMonth, dayFilter, dateRange, filterCategory, categories]);

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
      category: (transaction?.category && typeof transaction.category === 'object')
        ? (transaction.category._id || '')
        : (transaction?.category || ''),
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
    const id = getTxnCategoryId(txn);
    const cat = (typeof txn?.category === 'object' && txn?.category) ? txn.category : (categories || []).find(c => c._id === id);
    const iconName = cat?.icon || txn?.category?.icon;
    return <CategoryIcon iconName={iconName} className="w-6 h-6" />;
  };

  const hashString = (s) => {
    const str = String(s || '');
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  };

  const getTxnBadgeClasses = (txn) => {
    if (txn?.type === 'income') {
      return 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20';
    }
    const palette = [
      'bg-orange-500/15 text-orange-200 ring-orange-400/20',
      'bg-sky-500/15 text-sky-200 ring-sky-400/20',
      'bg-violet-500/15 text-violet-200 ring-violet-400/20',
      'bg-rose-500/15 text-rose-200 ring-rose-400/20',
      'bg-amber-500/15 text-amber-200 ring-amber-400/20',
      'bg-teal-500/15 text-teal-200 ring-teal-400/20',
    ];
    const id = getTxnCategoryId(txn) || txn?.category?.name || txn?._id || 'expense';
    return palette[hashString(id) % palette.length];
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

      if (isoKey === todayKey) return 'วันนี้';
      if (isoKey === yesterdayKey) return 'เมื่อวาน';

      return d.toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const sortedCategories = useMemo(() => {
    const byName = (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'th');
    const expense = (Array.isArray(categories) ? categories : []).filter(c => c?.type === 'expense').sort(byName);
    const income = (Array.isArray(categories) ? categories : []).filter(c => c?.type === 'income').sort(byName);
    const displayed = (Array.isArray(displayedCategories) ? displayedCategories : []).slice().sort(byName);
    return { expense, income, displayed };
  }, [categories, displayedCategories]);

  const onCardTouchStart = (id, e) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchRef.current = { x: t.clientX, y: t.clientY, id, moved: false };
  };

  const onCardTouchMove = (id, e) => {
    const t = e.touches?.[0];
    if (!t) return;
    const start = touchRef.current;
    if (start.id !== id) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 18 || Math.abs(dy) > 24) return;
    touchRef.current.moved = true;
    if (dx < 0) setOpenSwipeId(id);
    if (dx > 0 && openSwipeId === id) setOpenSwipeId(null);
  };

  const onCardTouchEnd = (id) => {
    const start = touchRef.current;
    if (start.id !== id) return;
    if (!start.moved) {
      touchRef.current = { x: 0, y: 0, id: null, moved: false };
      return;
    }
    if (touchClearRef.current) clearTimeout(touchClearRef.current);
    touchClearRef.current = setTimeout(() => {
      touchRef.current = { x: 0, y: 0, id: null, moved: false };
      touchClearRef.current = null;
    }, 220);
  };

  const categoryApplied = Array.isArray(filterCategory) && filterCategory.length > 0;
  const typeApplied = filterType && filterType !== 'all';
  const dateApplied = dayFilter !== 'all' || !!selectedMonth || !!dateRange?.start;
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;

  const formatShortDateLabel = (isoKey) => {
    try {
      const d = new Date(`${isoKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return isoKey;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return isoKey;
    }
  };

  const selectedRangeLabel = useMemo(() => {
    if (!dateRange?.start) return '';
    const s = dateRange.start;
    const e = dateRange.end || dateRange.start;
    if (s === e) return formatShortDateLabel(s);
    return `${formatShortDateLabel(s)} - ${formatShortDateLabel(e)}`;
  }, [dateRange]);

  const selectedCategoryLabel = useMemo(() => {
    const picked = Array.isArray(filterCategory) ? filterCategory : [];
    if (picked.length === 0) return 'ทั้งหมด';
    if (picked.length === 1 && picked[0] === 'other') return 'อื่นๆ / ไม่ระบุ';
    if (picked.length === 1) {
      const cat = (Array.isArray(categories) ? categories : []).find(c => c?._id === picked[0]);
      return cat?.name || 'หมวดหมู่';
    }
    return `เลือกแล้ว ${picked.length}`;
  }, [categories, filterCategory]);

  const toggleFilterCategory = (id) => {
    setFilterCategory((prev) => {
      const curr = Array.isArray(prev) ? prev : [];
      if (!id) return curr;
      if (curr.includes(id)) return curr.filter((x) => x !== id);
      return [...curr, id];
    });
  };

  const selectedDateLabel = useMemo(() => {
    if (selectedRangeLabel) return selectedRangeLabel;
    if (dayFilter === 'today') return 'วันนี้';
    if (dayFilter === 'yesterday') return 'เมื่อวาน';
    if (selectedMonth) {
      if (selectedMonth === currentMonthKey) return 'เดือนนี้';
      const opt = monthOptions.find(o => o.key === selectedMonth);
      return opt?.label || 'เลือกเดือน';
    }
    return 'ทั้งหมด';
  }, [selectedRangeLabel, dayFilter, selectedMonth, currentMonthKey, monthOptions]);

  const selectedTypeLabel = useMemo(() => {
    if (filterType === 'income') return 'รายรับ';
    if (filterType === 'expense') return 'รายจ่าย';
    return 'ทั้งหมด';
  }, [filterType]);

  const filterButtonBase = 'relative flex items-center gap-2 h-11 w-full rounded-2xl border px-4 pr-10 text-sm font-extrabold text-left border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] shadow-sm shadow-black/10 hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition motion-reduce:transition-none';
  const dropdownPanelBase = 'absolute left-0 right-0 top-[calc(100%+8px)] z-[20] max-h-72 overflow-auto rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/20';
  const dropdownItemBase = 'w-full px-4 py-3 text-left text-sm font-semibold flex items-center justify-between gap-3 text-[color:var(--app-text)] hover:bg-[var(--app-surface-2)]';
  const dropdownActive = 'bg-emerald-500/15 text-emerald-200';

  const weekdayLabels = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const formatThaiShortDate = (isoKey) => {
    if (!isoKey) return '';
    try {
      const d = new Date(`${isoKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return isoKey;
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoKey;
    }
  };
  const toISOKeyLocal = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const startOfWeekMonday = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = x.getDay(); // 0 Sun..6 Sat
    const delta = (day + 6) % 7; // Mon=0
    x.setDate(x.getDate() - delta);
    return x;
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const applyPreset = (key) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (key === 'reset') {
      setDateRange({ start: '', end: '' });
      setDayFilter('all');
      setSelectedMonth('');
      return;
    }

    let start = null;
    let end = null;
    if (key === 'last7') {
      end = today;
      start = addDays(today, -6);
    } else if (key === 'thisWeek') {
      start = startOfWeekMonday(today);
      end = addDays(start, 6);
    } else if (key === 'lastWeek') {
      end = addDays(startOfWeekMonday(today), -1);
      start = addDays(end, -6);
    } else if (key === 'currentMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (key === 'lastMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    if (!start || !end) return;
    const startKey = toISOKeyLocal(start);
    const endKey = toISOKeyLocal(end);
    setDateRange({ start: startKey, end: endKey });
    setDayFilter('all');
    setSelectedMonth('');
    setCalendarMonth(new Date(start.getFullYear(), start.getMonth(), 1));
  };

  const onPickDay = (isoKey) => {
    if (!isoKey) return;
    // switching to explicit range => clear old modes
    setDayFilter('all');
    setSelectedMonth('');

    // If a start date already exists and no end date yet, this pick will finish the range.
    // Auto-close the calendar to make selection feel "workable" on mobile.
    if (dateRange?.start && !dateRange?.end) {
      try { setOpenDropdown(null); } catch {}
    }

    setDateRange((prev) => {
      const start = prev?.start || '';
      const end = prev?.end || '';
      if (!start || (start && end)) return { start: isoKey, end: '' };
      if (isoKey < start) return { start: isoKey, end: start };
      return { start, end: isoKey };
    });
  };

  const renderMonth = (monthDate) => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = first.getDay(); // 0 Sun..6 Sat
    const leading = (firstDay + 6) % 7; // Monday start

    const cells = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const startKey = dateRange?.start || '';
    const endKey = dateRange?.end || '';
    const rangeEnd = endKey || startKey;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toISOKeyLocal(today);

    return (
      <div className="min-w-0">
        <div className="grid grid-cols-7 gap-1 px-1 pb-2 text-center text-[10px] font-semibold text-[color:var(--app-muted-2)]">
          {weekdayLabels.map((l, i) => (
            <div key={`${l}-${i}`} className={i >= 5 ? 'text-slate-400' : ''}>
              {l}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 px-1">
          {cells.map((d, idx) => {
            if (!d) return <div key={`e-${idx}`} className="aspect-square w-full" />;
            const key = toISOKeyLocal(d);
            const inRange = startKey && key >= startKey && key <= rangeEnd;
            const isStart = startKey && key === startKey;
            const isEnd = rangeEnd && key === rangeEnd;
            const selected = isStart || isEnd;
            const isToday = key === todayKey;
            const isFuture = !!todayKey && key > todayKey;
            return (
              <button
                key={key}
                type="button"
                disabled={isFuture}
                onClick={() => onPickDay(key)}
                className={[
                  'relative aspect-square w-full rounded-2xl text-[13px] font-extrabold transition motion-reduce:transition-none',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
                  'disabled:opacity-35 disabled:cursor-not-allowed',
                  inRange ? 'bg-emerald-500/10 text-[color:var(--app-text)]' : 'bg-white/0 text-[color:var(--app-text)] hover:bg-white/5',
                  selected ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20 hover:bg-emerald-300' : '',
                  isToday && !selected ? 'ring-1 ring-sky-400/35 text-sky-100' : '',
                ].join(' ')}
                aria-label={`${formatThaiShortDate(key) || key}${isToday ? ' (วันนี้)' : ''}${isFuture ? ' (อนาคต)' : ''}`}
              >
                {d.getDate()}
                {isToday && !selected && (
                  <span className="pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-300" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[color:var(--app-text)]">
      <div className="mx-auto w-full max-w-lg">
        {/* Sticky header */}
        <div className="sticky top-0 z-[40] bg-[var(--app-bg)] backdrop-blur">
          <div className="px-4 pt-4 pb-3">
            <div className="relative flex items-center justify-between gap-3">
              <div className="w-11 shrink-0" aria-hidden="true" />

              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center max-w-[70%]">
                <div className="text-[11px] font-semibold tracking-wide text-[color:var(--app-muted)]">ธุรกรรม</div>
                <h1 className="truncate text-lg font-extrabold text-[color:var(--app-text)]">รายการ</h1>
              </div>

              <div className="ml-auto shrink-0 flex items-center gap-2">
                <ExportButton
                  onClick={exportToCSV}
                  className="flex-row gap-2 rounded-2xl !border-emerald-500 !bg-emerald-500 !text-white shadow-sm shadow-black/10 hover:brightness-95 focus-visible:ring-emerald-400/35"
                />
              </div>
            </div>

            <div ref={filtersRef} className="mt-4 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[color:var(--app-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="ค้นหารายการ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] py-3 pl-12 pr-4 text-sm font-semibold text-[color:var(--app-text)] placeholder-[color:var(--app-muted-2)] shadow-sm hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters(v => !v)}
                  className={[
                    'inline-flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm transition focus:outline-none focus:ring-2 motion-reduce:transition-none',
                    showFilters
                      ? 'border-emerald-400/20 bg-emerald-500/15 text-emerald-100 shadow-black/10 hover:bg-emerald-500/20 focus:ring-emerald-400/35'
                      : 'border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] shadow-black/10 hover:bg-[var(--app-surface-3)] focus:ring-emerald-400/30',
                  ].join(' ')}
                  aria-label={showFilters ? 'ซ่อนตัวกรอง' : 'แสดงตัวกรอง'}
                  title={showFilters ? 'ซ่อนตัวกรอง' : 'แสดงตัวกรอง'}
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
              </div>

              {showFilters && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Category */}
                <div className="relative">
                  <div className="mb-1 flex items-center gap-2 px-1 text-[11px] font-semibold text-[color:var(--app-muted)]">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    หมวดหมู่
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(v => (v === 'category' ? null : 'category'))}
                    className={[
                      filterButtonBase,
                      categoryApplied ? 'border-emerald-400/30' : 'border-[color:var(--app-border)]',
                    ].join(' ')}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'category'}
                  >
                    <span className="truncate flex-1">{selectedCategoryLabel}</span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[color:var(--app-muted)]">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>
                  {openDropdown === 'category' && (
                    <div className={dropdownPanelBase} role="listbox" aria-label="หมวดหมู่">
                      <button
                        type="button"
                        className={[dropdownItemBase, filterCategory.length === 0 ? dropdownActive : ''].join(' ')}
                        onClick={() => setFilterCategory([])}
                      >
                        <span>ทั้งหมด</span>
                        {filterCategory.length === 0 && <span className="text-emerald-300">✓</span>}
                      </button>

                      {filterType === 'all' ? (
                        <>
                          {sortedCategories.expense.length > 0 && (
                            <div className="px-4 py-2 text-[11px] font-semibold tracking-wide text-[color:var(--app-muted-2)]">รายจ่าย</div>
                          )}
                          {sortedCategories.expense.map((cat) => (
                            <button
                              key={cat._id}
                              type="button"
                              className={[dropdownItemBase, filterCategory.includes(cat._id) ? dropdownActive : ''].join(' ')}
                              onClick={() => toggleFilterCategory(cat._id)}
                            >
                              <span className="truncate inline-flex items-center gap-2">
                                <CategoryIcon iconName={cat.icon} className="w-4 h-4 text-[color:var(--app-muted)]" />
                                {cat.name}
                              </span>
                              {filterCategory.includes(cat._id) && <span className="text-emerald-300">✓</span>}
                            </button>
                          ))}

                          {sortedCategories.income.length > 0 && (
                            <div className="px-4 py-2 text-[11px] font-semibold tracking-wide text-[color:var(--app-muted-2)]">รายรับ</div>
                          )}
                          {sortedCategories.income.map((cat) => (
                            <button
                              key={cat._id}
                              type="button"
                              className={[dropdownItemBase, filterCategory.includes(cat._id) ? dropdownActive : ''].join(' ')}
                              onClick={() => toggleFilterCategory(cat._id)}
                            >
                              <span className="truncate inline-flex items-center gap-2">
                                <CategoryIcon iconName={cat.icon} className="w-4 h-4 text-[color:var(--app-muted)]" />
                                {cat.name}
                              </span>
                              {filterCategory.includes(cat._id) && <span className="text-emerald-300">✓</span>}
                            </button>
                          ))}
                        </>
                      ) : (
                        sortedCategories.displayed.map((cat) => (
                          <button
                            key={cat._id}
                            type="button"
                            className={[dropdownItemBase, filterCategory.includes(cat._id) ? dropdownActive : ''].join(' ')}
                            onClick={() => toggleFilterCategory(cat._id)}
                          >
                            <span className="truncate inline-flex items-center gap-2">
                              <CategoryIcon iconName={cat.icon} className="w-4 h-4 text-[color:var(--app-muted)]" />
                              {cat.name}
                            </span>
                            {filterCategory.includes(cat._id) && <span className="text-emerald-300">✓</span>}
                          </button>
                        ))
                      )}

                      <div className="my-1 h-px bg-white/10" aria-hidden="true" />
                      <button
                        type="button"
                        className={[dropdownItemBase, filterCategory.includes('other') ? dropdownActive : ''].join(' ')}
                        onClick={() => toggleFilterCategory('other')}
                      >
                        <span>อื่นๆ / ไม่ระบุ</span>
                        {filterCategory.includes('other') && <span className="text-emerald-300">✓</span>}
                      </button>

                      <div className="sticky bottom-0 border-t border-[color:var(--app-border)] bg-[var(--app-surface)] p-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFilterCategory([])}
                            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-extrabold text-slate-100 hover:bg-white/10"
                          >
                            ล้าง
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenDropdown(null)}
                            className="flex-1 rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:brightness-95"
                          >
                            เสร็จสิ้น
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Type */}
                <div className="relative">
                  <div className="mb-1 flex items-center gap-2 px-1 text-[11px] font-semibold text-[color:var(--app-muted)]">
                    <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    ประเภท
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(v => (v === 'type' ? null : 'type'))}
                    className={[
                      filterButtonBase,
                      typeApplied ? 'border-emerald-400/30' : 'border-[color:var(--app-border)]',
                    ].join(' ')}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'type'}
                  >
                    <span className="truncate flex-1">{selectedTypeLabel}</span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[color:var(--app-muted)]">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>
                  {openDropdown === 'type' && (
                    <div className={dropdownPanelBase} role="listbox" aria-label="ประเภท">
                      <button
                        type="button"
                        className={[dropdownItemBase, filterType === 'all' ? dropdownActive : ''].join(' ')}
                        onClick={() => { setFilterType('all'); setOpenDropdown(null); }}
                      >
                        <span>ทั้งหมด</span>
                        {filterType === 'all' && <span className="text-emerald-300">✓</span>}
                      </button>
                      <button
                        type="button"
                        className={[dropdownItemBase, filterType === 'expense' ? dropdownActive : ''].join(' ')}
                        onClick={() => { setFilterType('expense'); setOpenDropdown(null); }}
                      >
                        <span>รายจ่าย</span>
                        {filterType === 'expense' && <span className="text-emerald-300">✓</span>}
                      </button>
                      <button
                        type="button"
                        className={[dropdownItemBase, filterType === 'income' ? dropdownActive : ''].join(' ')}
                        onClick={() => { setFilterType('income'); setOpenDropdown(null); }}
                      >
                        <span>รายรับ</span>
                        {filterType === 'income' && <span className="text-emerald-300">✓</span>}
                      </button>
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="relative sm:col-span-2">
                  <div className="mb-1 flex items-center gap-2 px-1 text-[11px] font-semibold text-[color:var(--app-muted)]">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    ช่วงเวลา
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(v => (v === 'date' ? null : 'date'))}
                    className={[
                      filterButtonBase,
                      dateApplied ? 'border-emerald-400/30' : 'border-[color:var(--app-border)]',
                    ].join(' ')}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'date'}
                  >
                    <span className="truncate flex-1">{selectedDateLabel}</span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[color:var(--app-muted)]">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>
                  {openDropdown === 'date' && (
                    <div
                      className="absolute left-0 right-0 top-[calc(100%+8px)] z-[30] max-h-[72dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.25)]"
                      role="dialog"
                      aria-label="เลือกช่วงเวลา"
                    >
                      {/* Presets */}
                      <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[
                          { key: 'thisWeek', label: 'สัปดาห์นี้' },
                          { key: 'lastWeek', label: 'สัปดาห์ที่แล้ว' },
                          { key: 'last7', label: '7 วันล่าสุด' },
                          { key: 'currentMonth', label: 'เดือนนี้' },
                          { key: 'lastMonth', label: 'เดือนที่แล้ว' },
                          { key: 'reset', label: 'รีเซ็ต' },
                        ].map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPreset(p.key)}
                            className={[
                              'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition motion-reduce:transition-none',
                              p.key === 'reset'
                                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15'
                                : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
                            ].join(' ')}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Selected range summary */}
                      <div className="border-b border-white/10 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold text-slate-400">ช่วงที่เลือก</div>
                          {(dateRange?.start || dateRange?.end) && (
                            <button
                              type="button"
                              onClick={() => { setDateRange({ start: '', end: '' }); setDayFilter('all'); setSelectedMonth(''); }}
                              className="text-[11px] font-extrabold text-slate-300 hover:text-slate-100"
                            >
                              ล้าง
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 truncate rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-100">
                            {dateRange?.start ? formatThaiShortDate(dateRange.start) : 'วันเริ่มต้น'}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-muted-2)]" aria-hidden="true" />
                          <div className="flex-1 truncate rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-100">
                            {dateRange?.end ? formatThaiShortDate(dateRange.end) : 'วันสิ้นสุด'}
                          </div>
                        </div>
                      </div>

                      {/* Calendar */}
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                            aria-label="เดือนก่อนหน้า"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <div className="min-w-0 flex-1 text-center">
                            <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">
                              {calendarMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                              {dateRange?.start && !dateRange?.end ? 'เลือกวันสิ้นสุด' : 'เลือกวันเริ่มต้น'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                            aria-label="เดือนถัดไป"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-3">
                          {renderMonth(calendarMonth)}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => { setDateRange({ start: '', end: '' }); setDayFilter('all'); setSelectedMonth(''); }}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-slate-100 hover:bg-white/10"
                          >
                            ล้าง
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenDropdown(null)}
                            className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
                          >
                            เสร็จสิ้น
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
          </div>
        </div>
        </div>

        <div className="px-4 py-5">
        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-200 shadow-sm">
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
	                <div key={i} className="loading rounded-2xl border border-white/10 bg-white/5 shadow-sm">
	                  <div className="flex items-center gap-4 px-4 py-4">
	                    <div className="h-11 w-11 rounded-2xl bg-white/10" />
	                    <div className="min-w-0 flex-1">
	                      <div className="h-3 w-1/3 rounded bg-white/10" />
	                      <div className="mt-2 h-2 w-1/2 rounded bg-white/10" />
	                    </div>
	                    <div className="flex flex-col items-end gap-2">
	                      <div className="h-3 w-20 rounded bg-white/10" />
	                      <div className="h-2 w-12 rounded bg-white/10" />
	                    </div>
	                  </div>
	                </div>
	              ))}
	            </div>
	          ) : groupedTransactions.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10 text-2xl">
                🧾
              </div>
              <p className="text-[color:var(--app-text)] text-lg font-extrabold">ไม่พบธุรกรรม</p>
              <p className="text-slate-400 text-sm font-semibold mt-1">ลองเปลี่ยนตัวกรอง หรือเพิ่มรายการใหม่</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('all');
                    setFilterCategory([]);
                    setDayFilter('all');
                    setSelectedMonth('');
                    setDateRange({ start: '', end: '' });
                    setSearchQuery('');
                    setOpenDropdown(null);
                    setOpenSwipeId(null);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-extrabold text-slate-100 shadow-sm hover:bg-white/10"
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
                    <div className="text-base font-extrabold text-[color:var(--app-text)]">{group.dateLabel}</div>
                    <div className={`text-sm font-extrabold ${group.net < 0 ? 'text-slate-400' : group.net > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                      {group.net < 0 ? '-' : group.net > 0 ? '+' : ''}฿{formatMoney(Math.abs(group.net))}
                    </div>
                  </div>

                  <div className="mt-2 space-y-3">
                    {group.items.map(txn => {
                      const isOpen = openSwipeId === txn._id;
                      const categoryName = txn.category?.name || 'ไม่ระบุ';
                      const title = (txn.notes && txn.notes.trim()) ? txn.notes : categoryName;
                      const subtitle = `${formatTimeHHmm(txn.date) || '—'} • ${categoryName}`;
                      const amountSign = txn.type === 'expense' ? '-' : '+';
                      const amountText = `${amountSign}฿${formatMoney(Math.abs(txn.amount || 0))}`;
                      return (
                        <div
                          key={txn._id}
                          className="relative overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-sm"
                        >
                          <div
                            className={[
                              'absolute inset-y-0 right-0 flex w-40 overflow-hidden',
                              'transition-all duration-300 motion-reduce:transition-none',
                              'ease-[cubic-bezier(0.22,1,0.36,1)]',
                              isOpen ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-6 pointer-events-none',
                            ].join(' ')}
                            aria-hidden={!isOpen}
                          >
                            <button
                              type="button"
                              onClick={() => handleEdit(txn)}
                              tabIndex={isOpen ? 0 : -1}
                              className={[
                                'flex-1 bg-gradient-to-b from-emerald-400 to-emerald-500 text-slate-950',
                                'font-extrabold text-sm',
                                'inline-flex items-center justify-center gap-2',
                                'border-r border-white/10',
                                'transition-transform duration-200 ease-out active:scale-[0.98]',
                                'focus:outline-none focus:ring-2 focus:ring-emerald-300/40',
                                'motion-reduce:transition-none',
                              ].join(' ')}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(txn._id)}
                              tabIndex={isOpen ? 0 : -1}
                              className={[
                                'flex-1 bg-gradient-to-b from-rose-400 to-rose-500 text-white',
                                'font-extrabold text-sm',
                                'inline-flex items-center justify-center gap-2',
                                'transition-transform duration-200 ease-out active:scale-[0.98]',
                                'focus:outline-none focus:ring-2 focus:ring-rose-300/40',
                                'motion-reduce:transition-none',
                              ].join(' ')}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              ลบ
                            </button>
                          </div>

                          <button
                            type="button"
                            onTouchStart={(e) => onCardTouchStart(txn._id, e)}
                            onTouchMove={(e) => onCardTouchMove(txn._id, e)}
                            onTouchEnd={() => onCardTouchEnd(txn._id)}
                            onClick={() => {
                              if (touchRef.current.moved) return;
                              if (isOpen) { setOpenSwipeId(null); return; }
                              handleEdit(txn);
                            }}
                            className={[
                              'relative w-full text-left will-change-transform',
                              'transition-transform duration-300 motion-reduce:transition-none',
                              'ease-[cubic-bezier(0.22,1,0.36,1)]',
                              'active:scale-[0.995]',
                              isOpen ? '-translate-x-40' : 'translate-x-0',
                            ].join(' ')}
                          >
                            <div className="flex items-center gap-4 px-4 py-4">
                              <div
                                className={[
                                  'h-12 w-12 rounded-full flex items-center justify-center shrink-0 ring-1',
                                  getTxnBadgeClasses(txn),
                                ].join(' ')}
                                aria-hidden="true"
                              >
                                {renderTxnIcon(txn)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-base font-extrabold text-[color:var(--app-text)]">{title}</div>
                                    <div className="mt-1 truncate text-xs font-semibold text-slate-400">{subtitle}</div>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    <div className={`text-base font-extrabold ${txn.type === 'income' ? 'text-emerald-300' : 'text-slate-200'}`}>
                                      {amountText}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-24" />
      </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingTransaction && (
        <div
          className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm z-[9999] animate-fadeIn flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+88px)] sm:pb-0 overflow-hidden overscroll-contain"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div
            className="bg-[var(--app-surface)] w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden animate-slideUp border border-[color:var(--app-border)] text-[color:var(--app-text)] flex flex-col max-h-[92dvh] sm:max-h-[88dvh] sm:-translate-y-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-500 text-slate-950 px-5 sm:px-6 pb-4 sm:pb-6 pt-[calc(env(safe-area-inset-top)+16px)] sm:pt-[calc(env(safe-area-inset-top)+24px)] overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">แก้ไขรายการ</h2>
                    <p className="text-slate-950/70 text-xs sm:text-sm font-semibold">อัปเดตข้อมูลธุรกรรม</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 sm:p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:rotate-90"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

	            <form onSubmit={handleUpdateSubmit} className="flex-1 p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-6 space-y-4 sm:space-y-5 overflow-y-auto">
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-400/20 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-rose-200 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-rose-200 font-semibold text-sm">{error}</p>
                </div>
              )}

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

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">หมวดหมู่</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
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

                <button
                  type="button"
                  onClick={() => handleDelete(editingTransaction._id)}
                  className="w-full rounded-xl border border-rose-400/20 bg-rose-500/10 px-6 py-3 text-rose-200 font-extrabold hover:bg-rose-500/15 transition-colors"
                >
                  ลบรายการนี้
                </button>

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
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-slate-950 font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
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
