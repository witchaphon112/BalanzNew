"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  LogOut,
  ChevronRight,
  Trophy,
  Moon,
  BellRing,
  Brain,
  ReceiptText,
  LayoutGrid,
  Pencil,
  Flame,
  Loader2,
} from 'lucide-react';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const fileInputId = 'avatar-file-input';

  const rankingData = [
    { name: 'Witchaphon y.', days: 42 },
    { name: 'Somchai', days: 28 },
    { name: 'Nipa', days: 15 },
  ];

  // Local feature settings (stored in localStorage)
  const [activeModal, setActiveModal] = useState(null); // 'reminder' | 'autocat' | 'payments' | 'categories'
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [autoCategorize, setAutoCategorize] = useState(false);

  useEffect(() => {
    try {
      const rEn = localStorage.getItem('reminderEnabled');
      const rTime = localStorage.getItem('reminderTime');
      const aCat = localStorage.getItem('autoCategorize');
      if (rEn !== null) setReminderEnabled(JSON.parse(rEn));
      if (rTime) setReminderTime(rTime);
      if (aCat !== null) setAutoCategorize(JSON.parse(aCat));
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem('balanz_theme');
      setTheme(v === 'light' ? 'light' : 'dark');
    } catch {
      setTheme('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('balanz_theme', next);
    } catch {}
    setTheme(next);
    try {
      window.dispatchEvent(new Event('balanz_theme_change'));
    } catch {}
  };

  const openModal = (key) => setActiveModal(key);
  const closeModal = () => setActiveModal(null);

  const saveReminder = () => {
    try {
      localStorage.setItem('reminderEnabled', JSON.stringify(reminderEnabled));
      localStorage.setItem('reminderTime', reminderTime);
      setSuccess('บันทึกการเตือนเรียบร้อย');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {}
    closeModal();
  };

  const saveAutoCategorize = () => {
    try {
      localStorage.setItem('autoCategorize', JSON.stringify(autoCategorize));
      setSuccess('บันทึกการจัดหมวดเรียบร้อย');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {}
    closeModal();
  };

  // --- Logic เดิม (Fetch, Upload, Update) ---
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์');
          setLoading(false);
          return;
        }

        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setUser({ name: data.name, email: data.email });
          if (data.profilePic) {
            setAvatarUrl(data.profilePic);
            try { localStorage.setItem('avatarUrl', data.profilePic); } catch {}
          } else if (data.avatarUrl) {
            setAvatarUrl(data.avatarUrl);
            try { localStorage.setItem('avatarUrl', data.avatarUrl); } catch {}
          } else {
            const localAvatar = localStorage.getItem('avatarUrl');
            if (localAvatar) setAvatarUrl(localAvatar);
          }
        } else {
          setError(data.message || 'ไม่สามารถโหลดข้อมูลโปรไฟล์');
        }
        setLoading(false);
      } catch (error) {
        setError('ไม่สามารถโหลดข้อมูลโปรไฟล์');
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token');
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: user.name }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser({ name: data.name, email: data.email });
        try { localStorage.setItem('name', data.name); } catch {}
        setSuccess('บันทึกข้อมูลสำเร็จ');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'ไม่สามารถบันทึกข้อมูล');
      }
    } catch (error) {
      setError('ไม่สามารถบันทึกข้อมูล');
    }
  };

  const onPickFile = () => {
    const el = document.getElementById(fileInputId);
    if (el) el.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setError('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }
    
    try {
      setUploading(true);
      setError('');
      
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setAvatarUrl(reader.result);
      };
      reader.readAsDataURL(file);

      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('avatar', file);
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
      const res = await fetch(`${API_BASE}/api/auth/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const raw = await res.text();
      let data; 
      try { data = JSON.parse(raw); } catch { data = { message: raw }; }
      
      if (res.ok && data?.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        try { localStorage.setItem('avatarUrl', data.avatarUrl); } catch {}
        setSuccess('อัปโหลดรูปภาพสำเร็จ');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        try { localStorage.setItem('avatarUrl', avatarUrl); } catch {}
      }
    } catch (err) {
      console.error('Upload avatar failed', err);
      setError('ไม่สามารถอัปโหลดรูปภาพ');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('คุณต้องการลบรูปโปรไฟล์ใช่หรือไม่?')) return;

    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
      await fetch(`${API_BASE}/api/auth/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});

      setSuccess('ลบรูปโปรไฟล์สำเร็จ');
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setUploading(false);
      setAvatarUrl('');
      try { localStorage.removeItem('avatarUrl'); } catch {}
    }
  };

  const performLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem('name');
    } catch {}
    window.location.href = '/';
  };

  const handleLogout = () => setConfirmLogoutOpen(true);
  const cancelLogout = () => setConfirmLogoutOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[color:var(--app-muted)] font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const displayEmail = user.email && user.email.endsWith('@line.local')
    ? `LINE ID: ${user.email.replace('@line.local', '')}`
    : user.email;

  const streakDays = 0;
  const progressPercent = 15;
  const level = 1;
  const nextLevelInDays = 1;

  return (
    <div className="min-h-[100dvh] bg-[#06121f] text-slate-100">
      <div className="mx-auto w-full max-w-sm px-4 pb-24 pt-8">
        <div className="rounded-[28px] bg-gradient-to-r from-[#0a1b2c] via-[#0b2332] to-[#0c2a2b] p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-white/5 ring-2 ring-emerald-400/60 p-0.5">
                <div className="h-full w-full overflow-hidden rounded-full bg-[#0b2730]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400">
                      <User className="h-7 w-7" />
                    </div>
                  )}
                </div>
              </div>
                         </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-extrabold">{user.name || 'ผู้ใช้งาน'}</div>              
              <div className="mt-2 text-xs font-semibold text-slate-400 truncate">{displayEmail || ''}</div>            
            </div>
          </div>
        </div>

        {(error || success) && (
          <div
            className={[
              'mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold',
              error ? 'border-rose-400/20 bg-rose-500/10 text-rose-200' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
            ].join(' ')}
          >
            {error || success}
          </div>
        )}

        <div className="mt-4 rounded-[28px] bg-[#0b2332] p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-400">สถิติการใช้งาน</div>
            <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-200 ring-1 ring-emerald-400/25">
              เลเวล {level}
            </div>
          </div>
          <div className="mt-3 text-lg font-extrabold">เป้าหมายการออม</div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold">{streakDays} วันต่อเนื่อง</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-400">เข้าใช้งานทุกวันเพื่อรับรางวัล</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>สถิติการจดรายวันถัดไป</span>
              <span className="text-emerald-200">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500">เลเวลต่อไปใน {nextLevelInDays} วัน</div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setRankingOpen(true)}
              aria-label="ดูอันดับการจดต่อเนื่อง"
              className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-white/5 text-amber-200 hover:bg-white/10 ring-1 ring-white/10 shadow-sm transition"
            >
              <Trophy className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between rounded-2xl bg-[#0b2332] px-4 py-4 ring-1 ring-white/10 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200">
                <Moon className="h-5 w-5" />
              </div>
              <div className="text-sm font-extrabold">โหมดกลางคืน</div>
            </div>
            <div
              className={[
                'relative inline-flex h-7 w-12 items-center rounded-full transition',
                theme === 'dark' ? 'bg-emerald-500' : 'bg-white/10 ring-1 ring-white/10',
              ].join(' ')}
              aria-hidden="true"
            >
              <span
                className={[
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </div>
          </button>

          {[
            { key: 'reminder', label: 'เตือนจดประจำวัน', icon: BellRing, right: reminderEnabled ? `เปิด ${reminderTime}` : '', action: () => openModal('reminder') },
            { key: 'autocat', label: 'จัดหมวดด้วยความจำ', icon: Brain, right: autoCategorize ? 'เปิด' : '', action: () => openModal('autocat') },
            { key: 'payments', label: 'ประวัติการชำระเงิน', icon: ReceiptText, right: '', action: () => router.push('/transactions') },
            { key: 'categories', label: 'ตั้งค่าหมวด', icon: LayoutGrid, right: '', action: () => router.push('/categories') },
          ].map(({ key, label, icon: Icon, right, action }) => (
            <button
              key={key}
              type="button"
              onClick={action}
              className="w-full flex items-center justify-between rounded-2xl bg-[#0b2332] px-4 py-4 ring-1 ring-white/10 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-sm font-extrabold">{label}</div>
              </div>
              <div className="flex items-center gap-3">
                {right ? <div className="text-xs font-semibold text-slate-400">{right}</div> : null}
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-4 text-rose-200 font-extrabold hover:bg-rose-500/15 transition inline-flex items-center justify-center gap-3"
          >
            <LogOut className="h-5 w-5" />
            ออกจากระบบ
          </button>
          <div className="mt-5 text-center text-xs font-semibold text-slate-500">
            เวอร์ชัน 2.4.0 (Build 2024)
          </div>
        </div>
      </div>

      {/* Modals for features */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal}></div>
          <div className="bg-[#0b2332] border border-white/10 rounded-2xl shadow-2xl z-10 w-full max-w-md mx-auto p-5 max-h-[90vh] overflow-auto text-slate-100">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-extrabold">
                {activeModal === 'reminder'
                  ? 'เตือนจดประจำวัน'
                  : activeModal === 'autocat'
                    ? 'จัดหมวดด้วยความจำ'
                    : activeModal === 'payments'
                      ? 'ประวัติการชำระเงิน'
                      : 'ตั้งค่าหมวด'}
              </h3>
              <button onClick={closeModal} className="text-slate-300 hover:text-slate-50">✕</button>
            </div>
            <div className="mt-4">
              {activeModal === 'reminder' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm font-semibold">เปิดการเตือนรายวัน</span>
                  </label>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold">เวลาเตือน</label>
                    <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="mt-1 w-full px-3 py-2 border border-white/10 bg-white/5 rounded-xl text-slate-100" />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={closeModal} className="px-4 py-2 text-slate-300 hover:text-slate-50 font-semibold">ยกเลิก</button>
                    <button onClick={saveReminder} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-extrabold">บันทึก</button>
                  </div>
                </div>
              )}

              {activeModal === 'autocat' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={autoCategorize} onChange={(e) => setAutoCategorize(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm font-semibold">เปิดจัดหมวดอัตโนมัติจากข้อความ/จำนวน</span>
                  </label>
                  <p className="text-xs text-slate-400 font-semibold">เมื่อเปิด ระบบจะพยายามเดาหมวดหมู่จากหมายเหตุและจำนวนเงิน</p>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={closeModal} className="px-4 py-2 text-slate-300 hover:text-slate-50 font-semibold">ยกเลิก</button>
                    <button onClick={saveAutoCategorize} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-extrabold">บันทึก</button>
                  </div>
                </div>
              )}

              {activeModal === 'payments' && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-200">คุณสามารถดูประวัติการชำระเงินทั้งหมดได้ที่หน้ารายการ</p>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={closeModal} className="px-4 py-2 text-slate-300 hover:text-slate-50 font-semibold">ปิด</button>
                    <button onClick={() => { closeModal(); router.push('/transactions'); }} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-extrabold">ไปที่รายการ</button>
                  </div>
                </div>
              )}

              {activeModal === 'categories' && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-200">จัดการหมวดหมู่ของคุณ (เพิ่ม/แก้ไข/ลบ)</p>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={closeModal} className="px-4 py-2 text-slate-300 hover:text-slate-50 font-semibold">ปิด</button>
                    <button onClick={() => { closeModal(); router.push('/categories'); }} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-extrabold">ไปที่หมวดหมู่</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {rankingOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-12 sm:pt-0 pb-24 sm:pb-8">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRankingOpen(false)}></div>
          <div className="bg-[#0b2332] border border-white/10 rounded-2xl shadow-2xl z-10 w-full max-w-md mx-auto p-5 max-h-[90vh] overflow-auto text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">อันดับการจดต่อเนื่อง</h3>
              <button onClick={() => setRankingOpen(false)} className="text-slate-300 hover:text-slate-50">✕</button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-center">
                <svg viewBox="0 -10 220 150" className="w-full h-40">
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#86EFAC" />
                      <stop offset="100%" stopColor="#4ADE80" />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#FB7185" />
                      <stop offset="100%" stopColor="#F97316" />
                    </linearGradient>
                    <linearGradient id="g3" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#93C5FD" />
                      <stop offset="100%" stopColor="#60A5FA" />
                    </linearGradient>
                  </defs>

                  {(() => {
                    const positions = [40, 96, 162];
                    const widths = [28, 40, 28];
                    const maxBarHeight = 92;
                    const maxDays = Math.max(...rankingData.map(r => r.days));
                    const grads = ['g1', 'g2', 'g3'];
                    const sorted = [...rankingData].sort((a, b) => b.days - a.days);
                    const orderForPositions = [sorted[2], sorted[0], sorted[1]];

                    return orderForPositions.map((r, i) => {
                      const h = Math.round((r.days / maxDays) * maxBarHeight);
                      const x = positions[i];
                      const w = widths[i];
                      const y = 118 - h;
                      const cx = x + w / 2;
                      const badgeY = y - 18;
                      const rankIndex = sorted.findIndex(s => s.name === r.name);
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={w} height={h} rx="8" fill={`url(#${grads[i]})`} />
                          {(() => {
                            const badgeFill = rankIndex === 0 ? '#FFF1F2' : rankIndex === 1 ? '#EFF6FF' : '#ECFDF5';
                            const badgeStroke = rankIndex === 0 ? '#FECACA' : rankIndex === 1 ? '#BFDBFE' : '#BBF7D0';
                            const badgeTextColor = rankIndex === 0 ? '#BE123C' : rankIndex === 1 ? '#1E40AF' : '#065F46';
                            return (
                              <>
                                <circle cx={cx} cy={badgeY} r="12" fill={badgeFill} stroke={badgeStroke} strokeWidth="0.6" />
                                <text x={cx} y={badgeY + 4} fontSize="10" textAnchor="middle" fill={badgeTextColor} fontWeight="600">{rankIndex + 1}</text>
                              </>
                            );
                          })()}
                          <text x={cx} y="134" fontSize="11" textAnchor="middle" fill="#cbd5e1">{r.name.split(' ')[0]}</text>
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>

              <div className="mt-4 space-y-3">
                {(() => {
                  const sorted = [...rankingData].sort((a, b) => b.days - a.days);
                  return sorted.map((u, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5 mt-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-1 ${i === 0 ? 'bg-rose-500/15 text-rose-200 ring-rose-400/20' : i === 1 ? 'bg-sky-500/15 text-sky-200 ring-sky-400/20' : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20'} font-extrabold`}>{i + 1}</div>
                      <div className="flex-1">
                        <div className="text-sm font-extrabold text-slate-50">{u.name}</div>
                        <div className="text-xs text-slate-400 font-semibold mt-1">{u.days} วัน</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-400">#{i + 1}</div>
                    </div>
                  ));
                })()}
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={() => setRankingOpen(false)} className="px-4 py-2 bg-white/5 border border-white/10 text-slate-100 rounded-xl hover:bg-white/10 font-extrabold">ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmLogoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cancelLogout}></div>
          <div className="bg-[#0b2332] border border-white/10 rounded-2xl shadow-2xl z-10 w-full max-w-sm mx-auto p-5 text-slate-100">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-rose-500/10 text-rose-200 border border-rose-400/20">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-slate-50">ออกจากระบบ</h3>
                <p className="text-sm text-slate-400 mt-1 font-semibold">คุณจะถูกออกจากระบบและต้องเข้าสู่ระบบใหม่เพื่อใช้งานต่อ</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={cancelLogout} className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 font-extrabold">ยกเลิก</button>
              <button
                onClick={() => { setConfirmLogoutOpen(false); performLogout(); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl flex items-center justify-center gap-2 font-extrabold"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
