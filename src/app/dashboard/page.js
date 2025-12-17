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
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
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
      <Link
        href="/transactions/add"
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
      </Link>
    </main>
  );
}