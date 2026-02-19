"use client";
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Utensils, ShoppingBag, Car, Home, Zap, Heart, Gamepad2, Stethoscope, GraduationCap, Plane, Briefcase, Gift, Smartphone, Coffee, Music, Dumbbell, PawPrint, Scissors, CreditCard, Landmark, MoreHorizontal, Plus, Settings, Trash2, X, ChevronRight, LayoutGrid, Book, Bus, Train, Truck, Bicycle, Apple, Banana, Beer, Cake, Camera, Film, Globe, MapPin, Sun, Moon, Star, Tree, Flower, Leaf, Cloud, Snowflake, Droplet, Flame, Key, Lock, Bell, AlarmClock, Wallet, PiggyBank, ShoppingCart, Shirt, Glasses, Watch, Tablet, Tv, Speaker, Headphones, Printer, Cpu, MousePointer, Pen, Pencil, Paintbrush, Ruler, Calculator, Clipboard, Paperclip, Archive, Box, Package, Rocket, Medal, Trophy, Award, Flag, Target, Lightbulb, Battery, Plug, Wifi, Bluetooth, Signal, TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon } from 'lucide-react';

// Import Budget modal component
import Budget from '../budget/page';
import Currency from '../currency/page';
const CurrencyModalContent = ({ onClose }) => (
  <Currency onClose={onClose} />
);

