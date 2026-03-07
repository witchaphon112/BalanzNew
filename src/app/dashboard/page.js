"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Utensils, ShoppingBag, Car, Home, Zap, Heart, Gamepad2, Stethoscope, GraduationCap, Plane, Briefcase, Gift, Smartphone, Coffee, Music, Dumbbell, PawPrint, Scissors, CreditCard, Landmark, MoreHorizontal, Plus, Settings, Trash2, X, ChevronLeft, ChevronRight, LayoutGrid, Book, Bus, Train, Truck, Bicycle, Apple, Banana, Beer, Cake, Camera, Film, Globe, MapPin, Sun, Moon, Star, Tree, Flower, Leaf, Cloud, Snowflake, Droplet, Flame, Key, Lock, Bell, AlarmClock, Wallet, PiggyBank, ShoppingCart, Shirt, Glasses, Watch, Tablet, Tv, Speaker, Headphones, Printer, Cpu, MousePointer, Pen, Pencil, Paintbrush, Ruler, Calculator, Clipboard, Paperclip, Archive, Box, Package, Rocket, Medal, Trophy, Award, Flag, Target, Lightbulb, Battery, Plug, Wifi, Bluetooth, Signal, TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon, Calendar, StickyNote, Mic, ScanLine } from 'lucide-react';

import Currency from '../currency/page';
import LoadingMascot from '@/components/LoadingMascot';
const CurrencyModalContent = ({ onClose }) => (
  <Currency onClose={onClose} />
);

// Brand tone (Blue product theme)
const PRIMARY_COLOR = '#2563EB'; // blue-600
const PRIMARY_COLOR_DARK = '#1D4ED8'; // blue-700
const INCOME_COLOR = '#22C55E'; // emerald-500
const EXPENSE_COLOR = '#F43F5E'; // rose-500
const NET_SAVING_COLOR = '#0F172A'; // slate-900
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const parseThaiMonthLabel = (label) => {
  if (!label || typeof label !== 'string') return null;
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const monthName = parts[0];
  const buddhistYear = Number(parts[1]);
  const monthIndex = MONTH_NAMES_TH.findIndex((m) => m === monthName);
  if (monthIndex < 0 || !Number.isFinite(buddhistYear)) return null;
  return { year: buddhistYear - 543, monthIndex };
};

const BANGKOK_TZ = 'Asia/Bangkok';

const getBangkokDateParts = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BANGKOK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const map = {};
    parts.forEach((p) => { if (p?.type) map[p.type] = p.value; });
    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return { year, monthIndex: month - 1, day };
  } catch {
    // Fallback: use local parts (may be inaccurate for users outside TH timezone)
    return { year: d.getFullYear(), monthIndex: d.getMonth(), day: d.getDate() };
  }
};

const toBangkokISODateKey = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  try {
    // en-CA yields YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: BANGKOK_TZ }).format(d);
  } catch {
    return toLocalISODateKey(d);
  }
};

const toLocalISODateKey = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ICON_MAP = {
  'food': Utensils, 'drink': Coffee, 'restaurant': Utensils,
  'shopping': ShoppingBag, 'gift': Gift, 'clothes': Scissors,
  'transport': Car, 'fuel': Zap, 'plane': Plane,
  'home': Home, 'bills': Zap, 'pet': PawPrint,
  'game': Gamepad2, 'music': Music, 'health': Stethoscope, 'sport': Dumbbell,
  'money': Landmark, 'salary': CreditCard, 'work': Briefcase,
  'education': GraduationCap, 'tech': Smartphone,
  'other': MoreHorizontal, 'love': Heart,
  'book': Book, 'bus': Bus, 'train': Train, 'truck': Truck, 'bicycle': Bicycle,
  'apple': Apple, 'banana': Banana, 'beer': Beer, 'cake': Cake, 'camera': Camera,
  'film': Film, 'globe': Globe, 'mappin': MapPin, 'sun': Sun, 'moon': Moon,
  'star': Star, 'tree': Tree, 'flower': Flower, 'leaf': Leaf, 'cloud': Cloud,
  'snowflake': Snowflake, 'water': Droplet, 'fire': Flame, 'key': Key, 'lock': Lock,
  'bell': Bell, 'alarmclock': AlarmClock, 'wallet': Wallet, 'piggybank': PiggyBank,
  'shoppingcart': ShoppingCart, 'shirt': Shirt, 'glasses': Glasses, 'watch': Watch,
  'tablet': Tablet, 'tv': Tv, 'speaker': Speaker, 'headphones': Headphones,
  'printer': Printer, 'cpu': Cpu, 'mousepointer': MousePointer, 'pen': Pen,
  'pencil': Pencil, 'paintbrush': Paintbrush, 'ruler': Ruler, 'calculator': Calculator,
  'clipboard': Clipboard, 'paperclip': Paperclip, 'archive': Archive, 'box': Box,
  'package': Package, 'truckdelivery': Truck, 'rocket': Rocket, 'medal': Medal,
  'trophy': Trophy, 'award': Award, 'flag': Flag, 'target': Target, 'lightbulb': Lightbulb,
  'battery': Battery, 'plug': Plug, 'wifi': Wifi, 'bluetooth': Bluetooth, 'signal': Signal,
};

const normalizeForMatch = (s) => {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"“”‘’\[\]\\|<>?]/g, '');
};

const AUTO_CATEGORY_RULES = [
  { key: 'food', preferIcons: ['food', 'restaurant'], patterns: ['อาหาร', 'ข้าว', 'ก๋วย', 'ร้าน', 'ชาบู', 'หมูกระทะ', 'pizza', 'kfc', 'mcd', 'burger', 'grabfood', 'foodpanda', 'lineman'] },
  { key: 'drink', preferIcons: ['drink', 'coffee'], patterns: ['กาแฟ', 'คาเฟ่', 'ชา', 'ชานม', 'starbucks', 'amazon', 'cafe'] },
  { key: 'shopping', preferIcons: ['shopping'], patterns: ['ช้อป', 'shopping', 'market', 'lotus', 'bigc', '7-11', 'เซเว่น', 'เซเว่นอีเลฟเว่น', 'tops', 'makro'] },
  { key: 'transport', preferIcons: ['transport', 'car'], patterns: ['รถ', 'bts', 'mrt', 'รถไฟ', 'แท็กซี่', 'taxi', 'grab', 'bolt', 'ทางด่วน', 'parking', 'จอดรถ'] },
  { key: 'fuel', preferIcons: ['fuel', 'zap'], patterns: ['น้ำมัน', 'เติมน้ำมัน', 'gas', 'ptt', 'shell', 'esso', 'บางจาก'] },
  { key: 'home', preferIcons: ['home'], patterns: ['ค่าเช่า', 'rent', 'บ้าน', 'คอนโด', 'หอ'] },
  { key: 'bills', preferIcons: ['bills', 'zap'], patterns: ['ค่าไฟ', 'ค่าน้ำ', 'internet', 'wifi', 'โทรศัพท์', 'ค่าเน็ต', 'bill', 'invoice'] },
  { key: 'health', preferIcons: ['health'], patterns: ['หมอ', 'โรงพยาบาล', 'ยา', 'pharmacy', 'clinic', 'ตรวจ'] },
  { key: 'pet', preferIcons: ['pet'], patterns: ['สัตว์', 'หมา', 'แมว', 'pet', 'อาหารแมว', 'อาหารหมา'] },
  { key: 'education', preferIcons: ['education'], patterns: ['เรียน', 'คอร์ส', 'course', 'tuition', 'หนังสือ'] },
  { key: 'work', preferIcons: ['work'], patterns: ['งาน', 'office', 'โปรเจค', 'project'] },
];

