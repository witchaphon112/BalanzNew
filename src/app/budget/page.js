"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Budget() {
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(12);
  const [error, setError] = useState('');
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);


  const getMonths = () => {
    const months = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() + 543;
    const currentMonth = currentDate.getMonth();
    
    // สร้างรายการเดือน 12 เดือนย้อนหลัง + เดือนปัจจุบัน + 12 เดือนข้างหน้า
    for (let i = -12; i <= 12; i++) {
      const monthIndex = (currentMonth + i + 12) % 12; // ป้องกันลบเกิน
      const yearOffset = Math.floor((currentMonth + i) / 12);
      const year = currentYear + yearOffset;
      const monthNames = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
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
      fetchCategories(token);
      fetchBudgets(token);
      fetchTransactions(token);
    }
  }, [currentMonthIndex]);

  const fetchCategories = async (token) => {
    try {
      const res = await fetch('http://localhost:5000/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const expenseCategories = data.filter(cat => cat.type === 'expense');
        setCategories(expenseCategories);
      } else {
        setError(data.message || 'เกิดข้อผิดพลาดในการดึงหมวดหมู่');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
    }
  };

  const fetchBudgets = async (token) => {
    try {
      const res = await fetch('http://localhost:5000/api/budgets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const budgetMap = {};
        data.forEach(b => {
          if (!budgetMap[b.month]) budgetMap[b.month] = [];
          budgetMap[b.month].push({ ...b.category, total: b.total });
        });
        setBudgets(budgetMap);
      } else {
        setError(data.message || 'เกิดข้อผิดพลาดในการดึงงบประมาณ');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
    }
  };

  const fetchTransactions = async (token) => {
    try {
      const res = await fetch('http://localhost:5000/api/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.filter(t => t.type === 'expense'));
      } else {
        setError(data.message || 'เกิดข้อผิดพลาดในการดึงธุรกรรม');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
    }
  };


  const handleAddBudget = async (e) => {
    e.preventDefault();
    const form = e.target;
    const categoryId = form.category.value;
    const month = form.month.value;
    const total = parseFloat(form.total.value) || 0;

    if (total < 0) {
      setError('ยอดรวมต้องมากกว่าหรือเท่ากับ 0');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      await fetch('http://localhost:5000/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category: categoryId, month, total }),
      });
      setShowAddBudgetModal(false);
      fetchBudgets(token);
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการบันทึกงบประมาณ: ' + error.message);
    }
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-start justify-center pt-8 p-4" style={{ fontFamily: 'Noto Sans Thai, sans-serif' }}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-auto overflow-hidden flex flex-col h-[500px] border border-gray-200">
        {/* Header bar */}
        <div className="flex items-center justify-center px-6 py-5 bg-gradient-to-r from-[#299D91] to-[#238A80] text-white">
          <h2 className="text-xl font-bold">ตั้งเป้าหมายงบ</h2>
        </div>
        
        {/* Main content area - positioned at top */}
        <div className="flex-1 flex items-start justify-center px-6 py-6">
          <div className="w-full space-y-8">
            {/* Month Navigation */}
            <div className="text-center">
              <div className="flex items-center justify-center space-x-6 mb-2">
                <button
                  onClick={() => setCurrentMonthIndex((prev) => (prev > 0 ? prev - 1 : 0))}
                  className="p-2 text-gray-500 hover:text-[#299D91] transition-colors rounded-full hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
                  </svg>
                </button>
                <h2 className="text-2xl font-bold text-[#299D91]">{selectedMonth.split(' ')[0]}</h2>
                <button
                  onClick={() => setCurrentMonthIndex((prev) => (prev < months.length - 1 ? prev + 1 : months.length - 1))}
                  className="p-2 text-gray-500 hover:text-[#299D91] transition-colors rounded-full hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500">{selectedMonth}</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowAddBudgetModal(true)}
                className="w-full bg-gradient-to-r from-[#299D91] to-[#238A80] text-white py-4 rounded-xl hover:from-[#238A80] hover:to-[#1f6b63] transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>เพิ่มเป้าหมาย</span>
              </button>
              <Link
                href="/dashboard"
                className="w-full bg-white text-gray-700 py-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-center transition-all duration-300 font-semibold block flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>กลับ</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showAddBudgetModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm bg-black/40"
          onClick={() => setShowAddBudgetModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-md mx-auto shadow-2xl w-full transform transition-all duration-300 scale-95 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#299D91] to-[#238A80] shadow-xl shadow-[#299D91]/30 mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">เพิ่มเป้าหมาย</h3>
              <p className="text-gray-500 text-sm">ตั้งงบประมาณสำหรับหมวดหมู่ที่ต้องการ</p>
            </div>

            {/* Form */}
            <form onSubmit={handleAddBudget} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <svg className="w-4 h-4 text-[#299D91] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                  </svg>
                  หมวดหมู่
                </label>
                <div className="relative">
                  <select
                    name="category"
                    className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-white focus:border-[#299D91] focus:ring-4 focus:ring-[#299D91]/10 transition-all duration-200 text-gray-700 font-medium appearance-none cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <svg className="w-4 h-4 text-[#299D91] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                  </svg>
                  เดือน
                </label>
                <div className="relative">
                  <select
                    name="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      setCurrentMonthIndex(months.indexOf(e.target.value));
                    }}
                    className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-white focus:border-[#299D91] focus:ring-4 focus:ring-[#299D91]/10 transition-all duration-200 text-gray-700 font-medium appearance-none cursor-pointer"
                  >
                    {months.map((month, index) => (
                      <option key={index} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <svg className="w-4 h-4 text-[#299D91] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                  </svg>
                  ยอดรวม (บาท)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-medium">฿</span>
                  </div>
                  <input
                    type="number"
                    name="total"
                    step="1"
                    min="0"
                    className="w-full pl-8 pr-4 py-4 rounded-xl border-2 border-gray-200 bg-white focus:border-[#299D91] focus:ring-4 focus:ring-[#299D91]/10 transition-all duration-200 text-gray-700 font-medium"
                    placeholder="เช่น 5000"
                    required
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 mt-8">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#299D91] to-[#238A80] text-white py-4 rounded-xl hover:from-[#238A80] hover:to-[#1f6b63] transition-all duration-300 font-bold text-lg shadow-xl shadow-[#299D91]/30 hover:shadow-2xl hover:shadow-[#299D91]/40 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  บันทึกเป้าหมาย
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBudgetModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 transition-all duration-300 font-bold text-lg border-2 border-gray-200 hover:border-gray-300"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}