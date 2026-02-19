"use client";
import { useMemo, useState, useEffect } from 'react';
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
  const baseColors = ['#2563eb', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#f97316', '#14b8a6', '#22c55e', '#64748b', '#0f172a'];
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
            backgroundColor: '#2563eb',
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
          backgroundColor: ['#2563eb', '#f43f5e'],
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
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: { maxTicksLimit: isMobile ? 4 : 6, callback: (v) => formatCurrency(v) }
          },
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 6 : 12 } }
        }
      : { y: { display: false, grid: { display: false } }, x: { grid: { display: false } } },
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900">ภาพรวมการเงิน</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">ดูกราฟสรุปรายรับ-รายจ่ายแบบเข้าใจง่าย</p>
        </div>

        {/* Month selector */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              disabled={currentMonthIndex === 0}
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className="text-[11px] font-semibold text-slate-500">เดือนที่เลือก</div>
              <div className="truncate text-sm font-extrabold text-slate-900">{selectedMonthObj.label}</div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentMonthIndex(prev => Math.min(monthList.length - 1, prev + 1))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              disabled={currentMonthIndex === monthList.length - 1}
              aria-label="เดือนถัดไป"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
            <div className="text-sm font-semibold">{error}</div>
          </div>
        )}

        {/* Summary (stack like reference) */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">รายรับ</div>
                <div className="mt-1 text-2xl font-extrabold text-blue-700">฿{formatCurrency(summary.income)}</div>
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">รายจ่าย</div>
                <div className="mt-1 text-2xl font-extrabold text-rose-600">฿{formatCurrency(summary.expense)}</div>
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <TrendingDown className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">คงเหลือสุทธิ</div>
                <div className={`mt-1 text-2xl font-extrabold ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>฿{formatCurrency(balance)}</div>
              </div>
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${balance >= 0 ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-600'}`}>
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-900">กราฟรายรับ-รายจ่าย</div>
                <div className="text-xs font-semibold text-slate-500">แตะ/วางเมาส์บนแท่งเพื่อดูรายละเอียด</div>
              </div>
              <div className="inline-flex items-center rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setOverviewMode('daily')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-full transition ${overviewMode === 'daily' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  รายวัน
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewMode('monthly')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-full transition ${overviewMode === 'monthly' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  รวมเดือน
                </button>
              </div>
            </div>

            <div className="mt-4 h-56">
              <Bar data={barData} options={barChartOptions} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />รายรับ</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />รายจ่าย</span>
            </div>

            {overviewMode === 'daily' && dailySeries.labels.length > dailySeriesDisplay.labels.length && (
              <div className="mt-2 text-[11px] font-semibold text-slate-500">
                แสดงเฉพาะ {dailySeriesDisplay.labels.length} วันล่าสุดเพื่อให้อ่านง่าย
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-900">สัดส่วนรายจ่าย</div>
                <div className="text-xs font-semibold text-slate-500">แยกตามหมวดหมู่</div>
              </div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Layers className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              {pieLabels.length === 0 ? (
                <div className="h-56 rounded-3xl border border-slate-200/60 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">
                  ไม่มีรายจ่ายในเดือนนี้
                </div>
              ) : (
                <div className="relative h-64">
                  <Doughnut data={pieData} options={pieChartOptions} />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[11px] font-semibold text-slate-500">รายจ่ายรวม</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-900">฿{formatCurrency(summary.expense)}</div>
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
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                        <div className="truncate text-sm font-bold text-slate-900">{item.name}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-extrabold text-slate-600">
                          {pct}%
                        </span>
                        <div className="text-sm font-extrabold text-slate-900">฿{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/60 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold text-slate-900">รายการล่าสุด</div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
              {filteredTransactions.length} รายการ
            </span>
          </div>

          <div className="w-full md:w-auto">
            <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px,minmax(0,1fr)]">
                <div className="relative min-w-0">
                  <select
                    value={filterType}
                    onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-10 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-700 placeholder-slate-400 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  className="group w-full rounded-3xl border border-slate-200/60 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        'h-11 w-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0',
                        isExpense ? 'bg-gradient-to-br from-rose-500 to-rose-600' : 'bg-gradient-to-br from-blue-600 to-blue-700',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      <CategoryIcon iconName={cat?.icon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="truncate text-sm font-extrabold text-slate-900">{cat?.name || 'ทั่วไป'}</div>
                            <span
                              className={[
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold border',
                                isExpense ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-blue-50 text-blue-700 border-blue-200/60',
                              ].join(' ')}
                            >
                              {isExpense ? 'รายจ่าย' : 'รายรับ'}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-slate-500">{t.notes || '—'}</div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className={`text-sm font-extrabold ${isExpense ? 'text-rose-600' : 'text-blue-700'}`}>
                            {isExpense ? '-' : '+'}฿{formatCurrency(t.amount)}
                          </div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-400">{dateLabel}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            }) : (
              <div className="py-10 text-center text-sm font-semibold text-slate-500">ไม่มีรายการในเดือนนี้</div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-[720px] w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">วันที่</th>
                  <th className="px-6 py-4">หมวดหมู่</th>
                  <th className="px-6 py-4">หมายเหตุ</th>
                  <th className="px-6 py-4 text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentTableData.length > 0 ? currentTableData.map((t) => {
                  const cat = categories.find(c => c._id === t.category?._id || c._id === t.category);
                  const isExpense = t.type === 'expense';
                  return (
                    <tr key={t._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">
                            {new Date(t.date).getDate()}
                          </span>
                          <span className="text-xs text-slate-400">
                            {MONTH_NAMES[new Date(t.date).getMonth()]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isExpense ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-700'}`}>
                             {/* เรียกใช้ Icon Helper */}
                             <CategoryIcon iconName={cat?.icon} />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{cat?.name || 'ทั่วไป'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">{t.notes || '-'}</span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${isExpense ? 'text-rose-600' : 'text-blue-700'}`}>
                        {isExpense ? '-' : '+'}฿{formatCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                      ไม่มีรายการในเดือนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="mb-10 p-3 sm:mb-8 sm:p-4 border-t border-slate-200/60 flex items-center justify-between sm:justify-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                ก่อนหน้า
              </button>
              <span className="whitespace-nowrap px-2 sm:px-4 py-2 text-xs sm:text-sm text-slate-500 flex items-center justify-center">
                หน้า {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
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
