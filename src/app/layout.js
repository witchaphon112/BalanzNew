"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './globals.css'; // Make sure this file exists and is correctly styled

// --- Constants ---
const PRIMARY_TEXT_CLASS = 'text-primary'; // Assuming 'text-primary' uses var(--primary)
const PRIMARY_BG_CLASS = 'bg-primary';     // Assuming 'bg-primary' uses var(--primary)
const SIDEBAR_WIDTH_FULL = 'w-80'; // 320px
const SIDEBAR_WIDTH_COLLAPSED = 'w-24'; // 96px

// --- Icon Components (Placeholder SVGs for simplicity) ---
// Replace these with your actual icon components or image tags if preferred
const IconHome = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>;
const IconAddTransaction = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>; // Example icon
const IconBudget = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8h6m-5 0a3 3 0 110 6H9l-4 4V8a4 4 0 014-4h6a4 4 0 014 4v6m-5 0a3 3 0 100-6h-6l-4 4V8a4 4 0 004-4h6a4 4 0 004 4v6"></path></svg>; // Example icon
const IconExchange = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m-5 3H4m0 0l4 4m-4-4l4-4"></path></svg>; // Example icon
const IconAnalytics = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>; // Example icon
const IconNotifications = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>;
const IconProfile = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"/></svg>;
const IconLogout = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"/></svg>;
const IconMenu = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M3 5.75A.75.75 0 013.75 5h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 5.75zM3 11.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zM3.75 17h16.5a.75.75 0 010 1.5H3.75a.75.75 0 010-1.5z" clipRule="evenodd"/></svg>;
const IconClose = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M18.27 5.73a.75.75 0 00-1.06-1.06L12 10.94 6.79 5.73a.75.75 0 10-1.06 1.06L10.94 12l-5.21 5.21a.75.75 0 101.06 1.06L12 13.06l5.21 5.21a.75.75 0 101.06-1.06L13.06 12l5.21-5.21a.75.75 0 000-1.06z" clipRule="evenodd"/></svg>;
const IconChevronRight = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>;
const IconCheck = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>;
const IconSidebarToggleExpand = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>; // Example Icon
const IconSidebarToggleCollapse = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>; // Example Icon

