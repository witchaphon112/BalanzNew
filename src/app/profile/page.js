"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, User, Mail, Save, Key, LogOut, ChevronLeft, Trash2, UploadCloud } from 'lucide-react';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputId = 'avatar-file-input';

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

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem('name');
    } catch {}
    window.location.href = '/';
  };

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
          <h2 className="text-2xl text-gray-500">ตั้งค่า</h2>
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <User className="w-12 h-12" />
                    </div>
                  )}
                </div>

                <input id={fileInputId} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                <div className="absolute -bottom-1 -right-1 flex items-center gap-2">
                  
                  
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <h1 className="text-xl font-bold text-gray-900">{user.name || 'ผู้ใช้งาน'}</h1>
                </div>                
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="bg-white rounded-xl border p-4 shadow-sm flex gap-4 items-center">
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
              <div className="bg-white rounded-2xl shadow-2xl z-10 max-w-md w-full p-6">
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

          <div className="p-6 border-t border-gray-100">
            <button onClick={handleLogout} className="w-full text-left text-red-500 font-medium">ออกจากระบบ</button>
          </div>
        </div>
      </div>

      <p className="text-center text-gray-400 text-xs mt-8">© 2025 Financial Planner. All rights reserved.</p>
    </div>
  );
}