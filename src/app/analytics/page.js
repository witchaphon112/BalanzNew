"use client";
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingMascot from '@/components/LoadingMascot';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
// ใช้ Lucide Icons แทน SVG วาดเองและ Emoji
import { 
  Wallet, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight,
  X,
  Utensils, ShoppingBag, Car, Home, Zap, Heart, 
  Gamepad2, Stethoscope, GraduationCap, Plane, 
  Briefcase, Gift, Smartphone, Coffee, Music, 
  Dumbbell, PawPrint, Scissors, CreditCard, 
  Landmark, MoreHorizontal, Layers, SlidersHorizontal
} from 'lucide-react';

// ลงทะเบียน Chart.js
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Utility: format numbers for display
const formatCurrency = (v) => {
  if (typeof v !== 'number') return v;
  try {
    return new Intl.NumberFormat('th-TH').format(v);
  } catch {
    return String(v);
  }
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const clamp01 = (n) => Math.max(0, Math.min(1, n));

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

// --- 1. ICON CONFIG ---
// Map ชื่อไอคอน (จาก Database) ให้เป็น Component
const ICON_MAP = {
  'food': Utensils, 'drink': Coffee, 'restaurant': Utensils,
  'shopping': ShoppingBag, 'gift': Gift, 'clothes': Scissors,
  'transport': Car, 'fuel': Zap, 'plane': Plane,
  'home': Home, 'bills': Zap, 'pet': PawPrint,
  'game': Gamepad2, 'music': Music, 'health': Stethoscope, 'sport': Dumbbell,
  'money': Landmark, 'salary': CreditCard, 'work': Briefcase,
  'education': GraduationCap, 'tech': Smartphone,
  'other': MoreHorizontal, 'love': Heart
};

// Component ช่วยแสดง Icon (รองรับข้อมูลเก่าที่เป็น Emoji)
const CategoryIcon = ({ iconName, className = "w-5 h-5" }) => {
  const IconComp = ICON_MAP[iconName];
  if (IconComp) return <IconComp className={className} />;
  // Fallback สำหรับข้อมูลเก่าที่เป็น Emoji
  return <span className="text-lg leading-none">{iconName || '?'}</span>;
};

// --- 2. CONSTANTS ---
const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function Analytics() {
  const router = useRouter();

  const buildMonthList = () => {
    const now = new Date();
    const startYear = now.getFullYear() - 5;
    const endYear = now.getFullYear() + 1;
    const out = [];
    let currentIdx = 0;

    for (let y = startYear; y <= endYear; y++) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, 1);
        out.push({ label: `${MONTH_NAMES[m]} ${y + 543}`, value: d });
        if (y === now.getFullYear() && m === now.getMonth()) currentIdx = out.length - 1;
      }
    }

    return { out, currentIdx };
  };

  // --- STATE ---
  const [isMobile, setIsMobile] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const { out: monthList, currentIdx: initialMonthIndex } = useMemo(() => buildMonthList(), []);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => initialMonthIndex); // เริ่มที่เดือนปัจจุบัน
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Filter State
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'
  const [showTxnFilters, setShowTxnFilters] = useState(false);
  const [overviewMode, setOverviewMode] = useState('monthly'); // 'daily' | 'monthly'
  const spendChartRef = useRef(null);
  const spendClearTimerRef = useRef(null);
  const [activeSpendIndex, setActiveSpendIndex] = useState(null);
  const [spendTooltip, setSpendTooltip] = useState(null); // { xPx, yPx }

  useEffect(() => {
    return () => {
      try {
        if (spendClearTimerRef.current) clearTimeout(spendClearTimerRef.current);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(!!mq.matches);
    onChange();
    try {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);

  const selectedMonthObj = monthList[currentMonthIndex];

  const monthIndexMap = useMemo(() => {
    const map = new Map();
    monthList.forEach((m, idx) => {
      const d = m?.value instanceof Date ? m.value : null;
      if (!d) return;
      map.set(`${d.getFullYear()}-${d.getMonth()}`, idx);
    });
    return map;
  }, [monthList]);

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
    return MONTH_NAMES.map((name, monthIndex) => {
      const idx = monthIndexMap.get(`${y}-${monthIndex}`);
      return { name, monthIndex, idx: typeof idx === 'number' ? idx : null };
    });
  }, [monthIndexMap, monthPickerYear]);

  useEffect(() => {
    if (!showMonthPicker) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowMonthPicker(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [showMonthPicker]);

  // --- EFFECT: Fetch Data ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    const loadData = async () => {
      try {
        setLoading(true);
        const [resTrans, resCats] = await Promise.all([
          fetch(`${API_BASE}/api/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/categories`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const dataTrans = await resTrans.json();
        const dataCats = await resCats.json();

        if (resTrans.ok && resCats.ok) {
          setTransactions(dataTrans);
          setCategories(dataCats);
        } else {
          throw new Error('Failed to fetch data');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // --- LOGIC: Filter & Calculations ---
  // กรอง Transaction ตามเดือนที่เลือก
  let filteredTransactions = transactions.filter((t) => {
    const tDate = new Date(t.date);
    const mDate = selectedMonthObj.value;
    return tDate.getMonth() === mDate.getMonth() && tDate.getFullYear() === mDate.getFullYear();
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter by type
  if (filterType !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.type === filterType);
  }

  // Apply filterText (search หมวดหมู่/หมายเหตุ)
  if (filterText.trim()) {
    filteredTransactions = filteredTransactions.filter(t => {
      const cat = categories.find(c => c._id === t.category?._id || c._id === t.category);
      const catName = cat?.name?.toLowerCase() || '';
      const notes = (t.notes || '').toLowerCase();
      return catName.includes(filterText.toLowerCase()) || notes.includes(filterText.toLowerCase());
    });
  }

  // คำนวณยอดรวม
  const summary = filteredTransactions.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });
  
  const balance = summary.income - summary.expense;
  const healthScore = useMemo(() => {
    if (!Number.isFinite(summary.income) || summary.income <= 0) return 0;
    const savingsRate = (summary.income - summary.expense) / summary.income; // -inf..1
    return Math.round(clamp01(savingsRate) * 100);
  }, [summary.income, summary.expense]);

  const healthLabel = healthScore >= 80 ? 'ดีเยี่ยม' : healthScore >= 60 ? 'ดี' : 'ควรปรับปรุง';
  const healthSubLabel = healthScore >= 80
    ? 'คุณทำได้ดีมาก! ออมต่อเนื่องแบบนี้เลย'
    : healthScore >= 60
      ? 'กำลังไปได้ดี ลองเพิ่มสัดส่วนการออมอีกนิด'
      : 'ลองลดรายจ่าย หรือเพิ่มรายรับเพื่อให้เหลือออมมากขึ้น';

  const spendingTrend = useMemo(() => {
    const monthDate = selectedMonthObj?.value instanceof Date ? selectedMonthObj.value : null;
    if (!monthDate) return null;

    const now = new Date();
    const isCurrentMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
    const endDate = isCurrentMonth ? now : new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }

    const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const expenseByDay = new Map(days.map(d => [dayKey(d), 0]));

    for (const t of filteredTransactions || []) {
      if (!t || t.type !== 'expense') continue;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      if (!expenseByDay.has(key)) continue;
      expenseByDay.set(key, expenseByDay.get(key) + (Number(t.amount) || 0));
    }

    const values = days.map(d => expenseByDay.get(dayKey(d)) || 0);
    const todaySpend = values[values.length - 1] || 0;

    // Compare month expense vs last month expense
    const lastMonthDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    let lastMonthExpense = 0;
    for (const t of transactions || []) {
      if (!t || t.type !== 'expense') continue;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== lastMonthDate.getFullYear() || d.getMonth() !== lastMonthDate.getMonth()) continue;
      lastMonthExpense += Number(t.amount) || 0;
    }
    const thisMonthExpense = Number(summary.expense) || 0;
    const pctChange = lastMonthExpense > 0 ? Math.round(((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100) : null;

    // Build SVG paths
    const W = 100;
    const H = 40;
    const pad = 4;
    const usableH = H - pad * 2;
    const max = Math.max(1, ...values);
    const points = values.map((v, i) => {
      const x = (i / 6) * W;
      const y = pad + (1 - v / max) * usableH;
      return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
    });

    const dPath = buildSmoothSvgPath(points);
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = `${dPath} L ${last.x} ${H} L ${first.x} ${H} Z`;
    const labels = days.map(d => d.toLocaleDateString('th-TH', { weekday: 'short' }));

    return { dPath, areaPath, labels, values, todaySpend, thisMonthExpense, pctChange, points };
  }, [selectedMonthObj, filteredTransactions, transactions, summary.expense]);

  // จัดกลุ่มรายจ่ายตามหมวดหมู่
  const expenseByCategory = useMemo(() => {
    const map = {};
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const catName = t.category?.name || 'อื่นๆ';
        map[catName] = (map[catName] || 0) + (t.amount || 0);
      });
    return map;
  }, [filteredTransactions]);

  const dailySeries = useMemo(() => {
    const map = new Map();
    filteredTransactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const row = map.get(key);
      if (t.type === 'income') row.income += t.amount || 0;
      else row.expense += t.amount || 0;
    });

    const keys = Array.from(map.keys()).sort((a, b) => new Date(a) - new Date(b));
    const labels = keys.map(k => new Date(k).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
    return {
      labels,
      income: keys.map(k => map.get(k).income),
      expense: keys.map(k => map.get(k).expense),
    };
  }, [filteredTransactions]);

  const dailySeriesDisplay = useMemo(() => {
    const maxPoints = isMobile ? 12 : 20;
    if (dailySeries.labels.length <= maxPoints) return dailySeries;
    const start = Math.max(0, dailySeries.labels.length - maxPoints);
    return {
      labels: dailySeries.labels.slice(start),
      income: dailySeries.income.slice(start),
      expense: dailySeries.expense.slice(start),
    };
  }, [dailySeries, isMobile]);

  // --- CHART CONFIG ---
  const pieLabels = useMemo(() => Object.keys(expenseByCategory), [expenseByCategory]);
  const pieValues = useMemo(() => Object.values(expenseByCategory), [expenseByCategory]);
  const baseColors = ['#22c55e', '#10b981', '#14b8a6', '#0ea5e9', '#2563eb', '#6366f1', '#a855f7', '#ec4899', '#f97316', '#f59e0b', '#f43f5e', '#64748b'];
  const pieColors = pieLabels.map((_, i) => baseColors[i % baseColors.length]);
  const pieColorByLabel = useMemo(() => {
    const map = {};
    pieLabels.forEach((l, i) => { map[l] = pieColors[i]; });
    return map;
  }, [pieLabels, pieColors]);

  const pieData = {
    labels: pieLabels,
    datasets: [{ data: pieValues, backgroundColor: pieColors, borderWidth: 0 }]
  };

  const barData = overviewMode === 'daily'
    ? {
        labels: dailySeriesDisplay.labels,
        datasets: [
          {
            label: 'รายรับ',
            data: dailySeriesDisplay.income,
            backgroundColor: '#22c55e',
            borderRadius: 10,
            barThickness: 18,
          },
          {
            label: 'รายจ่าย',
            data: dailySeriesDisplay.expense,
            backgroundColor: '#f43f5e',
            borderRadius: 10,
            barThickness: 18,
          },
        ]
      }
    : {
        labels: ['รายรับ', 'รายจ่าย'],
        datasets: [{
          label: 'จำนวนเงิน (บาท)',
          data: [summary.income, summary.expense],
          backgroundColor: ['#22c55e', '#f43f5e'],
          borderRadius: 12,
          barThickness: 56,
        }]
      };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(2, 8, 23, 0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: 'rgba(248,250,252,0.95)',
        bodyColor: 'rgba(226,232,240,0.95)',
        callbacks: {
          title: (items) => {
            const first = items?.[0];
            if (!first) return '';
            return overviewMode === 'daily' ? String(first.label || '') : '';
          },
          label: (ctx) => {
            const v = ctx.raw ?? 0;
            return `฿ ${formatCurrency(v)}`;
          }
        }
      }
    },
    interaction: { mode: 'index', intersect: false },
    scales: overviewMode === 'daily'
      ? {
          y: {
            display: true,
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
            ticks: { color: 'rgba(226, 232, 240, 0.7)', maxTicksLimit: isMobile ? 4 : 6, callback: (v) => formatCurrency(v) }
          },
          x: { grid: { display: false }, ticks: { color: 'rgba(148, 163, 184, 0.8)', maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 6 : 12 } }
        }
      : { y: { display: false, grid: { display: false } }, x: { grid: { display: false }, ticks: { color: 'rgba(148, 163, 184, 0.8)' } } },
  };

  const pieChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(2, 8, 23, 0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: 'rgba(248,250,252,0.95)',
        bodyColor: 'rgba(226,232,240,0.95)',
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || '';
            const v = ctx.raw ?? 0;
            const total = pieValues.reduce((s, n) => s + (Number(n) || 0), 0) || 0;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return `${label}: ฿ ${formatCurrency(v)} (${pct}%)`;
          }
        }
      }
    }
  }), [pieValues]);

  const topExpenseList = useMemo(() => {
    const items = Object.entries(expenseByCategory)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, isMobile ? 5 : 8)
      .map(([name, amount]) => ({ name, amount: amount || 0 }));
    return items;
  }, [expenseByCategory, isMobile]);

  const recentTransactions = useMemo(() => {
    const src = Array.isArray(filteredTransactions) ? filteredTransactions : [];
    return src.slice(0, 5);
  }, [filteredTransactions]);

  const formatTxnTime = (dateInput) => {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const isSameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === y.getFullYear() &&
      d.getMonth() === y.getMonth() &&
      d.getDate() === y.getDate();

    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    if (isSameDay) return `วันนี้, ${time}`;
    if (isYesterday) return `เมื่อวาน, ${time}`;
    return `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}, ${time}`;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)]">
      <LoadingMascot label="กำลังโหลด..." size={88} />
    </div>
  );

  return (
    <main className="fixed inset-0 bg-[var(--app-bg)] text-[color:var(--app-text)] overflow-y-auto">
      <div className="mx-auto w-full max-w-lg px-4 py-5 pb-24 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-[color:var(--app-text)]">ภาพรวมการเงิน</h1>
          <p className="mt-1 text-sm font-semibold text-[color:var(--app-muted)]">ดูกราฟสรุปรายรับ-รายจ่ายแบบเข้าใจง่าย</p>
        </div>

        {/* Month selector */}
        <div className="relative z-[1] rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-2 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-emerald-200 hover:bg-[var(--app-surface-3)] disabled:opacity-40"
              disabled={currentMonthIndex === 0}
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                const d = selectedMonthObj?.value instanceof Date ? selectedMonthObj.value : new Date();
                setMonthPickerYear(d.getFullYear());
                setShowMonthPicker(true);
              }}
              className="min-w-0 flex-1 cursor-pointer rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2 text-center transition hover:bg-[var(--app-surface-3)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              aria-label="เปิดปฏิทินเลือกเดือน"
              aria-expanded={showMonthPicker}
            >
              <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">เดือนที่เลือก</div>
              <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">{selectedMonthObj.label}</div>
            </button>

            <button
              type="button"
              onClick={() => setCurrentMonthIndex(prev => Math.min(monthList.length - 1, prev + 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-emerald-200 hover:bg-[var(--app-surface-3)] disabled:opacity-40"
              disabled={currentMonthIndex === monthList.length - 1}
              aria-label="เดือนถัดไป"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Month Picker Modal */}
        {showMonthPicker && (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm flex items-start justify-center p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+88px)]"
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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-40"
                    aria-label="ปีก่อนหน้า"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="min-w-0 flex-1 text-center">
                    <div className="text-sm font-extrabold text-[color:var(--app-text)]">{Number(monthPickerYear) + 543}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-400">พ.ศ.</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableYears.indexOf(monthPickerYear);
                      const prev = idx > 0 ? availableYears[idx - 1] : null;
                      if (typeof prev === 'number') setMonthPickerYear(prev);
                    }}
                    disabled={availableYears.indexOf(monthPickerYear) <= 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-40"
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
                    const now = new Date();
                    const idx = monthIndexMap.get(`${now.getFullYear()}-${now.getMonth()}`);
                    if (typeof idx === 'number') setCurrentMonthIndex(idx);
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

        {error && (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-200 shadow-sm">
            <div className="text-sm font-semibold">{error}</div>
          </div>
        )}

        {/* Summary (stack like reference) */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-400">รายรับ</div>
                <div className="mt-1 text-2xl font-extrabold text-emerald-300">฿{formatCurrency(summary.income)}</div>
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-400">รายจ่าย</div>
                <div className="mt-1 text-2xl font-extrabold text-rose-300">฿{formatCurrency(summary.expense)}</div>
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/20">
                <TrendingDown className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-400">คงเหลือสุทธิ</div>
                <div className={`mt-1 text-2xl font-extrabold ${balance >= 0 ? 'text-[color:var(--app-text)]' : 'text-rose-200'}`}>฿{formatCurrency(balance)}</div>
              </div>
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${balance >= 0 ? 'bg-white/5 text-slate-100 ring-white/10' : 'bg-rose-500/15 text-rose-200 ring-rose-400/20'}`}>
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Financial health score */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 to-green-500 p-5 text-slate-950 shadow-lg shadow-emerald-500/20">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-[42px] bg-white/20" aria-hidden="true" />
          <div className="absolute -right-2 -top-2 h-24 w-24 rounded-[32px] bg-white/15" aria-hidden="true" />

          <div className="relative z-10">
            <div className="text-[11px] font-extrabold tracking-wide text-slate-950/70">คะแนนสุขภาพการเงิน</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-4xl font-extrabold">{healthScore}</div>
              <div className="text-sm font-extrabold text-slate-950/70">/ 100</div>
            </div>

            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/25 px-3 py-1 text-[11px] font-extrabold">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-950/70" aria-hidden="true" />
              {healthLabel}
            </div>

            <div className="mt-3 text-[11px] font-semibold text-slate-950/70">{healthSubLabel}</div>

            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/15">
              <div className="h-full rounded-full bg-white/80" style={{ width: `${healthScore}%` }} />
            </div>
          </div>
        </div>

        {/* Spending trend */}
        {spendingTrend && (
          <div className="relative overflow-hidden rounded-[34px] border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-300">ใช้ไปวันนี้</div>
                <div className="mt-2 text-4xl font-extrabold text-[color:var(--app-text)]">฿{formatCurrency(spendingTrend.todaySpend)}</div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-sm font-extrabold text-slate-300">เดือนนี้</div>
                <div className="mt-2 text-2xl font-extrabold text-[color:var(--app-text)]">฿{formatCurrency(spendingTrend.thisMonthExpense)}</div>
                {typeof spendingTrend.pctChange === 'number' && (
                  <div
                    className={[
                      'mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold',
                      spendingTrend.pctChange <= 0 ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/20' : 'bg-rose-500/15 text-rose-200 border border-rose-400/20'
                    ].join(' ')}
                  >
                    {spendingTrend.pctChange > 0 ? `+${spendingTrend.pctChange}%` : `${spendingTrend.pctChange}%`} เทียบเดือนก่อน
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div
                ref={spendChartRef}
                className="relative h-24"
                onPointerLeave={() => {
                  setActiveSpendIndex(null);
                  setSpendTooltip(null);
                }}
                onPointerDown={(e) => {
                  if (!spendChartRef.current || !spendingTrend?.points?.length) return;
                  const rect = spendChartRef.current.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const idx = Math.max(0, Math.min(6, Math.round((x / Math.max(1, rect.width)) * 6)));
                  const p = spendingTrend.points[idx];
                  const yPx = (p.y / 40) * rect.height;

                  setActiveSpendIndex(idx);
                  setSpendTooltip({ xPx: x, yPx });

                  // On touch, keep tooltip briefly after tapping.
                  if (e.pointerType === 'touch') {
                    try {
                      if (spendClearTimerRef.current) clearTimeout(spendClearTimerRef.current);
                      spendClearTimerRef.current = setTimeout(() => {
                        setActiveSpendIndex(null);
                        setSpendTooltip(null);
                      }, 1800);
                    } catch {
                      // ignore
                    }
                  }
                }}
                onPointerMove={(e) => {
                  if (!spendChartRef.current || !spendingTrend?.points?.length) return;
                  const rect = spendChartRef.current.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const idx = Math.max(0, Math.min(6, Math.round((x / Math.max(1, rect.width)) * 6)));
                  const p = spendingTrend.points[idx];
                  const yPx = (p.y / 40) * rect.height;

                  setActiveSpendIndex(idx);
                  setSpendTooltip({ xPx: x, yPx });
                }}
                role="img"
                aria-label="กราฟแนวโน้มรายจ่าย 7 วันล่าสุด (แตะหรือเลื่อนเมาส์เพื่อดูตัวเลข)"
              >
                {spendTooltip && activeSpendIndex != null && (
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs font-extrabold text-slate-100 backdrop-blur"
                    style={{
                      left: `${Math.max(10, Math.min((spendChartRef.current?.getBoundingClientRect().width || 0) - 10, spendTooltip.xPx))}px`,
                      top: `${Math.max(8, spendTooltip.yPx)}px`,
                    }}
                  >
                    <div className="text-slate-300">{spendingTrend.labels[activeSpendIndex]}</div>
                    <div className="mt-0.5">฿{formatCurrency(spendingTrend.values[activeSpendIndex] || 0)}</div>
                  </div>
                )}

                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="spendStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.65" />
                      <stop offset="70%" stopColor="#34d399" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.95" />
                    </linearGradient>
                    <filter id="spendGlow" x="-20%" y="-40%" width="140%" height="200%">
                      <feGaussianBlur stdDeviation="0.9" result="blur" />
                      <feColorMatrix
                        in="blur"
                        type="matrix"
                        values="
                          0 0 0 0 0.133
                          0 0 0 0 0.773
                          0 0 0 0 0.365
                          0 0 0 0.9 0"
                        result="glow"
                      />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <rect x="0" y="0" width="100" height="40" fill="transparent" />
                  <path d={spendingTrend.areaPath} fill="url(#spendFill)" />
                  <path
                    d={spendingTrend.dPath}
                    fill="none"
                    stroke="url(#spendStroke)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.18"
                    filter="url(#spendGlow)"
                  />
                  <path
                    d={spendingTrend.dPath}
                    fill="none"
                    stroke="url(#spendStroke)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {activeSpendIndex != null && spendingTrend.points?.[activeSpendIndex] && (
                    <>
                      <circle
                        cx={spendingTrend.points[activeSpendIndex].x}
                        cy={spendingTrend.points[activeSpendIndex].y}
                        r="2.6"
                        fill="#0b2730"
                        stroke="#34d399"
                        strokeWidth="1.4"
                      />
                      <circle
                        cx={spendingTrend.points[activeSpendIndex].x}
                        cy={spendingTrend.points[activeSpendIndex].y}
                        r="5.5"
                        fill="#22c55e"
                        opacity="0.10"
                      />
                    </>
                  )}
                </svg>
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[color:var(--app-muted-2)]">
                {spendingTrend.labels.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[color:var(--app-text)]">กราฟรายรับ-รายจ่าย</div>
                <div className="text-xs font-semibold text-slate-400">แตะ/วางเมาส์บนแท่งเพื่อดูรายละเอียด</div>
              </div>
              <div className="inline-flex items-center rounded-full bg-white/5 p-1 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => setOverviewMode('daily')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-full transition ${overviewMode === 'daily' ? 'bg-white/10 text-[color:var(--app-text)]' : 'text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]'}`}
                >
                  รายวัน
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewMode('monthly')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-full transition ${overviewMode === 'monthly' ? 'bg-white/10 text-[color:var(--app-text)]' : 'text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]'}`}
                >
                  รวมเดือน
                </button>
              </div>
            </div>

            <div className="mt-4 h-56">
              <Bar data={barData} options={barChartOptions} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-300">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />รายรับ</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />รายจ่าย</span>
            </div>

            {overviewMode === 'daily' && dailySeries.labels.length > dailySeriesDisplay.labels.length && (
              <div className="mt-2 text-[11px] font-semibold text-slate-400">
                แสดงเฉพาะ {dailySeriesDisplay.labels.length} วันล่าสุดเพื่อให้อ่านง่าย
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[color:var(--app-text)]">สัดส่วนรายจ่าย</div>
                <div className="text-xs font-semibold text-slate-400">แยกตามหมวดหมู่</div>
              </div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-200 ring-1 ring-white/10">
                <Layers className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              {pieLabels.length === 0 ? (
                <div className="h-56 rounded-3xl border border-white/10 bg-white/5 flex items-center justify-center text-sm font-semibold text-slate-400">
                  ไม่มีรายจ่ายในเดือนนี้
                </div>
              ) : (
                <div className="relative h-64">
                  <Doughnut data={pieData} options={pieChartOptions} />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[11px] font-semibold text-slate-400">รายจ่ายรวม</div>
                    <div className="mt-1 text-xl font-extrabold text-[color:var(--app-text)]">฿{formatCurrency(summary.expense)}</div>
                  </div>
                </div>
              )}
            </div>

            {pieLabels.length > 0 && (
              <div className="mt-4 space-y-2">
                {topExpenseList.map(item => {
                  const total = summary.expense || 0;
                  const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
                  const color = pieColorByLabel[item.name] || '#64748b';
                  return (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                        <div className="truncate text-sm font-bold text-[color:var(--app-text)]">{item.name}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-extrabold text-slate-300">
                          {pct}%
                        </span>
                        <div className="text-sm font-extrabold text-[color:var(--app-text)]">฿{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions (match reference design) */}
        <div className="rounded-[34px] border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[0_20px_70px_-55px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-extrabold text-[color:var(--app-text)]">รายการล่าสุด</div>
            <button
              type="button"
              onClick={() => setShowTxnFilters((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
              aria-label="ตัวกรอง"
              title="ตัวกรอง"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          {showTxnFilters && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-3 ring-1 ring-white/10">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px,minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="flex w-full rounded-2xl border border-white/10 bg-black/15 p-1 shadow-sm shadow-black/10" role="group" aria-label="ตัวกรองประเภทรายการ">
                    <button
                      type="button"
                      onClick={() => setFilterType('all')}
                      aria-pressed={filterType === 'all'}
                      className={[
                        'flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-emerald-400/25',
                        filterType === 'all'
                          ? 'bg-white/10 text-[color:var(--app-text)] ring-1 ring-white/10'
                          : 'text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-white/5',
                      ].join(' ')}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('income')}
                      aria-pressed={filterType === 'income'}
                      className={[
                        'flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-emerald-400/25',
                        filterType === 'income'
                          ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20'
                          : 'text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-white/5',
                      ].join(' ')}
                    >
                      รายรับ
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('expense')}
                      aria-pressed={filterType === 'expense'}
                      className={[
                        'flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-emerald-400/25',
                        filterType === 'expense'
                          ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/20'
                          : 'text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-white/5',
                      ].join(' ')}
                    >
                      รายจ่าย
                    </button>
                  </div>
                </div>

                <div className="relative min-w-0">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-2xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm font-semibold text-slate-100 placeholder-slate-500 shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                    placeholder="ค้นหา: หมวด หรือ หมายเหตุ..."
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 divide-y divide-white/10">
            {recentTransactions.length > 0 ? recentTransactions.map((t) => {
              const cat = categories.find((c) => c._id === t.category?._id || c._id === t.category);
              const isExpense = t.type === 'expense';
              const title = (t.notes || '').trim() || cat?.name || 'รายการ';
              const sub = formatTxnTime(t.date);
              const amount = Number(t.amount) || 0;
              const amountText = amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return (
                <div key={t._id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex items-center gap-4">
                    <div
                      className={[
                        'h-12 w-12 rounded-full flex items-center justify-center shrink-0 ring-1',
                        isExpense
                          ? 'bg-amber-500/15 text-amber-200 ring-amber-400/15'
                          : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/15',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      <CategoryIcon iconName={cat?.icon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-base font-extrabold text-[color:var(--app-text)]">{title}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-[color:var(--app-muted-2)]">{sub}</div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={`text-lg font-extrabold ${isExpense ? 'text-rose-200' : 'text-emerald-300'}`}>
                      {isExpense ? '-' : '+'} ฿{amountText}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-[color:var(--app-muted-2)]">
                      {cat?.name || (isExpense ? 'รายจ่าย' : 'รายรับ')}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="py-10 text-center text-sm font-semibold text-slate-400">ไม่มีรายการในเดือนนี้</div>
            )}
          </div>

          <div className="mt-6">
            <Link
              href="/transactions"
              className="block rounded-2xl py-2 text-center text-sm font-semibold text-slate-400 hover:text-slate-200"
            >
              ดูรายการทั้งหมด
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
