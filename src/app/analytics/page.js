"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// กำหนด monthNames ไว้ด้านบน
const monthNames = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function Analytics() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(60); // เริ่มที่เดือนปัจจุบัน (60 เดือนย้อนหลัง)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3; // ลดจำนวนรายการต่อหน้า

  // คำนวณเดือนย้อนหลัง 5 ปี (60 เดือน) และอนาคต 12 เดือน
  const getMonths = () => {
    const months = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() + 543; // แปลงเป็น พ.ศ.
    const currentMonth = currentDate.getMonth();
    const totalMonths = 72; // 60 เดือนย้อนหลัง + 12 เดือนข้างหน้า
    for (let i = -60; i < 60; i++) {
      const monthIndex = (currentMonth + i + 12) % 12;
      const yearOffset = Math.floor((currentMonth + i) / 12);
      const year = currentYear + yearOffset;
      months.push(`${monthNames[monthIndex]} ${year}`);
    }
    return months;
  };

  const months = getMonths();
  const selectedMonth = months[currentMonthIndex];

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
    } else {
      setIsLoggedIn(true);
      Promise.all([fetchTransactions(token), fetchCategories(token)]).catch((err) => {
        setError('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + err.message);
        setLoading(false);
      });
    }
  }, [currentMonthIndex]);

  const fetchTransactions = async (token) => {
    try {
      const res = await fetch('http://localhost:5000/api/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTransactions(data);
      } else {
        setError(data.message || 'เกิดข้อผิดพลาดในการดึงธุรกรรม');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const fetchCategories = async (token) => {
    try {
      const res = await fetch('http://localhost:5000/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCategories(data);
      } else {
        setError(data.message || 'เกิดข้อผิดพลาดในการดึงหมวดหมู่');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions
    .filter((t) => {
      const transactionDate = new Date(t.date);
      const tMonthYear = `${monthNames[transactionDate.getMonth()]} ${transactionDate.getFullYear() + 543}`;
      return tMonthYear === selectedMonth;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // เรียงล่าสุดมาก่อน

  const incomeByCategory = categories.reduce((acc, cat) => {
    acc[cat.name] = filteredTransactions
      .filter((t) => t.type === 'income' && t.category?.name === cat.name)
      .reduce((sum, t) => sum + t.amount, 0);
    return acc;
  }, {});
  const expenseByCategory = categories
    .filter((cat) => cat.type === 'expense') // กรองเฉพาะหมวดหมู่ประเภท expense
    .reduce((acc, cat) => {
      acc[cat.name] = filteredTransactions
        .filter((t) => t.type === 'expense' && t.category?.name === cat.name)
        .reduce((sum, t) => sum + t.amount, 0);
      return acc;
    }, {});

  const summary = filteredTransactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.totalIncome += t.amount;
      else acc.totalExpense += t.amount;
      return acc;
    },
    { totalIncome: 0, totalExpense: 0 }
  );
  summary.balance = summary.totalIncome - summary.totalExpense;

  // Pie Chart Data
  const pieData = {
    labels: categories
      .filter((cat) => cat.type === 'expense' && expenseByCategory[cat.name] > 0)
      .map((cat) => cat.name),
    datasets: [
      {
        data: categories
          .filter((cat) => cat.type === 'expense' && expenseByCategory[cat.name] > 0)
          .map((cat) => expenseByCategory[cat.name]),
        backgroundColor: [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
          '#DDA0DD', '#98D8C8', '#F7DC6F'
        ],
        borderColor: '#ffffff',
        borderWidth: 4,
        hoverBorderWidth: 6,
      },
    ],
  };

  // Bar Chart Data (ปรับให้แสดงเฉพาะเดือนที่เลือก)
  const barData = {
    labels: [selectedMonth],
    datasets: [
      {
        label: 'รายรับ',
        data: [filteredTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)],
        backgroundColor: 'rgba(76, 175, 80, 0.8)',
        borderColor: '#4CAF50',
        borderWidth: 3,
        borderRadius: 12,
        borderSkipped: false,
      },
      {
        label: 'รายจ่าย',
        data: [filteredTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)],
        backgroundColor: 'rgba(244, 67, 54, 0.8)',
        borderColor: '#F44336',
        borderWidth: 3,
        borderRadius: 12,
        borderSkipped: false,
      },
    ],
  };

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const prevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  if (!isLoggedIn) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex-1 w-full relative overflow-hidden" style={{ fontFamily: 'Noto Sans Thai, sans-serif' }}>
      {/* Colorful animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-pink-300/20 to-purple-300/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-blue-300/20 to-cyan-300/20 rounded-full blur-3xl animate-pulse delay-300"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-yellow-300/10 to-orange-300/10 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Floating geometric shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-4 h-4 bg-pink-400 rounded-full animate-bounce delay-100"></div>
        <div className="absolute top-40 right-32 w-6 h-6 bg-blue-400 rounded-full animate-bounce delay-300"></div>
        <div className="absolute bottom-32 left-40 w-3 h-3 bg-green-400 rounded-full animate-bounce delay-500"></div>
        <div className="absolute bottom-20 right-20 w-5 h-5 bg-purple-400 rounded-full animate-bounce delay-700"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 relative z-10">
        {/* Header with new style */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-purple-500 rounded-3xl blur-lg opacity-30 group-hover:opacity-40 transition-opacity duration-300"></div>
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500 shadow-2xl group-hover:shadow-3xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-1">
                สรุปและวิเคราะห์
              </h1>
              <p className="text-base text-gray-600 font-medium">ข้อมูลทางการเงินของคุณในรูปแบบที่เข้าใจง่าย</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-100 to-pink-100 border-l-4 border-red-400 p-4 rounded-2xl flex items-start space-x-3 shadow-lg mb-6">
            <div className="p-2 bg-red-200 rounded-xl">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/50">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-200 border-t-purple-500"></div>
                  <div className="absolute inset-0 animate-ping rounded-full h-10 w-10 bg-purple-400/20"></div>
                </div>
                <span className="text-gray-700 text-lg font-semibold">กำลังโหลดข้อมูล...</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Month Navigation with new style */}
            <div className="bg-gradient-to-r from-white/90 to-purple-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setCurrentMonthIndex((prev) => (prev > 0 ? prev - 1 : 0))}
                  className="group p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl hover:from-purple-200 hover:to-pink-200 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:-rotate-2 border border-purple-200"
                >
                  <svg className="w-5 h-5 text-purple-600 group-hover:text-purple-700 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </button>

                <div className="text-center">
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-1">{selectedMonth}</h2>
                  <p className="text-sm text-gray-600 font-medium">เลือกเดือนเพื่อดูข้อมูล</p>
                </div>

                <button
                  onClick={() => setCurrentMonthIndex((prev) => prev < months.length - 1 ? prev + 1 : months.length - 1)}
                  className="group p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl hover:from-purple-200 hover:to-pink-200 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:rotate-2 border border-purple-200"
                >
                  <svg className="w-5 h-5 text-purple-600 group-hover:text-purple-700 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats Cards with colorful gradients */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="group bg-gradient-to-br from-white/90 to-green-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5 hover:shadow-3xl transition-all duration-500 transform hover:scale-105 hover:-rotate-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">รายรับรวม</h3>
                    <p className="text-3xl font-black text-green-600 mb-1">{summary.totalIncome.toLocaleString()}</p>
                    <p className="text-gray-500 font-medium text-sm">บาท</p>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-200 rounded-2xl blur-lg group-hover:bg-green-300 transition-all duration-300"></div>
                    <div className="relative p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl shadow-xl group-hover:rotate-6 transition-transform duration-300">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="group bg-gradient-to-br from-white/90 to-red-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5 hover:shadow-3xl transition-all duration-500 transform hover:scale-105 hover:rotate-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">รายจ่ายรวม</h3>
                    <p className="text-3xl font-black text-red-600 mb-1">{summary.totalExpense.toLocaleString()}</p>
                    <p className="text-gray-500 font-medium text-sm">บาท</p>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-200 rounded-2xl blur-lg group-hover:bg-red-300 transition-all duration-300"></div>
                    <div className="relative p-3 bg-gradient-to-br from-red-400 to-pink-500 rounded-2xl shadow-xl group-hover:-rotate-6 transition-transform duration-300">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="group bg-gradient-to-br from-white/90 to-blue-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5 hover:shadow-3xl transition-all duration-500 transform hover:scale-105 hover:-rotate-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">ยอดคงเหลือ</h3>
                    <p className={`text-3xl font-black mb-1 ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.balance.toLocaleString()}
                    </p>
                    <p className="text-gray-500 font-medium text-sm">บาท</p>
                  </div>
                  <div className="relative">
                    <div className={`absolute inset-0 rounded-2xl blur-lg group-hover:opacity-30 transition-all duration-300 ${summary.balance >= 0 ? 'bg-green-200' : 'bg-red-200'}`}></div>
                    <div className={`relative p-3 rounded-2xl shadow-xl group-hover:rotate-6 transition-transform duration-300 ${summary.balance >= 0 ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-red-400 to-pink-500'}`}>
                      <svg className={`w-6 h-6 text-white`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section with new colorful style */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <div className="bg-gradient-to-br from-white/90 to-purple-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-200 rounded-2xl blur-lg"></div>
                    <div className="relative p-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">การกระจายรายจ่าย</h3>
                </div>
                <div className="max-w-xs mx-auto">
                  <Pie 
                    data={pieData} 
                    options={{ 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { 
                        legend: { 
                          position: 'bottom',
                          labels: {
                            color: '#374151',
                            font: {
                              size: 12,
                              weight: 'bold'
                            }
                          }
                        } 
                      } 
                    }} 
                  />
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-gradient-to-br from-white/90 to-blue-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-200 rounded-2xl blur-lg"></div>
                    <div className="relative p-2 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">รายรับ-รายจ่าย</h3>
                </div>
                <div className="max-w-sm mx-auto">
                  <Bar 
                    data={barData} 
                    options={{ 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { 
                        legend: { 
                          position: 'top',
                          labels: {
                            color: '#374151',
                            font: {
                              size: 12,
                              weight: 'bold'
                            }
                          }
                        } 
                      },
                      scales: {
                        y: {
                          ticks: {
                            color: '#6B7280',
                            font: { size: 11 }
                          },
                          grid: {
                            color: '#E5E7EB'
                          }
                        },
                        x: {
                          ticks: {
                            color: '#6B7280',
                            font: { size: 11 }
                          },
                          grid: {
                            color: '#E5E7EB'
                          }
                        }
                      }
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Category Summary with colorful cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Income Categories */}
              <div className="bg-gradient-to-br from-white/90 to-green-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-200 rounded-2xl blur-lg"></div>
                    <div className="relative p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">รายรับตามหมวดหมู่</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    incomeByCategory[cat.name] > 0 && (
                      <div key={cat._id} className="group bg-gradient-to-br from-green-100 to-emerald-100 p-3 rounded-2xl text-center border border-green-200 hover:shadow-xl transition-all duration-300 transform hover:scale-110 hover:-rotate-1">
                        <div className="text-2xl mb-2 group-hover:scale-125 transition-transform duration-300">{cat.icon}</div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-1">{cat.name}</h4>
                        <p className="text-sm font-bold text-green-600">{incomeByCategory[cat.name].toLocaleString()} บาท</p>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Expense Categories */}
              <div className="bg-gradient-to-br from-white/90 to-red-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-200 rounded-2xl blur-lg"></div>
                    <div className="relative p-2 bg-gradient-to-br from-red-400 to-pink-500 rounded-2xl">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-pink-600">รายจ่ายตามหมวดหมู่</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {categories
                    .filter((cat) => cat.type === 'expense')
                    .map((cat) => (
                      expenseByCategory[cat.name] > 0 && (
                        <div key={cat._id} className="group bg-gradient-to-br from-red-100 to-pink-100 p-3 rounded-2xl text-center border border-red-200 hover:shadow-xl transition-all duration-300 transform hover:scale-110 hover:rotate-1">
                          <div className="text-2xl mb-2 group-hover:scale-125 transition-transform duration-300">{cat.icon}</div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">{cat.name}</h4>
                          <p className="text-sm font-bold text-red-600">{expenseByCategory[cat.name].toLocaleString()} บาท</p>
                        </div>
                      )
                    ))}
                </div>
              </div>
            </div>

            {/* Transactions Table with colorful style */}
            <div className="bg-gradient-to-br from-white/90 to-indigo-50/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-5">
              <div className="flex items-center space-x-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-200 rounded-2xl blur-lg"></div>
                  <div className="relative p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">ประวัติธุรกรรม</h3>
              </div>
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gray-200 rounded-3xl blur-lg"></div>
                    <div className="relative p-4 bg-white rounded-3xl border border-gray-200">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-600 font-semibold">ไม่มีธุรกรรมในช่วงเวลานี้</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="border-b-2 border-indigo-200">
                          <th className="py-2 px-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">จำนวนเงิน</th>
                          <th className="py-2 px-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">ประเภท</th>
                          <th className="py-2 px-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">หมวดหมู่</th>
                          <th className="py-2 px-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">วันที่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTransactions.map((t) => {
                          const category = categories.find((cat) => cat._id.toString() === t.category?.toString());
                          return (
                            <tr key={t._id} className="border-b border-indigo-100 hover:bg-indigo-50/50 transition-all duration-300">
                              <td className="py-2 px-3 font-bold text-gray-900">{t.amount.toLocaleString()}</td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                                  t.type === 'income' 
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' 
                                    : 'bg-gradient-to-r from-red-400 to-pink-500 text-white'
                                }`}>
                                  {t.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-gray-600 font-medium text-sm">{t.category?.name || 'ไม่มี'}</td>
                              <td className="py-2 px-3 text-gray-600 font-medium text-sm">{new Date(t.date).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination Controls with colorful style */}
                  <div className="mt-4 flex justify-center items-center space-x-2">
                    <button
                      onClick={prevPage}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-gray-700 rounded-xl hover:from-purple-200 hover:to-pink-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-sm border border-purple-200"
                    >
                      ย้อนกลับ
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => paginate(page)}
                        className={`px-4 py-2 rounded-xl transition-all duration-300 font-bold text-sm ${
                          currentPage === page 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-xl transform scale-110' 
                            : 'bg-gradient-to-r from-purple-100 to-pink-100 text-gray-700 hover:from-purple-200 hover:to-pink-200 border border-purple-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-gray-700 rounded-xl hover:from-purple-200 hover:to-pink-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-sm border border-purple-200"
                    >
                      ถัดไป
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Back Button with new colorful style */}
        <div className="mt-6 text-center">
          <Link 
            href="/dashboard" 
            className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-100 to-pink-100 text-gray-700 rounded-2xl hover:from-purple-200 hover:to-pink-200 transition-all duration-300 font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 border border-purple-200"
          >
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับไปที่ Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}