// --- Root Layout Component ---
export default function RootLayout({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [notificationCount, setNotificationCount] = useState(0); // Example count
  const [avatarUrl, setAvatarUrl] = useState(''); //'/path/to/avatar.jpg'
  const [displayName, setDisplayName] = useState('');
  const pathname = usePathname();

  // Determine if it's a landing/auth page
  const isLanding = 
    pathname === '/' || 
    pathname === '/register' || 
    pathname === '/login' || 
    pathname === '/change-password' || 
    pathname === '/forgot-password' || 
    pathname === '/reset-password';
    
  // --- Effects ---
  useEffect(() => {
    // Check local storage on mount
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
    
    const storedName = localStorage.getItem('name') || localStorage.getItem('displayName') || 'ผู้ใช้';
    setDisplayName(storedName);
    
    const localAvatar = localStorage.getItem('avatarUrl');
    if (localAvatar) setAvatarUrl(localAvatar);

    // Fetch initial notification count if logged in
    if (token) {
      fetchNotificationCount(token);
    }
    // Simple example: Set a notification count after a delay
    // const timer = setTimeout(() => setNotificationCount(3), 2000);
    // return () => clearTimeout(timer);

  }, []); // Empty dependency array means this runs once on mount

  // --- Handlers ---
  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setAvatarUrl('');
    setDisplayName('');
    window.location.href = '/'; // Redirect to home/login
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false); // Helper to close menu on link click
  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed); 

  const isActive = (path) => pathname === path;

  // --- API Call Placeholders ---
  const fetchNotificationCount = async (token) => { 
    console.log("Fetching notifications..."); 
    // Replace with your actual API call
    // Example: setNotificationCount(await getNotificationCountAPI(token));
    setNotificationCount(0); // Example
  };
  const resetAndFetchNotifications = async (token) => { 
    console.log("Resetting and fetching notifications..."); 
    setNotificationCount(0); // Reset immediately
    // Replace with your actual API call to mark as read and refetch
    // Example: await markNotificationsReadAPI(token);
    // setNotificationCount(await getNotificationCountAPI(token));
  };

  // --- Reusable Link Components ---

  // NavLink for Desktop Sidebar
  const NavLink = ({ href, icon, children, badge, onClick = () => {} }) => (
    <Link
      href={href}
      onClick={() => onClick()} // Execute onClick if provided
      title={isSidebarCollapsed ? children : ''} // Tooltip when collapsed
      className={`group flex items-center ${isSidebarCollapsed ? 'justify-center space-x-0 px-2' : 'space-x-4 px-3'} py-3 rounded-xl transition-all duration-300 transform ${
        isActive(href)
          ? `${PRIMARY_BG_CLASS} text-white shadow-lg shadow-primary/30 scale-[1.02]`
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white hover:scale-[1.01]'
      }`}
    >
      <div className={`relative p-2.5 rounded-lg transition-all duration-300 ${
        isActive(href) 
          ? 'bg-white/20 shadow-inner' 
          : 'bg-slate-700/50 group-hover:bg-slate-700/80'
      }`}>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600 items-center justify-center text-[10px] font-bold text-white border-2 border-slate-900">
              {badge > 9 ? '9+' : badge} {/* Limit badge display */}
            </span>
          </span>
        )}
      </div>
      <span className={`font-medium flex-1 whitespace-nowrap transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 hidden absolute' : 'opacity-100'}`}>
        {children}
      </span>
      {isActive(href) && !isSidebarCollapsed && (
        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-auto"></div>
      )}
    </Link>
  );

  // NavLink for Mobile Menu
  const MobileNavLink = ({ href, icon, children, badge, onClick = () => {} }) => (
    <Link
      href={href}
      onClick={() => { onClick(); closeMenu(); }} // Close menu on click
      className={`flex items-center space-x-4 py-4 px-5 rounded-2xl transition-all duration-300 ${
        isActive(href)
          ? `bg-gradient-to-r from-primary to-primary/80 text-white shadow-xl shadow-primary/30 scale-[1.02]`
          : 'text-slate-700 hover:bg-gray-100/80 hover:text-slate-900 hover:scale-[1.01]'
      }`}
    >
      <div className={`relative p-3 rounded-xl transition-all duration-300 ${
        isActive(href) ? 'bg-white/20' : 'bg-gray-100'
      }`}>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-5 w-5 bg-red-600 items-center justify-center text-[10px] font-bold text-white border-2 border-white`}>
              {badge > 9 ? '9+' : badge}
            </span>
          </span>
        )}
      </div>
      <span className="text-lg font-medium flex-1">{children}</span>
      {isActive(href) && (
        <IconCheck />
      )}
    </Link>
  );

  // --- Main Render ---
  return (
    
   <html lang="th">
        
  
      <body
        className="min-h-screen flex flex-col bg-gray-50"
        style={{ fontFamily: "'Noto Sans Thai','Inter',sans-serif" }}
      >
        {/* Mobile Header (Always visible on mobile) */}
        <header className="md:hidden border-b sticky top-0 z-50 bg-white/95 backdrop-blur-xl shadow-md">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between py-4">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4db8a8] to-[#3d9888] flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">B</span>
                </div>

                <span className="font-extrabold text-xl text-slate-900">
                  Balanz<span className={`text-primary font-light`}>.IA</span>
                </span>
              </Link>
              {/* Show menu button only if logged in or adjust logic as needed */}
              {isLoggedIn && !isLanding && (
                <button
                  onClick={toggleMenu}
                  className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-300 shadow-sm"
                  aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                >
                  {isMenuOpen ? <IconClose /> : <IconMenu />}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="md:flex flex-1">
          {/* Desktop Sidebar (Only if logged in and not landing page) */}
          {isLoggedIn && !isLanding && (
            <aside 
              className={`hidden md:flex fixed h-screen top-0 left-0 flex-col bg-slate-900 text-white border-r border-slate-700/50 shadow-2xl transition-all duration-300 z-30 ${isSidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_FULL}`}
              // style={{ minWidth: isSidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_FULL }} // Tailwind handles width
            >
              {/* Decorative Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none opacity-50"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none opacity-30"></div>
              
              {/* Logo Section */}
              <div className="relative px-6 py-8 border-b border-slate-700/50">
                <Link href="/dashboard" className={`flex items-center space-x-3 group transition-opacity duration-300 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                  <div className={`flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-xl shadow-primary/30 ${isSidebarCollapsed ? 'w-14 h-14' : ''}`}>
                    <span className="text-white font-bold text-xl">B</span>
                  </div>
                  <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'hidden' : 'visible'}`}>
                    <span className="font-extrabold text-2xl text-white group-hover:text-primary-light transition-colors whitespace-nowrap">
                      Balanz<span className="text-slate-300">.IA</span>
                    </span>
                  </div>
                </Link>
              </div>

              {/* Navigation */}
              <nav className="relative flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                  {/* --- Add Navigation Links Here --- */}
                  <NavLink href="/dashboard" icon={<IconHome />}>หน้าหลัก</NavLink>
                  <NavLink href="/transactions/add" icon={<IconAddTransaction />}>เพิ่มรายการ</NavLink> 
                  <NavLink href="/budget" icon={<IconBudget />}>งบประมาณ</NavLink>
                  <NavLink href="/currency" icon={<IconExchange />}>อัตราแลกเปลี่ยน</NavLink>
                  <NavLink href="/analytics" icon={<IconAnalytics />}>สรุปผล</NavLink>
                  <NavLink 
                    href="/notifications" 
                    badge={notificationCount}
                    onClick={() => resetAndFetchNotifications(localStorage.getItem('token'))}
                    icon={<IconNotifications />}
                  >
                    แจ้งเตือน
                  </NavLink>
                  {/* --- End Navigation Links --- */}
              </nav>

              {/* Sidebar Footer Section */}
              <div className="relative p-4 border-t border-slate-700/50 space-y-4 mt-auto">
                {/* Profile Card */}
                <Link 
                  href="/profile" 
                  className={`flex items-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 transition-all duration-300 group border border-slate-600/30 backdrop-blur-sm ${isSidebarCollapsed ? 'justify-center mx-auto' : 'w-full'}`}
                  title={isSidebarCollapsed ? "Profile" : ""}
                >
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 overflow-hidden flex items-center justify-center text-white font-bold mr-3 flex-shrink-0 shadow-lg shadow-primary/20">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} /> // Basic error handle
                    ) : (
                      <span className="text-lg">{displayName?.charAt(0)?.toUpperCase()}</span>
                    )}
                    {/* Online status indicator */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-slate-800 rounded-full"></div> 
                  </div>
                  
                  <div className={`flex-1 min-w-0 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden absolute' : 'visible'}`}>
                    <p className="text-sm text-white font-semibold truncate">{displayName || 'User'}</p>
                    <p className="text-xs text-slate-400">ดูโปรไฟล์</p>
                  </div>
                  {!isSidebarCollapsed && (
                     <IconChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors ml-auto flex-shrink-0" />
                  )}
                </Link>

                {/* Logout Button */}
                <button 
                  onClick={handleLogout} 
                  className={`flex items-center space-x-3 px-3 py-3 rounded-xl bg-red-600/70 hover:bg-red-700/90 text-white transition-all duration-300 shadow-lg shadow-red-500/20 w-full ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  title={isSidebarCollapsed ? "Logout" : ""}
                >
                  <IconLogout />
                  <span className={`font-semibold transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden absolute' : 'visible'}`}>ออกจากระบบ</span>
                </button>
                
                <p className={`text-xs text-slate-600 text-center mt-2 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden absolute' : 'visible'}`}>
                  © 2025 Balanz.IA
                </p>
              </div>
            </aside>
          )}

          {/* Main Content & Footer Wrapper */}
          <div className={`flex flex-col flex-1 ${isLoggedIn && !isLanding ? `w-full transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-24' : 'md:ml-80'}` : 'w-full'}`}>
            
            {/* Desktop Top Bar (Only if logged in and not landing page) */}
            {isLoggedIn && !isLanding && (
              <div className="hidden md:block sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                  <div className="flex items-center justify-between">
                    
                    {/* Left: Greeting & Toggle Button */}
                    <div className="flex items-center gap-4">
                       <button 
                         onClick={toggleSidebar} 
                         className="p-2 text-slate-500 hover:text-primary transition-colors hover:bg-slate-100 rounded-lg"
                         aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                       >
                          {isSidebarCollapsed ? <IconSidebarToggleExpand /> : <IconSidebarToggleCollapse />}
                       </button>

                       <div>
                         <h1 className="text-xl font-bold text-slate-800">Hello {displayName || 'User'}</h1>
                         <p className="text-sm text-slate-500">
                           {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                         </p>
                       </div>
                    </div>
                    
                    {/* Right: Notifications (Desktop) */}
                    <div className="flex items-center gap-3">
                      <Link 
                        href="/notifications" 
                        onClick={() => resetAndFetchNotifications(localStorage.getItem('token'))}
                        className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all duration-300 shadow-sm group"
                        aria-label={`Notifications ${notificationCount > 0 ? `(${notificationCount})` : ''}`}
                      >
                        <IconNotifications className="w-5 h-5 text-slate-600 group-hover:text-primary transition-colors" />
                        {notificationCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4">
                             <span className="relative inline-flex h-4 w-4 bg-red-600 text-white text-[10px] rounded-full border-2 border-white items-center justify-center font-bold">
                              {notificationCount > 9 ? '9+' : notificationCount}
                            </span>
                          </span>
                        )}
                      </Link>
                      {/* Add other top bar items here if needed */}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Menu Overlay */}
            <nav
              className={`md:hidden fixed inset-0 bg-white/98 backdrop-blur-xl p-6 overflow-y-auto z-[60] transition-all duration-300 transform ${
                isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
              }`}
              aria-hidden={!isMenuOpen}
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4db8a8] to-[#3d9888] flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">B</span>
              </div>
                  <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-slate-900">Menu</h2>
                    <span className="text-xs text-slate-500">Navigation</span>
                  </div>
                </div>
                <button
                  onClick={toggleMenu}
                  className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-300 shadow-sm"
                  aria-label="Close menu"
                >
                  <IconClose />
                </button>
              </div>

              {isLoggedIn && (
                <div className="flex flex-col space-y-3">
                  {/* --- Add Mobile Navigation Links Here --- */}
                  <MobileNavLink href="/dashboard" icon={<IconHome />}>หน้าหลัก</MobileNavLink>
                  <MobileNavLink href="/transactions/add" icon={<IconAddTransaction />}>เพิ่มรายการ</MobileNavLink> 
                  <MobileNavLink href="/budget" icon={<IconBudget />}>งบประมาณ</MobileNavLink>
                  <MobileNavLink href="/currency" icon={<IconExchange />}>อัตราแลกเปลี่ยน</MobileNavLink>
                  <MobileNavLink href="/analytics" icon={<IconAnalytics />}>สรุปผล</MobileNavLink>
                  <MobileNavLink 
                    href="/notifications" 
                    badge={notificationCount} 
                    onClick={() => resetAndFetchNotifications(localStorage.getItem('token'))} 
                    icon={<IconNotifications />}
                  >
                    แจ้งเตือน
                  </MobileNavLink>
                  <MobileNavLink href="/profile" icon={<IconProfile />}>โปรไฟล์</MobileNavLink>
                  {/* --- End Mobile Navigation Links --- */}
                  
                  {/* Logout Button (Mobile) */}
                  <button
                    onClick={() => { handleLogout(); closeMenu(); }}
                    className="flex items-center w-full space-x-4 py-4 px-5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-all duration-300 shadow-lg shadow-red-500/20 mt-6"
                  >
                    <div className="p-3 rounded-xl bg-white/20">
                      <IconLogout className="w-6 h-6"/>
                    </div>
                    <span className="text-lg font-semibold flex-1 text-left">ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </nav>

            {/* Main Content Area */}
            <main className={`flex-1 ${!isLanding ? 'p-4 sm:p-6 lg:p-8' : ''}`}>
              {/* Render children (Page Content) */}
              {children}
            </main>

{/* Footer */}
<footer className="mt-auto">
  {isLanding ? (
    // --- Footer for Landing Page (Ultra Minimal) ---
    <div className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
          {/* Brand Column */}
          <div>
            <Link href="/" className="flex items-center space-x-2 group mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4db8a8] to-[#3d9888] flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                <span className="text-white font-bold text-xs">B</span>
              </div>
              <span className="font-bold text-base text-[#191919]">
                Balanz<span className="text-gray-600">.IA</span>
              </span>
            </Link>
            <p className="text-xs text-gray-500">ระบบจัดการการเงินอัจฉริยะ</p>
          </div>

          {/* Links Column */}
          <div>
            <nav className="flex flex-col space-y-1.5">
              <Link href="/features" className="text-xs text-gray-600 hover:text-[#4db8a8] transition-colors">คุณสมบัติ</Link>
              <Link href="/contact" className="text-xs text-gray-600 hover:text-[#4db8a8] transition-colors">ติดต่อเรา</Link>
              <Link href="/help" className="text-xs text-gray-600 hover:text-[#4db8a8] transition-colors">ศูนย์ช่วยเหลือ</Link>
            </nav>
          </div>

          {/* Social Column */}
          <div>
            <div className="flex space-x-2">
              <a href="#" className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-[#4db8a8] text-gray-600 hover:text-white flex items-center justify-center transition-all duration-300">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-[#4db8a8] text-gray-600 hover:text-white flex items-center justify-center transition-all duration-300">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a href="#" className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-[#4db8a8] text-gray-600 hover:text-white flex items-center justify-center transition-all duration-300">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar - Compact */}
        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Balanz.IA</p>
          <div className="flex gap-3">
            <Link href="/privacy" className="hover:text-[#4db8a8] transition-colors">นโยบายความเป็นส่วนตัว</Link>
            <Link href="/terms" className="hover:text-[#4db8a8] transition-colors">เงื่อนไข</Link>
          </div>
        </div>
      </div>
    </div>
  ) : (
    // --- Footer for Dashboard (Minimal) ---
    <div className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <p className="text-xs text-center text-gray-500">
          © {new Date().getFullYear()} Balanz.IA
        </p>
      </div>
    </div>
  )}
</footer>
          
          </div> {/* End Main Content & Footer Wrapper */}
        </div> {/* End md:flex flex-1 */}

        {/* CSS for custom scrollbar (in Sidebar) */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          /* Hide scrollbar when sidebar is collapsed */
          aside[class*="${SIDEBAR_WIDTH_COLLAPSED}"] .custom-scrollbar::-webkit-scrollbar {
             display: none;
          }
        `}</style>
      </body>
   </html>
  );
}
