"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, User, Mail, Save, Key, LogOut, ChevronLeft, Trash2, UploadCloud, Trophy } from 'lucide-react';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const displayEmail = user.email && user.email.endsWith('@line.local')
    ? `LINE ID: ${user.email.replace('@line.local', '')}`
    : user.email;

  return (
    <div className="min-h-screen bg-gray-50/50 py-6 px-4 md:py-10">

      <div className="max-w-2xl mx-auto mb-4">
        <div className="flex items-center justify-between">
          <div />
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="bg-transparent sm:bg-white rounded-3xl shadow-none sm:shadow-xl sm:border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100 relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <User className="w-12 h-12" />
                    </div>
                  )}
                </div>

                <input id={fileInputId} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <h1 className="text-xl font-bold text-gray-900">{user.name || 'ผู้ใช้งาน'}</h1>
                </div>                
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-28">
                  <img src="/Jiw.png" alt="Jiw" className="w-full h-auto" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800">จดต่อเนื่องมา</h3>
                  <p className="text-4xl font-extrabold text-gray-900 mt-1">0 วัน</p>
                  <p className="text-sm text-gray-500 mt-1">เลเวลต่อไปใน 1 วัน</p>
                  <div className="mt-3 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="h-4 bg-sky-500 rounded-full w-1/3"></div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                <button
                  onClick={() => setRankingOpen(true)}
                  aria-label="ดูอันดับการจดต่อเนื่อง"
                  className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-yellow-50 text-yellow-700 hover:bg-yellow-100 shadow-sm transition"
                >
                  <Trophy className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { key: 'reminder', label: 'เตือนจดประจำวัน' },
                { key: 'autocat', label: 'จัดหมวดด้วยความจำ' },
                { key: 'payments', label: 'ประวัติการชำระเงิน' },
                { key: 'categories', label: 'ตั้งค่าหมวด' }
              ].map(({ key, label }) => (
                <div
                  key={key}
                  role="button"
                  onClick={() => openModal(key)}
                  className="cursor-pointer flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-700">{label}</div>
                    {key === 'reminder' && (
                      <div className="ml-3 text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">{reminderEnabled ? `เปิด ${reminderTime}` : 'ปิด'}</div>
                    )}
                    {key === 'autocat' && (
                      <div className="ml-3 text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">{autoCategorize ? 'เปิด' : 'ปิด'}</div>
                    )}
                  </div>
                  <div className="text-gray-400">
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modals for features */}
          {activeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={closeModal}></div>
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl z-10 w-full max-w-lg sm:max-w-md mx-4 sm:mx-auto p-4 sm:p-6 max-h-[90vh] overflow-auto transform -translate-y-6 sm:-translate-y-12">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-gray-800">{activeModal === 'reminder' ? 'เตือนจดประจำวัน' : activeModal === 'autocat' ? 'จัดหมวดด้วยความจำ' : activeModal === 'payments' ? 'ประวัติการชำระเงิน' : 'ตั้งค่าหมวด'}</h3>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-700">✕</button>
                </div>
                <div className="mt-4">
                  {activeModal === 'reminder' && (
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">เปิดการเตือนรายวัน</span>
                      </label>
                      <div>
                        <label className="text-xs text-gray-500">เวลาเตือน</label>
                        <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <button onClick={closeModal} className="px-4 py-2">ยกเลิก</button>
                        <button onClick={saveReminder} className="px-4 py-2 bg-sky-500 text-white rounded-lg">บันทึก</button>
                      </div>
                    </div>
                  )}

                  {activeModal === 'autocat' && (
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" checked={autoCategorize} onChange={(e) => setAutoCategorize(e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">เปิดจัดหมวดอัตโนมัติจากข้อความ/จำนวน</span>
                      </label>
                      <p className="text-xs text-gray-500">เมื่อเปิด ระบบจะพยายามเดาหมวดหมู่จากหมายเหตุและจำนวนเงิน</p>
                      <div className="flex justify-end gap-2 mt-4">
                        <button onClick={closeModal} className="px-4 py-2">ยกเลิก</button>
                        <button onClick={saveAutoCategorize} className="px-4 py-2 bg-sky-500 text-white rounded-lg">บันทึก</button>
                      </div>
                    </div>
                  )}

                  {activeModal === 'payments' && (
                    <div className="space-y-3">
                      <p className="text-sm">คุณสามารถดูประวัติการชำระเงินทั้งหมดได้ที่หน้ารายการ</p>
                      <div className="flex justify-end gap-2 mt-4">
                        <button onClick={closeModal} className="px-4 py-2">ปิด</button>
                        <button onClick={() => { closeModal(); router.push('/transactions'); }} className="px-4 py-2 bg-sky-500 text-white rounded-lg">ไปที่รายการ</button>
                      </div>
                    </div>
                  )}

                  {activeModal === 'categories' && (
                    <div className="space-y-3">
                      <p className="text-sm">จัดการหมวดหมู่ของคุณ (เพิ่ม/แก้ไข/ลบ)</p>
                      <div className="flex justify-end gap-2 mt-4">
                        <button onClick={closeModal} className="px-4 py-2">ปิด</button>
                        <button onClick={() => { closeModal(); router.push('/categories'); }} className="px-4 py-2 bg-sky-500 text-white rounded-lg">ไปที่หมวดหมู่</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {rankingOpen && (
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-12 sm:pt-0 pb-24 sm:pb-8">
              <div className="absolute inset-0 bg-black/40" onClick={() => setRankingOpen(false)}></div>
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl z-10 w-full max-w-lg sm:max-w-md mx-4 sm:mx-auto p-4 sm:p-6 max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">อันดับการจดต่อเนื่อง</h3>
                  <button onClick={() => setRankingOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
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
                        // positions left, center, right
                        const positions = [40, 96, 162];
                        const widths = [28, 40, 28];
                        const maxBarHeight = 92; // matches available SVG height
                        const maxDays = Math.max(...rankingData.map(r => r.days));
                        const grads = ['g1', 'g2', 'g3'];

                        // sort descending so sorted[0] is rank 1 (highest)
                        const sorted = [...rankingData].sort((a, b) => b.days - a.days);
                        // we want center=top (rank1), right=rank2, left=rank3
                        const orderForPositions = [sorted[2], sorted[0], sorted[1]];

                        return orderForPositions.map((r, i) => {
                          const h = Math.round((r.days / maxDays) * maxBarHeight);
                          const x = positions[i];
                          const w = widths[i];
                          const y = 118 - h;
                          const cx = x + w / 2;
                          const badgeY = y - 18; // position badge above bar
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
                              <text x={cx} y="134" fontSize="11" textAnchor="middle" fill="#374151">{r.name.split(' ')[0]}</text>
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
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white mt-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i===0? 'bg-rose-50 text-rose-600 ring-1 ring-white shadow-sm' : i===1? 'bg-sky-50 text-sky-700 ring-1 ring-white shadow-sm' : 'bg-emerald-50 text-emerald-700 ring-1 ring-white shadow-sm'} font-medium`}>{i+1}</div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">{u.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{u.days} วัน</div>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">#{i+1}</div>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button onClick={() => setRankingOpen(false)} className="px-4 py-2 bg-sky-100 text-sky-700 rounded-lg">ปิด</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
              <div className="w-full sm:w-auto">
                <div className="text-sm text-gray-500">เข้าสู่ระบบด้วย</div>
                <div className="text-sm font-medium text-gray-800">{displayEmail || 'ไม่ระบุอีเมล'}</div>
              </div>

              <div className="w-full sm:w-auto">
                <button
                  onClick={handleLogout}
                  className="relative w-full sm:inline-flex items-center pl-12 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold rounded-lg shadow-md hover:brightness-95 transition"
                >
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 text-white p-2 rounded-full flex items-center justify-center">
                    <LogOut className="w-4 h-4" />
                  </span>
                  <span className="w-full flex justify-center">ออกจากระบบ</span>
                </button>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">ออกจากระบบจะล้างข้อมูลการเข้าสู่ระบบบนเครื่องนี้</div>
          </div>

          {confirmLogoutOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={cancelLogout}></div>
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl z-10 w-full max-w-sm sm:max-w-md mx-4 sm:mx-auto p-4 sm:p-6 max-h-[80vh] overflow-auto">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-red-50 text-red-600">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">ออกจากระบบ</h3>
                    <p className="text-sm text-gray-500 mt-1">คุณจะถูกออกจากระบบและต้องเข้าสู่ระบบใหม่เพื่อใช้งานต่อ</p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button onClick={cancelLogout} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">ยกเลิก</button>
                  <button
                    onClick={() => { setConfirmLogoutOpen(false); performLogout(); }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-gray-400 text-xs mt-8">© 2025 Financial Planner. All rights reserved.</p>
    </div>
  );
}