"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './globals.css';

// --- Constants & Config ---
const SIDEBAR_WIDTH_FULL = 'w-[280px]';
const SIDEBAR_WIDTH_COLLAPSED = 'w-[88px]';

// --- Improved Icons (Clean Stroke) ---
const IconHome = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const IconAddTransaction = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
const IconBudget = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>;
const IconExchange = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m-5 3H4m0 0l4 4m-4-4l4-4" /></svg>;
const IconAnalytics = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const IconNotifications = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const IconProfile = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const IconLogout = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const IconMenu = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const IconClose = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const IconChevronRight = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;
const IconSidebarToggleExpand = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>; 
const IconSidebarToggleCollapse = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" /></svg>;

// --- Root Layout Component ---
export default function RootLayout({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [notificationCount, setNotificationCount] = useState(0); 
  const [avatarUrl, setAvatarUrl] = useState(''); 
  const [displayName, setDisplayName] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const pathname = usePathname();

  const isLanding = ['/', '/register', '/login', '/change-password', '/forgot-password', '/reset-password'].includes(pathname);
    
  // --- Effects ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
    
    setDisplayName(localStorage.getItem('name') || localStorage.getItem('displayName') || 'User');
    setAvatarUrl(localStorage.getItem('avatarUrl') || '');
    
    // Set current date on client side only
    setCurrentDate(new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

    if (token) {
      setNotificationCount(3); // Mock data
    }
  }, []);

  // --- Handlers ---
  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    window.location.href = '/'; 
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);
  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed); 
  const isActive = (path) => pathname === path;
  const resetNotifications = () => setNotificationCount(0);

  // --- NavLink Components ---
  const NavLink = ({ href, icon, children, badge, onClick = () => {} }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={() => onClick()}
        title={isSidebarCollapsed ? children : ''}
        className={`group relative flex items-center py-3 px-3 mx-3 rounded-xl transition-all duration-300 ease-in-out
          ${active 
            ? 'bg-teal-50 text-teal-700 shadow-sm' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }
          ${isSidebarCollapsed ? 'justify-center mx-2 px-2' : ''}
        `}
      >
        {/* Active Indicator Bar */}
        {active && !isSidebarCollapsed && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-500 rounded-r-full shadow-[0_0_10px_rgba(20,184,166,0.5)]"></div>
        )}

        <div className={`relative flex items-center justify-center transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
          {icon}
          {badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[10px] font-bold items-center justify-center border border-white">
                {badge > 9 ? '9+' : badge}
              </span>
            </span>
          )}
        </div>

        <span className={`ml-3 font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${
          isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}>
          {children}
        </span>
      </Link>
    );
  };

  const MobileNavLink = ({ href, icon, children, onClick = () => {} }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={() => { onClick(); closeMenu(); }}
        className={`flex items-center space-x-4 p-4 rounded-2xl transition-all duration-200 border border-transparent ${
          active
            ? 'bg-teal-50 border-teal-100 text-teal-700 shadow-sm'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <div className={`${active ? 'text-teal-600' : 'text-slate-400'}`}>{icon}</div>
        <span className="font-semibold text-base">{children}</span>
      </Link>
    );
  };

  // --- Render ---
  return (
   <html lang="th" suppressHydrationWarning>
      <body className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-teal-100 selection:text-teal-900 overflow-x-hidden">
        
        {/* Background Pattern */}
        <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.4]" 
             style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        </div>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-800">Balanz<span className="text-teal-500">.IA</span></span>
            </Link>
            {isLoggedIn && !isLanding && (
              <button onClick={toggleMenu} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                {isMenuOpen ? <IconClose /> : <IconMenu />}
              </button>
            )}
          </div>
        </header>

        <div className="relative flex min-h-screen z-10">
          
          {/* Desktop Sidebar */}
          {isLoggedIn && !isLanding && (
            <aside 
              className={`hidden md:flex fixed h-screen top-0 left-0 flex-col bg-white border-r border-slate-200/60 shadow-xl shadow-slate-200/40 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] z-40
                ${isSidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_FULL}`}
            >
              {/* Logo Area */}
              <div className={`h-20 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-6'}`}>
                <Link href="/dashboard" className="flex items-center gap-3 group overflow-hidden">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-teal-500/30 transition-transform duration-300 group-hover:scale-110`}>
                    B
                  </div>
                  <span className={`font-bold text-xl tracking-tight text-slate-800 transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    Balanz<span className="text-teal-500 font-light">.IA</span>
                  </span>
                </Link>
              </div>

              {/* Navigation */}
              <nav className="flex-1 py-6 space-y-1 overflow-y-auto no-scrollbar">
                  <div className={`px-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider ${isSidebarCollapsed ? 'text-center' : ''}`}>
                    {isSidebarCollapsed ? '•' : 'Menu'}
                  </div>
                  <NavLink href="/dashboard" icon={<IconHome />}>หน้าหลัก</NavLink>
                  <NavLink href="/transactions/add" icon={<IconAddTransaction />}>เพิ่มรายการ</NavLink> 

                  <NavLink href="/analytics" icon={<IconAnalytics />}>สรุปผล</NavLink>
              </nav>

              {/* User Profile & Logout */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm">
                 <Link href="/profile" className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-300 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                    <div className="relative">
                       <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                         {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-teal-100 text-teal-600 font-bold">{displayName?.charAt(0)}</div>}
                       </div>
                       <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div className={`flex-1 min-w-0 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden opacity-0' : 'block opacity-100'}`}>
                       <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                       <p className="text-xs text-slate-500 truncate">Free Plan</p>
                    </div>
                    {!isSidebarCollapsed && <IconChevronRight className="text-slate-400" />}
                 </Link>
                 
                 <button onClick={handleLogout} className={`mt-2 flex items-center gap-3 w-full p-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center' : ''}`} title="ออกจากระบบ">
                    <IconLogout />
                    <span className={`${isSidebarCollapsed ? 'hidden' : 'block'} text-sm font-medium`}>ออกจากระบบ</span>
                 </button>
              </div>
            </aside>
          )}

          {/* Main Content Wrapper */}
          <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isLoggedIn && !isLanding ? (isSidebarCollapsed ? 'md:ml-[88px]' : 'md:ml-[280px]') : ''}`}>
            
            {/* Desktop Topbar */}
            {isLoggedIn && !isLanding && (
              <header className="hidden md:flex sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 h-20 px-8 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={toggleSidebar} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all duration-200">
                     {isSidebarCollapsed ? <IconSidebarToggleExpand /> : <IconSidebarToggleCollapse />}
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">สวัสดี, คุณ{displayName} </h1>
                    <p className="text-xs text-slate-500">
                      {currentDate || 'Loading...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                   {/* Add Transaction Shortcut */}
                   <Link href="/transactions/add" className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                      เพิ่มรายการ
                   </Link>

                   {/* Notification Bell */}
                   <Link href="/notifications" onClick={resetNotifications} className="relative p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-teal-600 hover:border-teal-200 hover:shadow-md transition-all duration-300">
                     <IconNotifications />
                     {notificationCount > 0 && (
                       <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                     )}
                   </Link>
                </div>
              </header>
            )}

            {/* Mobile Menu Overlay */}
            <div className={`md:hidden fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={closeMenu} />
            <nav className={`md:hidden fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white z-[70] shadow-2xl p-6 transform transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white font-bold">B</div>
                  <div className="flex flex-col">
                    <span className="font-bold text-lg text-slate-900">เมนูหลัก</span>
                    <span className="text-xs text-slate-400">Balanz.IA Mobile</span>
                  </div>
                </div>
                <button onClick={toggleMenu} className="p-2 rounded-full bg-slate-100 text-slate-500"><IconClose /></button>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-180px)]">
                 <MobileNavLink href="/dashboard" icon={<IconHome />}>หน้าหลัก</MobileNavLink>
                 <MobileNavLink href="/transactions/add" icon={<IconAddTransaction />}>เพิ่มรายการ</MobileNavLink>
                 <MobileNavLink href="/budget" icon={<IconBudget />}>งบประมาณ</MobileNavLink>
                 <MobileNavLink href="/analytics" icon={<IconAnalytics />}>สรุปผล</MobileNavLink>
                 <MobileNavLink href="/profile" icon={<IconProfile />}>โปรไฟล์</MobileNavLink>
              </div>
              <div className="absolute bottom-8 left-6 right-6">
                <button onClick={() => { handleLogout(); closeMenu(); }} className="w-full py-3 rounded-xl bg-rose-50 text-rose-600 font-semibold flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors">
                  <IconLogout /> ออกจากระบบ
                </button>
              </div>
            </nav>

            {/* Main Content Area */}
            <main className={`flex-1 ${!isLanding && 'max-w-7xl mx-auto w-full'}`}>
               {children}
            </main>

            {/* Footer */}
            <footer className="mt-auto border-t border-slate-200 bg-white/50 backdrop-blur-sm">
               <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
                  <p>© {currentDate ? new Date().getFullYear() : '2025'} Balanz.IA - Smart Financial Management</p>
                  <div className="flex gap-6">
                    <Link href="#" className="hover:text-teal-600 transition-colors">นโยบายความเป็นส่วนตัว</Link>
                    <Link href="#" className="hover:text-teal-600 transition-colors">เงื่อนไขการใช้งาน</Link>
                    <Link href="#" className="hover:text-teal-600 transition-colors">ช่วยเหลือ</Link>
                  </div>
               </div>
            </footer>

          </div>
        </div>

        {/* Global Styles for Scrollbar */}
        <style jsx global>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </body>
   </html>
  );
}