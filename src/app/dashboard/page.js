"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

// Define the primary color constants (Teal theme - ใช้สีเดียวกับ Landing)
const PRIMARY_COLOR = '#4db8a8';
const PRIMARY_COLOR_DARK = '#3d9888';
const INCOME_COLOR = '#10b981'; // Emerald green
const EXPENSE_COLOR = '#ef4444'; // Red
const NET_SAVING_COLOR = '#f59e0b'; // Amber

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [categories, setCategories] = useState([]);

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

  useEffect(() => {
    const token = localStorage.getItem('token');

    const getThaiYear = (date) => date.getFullYear() + 543;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
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
        });
        setError('');
        
      } catch (error) {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (error.message || 'Error'));
        setStats({ totalIncome: 0, totalExpenses: 0, netSavings: 0, recentTransactions: [] });
      } finally {
        setLoading(false);
      }
    };

    if (!token) {
        window.location.href = '/login';
        return;
    }

    fetchStats();
    
    return () => {};
  }, [selectedMonth]);

  useEffect(() => {
    if (!showAddModal) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetchCategories(token);
  }, [showAddModal, formData.type]);

  const fetchCategories = async (token) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
      const res = await fetch(`${API_BASE}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        let updatedCategories = data || [];
        setCategories(updatedCategories);
        if (!formData.category) {
          const defaultCat = updatedCategories.find(cat => cat.type === formData.type) || updatedCategories[0];
          if (defaultCat) {
            setFormData(prev => ({ ...prev, category: defaultCat._id }));
          }
        }
      } else {
        setAddError(data.message || 'เกิดข้อผิดพลาดในการดึงหมวดหมู่');
        setCategories([]);
      }
    } catch (error) {
      setAddError('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
      setCategories([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setAddError('กรุณากรอกจำนวนเงินที่มากกว่า 0');
      setAddLoading(false);
      return;
    }
    if (!formData.category) {
      setAddError('กรุณาเลือกหมวดหมู่');
      setAddLoading(false);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (formData.date > today) {
      setAddError('วันที่ต้องไม่เกินวันปัจจุบัน');
      setAddLoading(false);
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
          ...formData,
          amount: parseFloat(formData.amount),
          date: formData.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
      }
      setShowAddModal(false);
      setFormData({ amount: '', type: 'expense', category: '', date: new Date().toISOString().split('T')[0], notes: '' });
      setAddError('');
      setAddLoading(false);
      // Refresh data
      window.location.reload();
    } catch (error) {
      setAddError('เกิดข้อผิดพลาด: ' + error.message);
      setAddLoading(false);
    }
  };

  const formatCurrentDate = () => {
    const d = new Date();
    const m = monthNames[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear() + 543;
    return `${m} ${day}, ${year}`;
  };

  /* --- JSX Rendering --- */

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 md:py-12">
        
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {formatCurrentDate()}
          </p>
        </div>

        {/* Month Navigation Panel */}
        <div className="mb-8 bg-gradient-to-br from-[#4db8a8] to-[#3d9888] rounded-xl shadow-lg p-5">
          <p className="text-xs text-white/80 mb-3 uppercase tracking-wide font-semibold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            ช่วงเดือน
          </p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentMonthIndex((prev) => (prev > 0 ? prev - 1 : 0))}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
              disabled={currentMonthIndex === 0}
              aria-label="เดือนก่อนหน้า"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            
            <div className="text-center">
              <span className="text-xl md:text-2xl font-bold text-white">
                {selectedMonth}
              </span>
            </div>
            
            <button
              onClick={() => setCurrentMonthIndex((prev) => (prev < months.length - 1 ? prev + 1 : months.length - 1))}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
              disabled={currentMonthIndex === months.length - 1}
              aria-label="เดือนถัดไป"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <p className="text-red-700 font-medium text-sm">{error}</p>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          
          {/* Income Card */}
          <div className="bg-white rounded-xl border-2 border-gray-100 p-6 hover:border-emerald-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                   {/* Trending Up Icon */}
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                   </svg>
               </div>
               <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Income</p>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-2">รายรับรวม</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-bold text-emerald-600">
                {loading ? '---' : stats.totalIncome.toLocaleString()}
              </span>
              <span className="text-lg font-bold text-gray-400">฿</span>
            </div>
          </div>

          {/* Expense Card */}
          <div className="bg-white rounded-xl border-2 border-gray-100 p-6 hover:border-red-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                   {/* Trending Down Icon */}
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                   </svg>
               </div>
               <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Expense</p>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-2">รายจ่ายรวม</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-bold text-red-600">
                {loading ? '---' : stats.totalExpenses.toLocaleString()}
              </span>
              <span className="text-lg font-bold text-gray-400">฿</span>
            </div>
          </div>

          {/* Net Balance Card */}
          <div className="bg-white rounded-xl border-2 border-gray-100 p-6 hover:border-amber-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                   {/* Wallet Icon */}
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                   </svg>
               </div>
               <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Balance</p>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-2">ยอดคงเหลือสุทธิ</p>
            <div className="flex items-baseline gap-2">
              <span 
                className={`text-3xl md:text-4xl font-bold`}
                style={{ color: stats.netSavings >= 0 ? INCOME_COLOR : EXPENSE_COLOR }}
               >
                {loading ? '---' : Math.abs(stats.netSavings).toLocaleString()}
              </span>
              <span className="text-lg font-bold text-gray-400">฿</span>
            </div>
          </div>

        </div>

        {/* Recent Transactions Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-8 bg-[#4db8a8] rounded-full"></div>
            <h2 className="text-xl md:text-2xl font-bold text-[#191919] flex items-center gap-2">
              <svg className="w-6 h-6 text-[#4db8a8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              ธุรกรรมล่าสุด
            </h2>
          </div>
          
          <div className="bg-white rounded-xl border-2 border-gray-100 p-5 md:p-6">
            
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-[#4db8a8] rounded-full animate-spin"></div>
                <p className="text-gray-500 mt-3 text-sm">กำลังโหลด...</p>
              </div>
            ) : stats.recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p className="text-gray-500 text-sm font-medium">ไม่มีธุรกรรมในเดือนนี้</p>
                <p className="text-gray-400 text-xs mt-1">เริ่มต้นเพิ่มรายการแรกของคุณ</p>
              </div>
            ) : (
              <div className="space-y-1">
                {stats.recentTransactions.map((txn, index) => (
                  <div 
                    key={txn._id} 
                    className={`flex items-center justify-between py-4 px-3 hover:bg-gray-50 rounded-lg transition-colors ${
                      index !== stats.recentTransactions.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    {/* Left: Icon + Details */}
                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                      {/* Icon Container */}
                      <div 
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-md"
                        style={{ 
                          background: txn.type === 'income' 
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        }}
                      >
                        {txn.type === 'income' ? 
                            // Money Receive Icon
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
                            </svg> :
                            // Money Send Icon
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"/>
                            </svg>
                        }
                      </div>
                      
                      {/* Transaction Info */}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#191919] text-sm md:text-base truncate">
                          {txn.category?.name || 'หมวดหมู่ไม่ระบุ'}
                        </p>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                          {new Date(txn.date).toLocaleDateString('th-TH', { 
                            day: 'numeric',
                            month: 'short',
                          })}
                          {txn.description && (
                            <>
                              {' • '}
                              <span className="hidden sm:inline">{txn.description}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount */}
                    <div 
                      className="text-base md:text-lg font-bold flex-shrink-0 ml-3 md:ml-4"
                      style={{ color: txn.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }}
                    >
                      {txn.type === 'expense' ? '-' : '+'}{txn.amount.toLocaleString()} ฿
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* View All Link */}
            {stats.recentTransactions.length > 0 && (
              <div className="pt-4 mt-4 border-t border-gray-100 text-center">
                <Link 
                  href="/transactions" 
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#4db8a8] hover:text-[#3d9888] transition-colors group"
                >
                    ดูธุรกรรมทั้งหมด
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                    </svg>
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
      
      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        className="fixed right-6 md:right-8 bottom-6 md:bottom-8 w-14 h-14 md:w-16 md:h-16 rounded-2xl shadow-2xl text-white flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-50 group"
        style={{ 
          background: 'linear-gradient(135deg, #4db8a8 0%, #3d9888 100%)',
          boxShadow: `0 10px 25px rgba(77, 184, 168, 0.4)` 
        }}
        aria-label="เพิ่มรายการ"
      >
        <svg className="w-7 h-7 md:w-8 md:h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
      </button>

      {/* Modal for Add Transaction */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)',
          backdropFilter: 'blur(8px)'
        }} onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden transform animate-slideUp" onClick={(e) => e.stopPropagation()}>
            {/* Header with Gradient */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#4db8a8] via-[#3d9888] to-[#2d7868]"></div>
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-20 translate-x-20"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-16 -translate-x-16"></div>
              </div>
              <div className="relative px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">บันทึกรายการ</h2>
                    <p className="text-xs text-white/80">เพิ่มรายรับ-รายจ่ายของคุณ</p>
                  </div>
                </div>
                <button
                  className="text-white/90 hover:bg-white/20 rounded-xl p-2 transition-all hover:rotate-90 duration-300"
                  onClick={() => setShowAddModal(false)}
                  aria-label="ปิด"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Form Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {addError && (
                <div className="bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 p-4 rounded-r-xl mb-5 flex items-start gap-3 shadow-sm animate-shake">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-800 flex-1">{addError}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Amount Input with Icon */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                      </svg>
                    </div>
                    จำนวนเงิน (บาท)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value < 0 ? 0 : e.target.value })}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4db8a8] focus:border-transparent text-gray-800 text-lg font-semibold transition-all shadow-sm hover:shadow-md group-hover:border-[#4db8a8]"
                      placeholder="0.00"
                      required
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">฿</div>
                  </div>
                </div>
                
                {/* Type Toggle with Icons */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                      </svg>
                    </div>
                    ประเภทรายการ
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, type: 'income' })} 
                      className={`relative overflow-hidden px-5 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 ${
                        formData.type==='income' 
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/50' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
                        </svg>
                        รายรับ
                      </div>
                      {formData.type==='income' && (
                        <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, type: 'expense' })} 
                      className={`relative overflow-hidden px-5 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 ${
                        formData.type==='expense' 
                          ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/50' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6"/>
                        </svg>
                        รายจ่าย
                      </div>
                      {formData.type==='expense' && (
                        <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Category Select */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                      </svg>
                    </div>
                    หมวดหมู่
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4db8a8] focus:border-transparent text-gray-700 text-base font-medium transition-all shadow-sm hover:shadow-md group-hover:border-[#4db8a8] bg-white"
                    required
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {categories.filter(cat => cat.type === formData.type).map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Date Input */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    วันที่ทำรายการ
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4db8a8] focus:border-transparent text-gray-700 text-base font-medium transition-all shadow-sm hover:shadow-md group-hover:border-[#4db8a8]"
                    required
                  />
                </div>
                
                {/* Notes Textarea */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </div>
                    หมายเหตุ <span className="text-gray-400 font-normal">(ถ้ามี)</span>
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4db8a8] focus:border-transparent text-gray-700 text-base resize-none transition-all shadow-sm hover:shadow-md group-hover:border-[#4db8a8]"
                    placeholder="เช่น ซื้ออาหารที่ร้าน ศศิ"
                    rows="3"
                  />
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-[#4db8a8] to-[#3d9888] text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {addLoading ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        บันทึกรายการ
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl text-base border-2 border-gray-200 font-bold hover:bg-gray-200 hover:border-gray-300 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .animate-shake {
          animation: shake 0.3s ease-out;
        }
      `}</style>
    </main>
  );
}