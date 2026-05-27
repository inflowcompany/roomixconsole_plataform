// Atomic building blocks used across the Platform Console views.
// 1:1 port of the Cloud Design `components.jsx` bundle, rewritten as
// proper TSX modules that use lucide-react instead of the global `lucide`.

import React from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  BadgeAlert,
  BarChart3,
  BedDouble,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Columns3,
  Cpu,
  Database,
  DoorOpen,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  GitBranch,
  GitCompare,
  Globe,
  Hand,
  History,
  Hourglass,
  Inbox,
  Key,
  Layers,
  LayoutDashboard,
  LineChart,
  List,
  ListChecks,
  Lock,
  LogIn,
  Mail,
  Map,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Pause,
  PauseCircle,
  PieChart,
  Play,
  Plug,
  Plus,
  PlusCircle,
  Puzzle,
  RefreshCw,
  Receipt,
  Rocket,
  ScrollText,
  Search,
  Send,
  Settings,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Timer,
  TrendingUp,
  User as UserIcon,
  UserX,
  Users,
  Webhook,
  Workflow,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---- Icon -----------------------------------------------------------------
// The Cloud Design uses kebab-case names; lucide-react exports PascalCase
// components. Lookup table keeps tree-shaking predictable and avoids a
// dynamic import per icon. Add new icons by extending this map.
const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  "alert-octagon": AlertOctagon,
  "alert-triangle": AlertTriangle,
  "arrow-down-right": ArrowDownRight,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-right-left": ArrowRightLeft,
  "arrow-up-right": ArrowUpRight,
  "badge-alert": BadgeAlert,
  "bar-chart-3": BarChart3,
  "bed-double": BedDouble,
  bell: Bell,
  "book-open": BookOpen,
  bot: Bot,
  "building-2": Building2,
  calendar: Calendar,
  check: Check,
  "check-circle-2": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "clipboard-list": ClipboardList,
  clock: Clock,
  "columns-3": Columns3,
  cpu: Cpu,
  database: Database,
  "door-open": DoorOpen,
  download: Download,
  "external-link": ExternalLink,
  eye: Eye,
  "eye-off": EyeOff,
  "file-text": FileText,
  filter: Filter,
  "git-branch": GitBranch,
  "git-compare": GitCompare,
  globe: Globe,
  hand: Hand,
  history: History,
  hourglass: Hourglass,
  inbox: Inbox,
  key: Key,
  layers: Layers,
  "layout-dashboard": LayoutDashboard,
  "line-chart": LineChart,
  list: List,
  "list-checks": ListChecks,
  lock: Lock,
  "log-in": LogIn,
  mail: Mail,
  map: Map,
  "message-square": MessageSquare,
  "more-horizontal": MoreHorizontal,
  palette: Palette,
  pause: Pause,
  "pause-circle": PauseCircle,
  "pie-chart": PieChart,
  play: Play,
  plug: Plug,
  plus: Plus,
  "plus-circle": PlusCircle,
  puzzle: Puzzle,
  "refresh-cw": RefreshCw,
  receipt: Receipt,
  rocket: Rocket,
  "scroll-text": ScrollText,
  search: Search,
  send: Send,
  settings: Settings,
  "settings-2": Settings2,
  shield: Shield,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  timer: Timer,
  "trending-up": TrendingUp,
  user: UserIcon,
  "user-x": UserX,
  users: Users,
  webhook: Webhook,
  workflow: Workflow,
  x: X,
  "x-circle": XCircle,
  zap: Zap,
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 14, color, className = "", strokeWidth = 1.75, style }: IconProps) {
  const Component = ICONS[name];
  if (!Component) {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug(`[platform-console] missing icon: ${name}`);
    }
    return null;
  }
  // Render the lucide SVG directly so the existing Cloud Design CSS
  // (which targets `.sb-item .lucide`, `.btn .lucide`, etc.) can size
  // it. The previous wrapping <span> blocked the CSS selectors from
  // matching the actual SVG. `color="currentColor"` keeps icons
  // inheriting the surrounding text colour by default — critical for
  // the dark theme to look right.
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      color={color ?? "currentColor"}
      className={`lucide ${className}`.trim()}
      style={style}
      aria-hidden
    />
  );
}

