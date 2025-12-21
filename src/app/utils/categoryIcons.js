import { 
  Zap, Droplets, Wifi, Flame, Plug, Radio, CloudLightning,
  Car, Fuel, ParkingCircle, TrafficCone, Wrench,
  Banknote, CreditCard, Landmark, Receipt, Coins, Gem,
  Users, Baby, Backpack, ToyBrick, Home,
  ShoppingBag, Gift, Shirt, Watch, Tag,
  Utensils, Coffee, Pizza, Soup, Sandwich, Donut, Citrus,
  GraduationCap, Book, PenTool, School, Calculator,
  Film, Music, Gamepad2, Tv, Mic, Headphones, Palette, Dices,
  Stethoscope, Pill, Hospital, Activity, Bandage,
  Box, Paperclip, Key, Scissors, Hammer,
  Sofa, DoorOpen, Image, Bed, Brush,
  PawPrint, Fish, Turtle, Rabbit,
  Bus, Train, Bike, Taxi, Ship, TramFront,
  Plane, Map, Umbrella, Mountain, Anchor,
  Heart, HandHeart, Package,
  User, Hotel, Flower2, Trees,
  Dumbbell, Trophy, Medal,
  Laptop, Smartphone, Mouse, Keyboard, Cpu,
  Briefcase, BarChart, Calendar, Printer, Building,
  Camera, PartyPopper, BookOpen, Truck, Moon, Bath, ChefHat, CookingPot,
  Folder
} from 'lucide-react';

export const iconMap = {
  // Utilities
  'Zap': Zap, 'Droplets': Droplets, 'Wifi': Wifi, 'Flame': Flame, 'Plug': Plug, 'Radio': Radio, 'CloudLightning': CloudLightning,
  // Car
  'Car': Car, 'Fuel': Fuel, 'ParkingCircle': ParkingCircle, 'TrafficCone': TrafficCone, 'Wrench': Wrench,
  // Finance
  'Banknote': Banknote, 'CreditCard': CreditCard, 'Landmark': Landmark, 'Receipt': Receipt, 'Coins': Coins, 'Gem': Gem,
  // Family
  'Users': Users, 'Baby': Baby, 'Backpack': Backpack, 'ToyBrick': ToyBrick, 'Home': Home,
  // Shopping
  'ShoppingBag': ShoppingBag, 'Gift': Gift, 'Shirt': Shirt, 'Watch': Watch, 'Tag': Tag,
  // Food
  'Utensils': Utensils, 'Coffee': Coffee, 'Pizza': Pizza, 'Soup': Soup, 'Sandwich': Sandwich, 'Donut': Donut, 'Citrus': Citrus,
  // Education
  'GraduationCap': GraduationCap, 'Book': Book, 'PenTool': PenTool, 'School': School, 'Calculator': Calculator,
  // Entertainment
  'Film': Film, 'Music': Music, 'Gamepad2': Gamepad2, 'Tv': Tv, 'Mic': Mic, 'Headphones': Headphones, 'Palette': Palette, 'Dices': Dices,
  // Health
  'Stethoscope': Stethoscope, 'Pill': Pill, 'Hospital': Hospital, 'Activity': Activity, 'Bandage': Bandage,
  // Misc
  'Box': Box, 'Paperclip': Paperclip, 'Key': Key, 'Scissors': Scissors, 'Hammer': Hammer,
  // Home
  'Sofa': Sofa, 'DoorOpen': DoorOpen, 'Image': Image, 'Bed': Bed, 'Brush': Brush,
  // Pets
  'PawPrint': PawPrint, 'Fish': Fish, 'Turtle': Turtle, 'Rabbit': Rabbit,
  // Travel
  'Bus': Bus, 'Train': Train, 'Bike': Bike, 'Taxi': Taxi, 'Ship': Ship, 'TramFront': TramFront,
  'Plane': Plane, 'Map': Map, 'Umbrella': Umbrella, 'Mountain': Mountain, 'Anchor': Anchor,
  // Donate
  'Heart': Heart, 'HandHeart': HandHeart, 'Package': Package,
  // Personal
  'User': User,
  // Hotel
  'Hotel': Hotel,
  // Garden
  'Flower2': Flower2, 'Trees': Trees,
  // Sports
  'Dumbbell': Dumbbell, 'Trophy': Trophy, 'Medal': Medal,
  // Tech
  'Laptop': Laptop, 'Smartphone': Smartphone, 'Mouse': Mouse, 'Keyboard': Keyboard, 'Cpu': Cpu,
  // Work
  'Briefcase': Briefcase, 'BarChart': BarChart, 'Calendar': Calendar, 'Printer': Printer, 'Building': Building,
  // Art
  'Camera': Camera,
  // Party
  'PartyPopper': PartyPopper,
  // Study
  'BookOpen': BookOpen,
  // Logistics
  'Truck': Truck,
  // Relax
  'Moon': Moon, 'Bath': Bath,
  // Kitchen
  'ChefHat': ChefHat, 'CookingPot': CookingPot
};

