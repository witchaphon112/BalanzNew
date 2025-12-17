"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Profile() {
  const [user, setUser] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputId = 'avatar-file-input';

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์');
          setLoading(false);
          return;
        }

        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setUser({ name: data.name, email: data.email });
          if (data.avatarUrl) {
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
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
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
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }
    
    try {
      setUploading(true);
      setError('');
      
      // Preview immediately
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setAvatarUrl(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to backend
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('avatar', file);
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
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
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#4db8a8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2">
            โปรไฟล์ของฉัน
          </h1>
          <p className="text-gray-500">จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชีของคุณ</p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 text-green-700 p-4 rounded-xl flex items-center animate-slideDown">
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span className="font-medium">{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 text-red-600 p-4 rounded-xl flex items-center animate-slideDown">
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Avatar Section */}
          <div className="bg-gradient-to-r from-[#4db8a8] to-[#3d9888] p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white overflow-hidden flex items-center justify-center shadow-xl ring-4 ring-white/50">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                    </svg>
                  )}
                </div>
                
                {/* Upload overlay */}
                <button
                  type="button"
                  onClick={onPickFile}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                  {user.name || 'ชื่อของคุณ'}
                </h2>
                <p className="text-white/80 mb-4">{user.email}</p>
                
                {/* Avatar Actions */}
                <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                  <input 
                    id={fileInputId} 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange} 
                  />
                  <button
                    type="button"
                    onClick={onPickFile}
                    disabled={uploading}
                    className="px-5 py-2.5 rounded-xl bg-white text-[#4db8a8] font-semibold hover:bg-gray-50 disabled:opacity-60 transition-all shadow-md text-sm"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        กำลังอัปโหลด...
                      </span>
                    ) : (
                      'เปลี่ยนรูปภาพ'
                    )}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteAvatar}
                      className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all border border-white/30 text-sm"
                    >
                      ลบรูปภาพ
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#4db8a8]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                </svg>
                ข้อมูลส่วนตัว
              </h3>
              
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                    ชื่อ - นามสกุล
                  </label>
                  <div className="relative">
                    <input
                      id="name"
                      type="text"
                      value={user.name}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#4db8a8] focus:ring-4 focus:ring-[#4db8a8]/10 outline-none transition-all"
                      placeholder="กรอกชื่อของคุณ"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    อีเมล
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={user.email}
                      readOnly
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                      placeholder="อีเมลของคุณ"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">ไม่สามารถเปลี่ยนแปลงอีเมลได้</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#4db8a8] to-[#3d9888] text-white font-bold hover:from-[#3d9888] hover:to-[#2d7868] shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  บันทึกการเปลี่ยนแปลง
                </button>
                <Link
                  href="/change-password"
                  className="px-6 py-3.5 rounded-xl border-2 border-[#4db8a8] text-[#4db8a8] font-bold hover:bg-[#4db8a8] hover:text-white transition-all duration-200 text-center"
                >
                  เปลี่ยนรหัสผ่าน
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
          </div>
        </div>
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}