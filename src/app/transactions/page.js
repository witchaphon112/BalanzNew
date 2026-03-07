"use client";
import { useRef, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import LoadingMascot from '@/components/LoadingMascot';
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
  CheckSquare,
  Square,
  ListChecks,
  AlertTriangle,
  X,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

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
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [loading, setLoading] = useState(false);
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
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editDatePickerMonth, setEditDatePickerMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
  });
  const [categories, setCategories] = useState([]);
  // Multi-select: [] means "ทั้งหมด"
  const [filterCategory, setFilterCategory] = useState([]); // string[] (categoryId | 'other')
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTxnIds, setSelectedTxnIds] = useState(() => new Set());
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showBulkDateModal, setShowBulkDateModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkTargetType, setBulkTargetType] = useState('expense'); // 'expense' | 'income'
  const [bulkDate, setBulkDate] = useState('');
  const [showBulkDatePicker, setShowBulkDatePicker] = useState(false);
  const [bulkDatePickerMonth, setBulkDatePickerMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
  });
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

  const parseISODateKey = (iso) => {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, monthIndex: month - 1, day };
  };

  const toISOFromParts = (year, monthIndex, day) => {
    const yyyy = String(year).padStart(4, '0');
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const openEditDatePicker = () => {
    const parsed = parseISODateKey(editFormData?.date);
    if (parsed) setEditDatePickerMonth({ year: parsed.year, monthIndex: parsed.monthIndex });
    else {
      const d = new Date();
      setEditDatePickerMonth({ year: d.getFullYear(), monthIndex: d.getMonth() });
    }
    setShowEditDatePicker(true);
  };

  const openBulkDatePicker = () => {
    const parsed = parseISODateKey(bulkDate);
    if (parsed) setBulkDatePickerMonth({ year: parsed.year, monthIndex: parsed.monthIndex });
    else {
      const d = new Date();
      setBulkDatePickerMonth({ year: d.getFullYear(), monthIndex: d.getMonth() });
    }
    setShowBulkDatePicker(true);
  };

  useEffect(() => {
    if (!showEditModal) setShowEditDatePicker(false);
  }, [showEditModal]);

  useEffect(() => {
    if (!showBulkDateModal) setShowBulkDatePicker(false);
  }, [showBulkDateModal]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    if (!mq) return;

    const apply = () => setIsDesktop(Boolean(mq.matches));
    apply();

    try {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } catch {
      mq.addListener?.(apply);
      return () => mq.removeListener?.(apply);
    }
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    setShowFilters(true);
  }, [isDesktop]);

  const selectedCount = selectedTxnIds.size;
  const txnById = useMemo(() => {
    const map = new Map();
    (transactions || []).forEach((t) => { if (t?._id) map.set(t._id, t); });
    return map;
  }, [transactions]);
  const selectedTxns = useMemo(() => {
    return Array.from(selectedTxnIds).map((id) => txnById.get(id)).filter(Boolean);
  }, [selectedTxnIds, txnById]);
  const selectedTypeSet = useMemo(() => {
    const set = new Set();
    selectedTxns.forEach((t) => { if (t?.type) set.add(t.type); });
    return set;
  }, [selectedTxns]);
  const selectionHasMixedTypes = selectedCount > 0 && selectedTypeSet.size > 1;
  const bulkCategories = useMemo(() => {
    return (categories || []).filter((c) => c?.type === bulkTargetType);
  }, [categories, bulkTargetType]);
  const canBulkSaveCategory = selectedCount > 0 && Boolean(bulkCategoryId) && (bulkCategories || []).length > 0;

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedTxnIds(new Set());
    setOpenSwipeId(null);
    setShowBulkCategoryModal(false);
    setShowBulkDateModal(false);
    setShowDeleteConfirmModal(false);
    setDeleteIds([]);
    setDeleteLoading(false);
    setDeleteError('');
  };

  const toggleSelectTxn = (id) => {
    if (!id) return;
    setSelectedTxnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const ids = (filteredTransactions || []).map((t) => t?._id).filter(Boolean);
    setSelectedTxnIds(new Set(ids));
  };

  const clearSelection = () => setSelectedTxnIds(new Set());

  const openDeleteConfirm = (ids) => {
    const next = (ids || []).map((v) => String(v || '')).filter(Boolean);
    if (next.length === 0) return;
    setDeleteIds(next);
    setDeleteError('');
    setShowDeleteConfirmModal(true);
  };

  const handleBulkDelete = () => {
    if (selectedTxnIds.size === 0) return;
    openDeleteConfirm(Array.from(selectedTxnIds));
  };

  const confirmDelete = async () => {
    if (deleteLoading) return;
    if (!deleteIds || deleteIds.length === 0) return;

    try {
      setDeleteLoading(true);
      setDeleteError('');
      const token = localStorage.getItem('token');
      const ids = [...deleteIds];

      const results = await Promise.allSettled(ids.map(async (id) => {
        const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          let msg = '';
          try {
            const data = await res.json();
            msg = data?.message ? String(data.message) : '';
          } catch {}
          throw new Error(msg || 'ลบรายการไม่สำเร็จ');
        }
        return true;
      }));

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        setDeleteError(`ลบไม่สำเร็จ ${failed.length} รายการ ลองใหม่อีกครั้ง`);
        return;
      }

      await fetchTransactions(token);

      setShowDeleteConfirmModal(false);
      setDeleteIds([]);
      setShowEditModal(false);
      setEditingTransaction(null);
      setOpenSwipeId(null);

      if (selectMode) exitSelectMode();
    } catch (err) {
      setDeleteError(err?.message ? String(err.message) : 'ลบรายการไม่สำเร็จ');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkUpdateCategory = async () => {
    if (selectedCount === 0) return;
    if (!bulkTargetType) return;
    if (!bulkCategoryId) return;
    const targetLabel = bulkTargetType === 'income' ? 'รายรับ' : 'รายจ่าย';
    if (!confirm(`แก้ประเภทเป็น "${targetLabel}" และแก้หมวดหมู่ของ ${selectedCount} รายการที่เลือกใช่ไหม?`)) return;

    try {
      const token = localStorage.getItem('token');
      const ids = Array.from(selectedTxnIds);
      await Promise.all(ids.map((id) => fetch(`${API_BASE}/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: bulkTargetType, category: bulkCategoryId }),
      })));
      await fetchTransactions(token);
      setShowBulkCategoryModal(false);
      exitSelectMode();
    } catch (err) {
      setError('เกิดข้อผิดพลาด: ' + (err?.message || 'Error'));
    }
  };

  const handleBulkUpdateDate = async () => {
    if (selectedCount === 0) return;
    if (!bulkDate) return;
    if (!confirm(`แก้วันที่ของ ${selectedCount} รายการที่เลือกเป็น ${bulkDate} ใช่ไหม?`)) return;

    try {
      const token = localStorage.getItem('token');
      const ids = Array.from(selectedTxnIds);
      await Promise.all(ids.map((id) => fetch(`${API_BASE}/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: bulkDate }),
      })));
      await fetchTransactions(token);
      setShowBulkDateModal(false);
      exitSelectMode();
    } catch (err) {
      setError('เกิดข้อผิดพลาด: ' + (err?.message || 'Error'));
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    let cancelled = false;
    const loadInitial = async () => {
      setBootLoading(true);
      setError('');
      try {
        const [tRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/api/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!tRes.ok) throw new Error('Failed to fetch transactions');
        if (!cRes.ok) throw new Error('Failed to fetch categories');
        const [tData, cData] = await Promise.all([tRes.json(), cRes.json()]);
        const sorted = (Array.isArray(tData) ? tData : []).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (cancelled) return;
        setTransactions(sorted);
        setCategories(Array.isArray(cData) ? cData : []);
        exitSelectMode();
      } catch (e) {
        if (cancelled) return;
        setError('เกิดข้อผิดพลาด: ' + (e?.message || 'Error'));
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    };

    loadInitial();
    return () => { cancelled = true; };
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

  // If the visible list changes, keep selection only for IDs still visible.
  useEffect(() => {
    if (!selectMode) return;
    const visible = new Set((filteredTransactions || []).map((t) => t?._id).filter(Boolean));
    setSelectedTxnIds((prev) => {
      const next = new Set();
      prev.forEach((id) => { if (visible.has(id)) next.add(id); });
      return next;
    });
  }, [filteredTransactions, selectMode]);

  useEffect(() => {
    if (!showBulkCategoryModal) return;
    const preferredType = selectedTypeSet.size === 1 ? Array.from(selectedTypeSet)[0] : 'expense';
    setBulkTargetType(preferredType === 'income' ? 'income' : 'expense');
  }, [showBulkCategoryModal, selectedTypeSet]);

  useEffect(() => {
    if (!showBulkCategoryModal) return;
    const allowed = new Set((bulkCategories || []).map((c) => String(c?._id || '')).filter(Boolean));
    if (bulkCategoryId && allowed.has(String(bulkCategoryId))) return;
    const first = bulkCategories?.[0]?._id || '';
    setBulkCategoryId(first);
  }, [showBulkCategoryModal, bulkTargetType, bulkCategories, bulkCategoryId]);

  useEffect(() => {
    if (!showBulkDateModal) return;
    if (bulkDate) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setBulkDate(`${yyyy}-${mm}-${dd}`);
  }, [showBulkDateModal, bulkDate]);

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

  const handleDelete = (transactionId) => {
    if (!transactionId) return;
    openDeleteConfirm([transactionId]);
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
      try { setOpenDropdown(null); } catch {}
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
    try { setOpenDropdown(null); } catch {}
  };

  const applyDayPreset = (key) => {
    if (key !== 'today' && key !== 'yesterday') return;
    setDateRange({ start: '', end: '' });
    setSelectedMonth('');
    setDayFilter(key);
    try { setOpenDropdown(null); } catch {}
  };

  const setExplicitRange = (nextStart, nextEnd) => {
    const start = String(nextStart || '');
    const end = String(nextEnd || '');
    let s = start;
    let e = end;
    if (s && e && e < s) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    setDateRange({ start: s, end: e });
    setDayFilter('all');
    setSelectedMonth('');
    if (s) {
      const d = new Date(`${s}T00:00:00`);
      if (!Number.isNaN(d.getTime())) setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
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
                  inRange ? 'bg-emerald-500/10 text-[color:var(--app-text)]' : 'bg-white/0 text-[color:var(--app-text)] hover:bg-[var(--app-surface-2)]',
                  selected ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20 hover:bg-emerald-300' : '',
                  isToday && !selected ? 'ring-1 ring-sky-400/35' : '',
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

  const filtersVisible = isDesktop || showFilters;
  const filtersCard = (
    <div ref={filtersRef} className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm">
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
            'lg:hidden inline-flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm transition focus:outline-none focus:ring-2 motion-reduce:transition-none',
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

      {filtersVisible && (
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
              aria-haspopup="dialog"
              aria-expanded={openDropdown === 'date'}
            >
              <span className="truncate flex-1">{selectedDateLabel}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[color:var(--app-muted)]">
                <ChevronDown className="h-4 w-4" />
              </span>
            </button>

	            {mounted && openDropdown === 'date' && createPortal((
	              <div
	                className={[
                    'fixed inset-0 z-[9999] bg-slate-950/30 backdrop-blur-sm animate-fadeIn flex justify-center overflow-hidden overscroll-contain',
                    isDesktop ? 'items-center p-4' : 'items-end sm:items-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom)] sm:pb-0',
                  ].join(' ')}
	                role="dialog"
	                aria-label="เลือกช่วงเวลา"
	                onClick={(e) => e.target === e.currentTarget && setOpenDropdown(null)}
	              >
	                <div
                    className={[
                      'bg-[var(--app-surface)] w-full overflow-hidden animate-slideUp border border-[color:var(--app-border)] text-[color:var(--app-text)] flex flex-col',
                      isDesktop ? 'max-w-lg rounded-3xl max-h-[88dvh]' : 'sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[88dvh]',
                    ].join(' ')}
                  >
                  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[color:var(--app-border)]">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold tracking-wide text-[color:var(--app-muted)]">ตัวกรอง</div>
                      <div className="truncate text-base font-extrabold">ช่วงเวลา</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(null)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      aria-label="ปิด"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {/* Presets */}
                    <div className="sticky top-0 z-[1] bg-[var(--app-surface)] border-b border-[color:var(--app-border)]">
                      <div className="flex gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[
                          { key: 'today', label: 'วันนี้' },
                          { key: 'yesterday', label: 'เมื่อวาน' },
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
                            onClick={() => (p.key === 'today' || p.key === 'yesterday' ? applyDayPreset(p.key) : applyPreset(p.key))}
                            className={[
                              'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition motion-reduce:transition-none',
                              p.key === 'reset'
                                ? 'border-rose-500/25 bg-rose-500/10 text-[color:var(--app-danger)] hover:bg-rose-500/15'
                                : 'border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]',
                            ].join(' ')}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selected range summary + inputs */}
                    <div className="p-4">
                      <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">ช่วงที่เลือก</div>
                          {(dateRange?.start || dateRange?.end) && (
                            <button
                              type="button"
                              onClick={() => { setDateRange({ start: '', end: '' }); setDayFilter('all'); setSelectedMonth(''); }}
                              className="text-[11px] font-extrabold text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]"
                            >
                              ล้างช่วง
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 truncate rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-extrabold text-[color:var(--app-text)]">
                            {dateRange?.start ? formatThaiShortDate(dateRange.start) : 'วันเริ่มต้น'}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-muted-2)]" aria-hidden="true" />
                          <div className="flex-1 truncate rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-extrabold text-[color:var(--app-text)]">
                            {dateRange?.end ? formatThaiShortDate(dateRange.end) : 'วันสิ้นสุด'}
                          </div>
                        </div>

                        <div className="mt-3 hidden grid-cols-2 gap-2 sm:grid">
                          <label className="block">
                            <div className="mb-1 px-1 text-[11px] font-semibold text-[color:var(--app-muted)]">เริ่ม</div>
                            <input
                              type="date"
                              value={dateRange?.start || ''}
                              onChange={(e) => setExplicitRange(e.target.value, dateRange?.end || '')}
                              className="h-11 w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-extrabold text-[color:var(--app-text)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 px-1 text-[11px] font-semibold text-[color:var(--app-muted)]">สิ้นสุด</div>
                            <input
                              type="date"
                              value={dateRange?.end || ''}
                              min={dateRange?.start || undefined}
                              onChange={(e) => setExplicitRange(dateRange?.start || '', e.target.value)}
                              className="h-11 w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-extrabold text-[color:var(--app-text)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                            />
                          </label>
                        </div>

                        {dateRange?.start && !dateRange?.end && (
                          <button
                            type="button"
                            onClick={() => { setExplicitRange(dateRange.start, dateRange.start); setOpenDropdown(null); }}
                            className="mt-2 w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-xs font-extrabold text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
                          >
                            ใช้วันเดียว (เริ่ม = สิ้นสุด)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Calendar */}
                    <div className="px-4 pb-4">
                      <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
                            aria-label="เดือนก่อนหน้า"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <div className="min-w-0 flex-1 text-center">
                            <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">
                              {calendarMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">
                              {dateRange?.start && !dateRange?.end ? 'เลือกวันสิ้นสุด' : 'เลือกวันเริ่มต้น'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
                            aria-label="เดือนถัดไป"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-3">
                          {renderMonth(calendarMonth)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[color:var(--app-border)] bg-[var(--app-surface)] px-5 py-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { setDateRange({ start: '', end: '' }); setDayFilter('all'); setSelectedMonth(''); }}
                      className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2.5 text-xs font-extrabold text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
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
		            ), document.body)}
	          </div>
	        </div>
	      )}
    </div>
  );

  if (bootLoading) {
    return (
      <main className="min-h-[100dvh] bg-transparent text-[color:var(--app-text)] flex items-center justify-center p-6">
        <LoadingMascot label="กำลังโหลด..." size={88} />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[color:var(--app-text)]">
      <div className="mx-auto w-full max-w-lg lg:max-w-6xl">
        {/* Sticky header */}
          <div className="sticky top-0 z-[40] bg-[var(--app-bg)] backdrop-blur">
            <div className="px-4 lg:px-6 pt-4 pb-3">
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

                {!isDesktop && (
                  <div className="mt-4">
                    {filtersCard}
                  </div>
                )}
        </div>
        </div>

	        <div className="px-4 lg:px-6 py-5">
	            <div className="lg:grid lg:grid-cols-12 lg:gap-6">
	              {isDesktop && (
	                <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
	                  {filtersCard}
	                </div>
	              )}
              <div className={isDesktop ? 'lg:col-span-8' : ''}>
                <div className="mb-4 flex flex-col gap-2">
              {!selectMode && (
                <button
                  type="button"
                  onClick={() => { setSelectMode(true); setOpenSwipeId(null); setSelectedTxnIds(new Set()); }}
                  className="inline-flex h-12 w-full items-center justify-between gap-4 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 text-[color:var(--app-text)] shadow-sm shadow-black/10 transition hover:bg-[var(--app-surface-2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 motion-reduce:transition-none"
                  aria-label="เลือกหลายรายการ"
                  title="เลือกหลายรายการ"
                >
                  <span className="text-sm font-extrabold">เลือกหลายรายการ</span>
                  <ListChecks className="h-5 w-5 opacity-80" aria-hidden="true" />
                </button>
              )}
                </div>
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

	                  <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {group.items.map(txn => {
                      const isSelected = selectedTxnIds.has(txn._id);
                      const isOpen = !selectMode && openSwipeId === txn._id;
                      const categoryName = txn.category?.name || 'ไม่ระบุ';
                      const title = (txn.notes && txn.notes.trim()) ? txn.notes : categoryName;
                      const subtitle = `${formatTimeHHmm(txn.date) || '—'} • ${categoryName}`;
                      const amountSign = txn.type === 'expense' ? '-' : '+';
                      const amountText = `${amountSign}฿${formatMoney(Math.abs(txn.amount || 0))}`;
                      return (
                        <div
                          key={txn._id}
                          className={[
                            'relative overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-sm',
                            selectMode && isSelected ? 'ring-2 ring-emerald-400/35' : '',
                          ].join(' ')}
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
                              disabled={selectMode}
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
                              disabled={selectMode}
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
                            onTouchStart={selectMode ? undefined : (e) => onCardTouchStart(txn._id, e)}
                            onTouchMove={selectMode ? undefined : (e) => onCardTouchMove(txn._id, e)}
                            onTouchEnd={selectMode ? undefined : () => onCardTouchEnd(txn._id)}
                            onClick={() => {
                              if (touchRef.current.moved) return;
                              if (selectMode) { toggleSelectTxn(txn._id); return; }
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
                              {selectMode && (
                                <div className="shrink-0" aria-hidden="true">
                                  {isSelected ? (
                                    <CheckSquare className="h-6 w-6 text-emerald-300" />
                                  ) : (
                                    <Square className="h-6 w-6 text-slate-500" />
                                  )}
                                </div>
                              )}
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

					        <div className={selectMode ? 'h-40' : 'h-24'} />
              </div>
            </div>
          </div>
        </div>

	        {/* Bottom popup actions (multi-select) */}
	        {mounted && selectMode && createPortal((
		          <div className="fixed inset-x-0 bottom-0 z-[95]">
			            <div className="mx-auto w-full max-w-lg lg:max-w-6xl px-0 sm:px-4 lg:px-6">
		              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/30 backdrop-blur">
	                <div className="flex items-center justify-between gap-3 px-4 pt-4">
	                  <div className="text-xs font-semibold text-[color:var(--app-muted)]">
	                    เลือกแล้ว <span className="text-[color:var(--app-text)] font-extrabold">{selectedCount}</span> รายการ
	                  </div>
	                  <button
	                    type="button"
	                    onClick={exitSelectMode}
	                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
	                    aria-label="ยกเลิกการเลือก"
	                    title="ยกเลิก"
	                  >
	                    <X className="h-5 w-5" aria-hidden="true" />
	                  </button>
	                </div>

		                <div className="grid grid-cols-3 gap-3 p-3 pt-3">
		                  <button
		                    type="button"
		                    onClick={() => setShowBulkCategoryModal(true)}
		                    disabled={selectedCount === 0}
		                    className={[
		                      'rounded-2xl border px-3 py-4 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 motion-reduce:transition-none',
		                      selectedCount === 0
		                        ? 'border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-muted-2)] opacity-60 cursor-not-allowed'
		                        : 'border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:ring-emerald-400/30',
		                    ].join(' ')}
		                    title={selectedCount === 0 ? 'เลือกอย่างน้อย 1 รายการ' : 'แก้ประเภท/หมวดหมู่ของรายการที่เลือก'}
		                  >
		                    <span className="inline-flex items-center justify-center gap-2">
		                      <Tag className="h-5 w-5" aria-hidden="true" />
		                      แก้หมวด
		                    </span>
	                  </button>

	                  <button
	                    type="button"
	                    onClick={() => setShowBulkDateModal(true)}
	                    disabled={selectedCount === 0}
	                    className={[
	                      'rounded-2xl border px-3 py-4 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 motion-reduce:transition-none',
	                      selectedCount > 0
	                        ? 'border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:ring-emerald-400/30'
	                        : 'border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-muted-2)] opacity-60 cursor-not-allowed',
	                    ].join(' ')}
	                  >
	                    <span className="inline-flex items-center justify-center gap-2">
	                      <CalendarDays className="h-5 w-5" aria-hidden="true" />
	                      แก้วันที่
	                    </span>
	                  </button>

	                  <button
	                    type="button"
	                    onClick={handleBulkDelete}
	                    disabled={selectedCount === 0}
	                    className={[
	                      'rounded-2xl px-3 py-4 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 motion-reduce:transition-none',
	                      selectedCount === 0
	                        ? 'bg-rose-500/30 text-white/60 cursor-not-allowed'
	                        : 'bg-rose-500 text-white hover:brightness-95 focus:ring-rose-300/30',
	                    ].join(' ')}
	                    title="ลบรายการที่เลือก"
	                  >
	                    <span className="inline-flex items-center justify-center gap-2">
	                      <Trash2 className="h-5 w-5" aria-hidden="true" />
	                      ลบ ({selectedCount})
	                    </span>
	                  </button>
	                </div>
	              </div>
	            </div>
	          </div>
	        ), document.body)}

	      {/* Bulk Category Modal */}
	      {mounted && showBulkCategoryModal && createPortal((
	        <div
	          className="fixed inset-0 z-[9999] bg-slate-950/30 backdrop-blur-sm animate-fadeIn flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom)] sm:pb-0 overflow-hidden overscroll-contain"
          onClick={(e) => e.target === e.currentTarget && setShowBulkCategoryModal(false)}
        >
	          <div className="bg-[var(--app-surface)] w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden animate-slideUp border border-[color:var(--app-border)] text-[color:var(--app-text)]">
	            <div className="px-5 pt-5 pb-4">
	              <div className="text-sm font-extrabold">แก้หมวด ({selectedCount})</div>
	              <div className="mt-1 text-xs font-semibold text-[color:var(--app-muted)]">
	                เลือกประเภทปลายทาง แล้วเลือกหมวดหมู่
	              </div>

                {selectionHasMixedTypes ? (
                  <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                    <div className="text-[11px] font-extrabold text-amber-300">คำเตือน</div>
                    <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-text)]">
                      รายการที่เลือกมีทั้งรายรับและรายจ่าย ระบบจะปรับเป็น
                      {' '}
                      <span className="font-extrabold text-slate-200">
                        {bulkTargetType === 'income' ? 'รายรับ' : 'รายจ่าย'}
                      </span>
                      {' '}
                      ทั้งหมด
                    </div>
                  </div>
                ) : null}

                  <div className="mt-4 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-4 shadow-sm shadow-black/10">
                  <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-extrabold tracking-wide text-[color:var(--app-muted-2)]">ตั้งค่าปลายทาง</div>
                        <div className="mt-0.5 truncate text-sm font-extrabold text-[color:var(--app-text)]">ประเภท + หมวดหมู่</div>
                      </div>
                      <div className="shrink-0 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-right">
                        <div className="text-[10px] font-extrabold text-[color:var(--app-muted-2)]">ใช้กับ</div>
                        <div className="text-sm font-extrabold text-[color:var(--app-text)]">{selectedCount} รายการ</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-bold text-[color:var(--app-muted)]">ประเภทปลายทาง</label>
                      <div className="mt-2 flex rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-1">
                        <button
                          type="button"
                          onClick={() => setBulkTargetType('expense')}
                          className={[
                            'flex-1 px-4 py-2 text-sm font-extrabold rounded-2xl transition focus:outline-none focus:ring-2 focus:ring-emerald-400/25',
                            bulkTargetType === 'expense'
                              ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25'
                              : 'text-slate-300 hover:text-slate-100',
                          ].join(' ')}
                        >
                          รายจ่าย
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkTargetType('income')}
                          className={[
                            'flex-1 px-4 py-2 text-sm font-extrabold rounded-2xl transition focus:outline-none focus:ring-2 focus:ring-emerald-400/25',
                            bulkTargetType === 'income'
                              ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25'
                              : 'text-slate-300 hover:text-slate-100',
                          ].join(' ')}
                        >
                          รายรับ
                        </button>
                      </div>
                      <div className="mt-2 text-[11px] font-semibold text-[color:var(--app-muted)]">
                        เลือกแล้ว: <span className="font-extrabold text-slate-200">{bulkTargetType === 'income' ? 'รายรับ' : 'รายจ่าย'}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-bold text-[color:var(--app-muted)]">หมวดหมู่ปลายทาง</label>

                      {(bulkCategories || []).length === 0 ? (
                        <div className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-amber-300">
                                {bulkTargetType === 'income' ? 'ยังไม่มีหมวดรายรับ' : 'ยังไม่มีหมวดรายจ่าย'}
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-text)]">
                                ไปเพิ่มหมวดในหน้า “งบประมาณ” ก่อน แล้วกลับมาเลือกใหม่
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowBulkCategoryModal(false);
                                  window.location.href = '/budget';
                                }}
                                className="mt-3 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-extrabold text-slate-100 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                              >
                                ไปหน้า งบประมาณ
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 relative">
                            <select
                              value={bulkCategoryId}
                              onChange={(e) => setBulkCategoryId(e.target.value)}
                              className="h-12 w-full appearance-none rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 pr-11 text-sm font-semibold text-[color:var(--app-text)] shadow-sm hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                            >
                              {bulkCategories.map((c) => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-muted)]" aria-hidden="true" />
                          </div>
                          <div className="mt-2 text-[11px] font-semibold text-[color:var(--app-muted)]">
                            มี {bulkCategories.length} หมวด{bulkTargetType === 'income' ? 'รายรับ' : 'รายจ่าย'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
		            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4 bg-[var(--app-surface)]">
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-slate-100 hover:bg-white/10"
              >
                ยกเลิก
              </button>
	              <button
	                type="button"
	                onClick={handleBulkUpdateCategory}
	                disabled={!canBulkSaveCategory}
	                className={[
	                  'rounded-2xl px-4 py-3 text-sm font-extrabold shadow-sm',
	                  (!canBulkSaveCategory)
	                    ? 'bg-emerald-500/30 text-slate-950/50 cursor-not-allowed'
	                    : 'bg-emerald-500 text-slate-950 hover:brightness-95',
	                ].join(' ')}
	              >
	                บันทึก
	              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Bulk Date Modal */}
	      {mounted && showBulkDateModal && createPortal((
	        <div
	          className="fixed inset-0 z-[9999] bg-slate-950/30 backdrop-blur-sm animate-fadeIn flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom)] sm:pb-0 overflow-hidden overscroll-contain"
	          onClick={(e) => e.target === e.currentTarget && setShowBulkDateModal(false)}
	        >
          <div className="bg-[var(--app-surface)] w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden animate-slideUp border border-[color:var(--app-border)] text-[color:var(--app-text)]">
	            <div className="px-5 pt-5 pb-4">
	              <div className="text-sm font-extrabold">แก้วันที่ ({selectedCount})</div>
	              <div className="mt-4">
	                <label className="text-xs font-bold text-[color:var(--app-muted)]">วันที่</label>
	                <button
	                  type="button"
	                  onClick={openBulkDatePicker}
	                  className="mt-2 w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-emerald-400/30 hover:bg-[var(--app-surface-3)] transition flex items-center justify-between gap-3"
	                  aria-label="เปิดปฏิทินเลือกวันที่"
	                >
	                  <div className="min-w-0">
	                    <div className="text-sm font-extrabold text-[color:var(--app-text)] truncate">
	                      {(() => {
	                        const iso = String(bulkDate || '');
	                        if (!iso) return 'เลือกวันที่';
	                        const today = toLocalISODateKey(Date.now());
	                        try {
	                          const d = new Date(`${iso}T00:00:00`);
	                          const label = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
	                          return iso === today ? `วันนี้, ${label}` : label;
	                        } catch {
	                          return iso;
	                        }
	                      })()}
	                    </div>
	                    <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted-2)]">แตะเพื่อเปิดปฏิทิน</div>
	                  </div>
	                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20 shrink-0">
	                    <CalendarDays className="h-5 w-5" aria-hidden="true" />
	                  </div>
	                </button>
	              </div>
	            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4 bg-[var(--app-surface)]">
              <button
                type="button"
                onClick={() => setShowBulkDateModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-slate-100 hover:bg-white/10"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleBulkUpdateDate}
                disabled={!bulkDate || selectedCount === 0}
                className={[
                  'rounded-2xl px-4 py-3 text-sm font-extrabold shadow-sm',
                  (!bulkDate || selectedCount === 0)
                    ? 'bg-emerald-500/30 text-slate-950/50 cursor-not-allowed'
                    : 'bg-emerald-500 text-slate-950 hover:brightness-95',
                ].join(' ')}
              >
                บันทึก
              </button>
            </div>
	          </div>
	        </div>
	      ), document.body)}

	      {/* Bulk Date Picker Modal (custom calendar) */}
	      {mounted && showBulkDatePicker && createPortal((
	        <div
	          className="fixed inset-0 z-[10002] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:pb-0"
	          onClick={(e) => e.target === e.currentTarget && setShowBulkDatePicker(false)}
	        >
	          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[var(--app-surface)] shadow-2xl shadow-black/50 overflow-hidden text-slate-100">
	            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
	              <div>
	                <div className="text-sm font-extrabold text-[color:var(--app-text)]">เลือกวันที่</div>
	                <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">แก้หลายรายการพร้อมกัน (เลือกย้อนหลัง/ล่วงหน้าได้ สูงสุด 1 ปี)</div>
	              </div>
	              <button
	                type="button"
	                onClick={() => setShowBulkDatePicker(false)}
	                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
	                aria-label="ปิด"
	              >
	                <X className="h-5 w-5" aria-hidden="true" />
	              </button>
	            </div>

	            {(() => {
	              const FUTURE_DAYS_LIMIT = 365;
	              const todayKey = toLocalISODateKey(Date.now());
	              const maxKey = toLocalISODateKey(Date.now() + FUTURE_DAYS_LIMIT * 86400000);
	              const todayParsed = parseISODateKey(todayKey) || { year: new Date().getFullYear(), monthIndex: new Date().getMonth(), day: new Date().getDate() };
	              const maxParsed = parseISODateKey(maxKey) || todayParsed;
	              const selectedParsed = parseISODateKey(bulkDate) || todayParsed;
	              const { year, monthIndex } = bulkDatePickerMonth || selectedParsed;

	              const firstWeekday = new Date(year, monthIndex, 1).getDay();
	              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
	              const canGoNext = year < maxParsed.year || (year === maxParsed.year && monthIndex < maxParsed.monthIndex);
	              const monthLabel = `${MONTH_NAMES_TH[monthIndex] || ''} ${year + 543}`;
	              const weekdayTH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

	              const isBeyondMax = (d) => {
	                const iso = toISOFromParts(year, monthIndex, d);
	                return iso > maxKey;
	              };

	              const selectDay = (d) => {
	                if (isBeyondMax(d)) return;
	                const iso = toISOFromParts(year, monthIndex, d);
	                setBulkDate(iso);
	                setShowBulkDatePicker(false);
	              };

	              const goPrev = () => {
	                const m = monthIndex - 1;
	                if (m >= 0) setBulkDatePickerMonth({ year, monthIndex: m });
	                else setBulkDatePickerMonth({ year: year - 1, monthIndex: 11 });
	              };

	              const goNext = () => {
	                if (!canGoNext) return;
	                const m = monthIndex + 1;
	                if (m <= 11) setBulkDatePickerMonth({ year, monthIndex: m });
	                else setBulkDatePickerMonth({ year: year + 1, monthIndex: 0 });
	              };

	              const cells = [];
	              for (let i = 0; i < firstWeekday; i++) cells.push(null);
	              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
	              while (cells.length % 7 !== 0) cells.push(null);

	              return (
	                <>
	                  <div className="px-5 pt-4">
	                    <div className="flex items-center justify-between gap-2">
	                      <button
	                        type="button"
	                        onClick={goPrev}
	                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
	                        aria-label="เดือนก่อนหน้า"
	                      >
	                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
	                      </button>

	                      <div className="min-w-0 flex-1 text-center">
	                        <div className="text-sm font-extrabold text-[color:var(--app-text)]">{monthLabel}</div>
	                        <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">แตะวันที่เพื่อเลือก</div>
	                      </div>

	                      <button
	                        type="button"
	                        onClick={goNext}
	                        disabled={!canGoNext}
	                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 disabled:opacity-40"
	                        aria-label="เดือนถัดไป"
	                      >
	                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
	                      </button>
	                    </div>

	                    <div className="mt-4 grid grid-cols-7 gap-1.5">
	                      {weekdayTH.map((w) => (
	                        <div key={w} className="text-center text-[11px] font-extrabold text-[color:var(--app-muted)]">
	                          {w}
	                        </div>
	                      ))}

	                      {cells.map((d, idx) => {
	                        if (!d) return <div key={`e-${idx}`} className="h-10" />;
	                        const iso = toISOFromParts(year, monthIndex, d);
	                        const selected = iso === String(bulkDate || '');
	                        const today = iso === todayKey;
	                        const disabled = iso > maxKey;
	                        return (
	                          <button
	                            key={iso}
	                            type="button"
	                            onClick={() => selectDay(d)}
	                            disabled={disabled}
	                            className={[
	                              'h-10 rounded-2xl text-sm font-extrabold transition',
	                              'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
	                              disabled
	                                ? 'bg-white/0 text-white/25 cursor-not-allowed'
	                                : selected
	                                  ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
	                                  : today
	                                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/20'
	                                    : 'bg-white/5 text-slate-100 ring-1 ring-white/10 hover:bg-white/10',
	                            ].join(' ')}
	                            aria-pressed={selected}
	                            aria-label={`เลือกวันที่ ${d}`}
	                          >
	                            {d}
	                          </button>
	                        );
	                      })}
	                    </div>
	                  </div>

	                  <div className="mt-5 border-t border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2">
	                    <button
	                      type="button"
	                      onClick={() => {
	                        setBulkDate(todayKey);
	                        setShowBulkDatePicker(false);
	                      }}
	                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-slate-100 hover:bg-white/10"
	                    >
	                      วันนี้
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => setShowBulkDatePicker(false)}
	                      className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
	                    >
	                      เสร็จสิ้น
	                    </button>
	                  </div>
	                </>
	              );
	            })()}
	          </div>
	        </div>
	      ), document.body)}

	      {/* Delete Confirm Modal */}
	      {mounted && showDeleteConfirmModal && createPortal((
	        <div
	          className="fixed inset-0 z-[10000] bg-slate-950/45 backdrop-blur-sm animate-fadeIn flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom)] sm:pb-0 overflow-hidden overscroll-contain"
	          onClick={(e) => e.target === e.currentTarget && !deleteLoading && setShowDeleteConfirmModal(false)}
        >
          <div
            className="bg-[var(--app-surface)] w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden animate-slideUp border border-[color:var(--app-border)] text-[color:var(--app-text)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="ยืนยันการลบ"
          >
            <div className="px-5 pt-5 pb-4 border-b border-white/10 bg-[var(--app-surface)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-extrabold">
                    ลบ {deleteIds?.length || 0} รายการ?
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[color:var(--app-muted)]">
                    การลบจะไม่สามารถกู้คืนได้
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !deleteLoading && setShowDeleteConfirmModal(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  aria-label="ปิด"
                  title="ปิด"
                  disabled={deleteLoading}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {deleteError ? (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                  {deleteError}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 bg-[var(--app-surface)]">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-slate-100 hover:bg-white/10"
                disabled={deleteLoading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-60"
                disabled={deleteLoading || (deleteIds?.length || 0) === 0}
              >
                {deleteLoading ? 'กำลังลบ...' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Edit Modal */}
      {mounted && showEditModal && editingTransaction && createPortal((
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/30 backdrop-blur-sm animate-fadeIn flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom)] sm:pb-0 overflow-hidden overscroll-contain"
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
                <button
                  type="button"
                  onClick={openEditDatePicker}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 rounded-xl text-slate-100 hover:bg-white/10 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all flex items-center justify-between gap-3"
                  aria-label="เปิดปฏิทินเลือกวันที่"
                >
                  <div className="text-left min-w-0">
                    <div className="text-sm font-extrabold text-slate-100 truncate">
                      {(() => {
                        const iso = String(editFormData.date || '');
                        if (!iso) return 'เลือกวันที่';
                        try {
                          const d = new Date(`${iso}T00:00:00`);
                          return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                        } catch {
                          return iso;
                        }
                      })()}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted-2)]">แตะเพื่อเปิดปฏิทิน</div>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20 shrink-0">
                    <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  </div>
                </button>
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
      ), document.body)}

      {/* Edit Date Picker Modal (custom calendar) */}
      {mounted && showEditDatePicker && createPortal((
        <div
          className="fixed inset-0 z-[10001] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:pb-0"
          onClick={(e) => e.target === e.currentTarget && setShowEditDatePicker(false)}
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[var(--app-surface)] shadow-2xl shadow-black/50 overflow-hidden text-slate-100">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
              <div>
                <div className="text-sm font-extrabold text-[color:var(--app-text)]">เลือกวันที่</div>
                <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">เลือกย้อนหลัง/ล่วงหน้าได้ (สูงสุด 1 ปี)</div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditDatePicker(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {(() => {
              const FUTURE_DAYS_LIMIT = 365;
              const todayKey = toLocalISODateKey(Date.now());
              const maxKey = toLocalISODateKey(Date.now() + FUTURE_DAYS_LIMIT * 86400000);
              const todayParsed = parseISODateKey(todayKey) || { year: new Date().getFullYear(), monthIndex: new Date().getMonth(), day: new Date().getDate() };
              const maxParsed = parseISODateKey(maxKey) || todayParsed;
              const selectedParsed = parseISODateKey(editFormData?.date) || todayParsed;
              const { year, monthIndex } = editDatePickerMonth || selectedParsed;

              const firstWeekday = new Date(year, monthIndex, 1).getDay();
              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
              const canGoNext = year < maxParsed.year || (year === maxParsed.year && monthIndex < maxParsed.monthIndex);
              const monthLabel = `${MONTH_NAMES_TH[monthIndex] || ''} ${year + 543}`;
              const weekdayTH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

              const isBeyondMax = (d) => {
                const iso = toISOFromParts(year, monthIndex, d);
                return iso > maxKey;
              };

              const selectDay = (d) => {
                if (isBeyondMax(d)) return;
                const iso = toISOFromParts(year, monthIndex, d);
                setEditFormData((prev) => ({ ...prev, date: iso }));
                setShowEditDatePicker(false);
              };

              const goPrev = () => {
                const m = monthIndex - 1;
                if (m >= 0) setEditDatePickerMonth({ year, monthIndex: m });
                else setEditDatePickerMonth({ year: year - 1, monthIndex: 11 });
              };

              const goNext = () => {
                if (!canGoNext) return;
                const m = monthIndex + 1;
                if (m <= 11) setEditDatePickerMonth({ year, monthIndex: m });
                else setEditDatePickerMonth({ year: year + 1, monthIndex: 0 });
              };

              const cells = [];
              for (let i = 0; i < firstWeekday; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(null);

              return (
                <>
                  <div className="px-5 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                        aria-label="เดือนก่อนหน้า"
                      >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>

                      <div className="min-w-0 flex-1 text-center">
                        <div className="text-sm font-extrabold text-[color:var(--app-text)]">{monthLabel}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">แตะวันที่เพื่อเลือก</div>
                      </div>

                      <button
                        type="button"
                        onClick={goNext}
                        disabled={!canGoNext}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 disabled:opacity-40"
                        aria-label="เดือนถัดไป"
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-1.5">
                      {weekdayTH.map((w) => (
                        <div key={w} className="text-center text-[11px] font-extrabold text-[color:var(--app-muted)]">
                          {w}
                        </div>
                      ))}

                      {cells.map((d, idx) => {
                        if (!d) return <div key={`e-${idx}`} className="h-10" />;
                        const iso = toISOFromParts(year, monthIndex, d);
                        const selected = iso === String(editFormData?.date || '');
                        const today = iso === todayKey;
                        const disabled = iso > maxKey;
                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => selectDay(d)}
                            disabled={disabled}
                            className={[
                              'h-10 rounded-2xl text-sm font-extrabold transition',
                              'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
                              disabled
                                ? 'bg-white/0 text-white/25 cursor-not-allowed'
                                : selected
                                  ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
                                  : today
                                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/20'
                                    : 'bg-white/5 text-slate-100 ring-1 ring-white/10 hover:bg-white/10',
                            ].join(' ')}
                            aria-pressed={selected}
                            aria-label={`เลือกวันที่ ${d}`}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditFormData((prev) => ({ ...prev, date: todayKey }));
                        setShowEditDatePicker(false);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-slate-100 hover:bg-white/10"
                    >
                      วันนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditDatePicker(false)}
                      className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ), document.body)}
    </main>
  );
}