// ---- Badge ----------------------------------------------------------------
export type BadgeTone =
  | "neutral"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "ghost"
  | "brand"
  | "violet";

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  // React's intrinsic JSX key — declared explicitly so callers can pass
  // it when rendering badges inside .map() without TypeScript complaining
  // about an unknown prop.
  key?: React.Key | null;
}

export function Badge({ tone = "neutral", dot = false, pulse = false, children, className = "", style }: BadgeProps) {
  return (
    <span className={`badge b-${tone} ${pulse ? "pulse" : ""} ${className}`} style={style}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

// ---- Metric Card ----------------------------------------------------------
export interface MetricProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: string;
  delta?: string;
  deltaDir?: "up" | "down" | "neutral";
  ctx?: React.ReactNode;
  accent?: "brand" | "danger" | "warning" | "info";
  sparkColor?: string;
}

export function Metric({ label, value, unit, icon, delta, deltaDir, ctx, accent }: MetricProps) {
  const dir = deltaDir || (delta && delta.startsWith("-") ? "down" : delta && delta.startsWith("+") ? "up" : "neutral");
  return (
    <div className={`metric ${accent ? "accent-" + accent : ""}`}>
      <div className="metric-head">
        <div className="metric-label">{label}</div>
        {icon ? (
          <div className="metric-icon">
            <Icon name={icon} size={12} />
          </div>
        ) : null}
      </div>
      <div className="metric-value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      <div className="metric-foot">
        {delta ? (
          <span className={`metric-delta ${dir}`}>
            {dir === "up" && <Icon name="arrow-up-right" size={10} />}
            {dir === "down" && <Icon name="arrow-down-right" size={10} />}
            {delta}
          </span>
        ) : null}
        {ctx ? <span className="ctx">{ctx}</span> : null}
      </div>
    </div>
  );
}

// ---- Panel ----------------------------------------------------------------
export interface PanelProps {
  title?: React.ReactNode;
  icon?: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  dense?: boolean;
}

export function Panel({ title, icon, sub, action, children, className = "", dense = false }: PanelProps) {
  return (
    <div className={`panel ${className}`}>
      {(title || sub || action) && (
        <div className="panel-hd">
          <div className="title">
            {icon ? <Icon name={icon} size={14} /> : null}
            {title}
            {sub ? <span className="sub" style={{ marginLeft: 8 }}>{sub}</span> : null}
          </div>
          {action}
        </div>
      )}
      <div className={`panel-bd ${dense ? "dense" : ""}`}>{children}</div>
    </div>
  );
}

// ---- Sparkline ------------------------------------------------------------
export interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
}

