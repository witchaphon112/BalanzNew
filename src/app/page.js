"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      window.location.href = '/dashboard';
    }
    setIsLoggedIn(!!token);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-white min-h-screen">

        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 md:py-20 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          <div className="md:col-span-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight text-[#191919] mb-4">
              ยินดีต้อนรับเข้าสู่{' '}
              <span className="text-[#4db8a8]">Balanz</span>
              <span className="text-[#191919]">.IA</span>
            </h1>
            
            <p className="text-[#191919] text-base md:text-lg mb-3">
              จัดการการเงินของคุณได้อย่างง่ายดายและมีประสิทธิภาพ
            </p>
            
            {!isLoggedIn && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4">
                {/* ปุ่มเริ่มต้นใช้งาน - Mobile Optimized */}
                <Link
                  href="/register"
                  className="group relative inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-white bg-gradient-to-r from-[#4db8a8] to-[#3d9888] hover:from-[#3d9888] hover:to-[#2d7868] shadow-lg hover:shadow-2xl active:scale-95 sm:transform sm:hover:-translate-y-0.5 transition-all duration-300 font-bold overflow-hidden text-base sm:text-lg w-full sm:w-auto"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    เริ่มต้นใช้งาน
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  {/* Shine effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                </Link>

                {/* ปุ่มเข้าสู่ระบบ - Mobile Optimized */}
                <Link
                  href="/login"
                  className="group relative inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[#4db8a8] border-2 border-[#4db8a8] bg-white hover:bg-[#4db8a8] hover:text-white shadow-md hover:shadow-xl active:scale-95 sm:transform sm:hover:-translate-y-0.5 transition-all duration-300 font-bold overflow-hidden text-base sm:text-lg w-full sm:w-auto"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    เข้าสู่ระบบ
                  </span>
                  {/* Background fill effect */}
                  <div className="absolute inset-0 bg-[#4db8a8] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </Link>
              </div>
            )}
          </div>

          {/* Hero Illustration - Hide on small mobile */}
          <div className="hidden sm:flex justify-center md:col-span-6 mt-8 md:mt-0">
            <img
              src="/Home.png"
              alt="Balanz.IA infographic"
              className="w-[300px] sm:w-[380px] md:w-[420px] lg:w-[520px] h-auto select-none drop-shadow-2xl animate-float"
              draggable="false"
            />
          </div>
        </div>

        {/* Feature Cards - Mobile Optimized */}
        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-12 md:pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Feature 1 */}
          <div className="bg-white border-2 border-gray-100 rounded-xl md:rounded-2xl p-6 md:p-8 text-center hover:border-[#4db8a8] hover:shadow-xl active:scale-95 sm:transform sm:hover:-translate-y-2 transition-all duration-300 group cursor-pointer">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-gradient-to-br from-[#4db8a8] to-[#3d9888] text-white flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <svg className="w-7 h-7 md:w-9 md:h-9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 7h12v2H6zM6 11h12v2H6zM6 15h12v2H6z"/>
              </svg>
            </div>
            <p className="text-gray-700 font-bold text-base md:text-lg mb-2 group-hover:text-[#4db8a8] transition-colors">ติดตามธุรกรรม</p>
            <p className="text-gray-500 text-sm">บันทึกรายรับรายจ่ายอย่างละเอียด</p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white border-2 border-gray-100 rounded-xl md:rounded-2xl p-6 md:p-8 text-center hover:border-[#4db8a8] hover:shadow-xl active:scale-95 sm:transform sm:hover:-translate-y-2 transition-all duration-300 group cursor-pointer">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-gradient-to-br from-[#4db8a8] to-[#3d9888] text-white flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <svg className="w-7 h-7 md:w-9 md:h-9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 19h16v2H4z"/>
                <path d="M6 10h3v7H6zM11 6h3v11h-3zM16 12h3v5h-3z"/>
              </svg>
            </div>
            <p className="text-gray-700 font-bold text-base md:text-lg mb-2 group-hover:text-[#4db8a8] transition-colors">วิเคราะห์การเงิน</p>
            <p className="text-gray-500 text-sm">ดูสถิติและแนวโน้มการใช้จ่าย</p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white border-2 border-gray-100 rounded-xl md:rounded-2xl p-6 md:p-8 text-center hover:border-[#4db8a8] hover:shadow-xl active:scale-95 sm:transform sm:hover:-translate-y-2 transition-all duration-300 group cursor-pointer sm:col-span-2 lg:col-span-1">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-gradient-to-br from-[#4db8a8] to-[#3d9888] text-white flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <svg className="w-7 h-7 md:w-9 md:h-9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22a2 2 0 002-2H10a2 2 0 002 2z"/>
                <path d="M18 16V11a6 6 0 10-12 0v5l-2 2h16l-2-2z"/>
              </svg>
            </div>
            <p className="text-gray-700 font-bold text-base md:text-lg mb-2 group-hover:text-[#4db8a8] transition-colors">การแจ้งเตือน</p>
            <p className="text-gray-500 text-sm">รับการแจ้งเตือนสำคัญทันที</p>
          </div>
        </div>
      </section>

      {/* CSS สำหรับ animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        /* ปิด animation บนโมบาย */
        @media (max-width: 640px) {
          .animate-float {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}