function renderIcon(iconKey) {
  const IconComp = ICON_MAP[iconKey];
  if (IconComp) return <IconComp className="w-7 h-7" />;
  return <span className="text-2xl">{iconKey || '-'}</span>;
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Store JWT token from query string to localStorage (for LINE login)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      const profilePic = url.searchParams.get('profilePic');
      if (token) {
        localStorage.setItem('token', token);
      }
      if (profilePic) {
        try {
          localStorage.setItem('profilePic', profilePic);
        } catch {
          // ignore
        }
      }
      if (token || profilePic) {
        // Remove token/profilePic from URL for security
        url.searchParams.delete('token');
        url.searchParams.delete('profilePic');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    }
  }, []);

  // NOTE: Keep the first render identical between server and client to avoid hydration mismatch.
  // Load localStorage values in an effect instead of the useState initializer.
  const [userProfile, setUserProfile] = useState({ name: '', profilePic: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setUserProfile({
        name: localStorage.getItem('user_name') || '',
        profilePic: localStorage.getItem('profilePic') || '',
      });
    } catch {
      // ignore
    }
  }, []);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => getBangkokDateParts(Date.now())?.year || new Date().getFullYear());
  const [readNotifMap, setReadNotifMap] = useState(() => ({}));
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    recentTransactions: [],
    recentIncome: [],
    recentExpense: [],
    todayExpenseTotal: 0,
    currentMonthIncomeTotal: 0,
    currentMonthExpenseTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [recentTxnType, setRecentTxnType] = useState('all'); // 'all' | 'expense' | 'income'
  const [showAddModal, setShowAddModal] = useState(false);
  const [addInlinePanel, setAddInlinePanel] = useState('none'); // 'none' | 'slip' | 'voice'
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState('');
  const [slipLoading, setSlipLoading] = useState(false);
  const [slipError, setSlipError] = useState('');
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState('');
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const voiceRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStartMsRef = useRef(0);
  const voiceAutoTranscribeRef = useRef(false);
  const slipInputRef = useRef(null);
	  const slipAutoReadKeyRef = useRef('');
	  const readSlipRef = useRef(null);
	  const [categories, setCategories] = useState([]);
	  const [categoryOrder, setCategoryOrder] = useState({ expense: [], income: [] }); // string[] by type (from Budget page reorder)
	  const [budgetsByMonth, setBudgetsByMonth] = useState({}); // { [monthLabel]: { [categoryId]: number } }
	  const [monthlyBudgetTotals, setMonthlyBudgetTotals] = useState({}); // { [monthLabel]: number }
	  const [budgetCategoryTypeById, setBudgetCategoryTypeById] = useState({}); // { [categoryId]: 'expense'|'income'|... }
  const [editFormData, setEditFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    date: '',
    notes: '',
  });
  const [autoCategorize, setAutoCategorize] = useState(false);
  const [addFormData, setAddFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    date: toBangkokISODateKey(Date.now()),
    notes: '',
  });
  const [autoCategoryApplied, setAutoCategoryApplied] = useState('');
  const autoCatTimerRef = useRef(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState('add'); // 'add' | 'edit'
	  const [datePickerMonth, setDatePickerMonth] = useState(() => {
	    const p = getBangkokDateParts(Date.now());
	    return { year: p?.year || new Date().getFullYear(), monthIndex: p?.monthIndex ?? new Date().getMonth() };
	  });

	  useEffect(() => {
	    if (typeof window === 'undefined') return;
	    try {
	      const expRaw = localStorage.getItem('budget_category_order_v1_expense');
	      const incRaw = localStorage.getItem('budget_category_order_v1_income');
	      const exp = expRaw ? JSON.parse(expRaw) : null;
	      const inc = incRaw ? JSON.parse(incRaw) : null;
	      setCategoryOrder({
	        expense: Array.isArray(exp) ? exp.map((x) => String(x)).filter(Boolean) : [],
	        income: Array.isArray(inc) ? inc.map((x) => String(x)).filter(Boolean) : [],
	      });
	    } catch {
	      // ignore
	    }
	  }, []);

	  const categoryOrderIndex = useMemo(() => {
	    const exp = new Map();
	    const inc = new Map();
	    (categoryOrder?.expense || []).forEach((id, idx) => exp.set(String(id), idx));
	    (categoryOrder?.income || []).forEach((id, idx) => inc.set(String(id), idx));
	    return { expense: exp, income: inc };
	  }, [categoryOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => {
      try {
        const raw = localStorage.getItem('autoCategorize');
        if (raw === null) {
          // Default ON for faster logging.
          setAutoCategorize(true);
          return;
        }
        setAutoCategorize(JSON.parse(raw) === true);
      } catch {
        setAutoCategorize(true);
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    if (!slipPreviewUrl) return;
    return () => {
      try { URL.revokeObjectURL(slipPreviewUrl); } catch {}
    };
  }, [slipPreviewUrl]);

  useEffect(() => {
    if (!voiceAudioUrl) return;
    return () => {
      try { URL.revokeObjectURL(voiceAudioUrl); } catch {}
    };
  }, [voiceAudioUrl]);

  useEffect(() => {
    if (!showVoiceModal) return;
    return () => {
      try {
        if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
          voiceRecorderRef.current.stop();
        }
      } catch {}
      try {
        if (voiceStreamRef.current) {
          voiceStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      } catch {}
      voiceRecorderRef.current = null;
      voiceStreamRef.current = null;
      voiceChunksRef.current = [];
      setVoiceRecording(false);
      setVoiceSeconds(0);
    };
  }, [showVoiceModal]);

  useEffect(() => {
    if (!voiceRecording) return;
    const tick = () => {
      const start = voiceStartMsRef.current || Date.now();
      setVoiceSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [voiceRecording]);

  const resetSlipState = () => {
    setSlipFile(null);
    setSlipError('');
    setSlipLoading(false);
    slipAutoReadKeyRef.current = '';
    setSlipPreviewUrl((prev) => {
      try { if (prev) URL.revokeObjectURL(prev); } catch {}
      return '';
    });
  };

  const cleanupVoiceDevices = () => {
    try {
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
        voiceRecorderRef.current.stop();
      }
    } catch {}
    try {
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    voiceRecorderRef.current = null;
    voiceStreamRef.current = null;
    voiceChunksRef.current = [];
    setVoiceRecording(false);
  };

  const resetVoiceState = () => {
    setVoiceError('');
    setVoiceLoading(false);
    setVoiceTranscript('');
    setVoiceBlob(null);
    setVoiceSeconds(0);
    voiceStartMsRef.current = 0;
    voiceAutoTranscribeRef.current = false;
    setVoiceAudioUrl((prev) => {
      try { if (prev) URL.revokeObjectURL(prev); } catch {}
      return '';
    });
    voiceChunksRef.current = [];
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddInlinePanel('none');
    setSlipError('');
    resetSlipState();
    cleanupVoiceDevices();
    resetVoiceState();
  };

  const toggleAutoCategorize = () => {
    setAutoCategorize((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('autoCategorize', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const suggestCategoryId = useMemo(() => (args) => {
    const { type, notes } = args || {};
    if (!type) return null;
    const noteRaw = String(notes || '').trim();
    if (!noteRaw) return null;
    const noteNorm = normalizeForMatch(noteRaw);
    if (!noteNorm) return null;

    const list = (categories || []).filter((c) => c?.type === type && c?._id);
    if (!list.length) return null;

    let best = null;
    for (const c of list) {
      const name = String(c?.name || '').trim();
      const icon = String(c?.icon || '').trim().toLowerCase();
      const nameNorm = normalizeForMatch(name);
      let score = 0;

      if (name && noteRaw.includes(name)) score += 10;
      if (nameNorm && noteNorm.includes(nameNorm)) score += 8;

      const tokens = nameNorm ? nameNorm.split(/[^a-z0-9\u0E00-\u0E7F]+/).filter(Boolean) : [];
      tokens.forEach((t) => {
        if (t.length >= 2 && noteNorm.includes(t)) score += 3;
      });

      for (const rule of AUTO_CATEGORY_RULES) {
        const matched = rule.patterns.some((p) => noteNorm.includes(normalizeForMatch(p)));
        if (!matched) continue;
        if (rule.preferIcons.includes(icon)) score += 4;
        else score += 1;
      }

      if (!best || score > best.score) best = { id: c._id, name, score };
    }

    if (!best || best.score < 4) return null;
    return best;
  }, [categories]);

  useEffect(() => {
    if (!showAddModal) {
      setAutoCategoryApplied('');
      return;
    }

    if (!categories?.length) return;

    if (!autoCategorize) return;
    if (addFormData.category) return;

    if (autoCatTimerRef.current) {
      try { clearTimeout(autoCatTimerRef.current); } catch {}
    }

    autoCatTimerRef.current = setTimeout(() => {
      const suggested = suggestCategoryId({ type: addFormData.type, notes: addFormData.notes });
      if (!suggested?.id) return;
      setAddFormData((prev) => (prev.category ? prev : { ...prev, category: suggested.id }));
      setAutoCategoryApplied(suggested.name || '');
    }, 220);

    return () => {
      if (autoCatTimerRef.current) {
        try { clearTimeout(autoCatTimerRef.current); } catch {}
        autoCatTimerRef.current = null;
      }
    };
  }, [showAddModal, autoCategorize, addFormData.type, addFormData.notes, addFormData.category, categories, suggestCategoryId]);

  const applySlipParsedToAddForm = (parsed) => {
    const p = parsed && typeof parsed === 'object' ? parsed : {};
    const direction = String(p.direction || '').toLowerCase();
    const mappedType = direction === 'in' ? 'income' : direction === 'out' ? 'expense' : '';
    const amount = Number(p.amount);
    const nextAmount = Number.isFinite(amount) && amount > 0 ? String(amount) : '';
    const nextDate = typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : '';
    const nextNotes = typeof p.notes === 'string' ? p.notes : '';

    setAddFormData((prev) => ({
      ...prev,
      type: mappedType || prev.type,
      amount: nextAmount || prev.amount,
      date: nextDate || prev.date,
      notes: nextNotes || prev.notes,
    }));
    setAutoCategoryApplied('');
  };

  const startVoiceRecording = async () => {
    if (voiceRecording) return;
    setVoiceError('');
    setVoiceTranscript('');
    setVoiceBlob(null);
    setVoiceAudioUrl('');
    setVoiceSeconds(0);
    voiceStartMsRef.current = Date.now();
    voiceAutoTranscribeRef.current = false;
    voiceChunksRef.current = [];

    if (typeof window === 'undefined') return;
    if (!navigator?.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError('เบราว์เซอร์นี้ยังไม่รองรับการอัดเสียง');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;

      const opts = {};
      try {
        if (window.MediaRecorder?.isTypeSupported?.('audio/webm;codecs=opus')) {
          opts.mimeType = 'audio/webm;codecs=opus';
        } else if (window.MediaRecorder?.isTypeSupported?.('audio/webm')) {
          opts.mimeType = 'audio/webm';
        }
      } catch {}

      const recorder = new MediaRecorder(stream, opts);
      voiceRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e?.data && e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        setVoiceError('เกิดข้อผิดพลาดในการอัดเสียง');
      };
      recorder.onstop = () => {
        try {
          const chunks = voiceChunksRef.current || [];
          if (!chunks.length) return;
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: mimeType });
          setVoiceBlob(blob);
          const url = URL.createObjectURL(blob);
          setVoiceAudioUrl(url);
          if (voiceAutoTranscribeRef.current) {
            voiceAutoTranscribeRef.current = false;
            // Auto-transcribe after stopping (1-tap flow).
            Promise.resolve()
              .then(() => transcribeVoice(blob))
              .catch(() => {});
          }
        } catch {}
      };

      recorder.start();
      setVoiceRecording(true);
    } catch (e) {
      setVoiceError(e?.message ? String(e.message) : 'ไม่สามารถเปิดไมโครโฟนได้');
      setVoiceRecording(false);
      try {
        if (voiceStreamRef.current) voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      voiceStreamRef.current = null;
      voiceRecorderRef.current = null;
      voiceChunksRef.current = [];
    }
  };

  const stopVoiceRecording = (opts) => {
    if (!voiceRecording) return;
    voiceAutoTranscribeRef.current = Boolean(opts?.autoTranscribe);
    setVoiceRecording(false);
    try {
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
        voiceRecorderRef.current.stop();
      }
    } catch {}
    try {
      if (voiceStreamRef.current) voiceStreamRef.current.getTracks().forEach((t) => t.stop());
    } catch {}
    voiceStreamRef.current = null;
  };

  const formatVoiceDuration = (sec) => {
    const s = Math.max(0, Number(sec) || 0);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const transcribeVoice = async (blobOverride) => {
    if (voiceLoading) return;
    const blob = blobOverride || voiceBlob;
    if (!blob) {
      setVoiceError('ยังไม่มีเสียงที่อัดไว้');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      setVoiceLoading(true);
      setVoiceError('');
      const fd = new FormData();
      fd.append('audio', blob, 'recording.webm');
      const res = await fetch(`${API_BASE}/api/ai/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'ถอดเสียงไม่สำเร็จ');
      }
      const text = String(data?.text || '').trim();
      setVoiceTranscript(text);
    } catch (e) {
      setVoiceError(e?.message ? String(e.message) : 'ถอดเสียงไม่สำเร็จ');
    } finally {
      setVoiceLoading(false);
    }
  };

  const parseISODateKey = (iso) => {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, monthIndex: month - 1, day };
  };

  const toISOFromParts = (year, monthIndex, day) => {
    const yyyy = String(year).padStart(4, '0');
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getBangkokWeekdayIndex = (year, monthIndex, day) => {
    try {
      const iso = toISOFromParts(year, monthIndex, day);
      const d = new Date(`${iso}T00:00:00+07:00`);
      const w = new Intl.DateTimeFormat('en-US', { timeZone: BANGKOK_TZ, weekday: 'short' }).format(d);
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return typeof map[w] === 'number' ? map[w] : d.getDay();
    } catch {
      const d = new Date(year, monthIndex, day);
      return d.getDay();
    }
  };

  const openDatePicker = (target = 'add') => {
    const nextTarget = target === 'edit' ? 'edit' : 'add';
    setDatePickerTarget(nextTarget);
    const activeISO = nextTarget === 'edit' ? editFormData?.date : addFormData?.date;
    const parsed = parseISODateKey(activeISO);
    if (parsed) setDatePickerMonth({ year: parsed.year, monthIndex: parsed.monthIndex });
    else {
      const p = getBangkokDateParts(Date.now());
      setDatePickerMonth({ year: p?.year || new Date().getFullYear(), monthIndex: p?.monthIndex ?? new Date().getMonth() });
    }
    setShowDatePicker(true);
  };

  const inferTxnTypeFromVoice = (text) => {
    const norm = normalizeForMatch(text);
    if (!norm) return '';

    const incomeHints = [
      'รายรับ', 'income', 'เงินเข้า', 'โอนเข้า', 'ได้รับ', 'ได้เงิน', 'เงินเดือน', 'salary', 'โบนัส', 'bonus',
    ];
    const expenseHints = [
      'รายจ่าย', 'expense', 'เงินออก', 'โอนออก', 'จ่าย', 'ซื้อ', 'ค่า', 'ชำระ', 'จ่ายบิล', 'bill', 'เติม',
    ];

    let inc = 0;
    let exp = 0;
    incomeHints.forEach((h) => { if (norm.includes(normalizeForMatch(h))) inc += 1; });
    expenseHints.forEach((h) => { if (norm.includes(normalizeForMatch(h))) exp += 1; });

    if (!inc && !exp) return '';
    if (inc > exp) return 'income';
    if (exp > inc) return 'expense';
    return '';
  };

  const extractAmountFromVoice = (text) => {
    const s = String(text || '');
    if (!s) return '';

    const candidates = [];
    const re = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
    for (const m of s.matchAll(re)) {
      const raw = String(m[0] || '');
      const idx = typeof m.index === 'number' ? m.index : -1;
      const before = idx >= 2 ? s.slice(Math.max(0, idx - 2), idx) : '';
      const after = idx >= 0 ? s.slice(idx + raw.length, idx + raw.length + 2) : '';

      // Skip numbers that look like they are part of a date/time token: "2026-03-07", "7/3", etc.
      if ((before.includes('-') || before.includes('/') || after.includes('-') || after.includes('/')) && raw.length <= 4) {
        continue;
      }

      const n = Number(raw.replace(/,/g, ''));
      if (!Number.isFinite(n) || n <= 0) continue;
      if (n > 1_000_000_000) continue;

      candidates.push({ n, raw: raw.replace(/,/g, '') });
    }

    if (!candidates.length) return '';
    // Prefer the largest plausible number (usually the amount, not a day number).
    candidates.sort((a, b) => b.n - a.n);
    return candidates[0].raw || '';
  };

  const categoryMatchesType = (categoryId, type) => {
    if (!categoryId || !type) return false;
    return (categories || []).some((c) => String(c?._id) === String(categoryId) && String(c?.type) === String(type));
  };

  const applyVoiceTranscriptToAddForm = () => {
    const text = String(voiceTranscript || '').trim();
    if (!text) return;

    const typeGuess = inferTxnTypeFromVoice(text);
    const amountGuess = extractAmountFromVoice(text);

    setAddFormData((prev) => {
      const prevAmount = String(prev?.amount || '').trim();
      const prevNotes = String(prev?.notes || '').trim();

      const nextType = typeGuess || prev.type || 'expense';

      let nextCategory = prev.category || '';
      if (nextCategory && !categoryMatchesType(nextCategory, nextType)) nextCategory = '';

      const suggested = suggestCategoryId({ type: nextType, notes: text });
      if (!nextCategory && suggested?.id) nextCategory = suggested.id;

      const nextNotes = !prevNotes
        ? text
        : prevNotes.includes(text)
          ? prevNotes
          : `${prevNotes}\n${text}`;

      return {
        ...prev,
        type: nextType,
        amount: prevAmount ? prev.amount : (amountGuess || prev.amount),
        category: nextCategory,
        notes: nextNotes,
      };
    });

    setShowVoiceModal(false);
    setAddInlinePanel('none');
    setShowAddModal(true);
  };

  const readSlip = async () => {
    if (slipLoading) return;
    if (!slipFile) {
      setSlipError('กรุณาเลือกรูปสลิปก่อน');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      setSlipLoading(true);
      setSlipError('');
      const fd = new FormData();
      fd.append('image', slipFile);

      const res = await fetch(`${API_BASE}/api/ai/slip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'อ่านสลิปไม่สำเร็จ');
      }
      applySlipParsedToAddForm(data?.parsed || {});
      setAddInlinePanel('none');
      resetSlipState();
    } catch (e) {
      setSlipError(e?.message ? String(e.message) : 'อ่านสลิปไม่สำเร็จ');
    } finally {
      setSlipLoading(false);
    }
  };

  readSlipRef.current = readSlip;

  useEffect(() => {
    const active = showAddModal && addInlinePanel === 'slip';
    if (!active) {
      slipAutoReadKeyRef.current = '';
      return;
    }
    if (slipLoading) return;
    if (!slipFile) return;
    const key = `${slipFile.name}_${slipFile.size}_${slipFile.lastModified}`;
    if (key === slipAutoReadKeyRef.current) return;
    slipAutoReadKeyRef.current = key;
    const id = setTimeout(() => {
      try {
        readSlipRef.current && readSlipRef.current();
      } catch {
        // ignore
      }
    }, 220);
    return () => clearTimeout(id);
  }, [showAddModal, addInlinePanel, slipFile, slipLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('dashboard_notif_read_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') setReadNotifMap(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('dashboard_notif_read_v1', JSON.stringify(readNotifMap || {}));
    } catch {
      // ignore
    }
  }, [readNotifMap]);

  useEffect(() => {
    if (!showNotifications) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowNotifications(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [showNotifications]);

  useEffect(() => {
    if (!showMonthPicker) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowMonthPicker(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [showMonthPicker]);

  /* --- Data & Logic Setup --- */
  const getMonths = () => {
    const currentDate = new Date();
    const nowParts = getBangkokDateParts(currentDate) || { year: currentDate.getFullYear(), monthIndex: currentDate.getMonth() };
    const currentYear = (nowParts.year || currentDate.getFullYear()) + 543; 
    const currentMonth = typeof nowParts.monthIndex === 'number' ? nowParts.monthIndex : currentDate.getMonth();
    const months = [];
    const span = 12;

    for (let i = -span; i <= span; i++) { 
      const monthIndex = (currentMonth + i) % 12;
      let yearOffset = Math.floor((currentMonth + i) / 12);
      if (monthIndex < 0) {
        yearOffset -= 1; 
      }
      const actualMonthIndex = (monthIndex + 12) % 12;
      const year = currentYear + yearOffset;
      months.push(`${MONTH_NAMES_TH[actualMonthIndex]} ${year}`);
    }
    return months;
  };

  const months = getMonths();
  const nowBkk = getBangkokDateParts(Date.now());
  const currentDate = new Date();
  const currentMonthYear = (() => {
    const p = nowBkk || getBangkokDateParts(currentDate) || { year: currentDate.getFullYear(), monthIndex: currentDate.getMonth() };
    return `${MONTH_NAMES_TH[p.monthIndex]} ${p.year + 543}`;
  })();
  
  const currentMonthInitialIndex = months.findIndex(m => m === currentMonthYear);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(currentMonthInitialIndex !== -1 ? currentMonthInitialIndex : Math.floor(months.length / 2));
  const selectedMonth = months[currentMonthIndex];

  const monthIndexMap = useMemo(() => {
    const map = new Map();
    months.forEach((label, idx) => {
      const p = parseThaiMonthLabel(label);
      if (!p) return;
      map.set(`${p.year}-${p.monthIndex}`, idx);
    });
    return map;
  }, [months]);

  const availableYears = useMemo(() => {
    const years = new Set();
    for (const key of monthIndexMap.keys()) {
      const y = Number(String(key).split('-')[0]);
      if (Number.isFinite(y)) years.add(y);
    }
    return Array.from(years.values()).sort((a, b) => b - a);
  }, [monthIndexMap]);

  const monthPickerMonthsForYear = useMemo(() => {
    const y = Number(monthPickerYear);
    const cells = MONTH_NAMES_TH.map((name, monthIndex) => {
      const idx = monthIndexMap.get(`${y}-${monthIndex}`);
      return { name, monthIndex, idx: typeof idx === 'number' ? idx : null };
    });
    return cells;
  }, [monthIndexMap, monthPickerYear]);

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error((await res.json()).message || 'Failed to fetch transactions');
      }     
      const transactions = await res.json();
      const allTransactions = Array.isArray(transactions) ? transactions : [];

      // Always compute "today spend" from ALL transactions (not only the selected month),
      // so the card stays correct even when viewing past/future months.
      const todayKey = toBangkokISODateKey(Date.now());
      const todayExpenseTotal = allTransactions
        .filter((t) => t?.type === 'expense' && toBangkokISODateKey(t?.date) === todayKey)
        .reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);

      // Also compute current-month totals from ALL transactions (for "ต่อวัน" targets).
      const nowParts = getBangkokDateParts(Date.now());
      const cmIncome = allTransactions
        .filter((t) => {
          if (t?.type !== 'income') return false;
          if (!nowParts) return false;
          const p = getBangkokDateParts(t?.date);
          return !!p && p.year === nowParts.year && p.monthIndex === nowParts.monthIndex;
        })
        .reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
      const cmExpense = allTransactions
        .filter((t) => {
          if (t?.type !== 'expense') return false;
          if (!nowParts) return false;
          const p = getBangkokDateParts(t?.date);
          return !!p && p.year === nowParts.year && p.monthIndex === nowParts.monthIndex;
        })
        .reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
      
      const selectedMonthName = selectedMonth.split(' ')[0];
      const selectedYear = selectedMonth.split(' ')[1];

      const filteredTransactions = allTransactions.filter(t => {
        const p = getBangkokDateParts(t?.date);
        if (!p) return false;
        const tMonthIndex = p.monthIndex;
        const tYearBuddhist = p.year + 543;
        return MONTH_NAMES_TH[tMonthIndex] === selectedMonthName && String(tYearBuddhist) === String(selectedYear);
      });

      const sortedRecentAll = [...allTransactions].sort((a, b) => {
        const ad = a?.date || a?.datetime || a?.createdAt || 0;
        const bd = b?.date || b?.datetime || b?.createdAt || 0;
        return new Date(bd) - new Date(ad);
      });
      const totalIncome = filteredTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = filteredTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
      setStats({
        totalIncome,
        totalExpenses,
        netSavings: totalIncome - totalExpenses,
        recentTransactions: sortedRecentAll.slice(0, 5),
        recentIncome: sortedRecentAll.filter((t) => t?.type === 'income').slice(0, 5),
        recentExpense: sortedRecentAll.filter((t) => t?.type === 'expense').slice(0, 5),
        transactionsAll: filteredTransactions,
        todayExpenseTotal,
        currentMonthIncomeTotal: Number(cmIncome) || 0,
        currentMonthExpenseTotal: Number(cmExpense) || 0,
      });
      setError('');
      
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (error.message || 'Error'));
      setStats({ totalIncome: 0, totalExpenses: 0, netSavings: 0, recentTransactions: [], recentIncome: [], recentExpense: [], todayExpenseTotal: 0, currentMonthIncomeTotal: 0, currentMonthExpenseTotal: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    let refreshTimer = null;
    let refreshInFlight = false;

    const safeJson = async (res) => {
      try {
        const text = await res.text();
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    const fetchBudgets = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [budgetRes, totalRes] = await Promise.all([
          fetch(`${API_BASE}/api/budgets`, { headers }),
          fetch(`${API_BASE}/api/budgets/total`, { headers }),
        ]);

        const buds = await safeJson(budgetRes);
        const totals = await safeJson(totalRes);

        if (budgetRes.ok && Array.isArray(buds)) {
          const map = {};
          const typeMap = {};
          buds.forEach((b) => {
            const month = b?.month;
            if (!month) return;
            if (!map[month]) map[month] = {};
            const catId = (b?.category && typeof b.category === 'object')
              ? (b.category?._id || '')
              : (b?.category || '');
            if (!catId) return;
            map[month][catId] = Number(b?.total ?? 0) || 0;
            if (b?.category && typeof b.category === 'object') {
              const t = b.category?.type;
              if (typeof t === 'string' && t) typeMap[catId] = t;
            }
          });
          setBudgetsByMonth(map);
          setBudgetCategoryTypeById(typeMap);
        }

        if (totalRes.ok && Array.isArray(totals)) {
          const tMap = {};
          totals.forEach((tb) => {
            const month = tb?.month;
            if (!month) return;
            tMap[month] = Number(tb?.total ?? 0) || 0;
          });
          setMonthlyBudgetTotals(tMap);
        }
      } catch (e) {
        // ignore budgets load errors (dashboard can still work)
      }
    };

    if (!token) {
        window.location.href = '/login';
        return;
    }

    const refreshAll = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      Promise.allSettled([fetchStats(), fetchCategories(), fetchBudgets()])
        .finally(() => { refreshInFlight = false; });
    };

    const scheduleRefresh = () => {
      try {
        if (refreshTimer) clearTimeout(refreshTimer);
      } catch {}
      refreshTimer = setTimeout(() => refreshAll(), 120);
    };

    refreshAll();

    const onFocus = () => scheduleRefresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    
    return () => {
      try {
        if (refreshTimer) clearTimeout(refreshTimer);
      } catch {}
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [selectedMonth]);

  // Fetch profile from backend (LINE user is linked to our User model)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) return;

    let cancelled = false;
    const loadMe = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // token expired/invalid
          if (res.status === 401) {
            try { localStorage.removeItem('token'); } catch {}
            if (!cancelled) window.location.href = '/login';
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const next = {
          name: data?.name || '',
          profilePic: data?.profilePic || (typeof window !== 'undefined' ? (localStorage.getItem('profilePic') || '') : ''),
        };
        setUserProfile(next);
        try {
          localStorage.setItem('user_name', next.name || '');
          if (next.profilePic) localStorage.setItem('profilePic', next.profilePic);
        } catch {
          // ignore
        }
      } catch (err) {
        // ignore profile load errors (dashboard can still work)
      }
    };

    loadMe();
    return () => { cancelled = true; };
  }, []);

  const handleView = (transaction) => {
    setViewingTransaction(transaction);
    setShowViewModal(true);
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setEditFormData({
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category?._id || '',
      date: new Date(transaction.date).toISOString().split('T')[0],
      notes: transaction.notes || '',
    });
    setShowEditModal(true);
  };

  const handleDelete = (transactionId) => {
    if (!transactionId) return;
    setDeletingTransactionId(transactionId);
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const transactionId = deletingTransactionId;
    if (!transactionId || deleteLoading) return;

    try {
      setDeleteLoading(true);
      setDeleteError('');

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || 'ลบรายการไม่สำเร็จ');
      }

      setShowDeleteModal(false);
      setDeletingTransactionId(null);
      fetchStats();
    } catch (err) {
      setDeleteError(err?.message ? String(err.message) : 'ลบรายการไม่สำเร็จ');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!editFormData.amount || parseFloat(editFormData.amount) <= 0) {
      setError('กรุณากรอกจำนวนเงินที่มากกว่า 0');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
      const res = await fetch(`${API_BASE}/api/transactions/${editingTransaction._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editFormData,
          amount: parseFloat(editFormData.amount),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาด');
      }

      setShowEditModal(false);
      setEditingTransaction(null);
      fetchStats();
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!addFormData.amount || parseFloat(addFormData.amount) <= 0) {
      setError('กรุณากรอกจำนวนเงินที่มากกว่า 0');
      return;
    }

    if (!addFormData.category) {
      setError('กรุณาเลือกหมวดหมู่');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...addFormData,
          amount: parseFloat(addFormData.amount),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาด');
      }

      setShowAddModal(false);
      setAddFormData({
        amount: '',
        type: 'expense',
        category: '',
        date: toBangkokISODateKey(Date.now()),
        notes: '',
      });
      fetchStats();
    } catch (error) {
      setError('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const formatCurrentDate = () => {
    const p = getBangkokDateParts(Date.now());
    if (!p) {
      const d = new Date();
      const m = MONTH_NAMES_TH[d.getMonth()];
      const day = d.getDate();
      const year = d.getFullYear() + 543;
      return `${m} ${day}, ${year}`;
    }
    const m = MONTH_NAMES_TH[p.monthIndex];
    return `${m} ${p.day}, ${p.year + 543}`;
  };

  const formatTHB = (value) => {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('th-TH');
    return `${n < 0 ? '-' : ''}฿${formatted}`;
  };

  const selectedParsed = useMemo(() => parseThaiMonthLabel(selectedMonth), [selectedMonth]);
  const monthExpenseBudgetTotal = useMemo(() => {
    const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
    const entries = Object.entries(monthBudgets || {});
    if (!entries.length) return 0;
    let sum = 0;
    for (const [categoryId, total] of entries) {
      const cat = (categories || []).find((c) => c?._id === categoryId);
      const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
      if (type && type !== 'expense') continue;
      sum += Number(total) || 0;
    }
    return Number(sum) || 0;
  }, [budgetsByMonth, selectedMonth, categories, budgetCategoryTypeById]);

  const currentMonthIncomeBudgetTotal = useMemo(() => {
    const monthBudgets = budgetsByMonth?.[currentMonthYear] || {};
    const entries = Object.entries(monthBudgets || {});
    if (!entries.length) return 0;
    let sum = 0;
    for (const [categoryId, total] of entries) {
      const cat = (categories || []).find((c) => c?._id === categoryId);
      const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
      if (type && type !== 'income') continue;
      sum += Number(total) || 0;
    }
    return Number(sum) || 0;
  }, [budgetsByMonth, currentMonthYear, categories, budgetCategoryTypeById]);

  const monthIncomeBudgetTotal = useMemo(() => {
    const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
    const entries = Object.entries(monthBudgets || {});
    if (!entries.length) return 0;
    let sum = 0;
    for (const [categoryId, total] of entries) {
      const cat = (categories || []).find((c) => c?._id === categoryId);
      const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
      if (type && type !== 'income') continue;
      sum += Number(total) || 0;
    }
    return Number(sum) || 0;
  }, [budgetsByMonth, selectedMonth, categories, budgetCategoryTypeById]);

  const monthIncomeTotal = useMemo(() => {
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    return src.filter((t) => t?.type === 'income').reduce((s, t) => s + (Number(t?.amount) || 0), 0);
  }, [stats.transactionsAll]);

  const monthExpenseTotal = useMemo(() => {
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    return src.filter((t) => t?.type === 'expense').reduce((s, t) => s + (Number(t?.amount) || 0), 0);
  }, [stats.transactionsAll]);

  const todaySpend = useMemo(() => Number(stats?.todayExpenseTotal) || 0, [stats?.todayExpenseTotal]);

  const daysInSelectedMonth = useMemo(() => {
    const parsed = selectedParsed;
    if (!parsed) return 30;
    const d = new Date(parsed.year, parsed.monthIndex + 1, 0);
    const n = d.getDate();
    return Number.isFinite(n) && n > 0 ? n : 30;
  }, [selectedParsed]);

  const daysInCurrentMonth = useMemo(() => {
    const p = nowBkk;
    if (!p) return 30;
    const d = new Date(p.year, p.monthIndex + 1, 0);
    const n = d.getDate();
    return Number.isFinite(n) && n > 0 ? n : 30;
  }, [nowBkk]);

  const daysUntilReset = useMemo(() => {
    const parsed = selectedParsed;
    if (!parsed) return 0;
    const nowParts = nowBkk;
    if (!nowParts || nowParts.year !== parsed.year || nowParts.monthIndex !== parsed.monthIndex) return 0;
    return Math.max(0, (Number(daysInSelectedMonth) || 0) - (Number(nowParts.day) || 0) + 1);
  }, [selectedParsed, nowBkk, daysInSelectedMonth]);

  const dailyTargetToday = useMemo(() => {
    const incomeActual = Number(stats?.currentMonthIncomeTotal) || 0;
    const incomeBudget = Number(currentMonthIncomeBudgetTotal) || 0;
    const base = incomeActual > 0 ? incomeActual : incomeBudget;
    if (base > 0) return base / Math.max(1, daysInCurrentMonth);
    return 0;
  }, [stats?.currentMonthIncomeTotal, currentMonthIncomeBudgetTotal, daysInCurrentMonth]);

  const monthRemaining = useMemo(() => {
    const incomeActual = Number(monthIncomeTotal) || 0;
    const expenseActual = Number(monthExpenseTotal) || 0;
    const incomeBudget = Number(monthIncomeBudgetTotal) || 0;
    const expenseBudget = Number(monthExpenseBudgetTotal) || 0;

    // Prefer actual income as the base for "remaining this month".
    // If the user has no income transactions yet, fall back to income budget (if any),
    // then to expense budget (classic budget mode).
    const base = incomeActual > 0 ? incomeActual : incomeBudget > 0 ? incomeBudget : expenseBudget;
    return base - expenseActual;
  }, [monthExpenseBudgetTotal, monthExpenseTotal, monthIncomeTotal, monthIncomeBudgetTotal]);

  const leakItems = useMemo(() => {
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    const map = new Map();
    for (const t of src) {
      if (!t || t.type !== 'expense') continue;
      const amt = Number(t.amount) || 0;
      if (amt <= 0) continue;
      const id = t.category?._id || t.category || '_none';
      const name = t.category?.name || 'ไม่ระบุ';
      const icon = t.category?.icon || 'other';
      const prev = map.get(id) || { id, name, icon, amount: 0 };
      prev.amount += amt;
      map.set(id, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [stats.transactionsAll]);

  const notifications = useMemo(() => {
    if (loading) return [];

    const income = Number(monthIncomeTotal) || 0;
    const expense = Math.max(0, Number(monthExpenseTotal) || 0);
    const budgetTotal = Number(monthExpenseBudgetTotal) || 0;
    const hasBudget = budgetTotal > 0;

    const parsed = selectedParsed;
    const nowParts = nowBkk;
    const isCurrentMonth = !!parsed && !!nowParts && nowParts.year === parsed.year && nowParts.monthIndex === parsed.monthIndex;
    const progress = isCurrentMonth ? Math.max(0.05, Math.min(1, (Number(nowParts?.day) || 1) / Math.max(1, daysInSelectedMonth))) : 1;
    const expectedSpendSoFar = hasBudget ? budgetTotal * progress : 0;

    const list = [];
    const push = (n) => { if (n && n.id) list.push(n); };

    if (hasBudget && expense > budgetTotal) {
      push({
        id: `budget_over_${selectedMonth}`,
        tone: 'rose',
        icon: TrendingDownIcon,
        title: 'ใช้จ่ายเกินงบเดือนนี้แล้ว',
        body: `ใช้งบไป ${Math.round((expense / Math.max(1, budgetTotal)) * 100)}% • เกิน ${formatTHB(expense - budgetTotal)}`,
        href: '/budget',
        cta: 'ไปหน้างบประมาณ',
      });
    } else if (hasBudget && expense / Math.max(1, budgetTotal) >= 0.85) {
      push({
        id: `budget_near_${selectedMonth}`,
        tone: 'amber',
        icon: Target,
        title: 'ใกล้ถึงงบประมาณเดือนนี้',
        body: `ใช้งบไป ${Math.round((expense / Math.max(1, budgetTotal)) * 100)}% • เหลือ ${formatTHB(Math.max(0, budgetTotal - expense))}`,
        href: '/budget',
        cta: 'ดูงบประมาณ',
      });
    }

    // Category-level budget alerts (expense categories only)
    if (hasBudget) {
      const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
      const entries = Object.entries(monthBudgets || {});
      if (entries.length) {
        const spentByCategory = new Map();
        const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
        for (const t of src) {
          if (!t || t.type !== 'expense') continue;
          const id = t.category?._id || t.category || '';
          if (!id) continue;
          spentByCategory.set(id, (spentByCategory.get(id) || 0) + (Number(t.amount) || 0));
        }

        const overList = [];
        for (const [categoryId, rawBudget] of entries) {
          const budget = Number(rawBudget) || 0;
          if (budget <= 0) continue;
          const cat = (categories || []).find((c) => c?._id === categoryId) || null;
          const type = String(cat?.type || budgetCategoryTypeById?.[categoryId] || '').toLowerCase();
          if (type && type !== 'expense') continue;
          const spent = Math.max(0, Number(spentByCategory.get(categoryId) || 0));
          if (spent <= budget) continue;
          overList.push({
            categoryId,
            name: cat?.name || 'หมวดหมู่',
            spent,
            budget,
            over: spent - budget,
            pct: budget > 0 ? spent / budget : 0,
          });
        }

        overList
          .sort((a, b) => (b.over - a.over) || (b.pct - a.pct))
          .slice(0, 2)
          .forEach((r) => {
            push({
              id: `cat_budget_over_${selectedMonth}_${r.categoryId}`,
              tone: 'rose',
              icon: Target,
              title: `เกินงบหมวด “${r.name}”`,
              body: `ใช้ไป ${formatTHB(r.spent)} จากงบ ${formatTHB(r.budget)} • เกิน ${formatTHB(r.over)}`,
              href: '/budget',
              cta: 'ดูงบหมวดนี้',
            });
          });
      }
    }

    if (hasBudget && isCurrentMonth && expectedSpendSoFar > 0 && expense / expectedSpendSoFar >= 1.15) {
      push({
        id: `budget_pace_${selectedMonth}`,
        tone: 'amber',
        icon: Zap,
        title: 'ใช้จ่ายเร็วกว่าแผน',
        body: `ควรใช้ราว ${formatTHB(expectedSpendSoFar)} แต่ตอนนี้ใช้ไป ${formatTHB(expense)}`,
        href: '/analytics',
        cta: 'ดูสถิติรายจ่าย',
      });
    }

    if (income <= 0 && expense > 0) {
      push({
        id: `no_income_${selectedMonth}`,
        tone: 'rose',
        icon: Wallet,
        title: 'เดือนนี้ยังไม่มีรายรับ',
        body: `แต่มีรายจ่าย ${formatTHB(expense)} ลองบันทึกรายรับเพื่อให้วิเคราะห์แม่นขึ้น`,
        href: '/transactions',
        cta: 'ไปหน้ารายการ',
      });
    }

    if (isCurrentMonth && dailyTargetToday > 0 && todaySpend > dailyTargetToday * 1.25) {
      push({
        id: `daily_over_${selectedMonth}`,
        tone: 'amber',
        icon: TrendingDownIcon,
        title: 'วันนี้ใช้เกินเป้าที่ตั้งไว้',
        body: `ใช้ไป ${formatTHB(todaySpend)} จากเป้า ${formatTHB(dailyTargetToday)}`,
        href: '/transactions',
        cta: 'ดูรายการวันนี้',
      });
    }

    if (Array.isArray(leakItems) && leakItems[0] && expense > 0) {
      const top = leakItems[0];
      const pct = top.amount / Math.max(1, expense);
      if (pct >= 0.35) {
        push({
          id: `leak_top_${selectedMonth}`,
          tone: 'sky',
          icon: TrendingDownIcon,
          title: 'หมวดนี้ใช้เยอะเป็นพิเศษ',
          body: `${top.name} คิดเป็น ${Math.round(pct * 100)}% ของรายจ่ายเดือนนี้`,
          href: '/analytics',
          cta: 'ดูสัดส่วนรายจ่าย',
        });
      }
    }

    if (isCurrentMonth && daysUntilReset > 0 && daysUntilReset <= 3 && hasBudget) {
      push({
        id: `reset_soon_${selectedMonth}`,
        tone: 'sky',
        icon: AlarmClock,
        title: 'งบประมาณใกล้รีเซ็ต',
        body: `เหลืออีก ${daysUntilReset} วัน งบเดือนนี้จะรีเซ็ต`,
        href: '/budget',
        cta: 'ตรวจงบเดือนนี้',
      });
    }

    if (list.length === 0) {
      push({
        id: `all_good_${selectedMonth}`,
        tone: 'emerald',
        icon: TrendingUpIcon,
        title: 'ทุกอย่างดูโอเค',
        body: 'ยังไม่พบสิ่งที่ควรแจ้งเตือนในตอนนี้',
        href: '/analytics',
        cta: 'ดูสรุปการเงิน',
      });
    }

    return list;
  }, [
    loading,
    monthIncomeTotal,
    monthExpenseTotal,
    monthExpenseBudgetTotal,
    budgetsByMonth,
    categories,
    budgetCategoryTypeById,
    stats.transactionsAll,
    selectedParsed,
    daysInSelectedMonth,
    daysUntilReset,
    todaySpend,
    dailyTargetToday,
    leakItems,
    selectedMonth,
    nowBkk,
  ]);

  const unreadNotifCount = useMemo(() => {
    const read = readNotifMap || {};
    return (notifications || []).reduce((acc, n) => acc + (read?.[n.id] ? 0 : 1), 0);
  }, [notifications, readNotifMap]);

  const markNotifRead = (id) => {
    if (!id) return;
    setReadNotifMap((prev) => {
      const curr = prev && typeof prev === 'object' ? prev : {};
      if (curr[id]) return curr;
      return { ...curr, [id]: Date.now() };
    });
  };

  const markAllNotifsRead = () => {
    setReadNotifMap((prev) => {
      const curr = prev && typeof prev === 'object' ? prev : {};
      const next = { ...curr };
      (notifications || []).forEach((n) => {
        if (n?.id && !next[n.id]) next[n.id] = Date.now();
      });
      return next;
    });
  };

  const notifToneUI = (tone) => {
    if (tone === 'rose') return { iconBg: 'bg-rose-500/15 text-rose-200 ring-rose-400/20', border: 'border-rose-400/15' };
    if (tone === 'amber') return { iconBg: 'bg-amber-500/15 text-amber-200 ring-amber-400/20', border: 'border-amber-400/15' };
    if (tone === 'sky') return { iconBg: 'bg-sky-500/15 text-sky-200 ring-sky-400/20', border: 'border-sky-400/15' };
    return { iconBg: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20', border: 'border-emerald-400/15' };
  };

	  const budgetRowsExpense = useMemo(() => {
	    const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
	    const entries = Object.entries(monthBudgets || {});
	    if (!entries.length) return [];

    const spentByCategory = new Map();
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    for (const t of src) {
      if (!t || t.type !== 'expense') continue;
      const id = t.category?._id || t.category || '';
      if (!id) continue;
      spentByCategory.set(id, (spentByCategory.get(id) || 0) + (Number(t.amount) || 0));
    }

	    const colors = ['#FB7185', '#FACC15', '#38BDF8']; // rose, amber, sky
	    const rows = entries
	      .map(([categoryId, total]) => {
	        const cat = (categories || []).find((c) => c?._id === categoryId);
	        const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
	        if (type && type !== 'expense') return null;
	        const budget = Number(total) || 0;
	        const spent = Math.max(0, Number(spentByCategory.get(categoryId) || 0));
	        return {
	          id: categoryId,
	          name: cat?.name || 'หมวดหมู่',
	          icon: cat?.icon || 'other',
	          spent,
	          budget,
	          pct: budget > 0 ? Math.max(0, Math.min(1, spent / budget)) : 0,
	        };
	      })
	      .filter(Boolean)
	      .filter((r) => r.budget > 0);

	    const idxMap = categoryOrderIndex.expense;
	    const sorted = [...rows].sort((a, b) => {
	      const ia = idxMap.has(String(a.id)) ? idxMap.get(String(a.id)) : Number.POSITIVE_INFINITY;
	      const ib = idxMap.has(String(b.id)) ? idxMap.get(String(b.id)) : Number.POSITIVE_INFINITY;
	      if (ia !== ib) return ia - ib;
	      return (Number(b.pct) || 0) - (Number(a.pct) || 0);
	    });

	    return sorted.map((r, idx) => ({ ...r, color: colors[idx % colors.length] }));
	  }, [budgetsByMonth, selectedMonth, stats.transactionsAll, categories, budgetCategoryTypeById, categoryOrderIndex]);

	  const budgetRowsIncome = useMemo(() => {
	    const monthBudgets = budgetsByMonth?.[selectedMonth] || {};
	    const entries = Object.entries(monthBudgets || {});
	    if (!entries.length) return [];

    const receivedByCategory = new Map();
    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
    for (const t of src) {
      if (!t || t.type !== 'income') continue;
      const id = t.category?._id || t.category || '';
      if (!id) continue;
      receivedByCategory.set(id, (receivedByCategory.get(id) || 0) + (Number(t.amount) || 0));
    }

	    const colors = ['#34D399', '#38BDF8', '#A78BFA']; // emerald, sky, violet
	    const rows = entries
	      .map(([categoryId, total]) => {
	        const cat = (categories || []).find((c) => c?._id === categoryId);
	        const type = (cat?.type || budgetCategoryTypeById?.[categoryId] || '').toString();
	        if (type && type !== 'income') return null;
	        const budget = Number(total) || 0;
	        const received = Math.max(0, Number(receivedByCategory.get(categoryId) || 0));
	        const pctRaw = budget > 0 ? received / budget : 0;
	        const pctClamped = Math.max(0, Math.min(1, pctRaw));
	        const alpha = 0.25 + 0.75 * pctClamped; // keep visible even when pct is low
	        return {
	          id: categoryId,
	          name: cat?.name || 'หมวดหมู่',
	          icon: cat?.icon || 'other',
	          received,
	          budget,
	          pct: pctClamped,
	          alpha,
	        };
	      })
	      .filter(Boolean)
	      .filter((r) => r.budget > 0);

	    const idxMap = categoryOrderIndex.income;
	    const sorted = [...rows].sort((a, b) => {
	      const ia = idxMap.has(String(a.id)) ? idxMap.get(String(a.id)) : Number.POSITIVE_INFINITY;
	      const ib = idxMap.has(String(b.id)) ? idxMap.get(String(b.id)) : Number.POSITIVE_INFINITY;
	      if (ia !== ib) return ia - ib;
	      return (Number(b.pct) || 0) - (Number(a.pct) || 0);
	    });

	    return sorted.map((r, idx) => ({ ...r, color: colors[idx % colors.length] }));
	  }, [budgetsByMonth, selectedMonth, stats.transactionsAll, categories, budgetCategoryTypeById, categoryOrderIndex]);

  const budgetCardType = recentTxnType === 'income' ? 'income' : 'expense';
  const budgetRows = budgetCardType === 'income' ? budgetRowsIncome : budgetRowsExpense;

	  const incomeMonthCategoryRows = useMemo(() => {
	    const src = Array.isArray(stats.transactionsAll) ? stats.transactionsAll : [];
	    const map = new Map();
    for (const t of src) {
      if (!t || t.type !== 'income') continue;
      const id = t.category?._id || t.category || '_none';
      const amt = Number(t.amount) || 0;
      if (amt <= 0) continue;
      const prev = map.get(id) || {
        id,
        name: t.category?.name || 'ไม่ระบุ',
        icon: t.category?.icon || 'other',
        received: 0,
        txCount: 0,
      };
      prev.received += amt;
      prev.txCount += 1;
      map.set(id, prev);
    }

	    const colors = ['#34D399', '#38BDF8', '#A78BFA', '#FACC15', '#FB7185', '#60A5FA'];
	    const idxMap = categoryOrderIndex.income;
	    const list = Array.from(map.values()).sort((a, b) => {
	      const ia = idxMap.has(String(a.id)) ? idxMap.get(String(a.id)) : Number.POSITIVE_INFINITY;
	      const ib = idxMap.has(String(b.id)) ? idxMap.get(String(b.id)) : Number.POSITIVE_INFINITY;
	      if (ia !== ib) return ia - ib;
	      return (Number(b.received) || 0) - (Number(a.received) || 0);
	    });
	    const maxReceived = Math.max(1, ...list.map((r) => Number(r?.received) || 0));
	    return list.map((r, idx) => {
	      const pct01 = Math.max(0, Math.min(1, (Number(r?.received) || 0) / maxReceived));
	      const alpha = 0.25 + 0.75 * pct01;
	      return { ...r, color: colors[idx % colors.length], alpha };
	    });
	  }, [stats.transactionsAll, categoryOrderIndex]);

  const showIncomeRowsWithoutTarget =
    budgetCardType === 'income' &&
    (budgetRowsIncome?.length || 0) === 0 &&
    (incomeMonthCategoryRows?.length || 0) > 0;

  const budgetCardTitle =
    budgetCardType === 'income'
      ? (showIncomeRowsWithoutTarget ? 'รายรับตามหมวดหมู่' : 'เป้ารายรับตามหมวดหมู่')
      : 'งบประมาณ';

  const recentTransactionsFiltered = useMemo(() => {
    if (recentTxnType === 'income') return Array.isArray(stats?.recentIncome) ? stats.recentIncome : [];
    if (recentTxnType === 'expense') return Array.isArray(stats?.recentExpense) ? stats.recentExpense : [];
    return Array.isArray(stats?.recentTransactions) ? stats.recentTransactions : [];
  }, [stats?.recentTransactions, stats?.recentIncome, stats?.recentExpense, recentTxnType]);

  /* --- JSX Rendering --- */

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[color:var(--app-text)]">
      <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+88px)] space-y-4 lg:max-w-6xl lg:px-6 lg:space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-[var(--app-surface)] shadow-sm shadow-black/10 border border-[color:var(--app-border)] flex items-center justify-center shrink-0">
              {userProfile.profilePic ? (
                <img
                  src={userProfile.profilePic}
                  alt={userProfile.name || 'Profile'}
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/25 flex items-center justify-center font-extrabold">
                  {(userProfile.name || 'B').trim().slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[color:var(--app-muted)] truncate">Welcome back</div>
              <div className="text-lg font-extrabold text-[color:var(--app-text)] truncate">{userProfile.name || 'Balanz'}</div>
              <div className="text-[11px] font-semibold text-[color:var(--app-muted-2)]">{formatCurrentDate()}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            

            <button
              type="button"
              onClick={() => setShowNotifications(true)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-surface)] shadow-sm shadow-black/10 border border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition"
              aria-label="การแจ้งเตือน"
              title="การแจ้งเตือน"
            >
              {unreadNotifCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-[color:var(--app-bg)]"
                  aria-label={`มีการแจ้งเตือนใหม่ ${unreadNotifCount} รายการ`}
                >
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-2 shadow-sm shadow-black/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonthIndex((p) => Math.max(0, p - 1))}
                disabled={currentMonthIndex === 0}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const p = parseThaiMonthLabel(selectedMonth);
                  setMonthPickerYear(p?.year || new Date().getFullYear());
                  setShowMonthPicker(true);
                }}
                className="min-w-0 flex-1 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2 text-center hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                aria-label="เปิดปฏิทินเลือกเดือน"
              >
                <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">เดือนที่เลือก</div>
                <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">{selectedMonth}</div>
              </button>

              <button
                type="button"
                onClick={() => setCurrentMonthIndex((p) => Math.min(months.length - 1, p + 1))}
                disabled={currentMonthIndex === months.length - 1}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Currency Modal */}
        {showCurrencyModal && (
          <CurrencyModalContent onClose={() => setShowCurrencyModal(false)} />
        )}

        {/* Month Picker Modal */}
        {showMonthPicker && (
          <div
            className="fixed inset-0 z-[75] bg-slate-950/45 backdrop-blur-sm flex items-start justify-center p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+88px)]"
            onClick={(e) => e.target === e.currentTarget && setShowMonthPicker(false)}
          >
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-5 py-4">
                <div>
                  <div className="text-sm font-extrabold text-[color:var(--app-text)]">เลือกเดือน</div>
                  <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">แตะเพื่อดูสรุปของเดือนนั้น</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMonthPicker(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableYears.indexOf(monthPickerYear);
                      const next = idx >= 0 ? availableYears[idx + 1] : null;
                      if (typeof next === 'number') setMonthPickerYear(next);
                    }}
                    disabled={availableYears.indexOf(monthPickerYear) >= availableYears.length - 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                    aria-label="ปีก่อนหน้า"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="min-w-0 flex-1 text-center">
                    <div className="text-sm font-extrabold text-[color:var(--app-text)]">
                      {Number(monthPickerYear) + 543}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">พ.ศ.</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableYears.indexOf(monthPickerYear);
                      const prev = idx > 0 ? availableYears[idx - 1] : null;
                      if (typeof prev === 'number') setMonthPickerYear(prev);
                    }}
                    disabled={availableYears.indexOf(monthPickerYear) <= 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                    aria-label="ปีถัดไป"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {monthPickerMonthsForYear.map((m) => {
                    const isActive = typeof m.idx === 'number' && m.idx === currentMonthIndex;
                    const disabled = m.idx == null;
                    return (
                      <button
                        key={`${monthPickerYear}-${m.monthIndex}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (typeof m.idx === 'number') setCurrentMonthIndex(m.idx);
                          setShowMonthPicker(false);
                        }}
                        className={[
                          'h-11 rounded-2xl border px-3 text-sm font-extrabold transition',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
                          disabled
                            ? 'border-white/10 bg-white/5 text-[color:var(--app-muted-2)] opacity-50 cursor-not-allowed'
                            : isActive
                              ? 'border-emerald-400/30 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                              : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
                        ].join(' ')}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const idx = currentMonthInitialIndex !== -1 ? currentMonthInitialIndex : currentMonthIndex;
                    setCurrentMonthIndex(idx);
                    setShowMonthPicker(false);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-slate-100 hover:bg-white/10"
                >
                  เดือนนี้
                </button>
                <button
                  type="button"
                  onClick={() => setShowMonthPicker(false)}
                  className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Modal */}
        {showNotifications && (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm flex items-start justify-center p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+88px)]"
            onClick={(e) => e.target === e.currentTarget && setShowNotifications(false)}
          >
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-[color:var(--app-text)]">การแจ้งเตือน</div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      {unreadNotifCount > 0 ? `ยังไม่อ่าน ${unreadNotifCount} รายการ` : 'ไม่มีรายการที่ยังไม่อ่าน'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[62dvh] overflow-y-auto p-4 space-y-3">
                {notifications.map((n) => {
                  const read = !!readNotifMap?.[n.id];
                  const Icon = n.icon || Bell;
                  const ui = notifToneUI(n.tone);
                  const row = (
                    <div
                      className={[
                        'rounded-3xl border bg-white/0 p-4 transition',
                        'hover:bg-white/5',
                        ui.border,
                        read ? 'opacity-80' : 'opacity-100',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={[
                            'h-11 w-11 rounded-2xl shrink-0 ring-1 flex items-center justify-center',
                            ui.iconBg,
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">{n.title}</div>
                              <div className="mt-1 text-xs font-semibold text-slate-400">{n.body}</div>
                            </div>
                            {!read && <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />}
                          </div>

                          {n.cta && (
                            <div className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-emerald-200">
                              {n.cta}
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  if (n.href) {
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => {
                          markNotifRead(n.id);
                          setShowNotifications(false);
                        }}
                        className="block focus:outline-none focus:ring-2 focus:ring-emerald-400/30 rounded-3xl"
                      >
                        {row}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markNotifRead(n.id)}
                      className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-emerald-400/30 rounded-3xl"
                    >
                      {row}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => { markAllNotifsRead(); }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-slate-100 hover:bg-white/10"
                >
                  อ่านแล้วทั้งหมด
                </button>
                <Link
                  href="/transactions"
                  onClick={() => setShowNotifications(false)}
                  className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
                >
                  ไปหน้ารายการ
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-200 shadow-sm">
            <svg className="w-5 h-5 text-rose-200 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <p className="text-rose-200 font-semibold text-sm">{error}</p>
          </div>
        )}

        {/* Desktop layout: split into 2 columns; mobile stays stacked */}
        <div className="space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
          <div className="space-y-4 lg:col-span-5">
            {/* Income / Expense quick filter (tap to filter list + budgets) */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              {(() => {
                const expense = Math.max(0, Number(monthExpenseTotal) || 0);
                const expenseBudget = Math.max(0, Number(monthExpenseBudgetTotal) || 0);
                const expHasTarget = expenseBudget > 0;
                const expPct = expHasTarget ? Math.round((expense / expenseBudget) * 100) : null;
                const expPctClamped = expHasTarget ? Math.max(0, Math.min(100, (expense / expenseBudget) * 100)) : 0;
                const expDiff = expenseBudget - expense;
                const expActive = recentTxnType === 'expense';

                const income = Math.max(0, Number(monthIncomeTotal) || 0);
                const incomeTarget = Math.max(0, Number(monthIncomeBudgetTotal) || 0);
                const incHasTarget = incomeTarget > 0;
                const incPct = incHasTarget ? Math.round((income / incomeTarget) * 100) : null;
                const incPctClamped = incHasTarget ? Math.max(0, Math.min(100, (income / incomeTarget) * 100)) : 0;
                const incDiff = incomeTarget - income;
                const incActive = recentTxnType === 'income';
                const incVisualPct = incHasTarget ? incPctClamped : (income > 0 ? 100 : 8);
                const incVisualPctClamped = Math.max(1, Math.min(100, Number(incVisualPct) || 0));

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setRecentTxnType((p) => (p === 'expense' ? 'all' : 'expense'))}
                      className={[
                        'rounded-3xl border p-4 text-left shadow-sm shadow-black/10 transition focus:outline-none focus:ring-2',
                        expActive
                          ? 'border-rose-400/30 bg-rose-500/10 focus:ring-rose-400/25'
                          : 'border-[color:var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-3)] focus:ring-emerald-400/20',
                      ].join(' ')}
                      aria-pressed={expActive}
                    >
                      <div className="text-xs font-semibold text-[color:var(--app-muted)]">รายจ่าย</div>
                      <div className="mt-1 text-xl font-extrabold text-rose-300">{formatTHB(expense)}</div>
                      {expHasTarget ? (
                        <>
                          <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                            {expDiff >= 0 ? `เหลือ ${formatTHB(expDiff)} จากงบ` : `เกิน ${formatTHB(Math.abs(expDiff))} จากงบ`} • {expPct}%
                          </div>
                          <div className="mt-2 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-rose-400" style={{ width: `${expPctClamped}%` }} />
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-muted-2)]">แตะเพื่อดูเฉพาะรายจ่าย</div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecentTxnType((p) => (p === 'income' ? 'all' : 'income'))}
                      className={[
                        'rounded-3xl border p-4 text-left shadow-sm shadow-black/10 transition focus:outline-none focus:ring-2',
                        incActive
                          ? 'border-emerald-400/30 bg-emerald-500/10 focus:ring-emerald-400/25'
                          : 'border-[color:var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-3)] focus:ring-emerald-400/20',
                      ].join(' ')}
                      aria-pressed={incActive}
                    >
                      <div className="text-xs font-semibold text-[color:var(--app-muted)]">รายรับ</div>
                      <div className="mt-1 text-xl font-extrabold text-emerald-300">{formatTHB(income)}</div>
                      <div className="mt-1 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                        {incHasTarget
                          ? (incDiff >= 0 ? `เหลือ ${formatTHB(incDiff)} จากเป้า` : `เกิน ${formatTHB(Math.abs(incDiff))} จากเป้า`)
                          : 'แตะเพื่อดูเฉพาะรายรับ'}
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${incVisualPctClamped}%` }} />
                      </div>
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Budget */}
            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm shadow-black/10">
              <div className="flex items-center justify-between">
                <div className="text-lg font-extrabold text-[color:var(--app-text)]">{budgetCardTitle}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-semibold text-[color:var(--app-muted-2)]">รีเซ็ตใน {daysUntilReset} วัน</div>
                  {budgetRows.length > 5 && (
                    <Link href="/budget" className="text-xs font-extrabold text-sky-300 hover:text-sky-200">
                      ดูทั้งหมด
                    </Link>
                  )}
                </div>
              </div>

              {/* Summary grid (match reference UI) */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/10">
                  <div className="text-xs font-semibold text-slate-400">ใช้ไปวันนี้</div>
                  <div className="mt-1 flex items-end gap-2">
                    <div className="text-2xl font-extrabold text-[color:var(--app-text)]">{formatTHB(todaySpend)}</div>
                    <div className="pb-1 text-sm font-semibold text-[color:var(--app-muted-2)]">
                      {dailyTargetToday > 0 ? `ใช้ได้ต่อวัน ${formatTHB(dailyTargetToday)}` : 'ยังไม่มีรายรับเดือนนี้'}
                    </div>
                  </div>
                  <div className="mt-3 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${dailyTargetToday > 0 ? Math.max(0, Math.min(100, (todaySpend / dailyTargetToday) * 100)) : 0}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/10">
                  <div className="text-xs font-semibold text-slate-400">คงเหลือเดือนนี้</div>
                  <div className={`mt-1 text-3xl font-extrabold ${monthRemaining < 0 ? 'text-rose-300' : 'text-[color:var(--app-text)]'}`}>
                    {loading ? '—' : formatTHB(monthRemaining)}
                  </div>
                </div>
              </div>

              {showIncomeRowsWithoutTarget ? (
                <div className="mt-4 space-y-4">
                  {incomeMonthCategoryRows.slice(0, 5).map((r) => (
                    <div key={r.id}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center shrink-0">
                            <div className="scale-90">{renderIcon(r.icon)}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                              <div className="text-sm font-extrabold text-[color:var(--app-text)] truncate">{r.name}</div>
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                              รับแล้ว {formatTHB(r.received)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-extrabold text-emerald-300">{formatTHB(r.received)}</div>
                        </div>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: r.color, opacity: r.alpha }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : budgetRows.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {budgetRows.slice(0, 5).map((r) => (
                    <div key={r.id}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center shrink-0">
                            <div className="scale-90">{renderIcon(r.icon)}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                              <div className="text-sm font-extrabold text-[color:var(--app-text)] truncate">{r.name}</div>
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                              {budgetCardType === 'income'
                                ? `เป้า ${formatTHB(r.budget)} • ได้แล้ว ${formatTHB(r.received)}`
                                : `งบ ${formatTHB(r.budget)} • ใช้ไป ${formatTHB(r.spent)}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-extrabold text-slate-100">
                            {budgetCardType === 'income' ? '' : `${Math.round(r.pct * 100)}%`}
                          </div>
                          <div className="text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                            {budgetCardType === 'income'
                              ? `เหลือ ${formatTHB(Math.max(0, r.budget - r.received))} จากเป้า`
                              : `เหลือ ${formatTHB(Math.max(0, r.budget - r.spent))}`}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-black/25 ring-1 ring-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: budgetCardType === 'income' ? '100%' : `${Math.round(r.pct * 100)}%`,
                            backgroundColor: r.color,
                            opacity: budgetCardType === 'income' ? (r.alpha ?? 1) : 1,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Recent Transactions Section */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 rounded-full bg-emerald-400" />
                <h2 className="text-lg sm:text-xl font-extrabold text-[color:var(--app-text)]">ธุรกรรมล่าสุด</h2>
              </div>
              <Link href="/transactions" className="text-sm font-extrabold text-emerald-300 hover:text-emerald-200">
                ดูทั้งหมด
              </Link>
            </div>

            <div className="mt-3 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm shadow-black/10">
              {loading ? (
                <div className="text-center py-10">
                  <LoadingMascot label="กำลังโหลด..." size={72} />
                </div>
              ) : recentTransactionsFiltered.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="w-16 h-16 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <p className="text-slate-200 text-sm font-extrabold">ยังไม่มีธุรกรรม</p>
                  <p className="text-slate-400 text-xs mt-1 font-semibold">ลองเพิ่มรายการใหม่ แล้วกลับมาดูอีกครั้ง</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTransactionsFiltered.map((txn, index) => (
                    <div
                      key={txn._id}
                      onClick={() => handleView(txn)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleView(txn);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="group w-full cursor-pointer rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-3)] p-4 text-left shadow-sm shadow-black/10 hover:bg-[var(--app-surface-3)] hover:shadow-md transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={[
                              'h-11 w-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0',
                              txn.type === 'income'
                                ? 'bg-gradient-to-br from-emerald-500 to-green-500'
                                : 'bg-gradient-to-br from-rose-500 to-rose-600',
                            ].join(' ')}
                            aria-hidden="true"
                          >
                            {renderIcon(txn.category?.icon)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold text-[color:var(--app-text)]">
                                  {txn.category?.name || 'หมวดหมู่ไม่ระบุ'}
                                </div>
                                <div className="mt-1 truncate text-xs font-semibold text-slate-400">
                                  {txn.notes || '—'}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-[11px] font-semibold text-[color:var(--app-muted-2)]">
                              {new Date(txn.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-sm font-extrabold" style={{ color: txn.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }}>
                            {txn.type === 'expense' ? '-' : '+'}{txn.amount.toLocaleString()} ฿
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEdit(txn); }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 shadow-sm shadow-black/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                              title="แก้ไข"
                              aria-label="แก้ไข"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDelete(txn._id); }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 shadow-sm shadow-black/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-rose-400/25"
                              title="ลบ"
                              aria-label="ลบ"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      
    
      {/* Floating Add Button */}
      <button
        type="button"
        onClick={() => {
          setSlipError('');
          setVoiceError('');
          setError('');
          resetSlipState();
          resetVoiceState();
          setAutoCategoryApplied('');
          setAddInlinePanel('none');
          setAddFormData({
            amount: '',
            type: 'expense',
            category: '',
            date: toBangkokISODateKey(Date.now()),
            notes: '',
          });
          setShowAddModal(true);
          setShowDatePicker(false);
        }}
	        className={[
            'fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-[60] inline-flex h-14 w-14 items-center justify-center rounded-3xl',
            'bg-emerald-500 text-slate-950',
            'border border-[color:var(--app-border)] ring-1 ring-emerald-400/25',
            'shadow-2xl shadow-black/20 hover:brightness-95',
            'focus:outline-none focus:ring-2 focus:ring-emerald-400/40',
            'lg:right-8',
          ].join(' ')}
        aria-label="เพิ่มรายการ"
        title="เพิ่มรายการ"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Voice Modal */}
      {mounted && showVoiceModal && createPortal((
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom)] sm:pb-0"
          onClick={(e) => e.target === e.currentTarget && !voiceRecording && !voiceLoading && setShowVoiceModal(false)}
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/40 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-5 py-4">
              <div>
                <div className="text-sm font-extrabold text-[color:var(--app-text)]">อัดเสียง</div>
                <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">กดเริ่มอัด → กดหยุด ระบบจะถอดให้เลย</div>
              </div>
              <button
                type="button"
                onClick={() => { if (!voiceRecording && !voiceLoading) setShowVoiceModal(false); }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-50"
                aria-label="ปิด"
                disabled={voiceRecording || voiceLoading}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {voiceError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                  {voiceError}
                </div>
              ) : null}

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[color:var(--app-muted)]">สถานะ</div>
                    <div className="mt-1 text-sm font-extrabold text-[color:var(--app-text)]">
                      {voiceRecording ? 'กำลังอัดเสียง...' : voiceBlob ? 'อัดเสียงแล้ว' : 'พร้อมอัดเสียง'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-[color:var(--app-muted)]">เวลา</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-100 tabular-nums">
                      {formatVoiceDuration(voiceSeconds)}
                    </div>
                  </div>
                </div>
                {voiceLoading ? (
                  <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-muted)]">
                    <span className="inline-flex h-4 w-4 rounded-full border-2 border-white/20 border-t-violet-300 animate-spin" aria-hidden="true" />
                    กำลังถอดข้อความ...
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (voiceLoading) return;
                  if (voiceRecording) stopVoiceRecording({ autoTranscribe: true });
                  else startVoiceRecording();
                }}
                disabled={voiceLoading}
                className={[
                  'h-14 w-full rounded-3xl font-extrabold transition flex items-center justify-center gap-3',
                  voiceRecording
                    ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25 hover:bg-rose-500/20'
                    : 'bg-emerald-500 text-slate-950 hover:brightness-95',
                  voiceLoading ? 'opacity-70 cursor-wait' : '',
                ].join(' ')}
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
                {voiceRecording ? 'หยุด (ถอดให้อัตโนมัติ)' : 'เริ่มอัดเสียง'}
              </button>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-[color:var(--app-muted)]">ข้อความที่ถอดได้</div>
                <div className="mt-2 text-sm font-semibold text-[color:var(--app-text)] whitespace-pre-wrap break-words">
                  {voiceTranscript ? voiceTranscript : '—'}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/5 p-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => { if (!voiceRecording && !voiceLoading) setShowVoiceModal(false); }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                disabled={voiceRecording || voiceLoading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={applyVoiceTranscriptToAddForm}
                disabled={!String(voiceTranscript || '').trim() || voiceRecording || voiceLoading}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-slate-950 hover:brightness-95 disabled:opacity-60"
              >
                ใช้กรอกอัตโนมัติ
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Add Transaction Modal */}
      {mounted && showAddModal && createPortal((
        <div
          className="fixed inset-0 z-[10005] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:pb-0"
          onClick={(e) => e.target === e.currentTarget && closeAddModal()}
        >
	          <form
	            onSubmit={handleAddSubmit}
	            className="w-full sm:max-w-md max-h-[92dvh] flex flex-col bg-[var(--app-surface)] text-[color:var(--app-text)] rounded-t-[32px] sm:rounded-[32px] border border-[color:var(--app-border)] shadow-2xl shadow-black/20 overflow-hidden"
	            onClick={(e) => e.stopPropagation()}
	          >
	            <div className="relative px-5 pt-5 pb-4 sm:pt-6 sm:pb-5">
	              <button
	                type="button"
	                onClick={() => closeAddModal()}
	                className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
	                aria-label="ปิด"
	              >
	                <X className="h-5 w-5" aria-hidden="true" />
	              </button>
	              <div className="text-center text-base font-extrabold tracking-wide">เพิ่มรายการ</div>
	            </div>

              <>
                  <div className="px-5">
                    <div className="grid grid-cols-2 rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAutoCategoryApplied('');
                          setAddFormData((prev) => ({
                            ...prev,
                            type: 'expense',
                            category: prev.category && (categories || []).some((c) => c?._id === prev.category && c?.type === 'expense')
                              ? prev.category
                              : '',
                          }));
                        }}
                        className={[
                          'h-11 rounded-full text-sm font-extrabold transition',
                          addFormData.type === 'expense'
                            ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/20'
                            : 'text-[color:var(--app-muted)] hover:bg-[var(--app-surface-3)]',
                        ].join(' ')}
                      >
                        รายจ่าย
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAutoCategoryApplied('');
                          setAddFormData((prev) => ({
                            ...prev,
                            type: 'income',
                            category: prev.category && (categories || []).some((c) => c?._id === prev.category && c?.type === 'income')
                              ? prev.category
                              : '',
                          }));
                        }}
                        className={[
                          'h-11 rounded-full text-sm font-extrabold transition',
                          addFormData.type === 'income'
                            ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/20'
                            : 'text-[color:var(--app-muted)] hover:bg-[var(--app-surface-3)]',
                        ].join(' ')}
                      >
                        รายรับ
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch] px-5 pt-6 pb-5 space-y-5">
                    <div className="text-center">
                      <div className="text-xs font-semibold text-[color:var(--app-muted)]">จำนวนเงิน</div>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <div className="text-emerald-300 text-2xl font-extrabold">฿</div>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={addFormData.amount}
                          onChange={(e) => setAddFormData((prev) => ({ ...prev, amount: e.target.value }))}
                          placeholder="0.00"
                          className="w-[240px] bg-transparent text-center text-6xl font-extrabold tracking-tight text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-muted-2)]"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSlipError('');
                          resetSlipState();
                          setAddInlinePanel('voice');
                          resetVoiceState();
                          cleanupVoiceDevices();
                          startVoiceRecording();
                        }}
                        className="h-14 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] font-extrabold flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                      >
                        <Mic className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                        อัดเสียง
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVoiceError('');
                          resetVoiceState();
                          cleanupVoiceDevices();
                          setAddInlinePanel('slip');
                          resetSlipState();
                          try { slipInputRef.current && slipInputRef.current.click(); } catch {}
                        }}
                        className="h-14 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] font-extrabold flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                      >
                        <ScanLine className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                        สแกนใบเสร็จ
                      </button>
                    </div>

                    <input
                      ref={slipInputRef}
                      id="add-slip-upload-input-inline"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setSlipFile(f);
                        setSlipError('');
                        if (slipPreviewUrl) {
                          try { URL.revokeObjectURL(slipPreviewUrl); } catch {}
                        }
                        if (f) {
                          const url = URL.createObjectURL(f);
                          setSlipPreviewUrl(url);
                          setAddInlinePanel('slip');
                        } else {
                          setSlipPreviewUrl('');
                        }
                      }}
                      disabled={slipLoading}
                    />

                    {addInlinePanel === 'voice' ? (
                      <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-[color:var(--app-text)]">อัดเสียง</div>
                            <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">
                              กดเริ่มอัด → กดหยุด ระบบจะถอดให้เลย
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (voiceRecording || voiceLoading) return;
                              cleanupVoiceDevices();
                              resetVoiceState();
                              setAddInlinePanel('none');
                            }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-50"
                            aria-label="ปิด"
                            title="ปิด"
                            disabled={voiceRecording || voiceLoading}
                          >
                            <X className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>

                        {voiceError ? (
                          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                            {voiceError}
                          </div>
                        ) : null}

                        <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[color:var(--app-muted)]">สถานะ</div>
                              <div className="mt-1 text-sm font-extrabold text-[color:var(--app-text)]">
                                {voiceRecording ? 'กำลังอัดเสียง...' : voiceBlob ? 'อัดเสียงแล้ว' : 'พร้อมอัดเสียง'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-semibold text-[color:var(--app-muted)]">เวลา</div>
                              <div className="mt-1 text-sm font-extrabold tabular-nums text-[color:var(--app-text)]">
                                {formatVoiceDuration(voiceSeconds)}
                              </div>
                            </div>
                          </div>
                          {voiceLoading ? (
                            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-muted)]">
                              <span className="inline-flex h-4 w-4 rounded-full border-2 border-[color:var(--app-border)] border-t-violet-400 animate-spin" aria-hidden="true" />
                              กำลังถอดข้อความ...
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (voiceLoading) return;
                            if (voiceRecording) stopVoiceRecording({ autoTranscribe: true });
                            else startVoiceRecording();
                          }}
                          disabled={voiceLoading}
                          className={[
                            'h-12 w-full rounded-2xl font-extrabold transition flex items-center justify-center gap-3',
                            voiceRecording
                              ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25 hover:bg-rose-500/20'
                              : 'bg-emerald-500 text-slate-950 hover:brightness-95',
                            voiceLoading ? 'opacity-70 cursor-wait' : '',
                          ].join(' ')}
                        >
                          <Mic className="h-5 w-5" aria-hidden="true" />
                          {voiceRecording ? 'หยุด (ถอดให้อัตโนมัติ)' : 'เริ่มอัดเสียง'}
                        </button>

                        <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4">
                          <div className="text-xs font-semibold text-[color:var(--app-muted)]">ข้อความที่ถอดได้</div>
                          <div className="mt-2 text-sm font-semibold text-[color:var(--app-text)] whitespace-pre-wrap break-words">
                            {voiceTranscript ? voiceTranscript : '—'}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (voiceRecording || voiceLoading) return;
                              cleanupVoiceDevices();
                              resetVoiceState();
                              setAddInlinePanel('none');
                            }}
                            className="h-12 flex-1 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-extrabold text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-60"
                            disabled={voiceRecording || voiceLoading}
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              applyVoiceTranscriptToAddForm();
                              setAddInlinePanel('none');
                            }}
                            disabled={!String(voiceTranscript || '').trim() || voiceRecording || voiceLoading}
                            className="h-12 flex-1 rounded-2xl bg-emerald-500 px-4 text-sm font-extrabold text-slate-950 hover:brightness-95 disabled:opacity-60"
                          >
                            ใช้กรอกอัตโนมัติ
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {addInlinePanel === 'slip' ? (
                      <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-[color:var(--app-text)]">อ่านสลิป</div>
                            <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">
                              เลือกรูปแล้วระบบจะอ่านให้อัตโนมัติ
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (slipLoading) return;
                              resetSlipState();
                              setAddInlinePanel('none');
                            }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-50"
                            aria-label="ปิด"
                            title="ปิด"
                            disabled={slipLoading}
                          >
                            <X className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>

                        {slipError ? (
                          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                            {slipError}
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => { try { slipInputRef.current && slipInputRef.current.click(); } catch {} }}
                          disabled={slipLoading}
                          className={[
                            'block w-full rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] overflow-hidden text-left',
                            'hover:bg-[var(--app-surface-3)] transition',
                            slipLoading ? 'opacity-80 cursor-wait' : '',
                          ].join(' ')}
                        >
                          {slipPreviewUrl ? (
                            <div className="relative">
                              <img
                                src={slipPreviewUrl}
                                alt="slip preview"
                                className="w-full max-h-[40vh] object-contain bg-black/10"
                              />
                              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                                <div className="text-xs font-extrabold text-white">แตะเพื่อเปลี่ยนรูป</div>
                                <div className="mt-0.5 text-[11px] font-semibold text-white/70">ให้ยอดเงินและวันที่เห็นชัด</div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">
                                  <Camera className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-extrabold text-[color:var(--app-text)]">ถ่ายรูป/อัปโหลดสลิป</div>
                                  <div className="mt-0.5 text-xs font-semibold text-[color:var(--app-muted)]">รองรับสลิป/ใบเสร็จ (≤ 10MB)</div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-[color:var(--app-muted)]" aria-hidden="true" />
                              </div>
                            </div>
                          )}
                        </button>

                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-extrabold text-[color:var(--app-text)]">
                              {slipLoading ? 'กำลังอ่าน...' : slipFile ? 'พร้อมอ่านอัตโนมัติ' : 'รอเลือกรูป'}
                            </div>
                            {slipLoading ? (
                              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-muted)]">
                                <span className="inline-flex h-4 w-4 rounded-full border-2 border-[color:var(--app-border)] border-t-emerald-400 animate-spin" aria-hidden="true" />
                                โปรดรอสักครู่
                              </div>
                            ) : null}
                          </div>
                          {!slipLoading && slipError && slipFile ? (
                            <div className="mt-2 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={readSlip}
                                className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95"
                              >
                                ลองอ่านอีกครั้ง
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <div className="text-sm font-extrabold text-[color:var(--app-text)]">หมวดหมู่</div>
                      <div className="mt-4 grid grid-cols-4 gap-4">
                        {(() => {
                          const list = (categories || []).filter((c) => c?.type === addFormData.type);
                          const top = list.slice(0, 8);
                          const selectedId = addFormData.category;
                          if (selectedId && !top.some((c) => String(c?._id) === String(selectedId))) {
                            const picked = list.find((c) => String(c?._id) === String(selectedId));
                            if (picked) return [picked, ...top.slice(0, 7)];
                          }
                          return top;
                        })().map((c) => {
                          const selected = addFormData.category === c._id;
                          return (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => {
                                setAutoCategoryApplied('');
                                setAddFormData((prev) => ({ ...prev, category: c._id }));
                              }}
                              className="flex flex-col items-center gap-2"
                              aria-pressed={selected}
                            >
                              <div
                                className={[
                                  'h-14 w-14 rounded-full flex items-center justify-center ring-1 transition',
                                  selected
                                    ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30 shadow-sm shadow-emerald-500/10'
                                    : 'bg-[var(--app-surface-2)] text-[color:var(--app-text)] ring-[color:var(--app-border)] hover:bg-[var(--app-surface-3)]',
                                ].join(' ')}
                                aria-hidden="true"
                              >
                                <div className="scale-90">{renderIcon(c.icon || 'other')}</div>
                              </div>
                              <div className="text-[11px] font-semibold text-[color:var(--app-muted)] truncate max-w-[76px]">{c.name}</div>
                            </button>
                          );
                        })}
                      </div>
                      {!addFormData.category ? (
                        <div className="mt-3 text-[11px] font-semibold text-[color:var(--app-muted-2)]">* เลือกหมวดหมู่ก่อนบันทึก</div>
                      ) : null}
                    </div>

                    <div className="relative rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-4 hover:bg-[var(--app-surface-3)] transition">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[color:var(--app-muted-2)]" aria-hidden="true" />
                      <div className="pl-8">
                        <div className="text-sm font-extrabold text-[color:var(--app-text)]">
                          {(() => {
                            const iso = String(addFormData.date || '');
                            const today = toBangkokISODateKey(Date.now());
                            const label = (() => {
                              try {
                                const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
                                return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                              } catch {
                                return iso || '-';
                              }
                            })();
                            return iso === today ? `วันนี้, ${label}` : label;
                          })()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openDatePicker('add')}
                        className="absolute inset-0"
                        aria-label="เปิดตัวเลือกวันที่"
                      />
                    </div>

                    <div className="relative rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-4 py-4 hover:bg-[var(--app-surface-3)] transition">
                      <StickyNote className="absolute left-4 top-4 h-5 w-5 text-[color:var(--app-muted-2)]" aria-hidden="true" />
                      <div className="pl-8">
                        <textarea
                          value={addFormData.notes}
                          onChange={(e) => setAddFormData((prev) => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                          placeholder="ระบุรายละเอียด..."
                          className="w-full bg-transparent text-sm font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-muted-2)] resize-none"
                        />
                      </div>
                    </div>

                    {error ? (
                      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                        {error}
                      </div>
                    ) : null}
                  </div>

                  <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-2 border-t border-[color:var(--app-border)] bg-[var(--app-surface)]">
                    <button
                      type="submit"
                      className="h-14 w-full rounded-full bg-emerald-500 text-slate-950 font-extrabold text-base shadow-lg shadow-emerald-500/15 hover:brightness-95 disabled:opacity-60"
                      disabled={!addFormData.category}
                    >
                      บันทึกรายการ
                    </button>
                  </div>
              </>
          </form>
        </div>
      ), document.body)}

      {/* Date Picker Modal (custom calendar) */}
      {mounted && showDatePicker && createPortal((
        <div
          className="fixed inset-0 z-[10006] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:pb-0"
          onClick={(e) => e.target === e.currentTarget && setShowDatePicker(false)}
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl shadow-black/20 overflow-hidden text-[color:var(--app-text)]">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-5 py-4">
              <div>
                <div className="text-sm font-extrabold">
                  เลือกวันที่{datePickerTarget === 'edit' ? ' (แก้ไขรายการ)' : ''}
                </div>
                <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">บันทึกย้อนหลัง/ล่วงหน้าได้ (สูงสุด 1 ปี)</div>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {(() => {
              const FUTURE_DAYS_LIMIT = 365;
              const todayKey = toBangkokISODateKey(Date.now());
              const maxKey = toBangkokISODateKey(Date.now() + FUTURE_DAYS_LIMIT * 86400000);
              const todayParsed = parseISODateKey(todayKey) || { year: new Date().getFullYear(), monthIndex: new Date().getMonth(), day: new Date().getDate() };
              const maxParsed = parseISODateKey(maxKey) || todayParsed;
              const activeISO = datePickerTarget === 'edit' ? editFormData?.date : addFormData?.date;
              const selectedParsed = parseISODateKey(activeISO) || todayParsed;
              const { year, monthIndex } = datePickerMonth || todayParsed;

              const firstWeekday = getBangkokWeekdayIndex(year, monthIndex, 1); // 0=Sun
              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
              const canGoNext = year < maxParsed.year || (year === maxParsed.year && monthIndex < maxParsed.monthIndex);

              const monthLabel = `${MONTH_NAMES_TH[monthIndex] || ''} ${year + 543}`;
              const weekdayTH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

              const isBeyondMax = (d) => {
                const iso = toISOFromParts(year, monthIndex, d);
                return iso > maxKey;
              };

              const selectDay = (d) => {
                if (isBeyondMax(d)) return;
                const iso = toISOFromParts(year, monthIndex, d);
                if (datePickerTarget === 'edit') setEditFormData((prev) => ({ ...prev, date: iso }));
                else setAddFormData((prev) => ({ ...prev, date: iso }));
                setShowDatePicker(false);
              };

              const goPrev = () => {
                const m = monthIndex - 1;
                if (m >= 0) setDatePickerMonth({ year, monthIndex: m });
                else setDatePickerMonth({ year: year - 1, monthIndex: 11 });
              };

              const goNext = () => {
                if (!canGoNext) return;
                const m = monthIndex + 1;
                if (m <= 11) setDatePickerMonth({ year, monthIndex: m });
                else setDatePickerMonth({ year: year + 1, monthIndex: 0 });
              };

              const cells = [];
              for (let i = 0; i < firstWeekday; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(null);

              return (
                <>
                  <div className="px-5 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
                        aria-label="เดือนก่อนหน้า"
                      >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>

                      <div className="min-w-0 flex-1 text-center">
                        <div className="text-sm font-extrabold">{monthLabel}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted)]">แตะวันที่เพื่อเลือก</div>
                      </div>

                      <button
                        type="button"
                        onClick={goNext}
                        disabled={!canGoNext}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] disabled:opacity-40"
                        aria-label="เดือนถัดไป"
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-1.5">
                      {weekdayTH.map((w) => (
                        <div key={w} className="text-center text-[11px] font-extrabold text-[color:var(--app-muted-2)]">
                          {w}
                        </div>
                      ))}

                      {cells.map((d, idx) => {
                        if (!d) return <div key={`e-${idx}`} className="h-10" />;
                        const iso = toISOFromParts(year, monthIndex, d);
                        const selected = iso === String(addFormData?.date || '');
                        const today = iso === todayKey;
                        const disabled = iso > maxKey;
                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => selectDay(d)}
                            disabled={disabled}
                            className={[
                              'h-10 rounded-2xl text-sm font-extrabold transition',
                              'focus:outline-none focus:ring-2 focus:ring-emerald-400/30',
                              disabled
                                ? 'bg-transparent text-[color:var(--app-muted-2)] opacity-50 cursor-not-allowed'
                                : selected
                                  ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
                                  : today
                                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/20'
                                    : 'bg-[var(--app-surface-2)] text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] hover:bg-[var(--app-surface-3)]',
                            ].join(' ')}
                            aria-pressed={selected}
                            aria-label={`เลือกวันที่ ${d}`}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (datePickerTarget === 'edit') setEditFormData((prev) => ({ ...prev, date: todayKey }));
                        else setAddFormData((prev) => ({ ...prev, date: todayKey }));
                        setShowDatePicker(false);
                      }}
                      className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-xs font-extrabold text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)]"
                    >
                      วันนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(false)}
                      className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-95 shadow-sm shadow-emerald-500/15"
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ), document.body)}

      {/* Edit Transaction Modal */}
      {mounted && showEditModal && editingTransaction && createPortal((
	        <div 
	          className="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-sm animate-fadeIn flex items-end justify-center p-0"
	          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
	        >
	          <div
	            className="w-full bg-[var(--app-surface)] text-[color:var(--app-text)] shadow-2xl overflow-hidden animate-slideUp flex flex-col rounded-t-3xl sm:rounded-3xl sm:max-w-md h-[88dvh] max-h-[88dvh] sm:h-auto sm:max-h-[90dvh] border border-[color:var(--app-border)]"
	            onClick={(e) => e.stopPropagation()}
	            role="dialog"
	            aria-modal="true"
	            aria-label="แก้ไขรายการ"
	          >
	            <form onSubmit={handleUpdateSubmit} className="flex h-full flex-col">
	              {/* Modal Header */}
	              <div className="sticky top-0 z-10 relative bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-500 text-slate-950 px-6 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] overflow-hidden">
	                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" aria-hidden="true" />
	                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" aria-hidden="true" />
	              
	                <div className="relative flex items-center justify-between">
	                  <div className="flex items-center gap-3">
	                    <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
	                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
	                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
	                      </svg>
	                    </div>
	                    <div>
	                      <h2 className="text-xl font-bold">แก้ไขรายการ</h2>
	                      <p className="text-slate-950/70 text-sm font-semibold">อัปเดตข้อมูลธุรกรรม</p>
	                    </div>
	                  </div>
	                  <button
	                    type="button"
	                    onClick={() => setShowEditModal(false)}
	                    className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:rotate-90"
	                    aria-label="ปิด"
	                  >
	                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
	                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
	                    </svg>
	                  </button>
	                </div>
	              </div>
		
	              {/* Modal Body */}
	              <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] p-6 space-y-5">
	              {error && (
		                <div className="p-4 bg-rose-500/10 border border-rose-400/20 rounded-xl flex items-start gap-3">
		                  <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
	                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
	                  </svg>
	                  <p className="text-[color:var(--app-text)] font-semibold text-sm">{error}</p>
	                </div>
	              )}

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-[color:var(--app-muted)] mb-2">ประเภท</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditFormData(prev => ({ 
                      ...prev, 
                      type: 'income',
                      category: categories.find(cat => cat.type === 'income')?._id || prev.category
                    }))}
                    className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                      editFormData.type === 'income'
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-[color:var(--app-text)]'
                        : 'bg-[var(--app-surface-2)] border-[color:var(--app-border)] text-[color:var(--app-muted)] hover:bg-[var(--app-surface-3)]'
                    }`}
                  >
                    รายรับ
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormData(prev => ({ 
                      ...prev, 
                      type: 'expense',
                      category: categories.find(cat => cat.type === 'expense')?._id || prev.category
                    }))}
                    className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                      editFormData.type === 'expense'
                        ? 'bg-rose-500/15 border-rose-400/40 text-[color:var(--app-text)]'
                        : 'bg-[var(--app-surface-2)] border-[color:var(--app-border)] text-[color:var(--app-muted)] hover:bg-[var(--app-surface-3)]'
                    }`}
                  >
                    รายจ่าย
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-semibold text-[color:var(--app-muted)] mb-2">จำนวนเงิน</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-3 border border-[color:var(--app-border)] bg-[var(--app-surface-2)] rounded-xl text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted-2)] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--app-muted-2)] font-semibold">฿</span>
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-[color:var(--app-muted)] mb-2">หมวดหมู่</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-[color:var(--app-border)] bg-[var(--app-surface-2)] rounded-xl text-[color:var(--app-text)] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all"
                  required
                >
                  <option value="">กรุณาเลือกหมวดหมู่</option>
                  {categories
                    .filter(cat => cat.type === editFormData.type)
                    .map(cat => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-sm font-semibold text-[color:var(--app-muted)] mb-2">วันที่</label>
                <button
                  type="button"
                  onClick={() => openDatePicker('edit')}
                  className="w-full px-4 py-3 border border-[color:var(--app-border)] bg-[var(--app-surface-2)] rounded-xl text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all flex items-center justify-between gap-3"
                  aria-label="เปิดปฏิทินเลือกวันที่"
                >
                  <div className="text-left min-w-0">
                    <div className="text-sm font-extrabold text-[color:var(--app-text)] truncate">
                      {(() => {
                        const iso = String(editFormData.date || '');
                        if (!iso) return 'เลือกวันที่';
                        try {
                          const d = new Date(`${iso}T00:00:00`);
                          return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                        } catch {
                          return iso;
                        }
                      })()}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-muted-2)]">แตะเพื่อเปิดปฏิทิน</div>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20 shrink-0">
                    <Calendar className="h-5 w-5" aria-hidden="true" />
                  </div>
                </button>
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-sm font-semibold text-[color:var(--app-muted)] mb-2">หมายเหตุ</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-3 border border-[color:var(--app-border)] bg-[var(--app-surface-2)] rounded-xl text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted-2)] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none transition-all resize-none"
                  placeholder="เพิ่มรายละเอียด..."
	                />
	              </div>
	
	              </div>

	              {/* Modal Footer */}
	              <div className="sticky bottom-0 z-10 border-t border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
	                <div className="flex gap-3">
		                <button
		                  type="button"
		                  onClick={() => setShowEditModal(false)}
	                  className="flex-1 px-6 py-3 border border-[color:var(--app-border)] bg-[var(--app-surface-2)] text-[color:var(--app-text)] font-semibold rounded-xl hover:bg-[var(--app-surface-3)] transition-colors"
	                >
	                  ยกเลิก
	                </button>
	                <button
	                  type="submit"
	                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-slate-950 font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
	                >
	                  บันทึก
		                </button>
		                </div>
		              </div>
		            </form>
	          </div>
	        </div>
	      ), document.body)}

      {/* Delete Confirm Modal */}
      {mounted && showDeleteModal && createPortal((
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[var(--app-surface)] text-[color:var(--app-text)] shadow-2xl shadow-black/40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="ยืนยันการลบ"
          >
            <div className="border-b border-white/10 bg-white/5 px-6 py-5 flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/20">
                  <Trash2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold text-[color:var(--app-text)]">ลบรายการนี้?</div>
                  <div className="mt-0.5 text-sm font-semibold text-[color:var(--app-muted-2)]">การลบจะไม่สามารถกู้คืนได้</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                aria-label="ปิด"
                title="ปิด"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {deleteError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-200 text-sm font-semibold">
                  {deleteError}
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-[color:var(--app-muted-2)]">
                กด <span className="text-rose-200 font-extrabold">ลบ</span> เพื่อยืนยัน หรือกด <span className="text-slate-100 font-extrabold">ยกเลิก</span> เพื่อกลับไปก่อนหน้า
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-extrabold text-slate-100 hover:bg-white/10"
                  disabled={deleteLoading}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 h-12 rounded-2xl bg-rose-500 px-4 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-60"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'กำลังลบ...' : 'ลบ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* View Transaction Modal */}
      {mounted && showViewModal && viewingTransaction && createPortal((
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}
        >
          <div
            className="bg-[var(--app-surface)] text-[color:var(--app-text)] border border-[color:var(--app-border)] w-full max-w-none sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/40 overflow-hidden animate-slideUp flex flex-col max-h-[92dvh] sm:max-h-[85dvh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="ดูรายละเอียดธุรกรรม"
          >
            <div className="relative border-b border-[color:var(--app-border)] bg-[var(--app-surface-2)] px-5 pb-4 pt-3 sm:pt-4">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/10 ring-1 ring-black/10 sm:hidden" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[color:var(--app-text)] hover:bg-[var(--app-surface-3)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                aria-label="ปิด"
                title="ปิด"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex items-center gap-3 pr-12">
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                  style={{
                    background: viewingTransaction.type === 'income'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  }}
                  aria-hidden="true"
                >
                  {renderIcon(viewingTransaction.category?.icon)}
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold tracking-wide text-[color:var(--app-muted-2)]">
                    {viewingTransaction.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                  </div>
                  <h3 className="mt-0.5 truncate text-lg font-extrabold text-[color:var(--app-text)]">
                    {viewingTransaction.category?.name || 'หมวดหมู่ไม่ระบุ'}
                  </h3>
                  <div className="mt-0.5 text-xs font-semibold text-[color:var(--app-muted)] truncate">
                    {new Date(viewingTransaction.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-4">
              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-[color:var(--app-muted)]">จำนวนเงิน</div>
                  <div className="text-2xl font-extrabold" style={{ color: viewingTransaction.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }}>
                    {viewingTransaction.type === 'expense' ? '-' : '+'}{formatTHB(viewingTransaction.amount)}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-2)] p-4">
                <div className="text-xs font-semibold text-[color:var(--app-muted)]">หมายเหตุ</div>
                <div className="mt-2 text-sm font-semibold text-[color:var(--app-text)] whitespace-pre-wrap break-words">
                  {String(viewingTransaction.notes || '').trim() ? viewingTransaction.notes : '—'}
                </div>
              </div>
            </div>

            <div className="border-t border-[color:var(--app-border)] bg-[var(--app-surface)] p-4">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="w-full rounded-2xl bg-emerald-500 py-3 text-slate-950 font-extrabold hover:brightness-95 transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </main>
  );
}
