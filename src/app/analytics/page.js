"use client";
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Utensils, ShoppingBag, Car, Home, Zap, Heart, 
  Gamepad2, Stethoscope, GraduationCap, Plane, 
  Briefcase, Gift, Smartphone, Coffee, Music, 
  Dumbbell, PawPrint, Scissors, CreditCard, 
  Landmark, MoreHorizontal, Layers
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

  // --- STATE ---
  const [isMobile, setIsMobile] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(60); // เริ่มที่เดือนปัจจุบัน
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  // Filter State
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'
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

  // --- LOGIC: Date Management ---
  const getMonths = () => {
    const months = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear(); 
    const currentMonth = currentDate.getMonth();
    
    // Generate 60 months back and 12 months forward
    for (let i = -60; i < 12; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      months.push({
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear() + 543}`,
        value: d
      });
    }
    return months;
  };
  
  const monthList = getMonths();
  const selectedMonthObj = monthList[currentMonthIndex];

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

  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs work';
  const healthSubLabel = healthScore >= 80
    ? 'You’re doing great! Keep saving.'
    : healthScore >= 60
      ? 'Good progress. Try to save more.'
      : 'Reduce expenses or increase income.';

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
    const labels = days.map(d => d.toLocaleDateString('en-US', { weekday: 'short' }));

    return { dPath, areaPath, labels, values, todaySpend, thisMonthExpense, pctChange, points };
  }, [selectedMonthObj, filteredTransactions, transactions, summary.expense]);

  // จัดกลุ่มรายจ่ายตามหมวดหมู่
  const expenseByCategory = useMemo(() => {
    const map = {};
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const catName = t.category?.name || 'Uncategorized';
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

  // --- PAGINATION Logic ---
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentTableData = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#04161c]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#04161c] text-slate-100">
      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-50">ภาพรวมการเงิน</h1>
          <p className="mt-1 text-sm font-semibold text-slate-400">ดูกราฟสรุปรายรับ-รายจ่ายแบบเข้าใจง่าย</p>
        </div>

        {/* Financial health score (like reference) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 to-green-500 p-5 text-slate-950 shadow-lg shadow-emerald-500/20">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-[42px] bg-white/20" aria-hidden="true" />
          <div className="absolute -right-2 -top-2 h-24 w-24 rounded-[32px] bg-white/15" aria-hidden="true" />

          <div className="relative z-10">
            <div className="text-[11px] font-extrabold tracking-wide text-slate-950/70">Financial Health Score</div>
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

        {/* Spending trend card (like reference) */}
        {spendingTrend && (
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#0b2730] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-300">Spending Today</div>
                <div className="mt-2 text-4xl font-extrabold text-slate-50">฿{formatCurrency(spendingTrend.todaySpend)}</div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-sm font-extrabold text-slate-300">This Month</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-50">฿{formatCurrency(spendingTrend.thisMonthExpense)}</div>
                {typeof spendingTrend.pctChange === 'number' && (
                  <div
                    className={[
                      'mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold',
                      spendingTrend.pctChange <= 0 ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/20' : 'bg-rose-500/15 text-rose-200 border border-rose-400/20'
                    ].join(' ')}
                  >
                    {spendingTrend.pctChange > 0 ? `+${spendingTrend.pctChange}%` : `${spendingTrend.pctChange}%`} vs last mo.
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

              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
                {spendingTrend.labels.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Month selector */}
        <div className="rounded-3xl border border-white/10 bg-[#0b2730] p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-200 hover:bg-white/10 disabled:opacity-40"
              disabled={currentMonthIndex === 0}
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className="text-[11px] font-semibold text-slate-400">เดือนที่เลือก</div>
              <div className="truncate text-sm font-extrabold text-slate-50">{selectedMonthObj.label}</div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentMonthIndex(prev => Math.min(monthList.length - 1, prev + 1))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-200 hover:bg-white/10 disabled:opacity-40"
              disabled={currentMonthIndex === monthList.length - 1}
              aria-label="เดือนถัดไป"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-200 shadow-sm">
            <div className="text-sm font-semibold">{error}</div>
          </div>
        )}

        {/* Summary (stack like reference) */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/10 bg-[#0b2730] p-4 shadow-sm">
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

          <div className="rounded-3xl border border-white/10 bg-[#0b2730] p-4 shadow-sm">
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

          <div className="rounded-3xl border border-white/10 bg-[#0b2730] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-400">คงเหลือสุทธิ</div>
                <div className={`mt-1 text-2xl font-extrabold ${balance >= 0 ? 'text-slate-50' : 'text-rose-200'}`}>฿{formatCurrency(balance)}</div>
              </div>
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${balance >= 0 ? 'bg-white/5 text-slate-100 ring-white/10' : 'bg-rose-500/15 text-rose-200 ring-rose-400/20'}`}>
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/10 bg-[#0b2730] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-50">กราฟรายรับ-รายจ่าย</div>
                <div className="text-xs font-semibold text-slate-400">แตะ/วางเมาส์บนแท่งเพื่อดูรายละเอียด</div>
              </div>
              <div className="inline-flex items-center rounded-full bg-white/5 p-1 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => setOverviewMode('daily')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-full transition ${overviewMode === 'daily' ? 'bg-white/10 text-slate-50' : 'text-slate-300 hover:text-slate-50'}`}
                >
                  รายวัน
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewMode('monthly')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-full transition ${overviewMode === 'monthly' ? 'bg-white/10 text-slate-50' : 'text-slate-300 hover:text-slate-50'}`}
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

          <div className="rounded-3xl border border-white/10 bg-[#0b2730] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-50">สัดส่วนรายจ่าย</div>
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
                    <div className="mt-1 text-xl font-extrabold text-slate-50">฿{formatCurrency(summary.expense)}</div>
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
                        <div className="truncate text-sm font-bold text-slate-50">{item.name}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-extrabold text-slate-300">
                          {pct}%
                        </span>
                        <div className="text-sm font-extrabold text-slate-50">฿{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-3xl border border-white/10 bg-[#0b2730] shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold text-slate-50">รายการล่าสุด</div>
            <span className="text-xs font-semibold bg-white/5 text-slate-300 px-2 py-1 rounded-lg ring-1 ring-white/10">
              {filteredTransactions.length} รายการ
            </span>
          </div>

          <div className="w-full md:w-auto">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px,minmax(0,1fr)]">
                <div className="relative min-w-0">
                  <select
                    value={filterType}
                    onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                    className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-white/5 pl-3 pr-10 text-sm font-extrabold text-slate-100 shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="income">รายรับ</option>
                    <option value="expense">รายจ่าย</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <div className="relative min-w-0">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    value={filterText}
                    onChange={e => { setFilterText(e.target.value); setCurrentPage(1); }}
                    className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm font-semibold text-slate-100 placeholder-slate-500 shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                    placeholder="ค้นหา: หมวด หรือ หมายเหตุ..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
          
          {/* Mobile list */}
          <div className="sm:hidden p-4 space-y-3">
            {currentTableData.length > 0 ? currentTableData.map((t) => {
              const cat = categories.find(c => c._id === t.category?._id || c._id === t.category);
              const isExpense = t.type === 'expense';
              const dateLabel = new Date(t.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <button
                  key={t._id}
                  type="button"
                  aria-label={`${isExpense ? 'รายจ่าย' : 'รายรับ'} ${cat?.name || 'ทั่วไป'} ${formatCurrency(t.amount)} บาท`}
                  className="group w-full rounded-3xl border border-white/10 bg-white/5 p-4 text-left shadow-sm transition active:scale-[0.99] hover:bg-white/10"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        'h-11 w-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0',
                        isExpense ? 'bg-gradient-to-br from-rose-500 to-rose-600' : 'bg-gradient-to-br from-emerald-500 to-green-500',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      <CategoryIcon iconName={cat?.icon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="truncate text-sm font-extrabold text-slate-50">{cat?.name || 'ทั่วไป'}</div>
                            <span
                              className={[
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold border',
                                isExpense ? 'bg-rose-500/15 text-rose-200 border-rose-400/20' : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
                              ].join(' ')}
                            >
                              {isExpense ? 'รายจ่าย' : 'รายรับ'}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-slate-400">{t.notes || '—'}</div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className={`text-sm font-extrabold ${isExpense ? 'text-rose-200' : 'text-emerald-200'}`}>
                            {isExpense ? '-' : '+'}฿{formatCurrency(t.amount)}
                          </div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-500">{dateLabel}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            }) : (
              <div className="py-10 text-center text-sm font-semibold text-slate-400">ไม่มีรายการในเดือนนี้</div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-[720px] w-full text-left">
              <thead className="bg-white/5 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">วันที่</th>
                  <th className="px-6 py-4">หมวดหมู่</th>
                  <th className="px-6 py-4">หมายเหตุ</th>
                  <th className="px-6 py-4 text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {currentTableData.length > 0 ? currentTableData.map((t) => {
                  const cat = categories.find(c => c._id === t.category?._id || c._id === t.category);
                  const isExpense = t.type === 'expense';
                  return (
                    <tr key={t._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-100">
                            {new Date(t.date).getDate()}
                          </span>
                          <span className="text-xs text-slate-500">
                            {MONTH_NAMES[new Date(t.date).getMonth()]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${isExpense ? 'bg-rose-500/15 text-rose-200 ring-rose-400/20' : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20'}`}>
                             {/* เรียกใช้ Icon Helper */}
                             <CategoryIcon iconName={cat?.icon} />
                          </div>
                          <span className="text-sm font-medium text-slate-100">{cat?.name || 'ทั่วไป'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-400">{t.notes || '-'}</span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${isExpense ? 'text-rose-200' : 'text-emerald-200'}`}>
                        {isExpense ? '-' : '+'}฿{formatCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      ไม่มีรายการในเดือนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="mb-10 p-3 sm:mb-8 sm:p-4 border-t border-white/10 flex items-center justify-between sm:justify-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50"
              >
                ก่อนหน้า
              </button>
              <span className="whitespace-nowrap px-2 sm:px-4 py-2 text-xs sm:text-sm text-slate-400 flex items-center justify-center">
                หน้า {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          )}
      </div>
      </div>
    </main>
  );
}