export const availableIcons = [
  { value: ['Zap', 'Droplets', 'Flame', 'Wifi', 'Plug', 'Radio', 'CloudLightning'], label: 'สารสาธารณูปโภค' },
  { value: ['Car', 'Fuel', 'ParkingCircle', 'TrafficCone', 'Wrench', 'Bus', 'Train'], label: 'รถยนต์/เดินทาง' },
  { value: ['Banknote', 'CreditCard', 'Landmark', 'Receipt', 'Coins', 'Gem'], label: 'การเงิน' },
  { value: ['Users', 'Baby', 'Backpack', 'ToyBrick', 'Home'], label: 'ครอบครัวและเด็ก' },
  { value: ['ShoppingBag', 'Gift', 'Shirt', 'Watch', 'Tag'], label: 'ช้อปปิ้ง' },
  { value: ['Utensils', 'Coffee', 'Pizza', 'Soup', 'Sandwich', 'Donut', 'Citrus'], label: 'อาหารและเครื่องดื่ม' },
  { value: ['GraduationCap', 'Book', 'PenTool', 'School', 'Calculator'], label: 'การศึกษา' },
  { value: ['Film', 'Music', 'Gamepad2', 'Tv', 'Mic', 'Headphones', 'Palette', 'Dices'], label: 'บันเทิง' },
  { value: ['Stethoscope', 'Pill', 'Hospital', 'Activity', 'Bandage'], label: 'สุขภาพ' },
  { value: ['Box', 'Paperclip', 'Key', 'Scissors', 'Hammer'], label: 'เบ็ดเตล็ด' },
  { value: ['Home', 'Sofa', 'DoorOpen', 'Image', 'Bed', 'Brush'], label: 'บ้าน' },
  { value: ['PawPrint', 'Fish', 'Turtle', 'Rabbit'], label: 'สัตว์เลี้ยง' },
  { value: ['Plane', 'Map', 'Umbrella', 'Mountain', 'Anchor', 'Hotel'], label: 'ท่องเที่ยว/ที่พัก' },
  { value: ['Heart', 'HandHeart', 'Package'], label: 'บริจาค/ความรัก' },
  { value: ['User', 'Dumbbell', 'Trophy', 'Medal', 'Bike'], label: 'ส่วนตัว/กีฬา' },
  { value: ['Laptop', 'Smartphone', 'Mouse', 'Keyboard', 'Cpu'], label: 'เทคโนโลยี' },
  { value: ['Briefcase', 'BarChart', 'Calendar', 'Printer', 'Building'], label: 'งาน/อาชีพ' },
  { value: ['Camera', 'PartyPopper', 'BookOpen', 'Truck', 'Moon', 'Bath', 'ChefHat', 'CookingPot'], label: 'อื่นๆ' },
];

export const CategoryIcon = ({ iconName, className = "w-6 h-6" }) => {
  const Icon = iconMap[iconName];
  if (Icon) {
    return <Icon className={className} />;
  }
  // Fallback for emojis or unknown icons
  return <span className={className}>{iconName}</span>;
};
