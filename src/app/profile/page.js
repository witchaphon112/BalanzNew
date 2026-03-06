"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingMascot from '@/components/LoadingMascot';
import {
  User,
  LogOut,
  ChevronRight,
  Trophy,
  Moon,
  BellRing,
  Brain,
  Languages,
  Trash2,
  LayoutGrid,
  Pencil,
  Flame,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
const BANGKOK_TZ = 'Asia/Bangkok';
const LEVEL_DAYS = 7;
const USAGE_STATS_CACHE_KEY = 'balanz_usage_stats_cache_v1';

const toBangkokISODateKey = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: BANGKOK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const map = {};
    for (const p of parts) {
      if (p?.type) map[p.type] = p.value;
    }
    const yyyy = map.year;
    const mm = map.month;
    const dd = map.day;
    if (!yyyy || !mm || !dd) return '';
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
};

const shiftBangkokISODateKey = (isoKey, deltaDays) => {
  if (!isoKey) return '';
  const base = new Date(`${isoKey}T00:00:00.000+07:00`);
  if (Number.isNaN(base.getTime())) return '';
  return toBangkokISODateKey(new Date(base.getTime() + deltaDays * 86400000));
};

export default function Profile() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [usageStats, setUsageStats] = useState({
    loading: true,
    error: '',
    streakDays: 0,
    loggedToday: false,
    totalLoggedDays: 0,
    level: 1,
    progressPercent: 0,
    nextLevelInDays: LEVEL_DAYS,
  });
  const [usageStatsUpdatedAt, setUsageStatsUpdatedAt] = useState(0);

  const [rankingData, setRankingData] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState('');

  // Local feature settings (stored in localStorage)
  const [activeModal, setActiveModal] = useState(null); // 'reminder' | 'autocat' | 'language' | 'clearAll' | 'categories'
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [autoCategorize, setAutoCategorize] = useState(false);
  const [language, setLanguage] = useState('th'); // 'th' | 'en'
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  useEffect(() => {
    try {
      const rEn = localStorage.getItem('reminderEnabled');
      const rTime = localStorage.getItem('reminderTime');
      const aCat = localStorage.getItem('autoCategorize');
      const lang = localStorage.getItem('balanz_lang');
      if (rEn !== null) setReminderEnabled(JSON.parse(rEn));
      if (rTime) setReminderTime(rTime);
      if (aCat !== null) setAutoCategorize(JSON.parse(aCat));
      if (lang === 'en' || lang === 'th') setLanguage(lang);
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

  useEffect(() => {
    if (!rankingOpen) return;
    let cancelled = false;
    const controller = new AbortController();
    const fetchRanking = async () => {
      try {
        setRankingLoading(true);
        setRankingError('');
        const token = localStorage.getItem('token');
        if (!token) throw new Error('กรุณาเข้าสู่ระบบ');

        const res = await fetch(`${API_BASE}/api/leaderboard/streak?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const contentType = String(res.headers.get('content-type') || '');
          const text = await res.text().catch(() => '');
          const looksLikeMissingRoute =
            contentType.includes('text/html') ||
            /Cannot\s+GET\s+\/api\/leaderboard\/streak/i.test(text);
          if (looksLikeMissingRoute) {
            throw new Error('Backend ยังไม่มี endpoint Leaderboard (ลองรีสตาร์ท server ที่พอร์ต 5050)');
          }
          throw new Error(text || 'ไม่สามารถโหลดอันดับได้');
        }
        const data = await res.json();
        const list = Array.isArray(data?.leaderboard) ? data.leaderboard : [];
        const mapped = list.map((u) => ({
          name: u?.name || 'ผู้ใช้งาน',
          days: Number(u?.days ?? u?.streakDays) || 0,
        }));
        if (!cancelled) setRankingData(mapped);
      } catch (err) {
        if (!cancelled && err?.name !== 'AbortError') {
          setRankingError(err?.message ? String(err.message) : 'ไม่สามารถโหลดอันดับได้');
          setRankingData([]);
        }
      } finally {
        if (!cancelled) setRankingLoading(false);
      }
    };
    fetchRanking();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rankingOpen]);

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

  const openModal = (key) => {
    if (key === 'clearAll') setDeleteConfirmText('');
    setActiveModal(key);
  };
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

  const saveLanguage = () => {
    try {
      localStorage.setItem('balanz_lang', language);
    } catch {}
    try {
      document.documentElement.lang = language === 'en' ? 'en' : 'th';
      window.dispatchEvent(new Event('balanz_lang_change'));
    } catch {}
    setSuccess('บันทึกภาษาเรียบร้อย');
    setTimeout(() => setSuccess(''), 3000);
    closeModal();
  };

  const deleteAllTransactions = async () => {
    if (deleteAllLoading) return;
    try {
      setDeleteAllLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const res = await fetch(`${API_BASE}/api/transactions/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'ลบรายการไม่สำเร็จ');
      }
      setSuccess(`ลบรายการทั้งหมดแล้ว (${Number(data?.deletedCount) || 0} รายการ)`);
      setTimeout(() => setSuccess(''), 3500);
      setDeleteConfirmText('');
      closeModal();
    } catch (err) {
      setError(err?.message ? String(err.message) : 'ลบรายการไม่สำเร็จ');
    } finally {
      setDeleteAllLoading(false);
    }
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

  // Auto-link LINE chat (Messaging API) to this web account when arriving with ?linkCode=xxxxxx
  useEffect(() => {
    const code = searchParams?.get('linkCode');
    if (!code) return;

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('กรุณาเข้าสู่ระบบก่อนเชื่อมบัญชี');

        setError('');
        setSuccess('กำลังเชื่อม LINE...');
        const res = await fetch(`${API_BASE}/api/auth/link-line-messaging`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'เชื่อมบัญชีไม่สำเร็จ');

        if (!cancelled) {
          setSuccess('เชื่อม LINE สำเร็จ');
          setTimeout(() => setSuccess(''), 3000);
          // remove linkCode from URL
          try { router.replace('/profile'); } catch {}
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          setError(e?.message ? String(e.message) : 'เชื่อมบัญชีไม่สำเร็จ');
          setSuccess('');
          try { router.replace('/profile'); } catch {}
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchParams, router]);

  const refreshUsageStats = useCallback(async (signal) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUsageStats((prev) => ({ ...prev, loading: false, error: 'กรุณาเข้าสู่ระบบเพื่อดูสถิติ' }));
      return;
    }

    setUsageStats((prev) => ({ ...prev, loading: true, error: '' }));
    const res = await fetch(`${API_BASE}/api/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'ไม่สามารถโหลดธุรกรรมได้');
    }
    const transactions = await res.json();
    const list = Array.isArray(transactions) ? transactions : [];

    const dayKeys = new Set();
    for (const t of list) {
      const dt = t?.date || t?.datetime || t?.createdAt;
      const key = dt ? toBangkokISODateKey(dt) : '';
      if (key) dayKeys.add(key);
    }

    const todayKey = toBangkokISODateKey(Date.now());
    const yesterdayKey = shiftBangkokISODateKey(todayKey, -1);
    const loggedToday = Boolean(todayKey && dayKeys.has(todayKey));

    const streakStartKey = loggedToday
      ? todayKey
      : (yesterdayKey && dayKeys.has(yesterdayKey) ? yesterdayKey : '');

    let streakDays = 0;
    if (streakStartKey) {
      let cursor = streakStartKey;
      while (cursor && dayKeys.has(cursor)) {
        streakDays += 1;
        cursor = shiftBangkokISODateKey(cursor, -1);
      }
    }

    const totalLoggedDays = dayKeys.size;
    const level = Math.floor(totalLoggedDays / LEVEL_DAYS) + 1;
    const daysIntoLevel = totalLoggedDays % LEVEL_DAYS;
    const progressPercent = Math.round((daysIntoLevel / LEVEL_DAYS) * 100);
    const nextLevelInDays = daysIntoLevel === 0 ? LEVEL_DAYS : (LEVEL_DAYS - daysIntoLevel);

    const computed = {
      loading: false,
      error: '',
      streakDays,
      loggedToday,
      totalLoggedDays,
      level,
      progressPercent,
      nextLevelInDays,
    };

    setUsageStats(computed);
    const now = Date.now();
    setUsageStatsUpdatedAt(now);
    try {
      localStorage.setItem(USAGE_STATS_CACHE_KEY, JSON.stringify({ updatedAt: now, ...computed }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USAGE_STATS_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && Number.isFinite(parsed.updatedAt)) {
        setUsageStats((prev) => ({
          ...prev,
          ...parsed,
          loading: true,
          error: '',
        }));
        setUsageStatsUpdatedAt(parsed.updatedAt);
      }
    } catch {}

    const controller = new AbortController();
    refreshUsageStats(controller.signal).catch((err) => {
      setUsageStats((prev) => ({
        ...prev,
        loading: false,
        error: err?.name === 'AbortError' ? '' : (err?.message ? String(err.message) : 'ไม่สามารถโหลดสถิติได้'),
      }));
    });

    const onFocus = () => {
      const c = new AbortController();
      refreshUsageStats(c.signal).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshUsageStats]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token');
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
        <LoadingMascot label="กำลังโหลดข้อมูล..." size={88} />
      </div>
    );
  }

  const displayEmail = user.email && user.email.endsWith('@line.local')
    ? `LINE ID: ${user.email.replace('@line.local', '')}`
    : user.email;

  const streakDays = usageStats.streakDays || 0;
  const progressPercent = Number.isFinite(usageStats.progressPercent) ? usageStats.progressPercent : 0;
  const level = usageStats.level || 1;
  const nextLevelInDays = usageStats.nextLevelInDays || LEVEL_DAYS;

  return (
    <div className="min-h-[100dvh] bg-[var(--app-bg)] text-[color:var(--app-text)]">
      <div className="mx-auto w-full max-w-md px-3 sm:px-4 pb-24 pt-8">
        <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-[var(--app-surface-2)] ring-2 ring-emerald-400/50 p-0.5">
                <div className="h-full w-full overflow-hidden rounded-full bg-[var(--app-surface)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[color:var(--app-muted)]">
                      <User className="h-7 w-7" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-extrabold text-[color:var(--app-text)]">{user.name || 'ผู้ใช้งาน'}</div>
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

        <div className="mt-4 rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[color:var(--app-muted)]">สถิติการใช้งาน</div>           
          </div>
          <div className="mt-3 text-lg font-extrabold text-[color:var(--app-text)]">เป้าหมายการออม</div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-[color:var(--app-text)]">{streakDays} วันต่อเนื่อง</div>
              <div className="mt-0.5 text-xs font-semibold text-[color:var(--app-muted)]">
                {usageStats.loading
                  ? 'กำลังคำนวณสถิติ...'
                  : usageStats.error
                    ? 'โหลดสถิติไม่สำเร็จ'
                    : usageStats.loggedToday
                      ? 'วันนี้จดแล้ว เยี่ยมมาก'
                      : 'จดวันนี้เพื่อรักษาสถิติ'}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--app-muted)]">
              <span>สถิติการจดรายวันถัดไป</span>
              <span className="text-emerald-300">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-[var(--app-surface-2)] ring-1 ring-[color:var(--app-border)] overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
            </div>
            <div className="mt-2 text-xs font-semibold text-[color:var(--app-muted-2)]">เลเวลต่อไปใน {nextLevelInDays} วัน</div>
            {usageStatsUpdatedAt ? (
              <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                อัปเดตล่าสุด {new Date(usageStatsUpdatedAt).toLocaleString('th-TH')}
              </div>
            ) : null}
            {usageStats.error ? (
              <div className="mt-2 text-[11px] font-semibold text-rose-200/90">
                {usageStats.error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4 hover:bg-[var(--app-surface-3)] transition"
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
            { key: 'language', label: 'ภาษา', icon: Languages, right: language === 'en' ? 'English' : 'ไทย', action: () => openModal('language') },
            { key: 'categories', label: 'ตั้งค่าหมวด', icon: LayoutGrid, right: '', action: () => router.push('/budget') },
            { key: 'clearAll', label: 'ลบรายการทั้งหมด', icon: Trash2, right: '', action: () => openModal('clearAll') },
          ].map(({ key, label, icon: Icon, right, action }) => (
            <button
              key={key}
              type="button"
              onClick={action}
              className={[
                'w-full flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4 hover:bg-[var(--app-surface-3)] transition',
                key === 'clearAll' ? 'border-rose-400/25 bg-rose-500/10 hover:bg-rose-500/15' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-sm font-extrabold">{label}</div>
              </div>
              <div className="flex items-center gap-3">
                {right ? <div className="text-xs font-semibold text-[color:var(--app-muted)]">{right}</div> : null}
                <ChevronRight className="h-5 w-5 text-[color:var(--app-muted)]" />
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
          <div className="mt-5 text-center text-xs font-semibold text-[color:var(--app-muted-2)]">
            เวอร์ชัน 1.0.0 - สร้างด้วย ❤️ โดยทีม Balanz
          </div>
        </div>
      </div>

      {/* Modals for features */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal}></div>
	          <div className="bg-[var(--app-surface)] border border-[color:var(--app-border)] rounded-2xl shadow-2xl z-10 w-full max-w-md mx-auto p-5 max-h-[90vh] overflow-auto text-[color:var(--app-text)]">
	            <div className="flex items-start justify-between">
	              <h3 className="text-lg font-extrabold">
	                {activeModal === 'reminder'
	                  ? 'เตือนจดประจำวัน'
	                  : activeModal === 'autocat'
	                    ? 'จัดหมวดด้วยความจำ'
	                    : activeModal === 'language'
	                      ? 'ภาษา'
	                      : activeModal === 'clearAll'
	                        ? 'ลบรายการทั้งหมด'
	                        : 'ตั้งค่าหมวด'}
	              </h3>
	              <button onClick={closeModal} className="text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]">✕</button>
	            </div>
	            <div className="mt-4">
              {activeModal === 'reminder' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm font-semibold">เปิดการเตือนรายวัน</span>
                  </label>
                  <div>
                    <label className="text-xs text-[color:var(--app-muted)] font-semibold">เวลาเตือน</label>
                    <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="mt-1 w-full px-3 py-2 border border-[color:var(--app-border)] bg-[var(--app-surface-2)] rounded-xl text-[color:var(--app-text)]" />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={closeModal} className="px-4 py-2 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] font-semibold">ยกเลิก</button>
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
	                    <button onClick={closeModal} className="px-4 py-2 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] font-semibold">ยกเลิก</button>
	                    <button onClick={saveAutoCategorize} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-extrabold">บันทึก</button>
	                  </div>
	                </div>
	              )}

	              {activeModal === 'language' && (
	                <div className="space-y-3">
	                  <p className="text-xs font-semibold text-[color:var(--app-muted)]">
	                    ตั้งค่าภาษาสำหรับแอป (บันทึกไว้ในเครื่องนี้)
	                  </p>

	                  <div className="space-y-2">
	                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
	                      <input
	                        type="radio"
	                        name="balanz_lang"
	                        value="th"
	                        checked={language === 'th'}
	                        onChange={() => setLanguage('th')}
	                      />
	                      <div className="text-sm font-extrabold">ไทย</div>
	                    </label>

	                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
	                      <input
	                        type="radio"
	                        name="balanz_lang"
	                        value="en"
	                        checked={language === 'en'}
	                        onChange={() => setLanguage('en')}
	                      />
	                      <div className="text-sm font-extrabold">English</div>
	                    </label>
	                  </div>

	                  <div className="flex justify-end gap-2 mt-4">
	                    <button onClick={closeModal} className="px-4 py-2 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] font-semibold">ยกเลิก</button>
	                    <button onClick={saveLanguage} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-extrabold">บันทึก</button>
	                  </div>
	                </div>
	              )}

	              {activeModal === 'clearAll' && (
	                <div className="space-y-3">
	                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-rose-200 text-sm font-semibold">
	                    การลบนี้จะลบ “รายการทั้งหมด” ของคุณแบบถาวร และไม่สามารถกู้คืนได้
	                  </div>
	                  <div>
	                    <label className="text-xs font-semibold text-[color:var(--app-muted)]">พิมพ์คำว่า DELETE เพื่อยืนยัน</label>
	                    <input
	                      value={deleteConfirmText}
	                      onChange={(e) => setDeleteConfirmText(e.target.value)}
	                      className="mt-1 w-full h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-extrabold text-slate-100 shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
	                      placeholder="DELETE"
	                    />
	                  </div>
	                  <div className="flex justify-end gap-2 mt-4">
	                    <button onClick={closeModal} className="px-4 py-2 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] font-semibold">ยกเลิก</button>
	                    <button
	                      onClick={deleteAllTransactions}
	                      disabled={deleteAllLoading || deleteConfirmText !== 'DELETE'}
	                      className="px-4 py-2 bg-rose-500 text-white rounded-xl font-extrabold disabled:opacity-50"
	                    >
	                      {deleteAllLoading ? 'กำลังลบ...' : 'ลบทั้งหมด'}
	                    </button>
	                  </div>
	                </div>
	              )}

	              {activeModal === 'categories' && (
	                <div className="space-y-3">
	                  <p className="text-sm font-semibold text-slate-200">จัดการหมวดหมู่ของคุณ (เพิ่ม/แก้ไข/ลบ)</p>
	                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={closeModal} className="px-4 py-2 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] font-semibold">ปิด</button>
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
          <div className="bg-[var(--app-surface)] border border-[color:var(--app-border)] rounded-2xl shadow-2xl z-10 w-full max-w-md mx-auto p-5 max-h-[90vh] overflow-auto text-[color:var(--app-text)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">อันดับการจดต่อเนื่อง</h3>
              <button onClick={() => setRankingOpen(false)} className="text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]">✕</button>
            </div>

            <div className="mt-4">
              {!rankingLoading && rankingData.length >= 3 ? (
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
                      const grads = ['g1', 'g2', 'g3'];
                      const sorted = [...rankingData].sort((a, b) => b.days - a.days);
                      const maxDays = Math.max(1, ...sorted.map((r) => r.days || 0));
                      const orderForPositions = [sorted[2], sorted[0], sorted[1]].filter(Boolean);

                      return orderForPositions.map((r, i) => {
                        const h = Math.round(((r.days || 0) / maxDays) * maxBarHeight);
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
                            <text x={cx} y="134" fontSize="11" textAnchor="middle" fill="var(--app-muted)">{String(r.name || '').split(' ')[0]}</text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                </div>
              ) : null}

              {rankingLoading ? (
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm font-semibold text-[color:var(--app-muted)]">
                  กำลังโหลดอันดับ...
                </div>
              ) : rankingError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">
                  {rankingError}
                </div>
              ) : rankingData.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm font-semibold text-[color:var(--app-muted)]">
                  ยังไม่มีข้อมูลอันดับ
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {(() => {
                  const sorted = [...rankingData].sort((a, b) => b.days - a.days);
                  return sorted.map((u, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] mt-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-1 ${i === 0 ? 'bg-rose-500/15 text-rose-200 ring-rose-400/20' : i === 1 ? 'bg-sky-500/15 text-sky-200 ring-sky-400/20' : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20'} font-extrabold`}>{i + 1}</div>
                      <div className="flex-1">
                        <div className="text-sm font-extrabold text-[color:var(--app-text)]">{u.name}</div>
                        <div className="text-xs text-[color:var(--app-muted)] font-semibold mt-1">{u.days} วัน</div>
                      </div>
                      <div className="text-sm font-semibold text-[color:var(--app-muted)]">#{i + 1}</div>
                    </div>
                  ));
                })()}
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={() => setRankingOpen(false)} className="px-4 py-2 bg-[var(--app-surface-2)] border border-[color:var(--app-border)] text-[color:var(--app-text)] rounded-xl hover:bg-[var(--app-surface-3)] font-extrabold">ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmLogoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cancelLogout}></div>
          <div className="bg-[var(--app-surface)] border border-[color:var(--app-border)] rounded-2xl shadow-2xl z-10 w-full max-w-sm mx-auto p-5 text-[color:var(--app-text)]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-rose-500/10 text-rose-200 border border-rose-400/20">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-[color:var(--app-text)]">ออกจากระบบ</h3>
                <p className="text-sm text-[color:var(--app-muted)] mt-1 font-semibold">คุณจะถูกออกจากระบบและต้องเข้าสู่ระบบใหม่เพื่อใช้งานต่อ</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={cancelLogout} className="flex-1 px-4 py-2 bg-[var(--app-surface-2)] border border-[color:var(--app-border)] rounded-xl hover:bg-[var(--app-surface-3)] font-extrabold">ยกเลิก</button>
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