// Brand tone (Blue product theme)
const PRIMARY_COLOR = '#2563EB'; // blue-600
const PRIMARY_COLOR_DARK = '#1D4ED8'; // blue-700
const INCOME_COLOR = '#2563EB'; // blue
const EXPENSE_COLOR = '#F43F5E'; // rose-500
const NET_SAVING_COLOR = '#0F172A'; // slate-900
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

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

  const [userProfile, setUserProfile] = useState(() => {
    try {
      if (typeof window === 'undefined') return { name: '', profilePic: '' };
      return {
        name: localStorage.getItem('user_name') || '',
        profilePic: localStorage.getItem('profilePic') || '',
      };
    } catch {
      return { name: '', profilePic: '' };
    }
  });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInitialType, setBudgetInitialType] = useState('expense');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [categories, setCategories] = useState([]);
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
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  /* --- Data & Logic Setup --- */
  const getMonths = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() + 543; 
    const currentMonth = currentDate.getMonth();
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
      months.push(`${monthNames[actualMonthIndex]} ${year}`);
    }
    return months;
  };

  const months = getMonths();
  const currentDate = new Date();
  const currentMonthYear = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`;
  
  const currentMonthInitialIndex = months.findIndex(m => m === currentMonthYear);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(currentMonthInitialIndex !== -1 ? currentMonthInitialIndex : Math.floor(months.length / 2));
  const selectedMonth = months[currentMonthIndex];

  const getThaiYear = (date) => date.getFullYear() + 543;

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
      
      const selectedMonthName = selectedMonth.split(' ')[0];
      const selectedYear = selectedMonth.split(' ')[1];

      const filteredTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        const tMonthIndex = tDate.getMonth();
        const tYear = getThaiYear(tDate);
        
        return monthNames[tMonthIndex] === selectedMonthName && tYear.toString() === selectedYear;
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
      });
      setError('');
      
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (error.message || 'Error'));
      setStats({ totalIncome: 0, totalExpenses: 0, netSavings: 0, recentTransactions: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');

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

    if (!token) {
        window.location.href = '/login';
        return;
    }

    fetchStats();
    fetchCategories();
    
    return () => {};
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
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      fetchStats();
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const formatCurrentDate = () => {
    const d = new Date();
    const m = monthNames[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear() + 543;
    return `${m} ${day}, ${year}`;
  };

  const formatTHB = (value) => {
    const n = Number(value) || 0;
    return `฿${n.toLocaleString('th-TH')}`;
  };

  const expenseBreakdown = useMemo(() => {
    const src = (stats.transactionsAll && stats.transactionsAll.length)
      ? stats.transactionsAll
      : (stats.recentTransactions || []);

    const map = new Map();
    let total = 0;
    for (const t of src) {
      if (!t) continue;
      if (t.type !== 'expense') continue;
      const amt = Number(t.amount) || 0;
      if (amt <= 0) continue;
      total += amt;
      const id = t.category?._id || '_none';
      const name = t.category?.name || 'อื่นๆ';
      const prev = map.get(id) || { id, name, amount: 0 };
      prev.amount += amt;
      map.set(id, prev);
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    const colors = ['#3B82F6', '#EF4444', '#10B981']; // blue, red, green
    const top = sorted.slice(0, 3).map((item, idx) => ({
      ...item,
      color: colors[idx],
      pct: total > 0 ? item.amount / total : 0,
    }));

    return { total, top };
  }, [stats.transactionsAll, stats.recentTransactions]);

  /* --- JSX Rendering --- */

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
              {userProfile.profilePic ? (
                <img
                  src={userProfile.profilePic}
                  alt={userProfile.name || 'Profile'}
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold">
                  {(userProfile.name || 'B').trim().slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-slate-500 truncate">Welcome back</div>
              <div className="text-lg font-extrabold text-slate-900 truncate">{userProfile.name || 'Balanz'}</div>
              <div className="text-[11px] font-semibold text-slate-400">{formatCurrentDate()}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCurrencyModal(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="อัตราแลกเปลี่ยน"
              title="อัตราแลกเปลี่ยน"
            >
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m-5 3H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="การแจ้งเตือน"
              title="การแจ้งเตือน"
            >
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Budget Modal */}
        {showBudgetModal && (
          <Budget initialType={budgetInitialType} onClose={() => setShowBudgetModal(false)} />
        )}
        {/* Currency Modal */}
        {showCurrencyModal && (
          <CurrencyModalContent onClose={() => setShowCurrencyModal(false)} />
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <p className="text-red-700 font-medium text-sm">{error}</p>
          </div>
        )}

        {/* Total balance card */}
        <div className="rounded-[28px] bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white shadow-xl shadow-blue-600/20">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white/80">Total Balance</div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight">
                {loading ? '—' : formatTHB(stats.netSavings)}
              </div>
            </div>

            <div className="shrink-0">
              <select
                value={currentMonthIndex}
                onChange={(e) => setCurrentMonthIndex(parseInt(e.target.value, 10))}
                className="rounded-full bg-white/15 px-3 py-2 text-sm font-extrabold text-white outline-none ring-1 ring-white/20 backdrop-blur"
                aria-label="เลือกเดือน"
              >
                {months.map((m, idx) => (
                  <option key={m} value={idx} className="text-slate-900">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15">
              <div className="flex items-center gap-2 text-white/85 text-sm font-semibold">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/20">
                  <TrendingUpIcon className="h-4 w-4 text-emerald-200" />
                </span>
                Income
              </div>
              <div className="mt-2 text-xl font-extrabold">{loading ? '—' : formatTHB(stats.totalIncome)}</div>
            </div>

            <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15">
              <div className="flex items-center gap-2 text-white/85 text-sm font-semibold">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-400/20">
                  <TrendingDownIcon className="h-4 w-4 text-rose-100" />
                </span>
                Expenses
              </div>
              <div className="mt-2 text-xl font-extrabold">{loading ? '—' : formatTHB(stats.totalExpenses)}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setBudgetInitialType('expense');
                setShowBudgetModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/15 hover:bg-white/20"
            >
              <Plus className="h-4 w-4" />
              จัดการงบรายจ่าย
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonthIndex((prev) => (prev > 0 ? prev - 1 : 0))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/15 hover:bg-white/20 disabled:opacity-40"
                disabled={currentMonthIndex === 0}
                aria-label="เดือนก่อนหน้า"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonthIndex((prev) => (prev < months.length - 1 ? prev + 1 : months.length - 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/15 hover:bg-white/20 disabled:opacity-40"
                disabled={currentMonthIndex === months.length - 1}
                aria-label="เดือนถัดไป"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Spending */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Spending</h2>
          <Link href="/analytics" className="text-sm font-extrabold text-blue-700 hover:text-blue-800">
            See All
          </Link>
        </div>

        <div className="rounded-[28px] bg-white p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-center">
            {(() => {
              const radius = 42;
              const circ = 2 * Math.PI * radius;
              const segments = expenseBreakdown.top;
              const totalPct = segments.reduce((s, it) => s + (it.pct || 0), 0);
              let offset = 0;
              return (
                <div className="relative h-56 w-56">
                  <svg viewBox="0 0 100 100" className="h-full w-full">
                    <g transform="rotate(-90 50 50)">
                      <circle cx="50" cy="50" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
                      {segments.map((seg) => {
                        const len = circ * (seg.pct || 0);
                        const dashArray = `${len} ${Math.max(0, circ - len)}`;
                        const dashOffset = -offset;
                        offset += len;
                        return (
                          <circle
                            key={seg.id}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                          />
                        );
                      })}
                      {totalPct < 1 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke="#94A3B8"
                          opacity="0.12"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${circ * (1 - totalPct)} ${circ}`}
                          strokeDashoffset={-offset}
                        />
                      )}
                    </g>
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="text-xs font-semibold text-slate-500">Total Spent</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {loading ? '—' : formatTHB(expenseBreakdown.total)}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {(expenseBreakdown.top.length ? expenseBreakdown.top : [
              { id: 'none1', name: '—', pct: 0, color: '#3B82F6' },
              { id: 'none2', name: '—', pct: 0, color: '#EF4444' },
              { id: 'none3', name: '—', pct: 0, color: '#10B981' },
            ]).map((it) => (
              <div key={it.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
                  <div className="truncate text-[12px] font-semibold text-slate-600">{it.name}</div>
                </div>
                <div className="mt-1 text-base font-extrabold text-slate-900">
                  {Math.round((it.pct || 0) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-blue-600" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">ธุรกรรมล่าสุด</h2>
            </div>
            <Link href="/transactions" className="text-sm font-extrabold text-blue-700 hover:text-blue-800">
              ดูทั้งหมด
            </Link>
          </div>
          
          <div className="mt-3 rounded-3xl border border-slate-200/60 bg-white p-4 sm:p-5 shadow-sm">
            
            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 mt-3 text-sm font-semibold">กำลังโหลด...</p>
              </div>
            ) : stats.recentTransactions.length === 0 ? (
              <div className="text-center py-10">
                <svg className="w-16 h-16 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <p className="text-slate-700 text-sm font-extrabold">ไม่มีธุรกรรมในเดือนนี้</p>
                <p className="text-slate-500 text-xs mt-1 font-semibold">ลองเพิ่มรายการ หรือเปลี่ยนช่วงเดือน</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentTransactions.map((txn, index) => (
                  <button
                    key={txn._id}
                    type="button"
                    onClick={() => handleView(txn)}
                    className="group w-full rounded-3xl border border-slate-200/60 bg-white p-4 text-left shadow-sm hover:shadow-md transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={[
                            'h-11 w-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0',
                            txn.type === 'income'
                              ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                              : 'bg-gradient-to-br from-rose-500 to-rose-600',
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          {renderIcon(txn.category?.icon)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-slate-900">
                                {txn.category?.name || 'หมวดหมู่ไม่ระบุ'}
                              </div>
                              <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                                {txn.notes || '—'}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] font-semibold text-slate-400">
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
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
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
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
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
                  </button>
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slideUp">
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
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-red-700 font-medium text-sm">{error}</p>
                </div>
              )}

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ประเภท</label>
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
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
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
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    รายจ่าย
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">จำนวนเงิน</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={addFormData.amount}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all"
                    placeholder="0.00"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">฿</span>
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">หมวดหมู่</label>
                <select
                  value={addFormData.category}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">วันที่</label>
                <input
                  type="date"
                  value={addFormData.date}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all"
                  required
                />
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">หมายเหตุ</label>
                <textarea
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all resize-none"
                  placeholder="เพิ่มรายละเอียด..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slideUp">
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
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-red-700 font-medium text-sm">{error}</p>
                </div>
              )}

              {/* Type Selection */}
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

              {/* Amount Input */}
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

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">หมวดหมู่</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
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

              {/* Notes Input */}
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

              {/* Submit Buttons */}
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

      {/* View Transaction Modal */}
      {showViewModal && viewingTransaction && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowViewModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                style={{ background: viewingTransaction.type === 'income' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                {renderIcon(viewingTransaction.category?.icon)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">{viewingTransaction.category?.name || 'หมวดหมู่ไม่ระบุ'}</h3>
                <p className="text-xs text-gray-500">{viewingTransaction.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">จำนวนเงิน</span>
                <span className="text-xl font-bold" style={{ color: viewingTransaction.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }}>
                  {viewingTransaction.type === 'expense' ? '-' : '+'}{viewingTransaction.amount.toLocaleString()} ฿
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">วันที่</span>
                <span className="text-base font-medium text-gray-700">{new Date(viewingTransaction.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">หมายเหตุ</span>
                <span className="text-base text-gray-700">{viewingTransaction.notes || '-'}</span>
              </div>
              
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="py-2 px-6 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-600 transition-all">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
