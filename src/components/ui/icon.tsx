import {
  Bell, Building2, ChartColumn, ChartLine, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EyeOff, CircleCheck, Clock, Download,
  Ellipsis, Eye, FileText, Flag, Funnel, Gavel, Globe, GripVertical, House, Image, IndianRupee, Inbox, LayoutGrid, Layers,
  List, Lock, LogOut, MapPin, Megaphone, MessageCircle, MessageSquare, Minus, Monitor, Package, Palette, Plus, Receipt, Redo2,
  Search, Settings, ShieldCheck, ShoppingCart, Smartphone, Star, Store, Tablet, Tag, ToggleRight, Trash2, TriangleAlert, Truck,
  Undo2, Upload, User, Users, Wallet, X, type LucideProps,
} from "lucide-react";

/**
 * Icons are referenced by name so server components can pass them to client
 * components (component references are not serialisable across the boundary).
 */
const icons = {
  bell: Bell, building: Building2, chart: ChartColumn, "chart-line": ChartLine, check: Check, "check-circle": CircleCheck,
  "chevron-down": ChevronDown, "chevron-left": ChevronLeft, "chevron-right": ChevronRight, "chevron-up": ChevronUp, "eye-off": EyeOff, clock: Clock, download: Download,
  more: Ellipsis, eye: Eye, file: FileText, flag: Flag, filter: Funnel, gavel: Gavel, globe: Globe, drag: GripVertical,
  home: House, image: Image, rupee: IndianRupee, inbox: Inbox, grid: LayoutGrid, layers: Layers, list: List, lock: Lock,
  logout: LogOut, pin: MapPin, megaphone: Megaphone, whatsapp: MessageCircle, chat: MessageSquare, minus: Minus,
  monitor: Monitor, box: Package, palette: Palette, plus: Plus, receipt: Receipt, redo: Redo2, search: Search,
  settings: Settings, shield: ShieldCheck, cart: ShoppingCart, phone: Smartphone, star: Star, store: Store, tablet: Tablet,
  tag: Tag, toggle: ToggleRight, trash: Trash2, alert: TriangleAlert, truck: Truck, undo: Undo2, upload: Upload,
  user: User, users: Users, wallet: Wallet, x: X,
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 18, strokeWidth = 1.75, ...rest }: { name: IconName } & LucideProps) {
  const Cmp = icons[name];
  return <Cmp size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}