export function Sparkline({ data, color = "var(--brand)", height = 28, width = 90, fill = true }: SparklineProps) {
  const id = React.useMemo(() => "sg" + Math.random().toString(36).slice(2, 7), []);
  if (!data || !data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = height - ((d - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1];
  const first = pts[0];
  const area = `${path} L${last[0].toFixed(1)} ${height} L${first[0].toFixed(1)} ${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---- MiniBars -------------------------------------------------------------
export interface MiniBarsProps {
  data: number[];
  height?: number;
  color?: string;
  dim?: number;
}

export function MiniBars({ data, height = 22, color = "var(--brand)", dim = 0.45 }: MiniBarsProps) {
  const max = Math.max(...data, 1);
  return (
    <div className="mini-bars" style={{ height }}>
      {data.map((d, i) => (
        <span
          key={i}
          style={{
            height: `${(d / max) * 100}%`,
            background: color,
            opacity: dim,
          }}
        />
      ))}
    </div>
  );
}

// ---- HealthBar ------------------------------------------------------------
export function HealthBar({ value }: { value: number }) {
  const color =
    value >= 90
      ? "var(--brand)"
      : value >= 70
        ? "var(--info)"
        : value >= 50
          ? "var(--warning)"
          : "var(--danger)";
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="bar" style={{ width: 64 }}>
        <span style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="mono dim" style={{ fontSize: 11 }}>
        {value}
      </span>
    </div>
  );
}

// ---- ChannelPill ----------------------------------------------------------
export function ChannelPill({ status, label }: { status: string; label: string }) {
  return <span className={`ch-pill ${status}`}>{label}</span>;
}

// ---- SectionHeader --------------------------------------------------------
export interface SectionHeaderProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionHeader({ title, sub, action }: SectionHeaderProps) {
  return (
    <div className="section-h">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {action}
    </div>
  );
}

// ---- Status helpers -------------------------------------------------------
export const StatusBadges: Record<string, React.ReactElement> = {
  active: (
    <Badge tone="success" dot pulse>
      ativa
    </Badge>
  ),
  trial: (
    <Badge tone="info" dot>
      trial
    </Badge>
  ),
  suspended: (
    <Badge tone="danger" dot>
      suspensa
    </Badge>
  ),
  demo: (
    <Badge tone="violet" dot>
      demo
    </Badge>
  ),
};

export function CMBadge({ status }: { status: string }) {
  if (status === "ok") return <Badge tone="success" dot>ok</Badge>;
  if (status === "warn") return <Badge tone="warning" dot>atenção</Badge>;
  if (status === "err") return <Badge tone="danger" dot pulse>erro</Badge>;
  if (status === "off") return <Badge tone="ghost">desligado</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

export function FNRHBadge({ status }: { status: string }) {
  if (status === "ok") return <Badge tone="success" dot>ok</Badge>;
  if (status === "pending") return <Badge tone="warning" dot>pendente</Badge>;
  if (status === "error") return <Badge tone="danger" dot pulse>erro</Badge>;
  if (status === "n/a") return <Badge tone="ghost">n/a</Badge>;
  if (status === "demo") return <Badge tone="violet">demo</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

export function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, BadgeTone> = {
    Starter: "neutral",
    Growth: "info",
    Evolution: "violet",
    Enterprise: "success",
  };
  return <Badge tone={map[plan] || "neutral"}>{plan}</Badge>;
}

export function SevBadge({ sev }: { sev: string }) {
  if (sev === "crit") return <Badge tone="danger" dot pulse>crítico</Badge>;
  if (sev === "warn") return <Badge tone="warning" dot>aviso</Badge>;
  if (sev === "info") return <Badge tone="info" dot>info</Badge>;
  if (sev === "ok") return <Badge tone="success" dot>resolvido</Badge>;
  return <Badge tone="neutral">{sev}</Badge>;
}

export function RiskPill({ risk }: { risk: string | null | undefined }) {
  if (risk === "critical") return <Badge tone="danger">crítico</Badge>;
  if (risk === "high") return <Badge tone="danger">alto</Badge>;
  if (risk === "medium") return <Badge tone="warning">médio</Badge>;
  if (risk === "low") return <Badge tone="success">baixo</Badge>;
  if (!risk) return <Badge tone="ghost">—</Badge>;
  return <Badge tone="ghost">{risk}</Badge>;
}

// ---- Formatters -----------------------------------------------------------
export const fmtBRL = (n: number | null | undefined) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtNum = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("pt-BR");

// ---- Source / status hint -------------------------------------------------
//
// One single banner that reflects whatever state useConsoleData is in.
// Loading produces no banner (the empty rows are enough). The other
// three states each have an honest, distinct hint so the operator can
// never mistake demo or error data for production reality.
export type ConsoleDataSource = "backend" | "demo" | "loading" | "error";

export function DemoSourceHint({ source }: { source: ConsoleDataSource }) {
  if (source === "backend" || source === "loading") return null;
  if (source === "demo") {
    return (
      <div className="notice warn" style={{ marginTop: 0 }}>
        <Icon name="alert-triangle" size={14} />
        <span>
          <strong>Modo demonstração</strong> · dados fictícios para layout/QA. Ative apenas com a flag
          <span className="mono"> VITE_PLATFORM_CONSOLE_DEMO_DATA=true</span> no build. Nada aqui é
          produção real.
        </span>
      </div>
    );
  }
  // source === "error"
  return (
    <div className="notice danger" style={{ marginTop: 0 }}>
      <Icon name="x-circle" size={14} />
      <span>
        <strong>Erro ao carregar dados.</strong> O endpoint{" "}
        <span className="mono">/api/platform/console/overview</span> não respondeu. As tabelas
        ficam vazias até o backend voltar — <strong>nenhum dado fictício é mostrado em runtime real</strong>.
      </span>
    </div>
  );
}

// Optional small inline indicator when something is loading. Views can
// drop this near a section header to make the spin obvious without
// stealing the whole layout.
export function LoadingBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="badge b-info" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Icon name="refresh-cw" size={10} className="pc-spin" />
      <span>carregando</span>
    </span>
  );
}
