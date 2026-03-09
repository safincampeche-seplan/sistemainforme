"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Users,
  FileText,
  CheckCircle2,
  TrendingUp,
  Clock,
  Search,
  Sparkles,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  Shield,
  UserPlus,
  ShieldCheck,
  Database,
  Brain,
  Zap,
  Lightbulb,
  X,
  Target
} from "lucide-react";
import { TopHeader } from "@/components/TopHeader";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface DashboardStats {
  totalPpa: number;
  beneficiaries: string;
  completedPercent: number;
  pendingValidations: number;
  totalEntities: number;
  capturedEntities: number;
  totalUsers?: number;
}

interface Activity {
  id: number;
  type: string;
  title: string;
  status: string;
  date: string;
}

export default function Home() {
  const { user, token, selectedPeriod } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const itemsPerPage = 5;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !token) return;
    setIsSearching(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
      const res = await fetch(`${baseUrl}/api/dashboard/search?q=${encodeURIComponent(searchQuery)}&periodo=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
        const [statsRes, activitiesRes] = await Promise.all([
          fetch(`${baseUrl}/api/dashboard/stats?periodo=${selectedPeriod}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${baseUrl}/api/activities?periodo=${selectedPeriod}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        const statsData = await statsRes.json();
        const activitiesData = await activitiesRes.json();
        setStats(statsData);
        setActivities(activitiesData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token, selectedPeriod]);

  // Filtering and Pagination Logic
  const mapStatus = (status: string) => {
    if (!status) return "Sincronizado";
    const s = status.toLowerCase().replace(/_/g, ' ');
    if (s === 'draft' || s === 'borrador') return "Borrador";
    if (s.includes('under validation safin') || s.includes('under validation semaig')) return "En Validación SAFIN";
    if (s.includes('with observations safin') || s.includes('with observations semaig')) return "Observado SAFIN";
    if (s === 'finalized' || s === 'finalizado') return "Finalizado";
    if (s.includes('under validation secont')) return "En Validación SECONT";
    if (s.includes('with observations secont')) return "Observado SECONT";
    if (s.includes('approved secont')) return "Aprobado SECONT";
    if (s.includes('approved safin') || s.includes('approved semaig')) return "Aprobado SAFIN";
    if (s.includes('approved') || s === 'aprobado') return "Aprobado";
    if (s === 'observed' || s === 'observado') return "Observado";
    if (s === 'finished' || s === 'terminado') return "Terminado";
    if (s.includes('en validación') || s.includes('en validacion')) return "En Validación";
    return status;
  };


  const safeActivities = (Array.isArray(activities) ? activities : []).map(act => ({
    ...act,
    status: mapStatus(act.status)
  }));
  const filteredActivities = safeActivities.filter(act =>
    filterStatus === "all" || act.status?.toLowerCase().includes(filterStatus.toLowerCase())
  );

  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats for the filter pills
  const statusCounts = {
    all: safeActivities.length,
    sincronizado: safeActivities.filter(a => a.status?.toLowerCase().includes('sincronizado') || a.status?.toLowerCase().includes('borrador')).length,
    validación: safeActivities.filter(a => a.status?.toLowerCase().includes('validación')).length,
    aprobado: safeActivities.filter(a => a.status?.toLowerCase().includes('aprobado')).length,
  };

  return (
    <>
      <TopHeader title="Resumen Ejecutivo" />
      <div className="p-6 md:p-8 grid gap-8 animate-in fade-in duration-700">

        {/* Metrics - Specialized for SuperAdmin */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-xl shadow-slate-200/50 bg-white group hover:scale-[1.02] transition-transform cursor-default overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-guinda-50 rounded-bl-full -mr-12 -mt-12"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">{user?.roles?.includes('super_admin') ? "Usuarios Totales" : "Total Programas (PPA)"}</CardTitle>
              {user?.roles?.includes('super_admin') ? <Users className="h-4 w-4 text-guinda-500" /> : <FileText className="h-4 w-4 text-guinda-500" />}
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-black text-slate-900">{loading ? "..." : (user?.roles?.includes('super_admin') ? (stats?.totalUsers ?? 0) : (stats?.totalPpa ?? 0))}</div>
              <p className="text-xs text-guinda-600 font-bold flex items-center mt-2 bg-guinda-50 px-2 py-1 rounded-full w-fit">
                <TrendingUp className="h-3 w-3 mr-1" />
                {user?.roles?.includes('super_admin') ? "Activos en el sistema" : (selectedPeriod === 2026 ? "+12% vs 2025" : `Ciclo ${selectedPeriod}`)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 bg-white group hover:scale-[1.02] transition-transform cursor-default overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-12 -mt-12"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Avance Global</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-black text-emerald-600">{loading ? "..." : `${stats?.completedPercent ?? 0}%`}</div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${stats?.completedPercent || 0}%` }}></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 bg-white group hover:scale-[1.02] transition-transform cursor-default overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-12 -mt-12"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">{user?.roles?.includes('super_admin') ? "Dependencias" : "Cuadros Estadísticos"}</CardTitle>
              <BarChart3 className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-black text-slate-900">{loading ? "..." : (user?.roles?.includes('super_admin') ? "56" : (stats?.totalEntities ?? 0))}</div>
              <p className="text-xs text-amber-600 font-bold flex items-center mt-2 bg-amber-50 px-2 py-1 rounded-full w-fit">
                <AlertCircle className="h-3 w-3 mr-1" />
                {user?.roles?.includes('super_admin') ? "6 con captura pendiente" : `${stats?.pendingValidations ?? 0} pendientes`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 bg-white group hover:scale-[1.02] transition-transform cursor-default overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-12 -mt-12"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                {user?.roles?.includes('super_admin') ? "Seguridad" : "Estado"}
              </CardTitle>
              <Shield className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-xl font-black text-slate-900 uppercase tracking-tighter">Acceso Seguro</div>
              <div className="flex items-center gap-1 mt-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Protección Activa</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sectors Quick Access - Filament Style Dashboard Implementation */}
        {(user?.roles?.includes('super_admin') || user?.roles?.includes('admin') || user?.roles?.includes('validador')) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Gestión por Misiones</h3>
                <p className="text-slate-500 font-medium text-sm italic">Supervisión del Plan Estatal de Desarrollo 2021-2027</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { id: "I", name: "Gobernanza y Seguridad", icon: ShieldCheck, color: "bg-guinda-50", text: "text-guinda-600", hover: "group-hover:bg-guinda-600" },
                { id: "III", name: "Desarrollo Social", icon: Users, color: "bg-emerald-50", text: "text-emerald-600", hover: "group-hover:bg-emerald-600" },
                { id: "IV", name: "Economía y Ambiente", icon: TrendingUp, color: "bg-amber-50", text: "text-amber-600", hover: "group-hover:bg-amber-600" },
                { id: "V", name: "Infraestructura", icon: Database, color: "bg-rose-50", text: "text-rose-600", hover: "group-hover:bg-rose-600" }
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <Link href={`/revision/sector/${s.id}`} key={s.id}>
                    <Card className="border-none shadow-lg shadow-slate-100/50 hover:shadow-indigo-100 transition-all cursor-pointer group bg-white rounded-3xl overflow-hidden active:scale-95 border-b-4 border-transparent hover:border-guinda-500">
                      <CardContent className="p-6 flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${s.color} ${s.text} ${s.hover} group-hover:text-white transition-all`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-0.5">Revisión</p>
                          <h4 className="font-bold text-slate-800 group-hover:text-guinda-600 transition-colors leading-tight">{s.name}</h4>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-guinda-400 group-hover:translate-x-1 transition-all" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity and forms */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {user?.roles?.includes('super_admin') ? (
                      <>Monitor de Actividad Global <Sparkles className="h-5 w-5 text-guinda-600" /></>
                    ) : (
                      <>Actividad Reciente <Sparkles className="h-5 w-5 text-guinda-600" /></>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {user?.roles?.includes('super_admin')
                      ? "Resumen de movimientos realizados por todos los usuarios."
                      : "Acciones registradas en el sistema en tiempo real."}
                  </CardDescription>
                </div>

                {/* Quick Filter Pills */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'Todos', count: statusCounts.all, color: 'text-slate-600 bg-slate-50' },
                    { id: 'sincronizado', label: 'Sync', count: statusCounts.sincronizado, color: 'text-amber-600 bg-amber-50' },
                    { id: 'validación', label: 'Valid', count: statusCounts.validación, color: 'text-guinda-600 bg-guinda-50' },
                    { id: 'aprobado', label: 'Aprob', count: statusCounts.aprobado, color: 'text-emerald-600 bg-emerald-50' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => { setFilterStatus(filter.id); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 border-2 ${filterStatus === filter.id
                        ? 'border-guinda-600 bg-guinda-600 text-white shadow-lg shadow-indigo-100'
                        : `border-transparent ${filter.color} border-slate-100`
                        }`}
                    >
                      {filter.label}
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${filterStatus === filter.id ? 'bg-white text-guinda-600' : 'bg-white/50'}`}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50 min-h-[440px]">
                {loading ? (
                  <div className="p-12 text-center text-slate-400 font-bold text-sm animate-pulse tracking-widest uppercase">Consultando API...</div>
                ) : paginatedActivities.length > 0 ? paginatedActivities.map((item) => (
                  <Link
                    key={item.id}
                    href={
                      user?.roles?.includes('super_admin') ? "/admin/bitacora" :
                        user?.roles?.includes('validador') || user?.roles?.includes('admin') ? `/inbox/${item.type}/${item.id}` :
                          (item.status === 'Borrador' || item.status === 'Observado' ? `/captura-narrativa?id=${item.id}` : `/captura-narrativa/historial`)
                    }
                    className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-all group/item cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform ${item.type === 'word' ? 'bg-guinda-50 text-guinda-600' :
                        item.type === 'excel' ? 'bg-emerald-50 text-emerald-600' :
                          item.status?.includes('Aprobado') ? 'bg-emerald-50 text-emerald-600' :
                            item.status?.includes('Validación') ? 'bg-guinda-50 text-guinda-600' :
                              'bg-amber-50 text-amber-600'
                        }`}>
                        {item.type === 'excel' ? <BarChart3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover/item:text-guinda-600 transition-colors uppercase tracking-tight">{item.title}</p>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-tight">
                          {user?.roles?.includes('super_admin') ? "ID de Auditoría" : "Folio de Gestión"}: {item.id ? `#${item.id.toString().slice(-6)}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div className="hidden sm:block">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${item.status?.includes('Aprobado') ? 'text-emerald-600' :
                          item.status?.includes('Validación') ? 'text-guinda-600' :
                            'text-amber-600'
                          }`}>{item.status || "Sincronizado"}</p>
                        <p className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {item.date}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover/item:text-guinda-500 transform group-hover/item:translate-x-1 transition-all" />
                    </div>
                  </Link>
                )) : (
                  <div className="py-32 text-center space-y-4">
                    <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-xs">Sin registros que mostrar</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[9px] font-black text-slate-400 border-none uppercase bg-white px-2">
                    {filteredActivities.length} registros
                  </Badge>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg hover:bg-white text-slate-400 disabled:opacity-30"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </Button>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg hover:bg-white text-slate-400 disabled:opacity-30"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {user?.roles?.includes('super_admin') ? (
              <Card className="border-none shadow-xl shadow-indigo-100/50 bg-guinda-600 text-white rounded-[3rem] overflow-hidden group p-2">
                <CardHeader className="pb-4 pt-6 px-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-black tracking-tight">Consola de Mando</CardTitle>
                    <Shield className="h-8 w-8 text-guinda-300/50" />
                  </div>
                  <CardDescription className="text-guinda-100 font-bold opacity-70">Control administrativo centralizado</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-6">
                  <Link href="/admin/usuarios">
                    <Button className="w-full bg-white text-guinda-600 hover:bg-slate-100 rounded-[1.5rem] h-16 font-black flex gap-3 group-hover:scale-[1.02] transition-all text-lg shadow-2xl">
                      <Users className="h-6 w-6" /> Gestión de Personal
                    </Button>
                  </Link>
                  <Link href="/admin/bitacora">
                    <Button className="w-full bg-guinda-500/40 text-white hover:bg-guinda-500/60 rounded-[1.5rem] h-16 font-black flex gap-3 border border-guinda-400/30 transition-all text-lg shadow-xl backdrop-blur-md">
                      <ShieldCheck className="h-6 w-6" /> Registro de Seguridad
                    </Button>
                  </Link>
                  <div className="pt-4 px-2 space-y-2 border-t border-guinda-400/20">
                    <p className="text-[10px] text-guinda-200 font-black uppercase tracking-[0.2em] text-center">Estado del Servidor</p>
                    <div className="flex justify-between items-center bg-guinda-700/30 p-3 rounded-2xl border border-guinda-400/10">
                      <span className="text-xs font-bold text-guinda-300">Latencia</span>
                      <span className="text-xs font-black text-emerald-400">14ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : user?.roles?.includes('admin') ? (
              <>
                <Card className="border-none shadow-xl shadow-indigo-100/50 bg-guinda-600 text-white rounded-[2rem] overflow-hidden group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Panel Operativo</CardTitle>
                      <Shield className="h-5 w-5 text-guinda-200" />
                    </div>
                    <CardDescription className="text-guinda-100/70">Gestión de datos institucionales</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 gap-3">
                      <Link href="/captura-narrativa">
                        <Button className="w-full bg-white text-guinda-600 hover:bg-slate-50 rounded-2xl h-14 font-black flex gap-2 group-hover:scale-105 transition-all text-sm">
                          <FileText className="h-5 w-5" /> Nueva Narrativa
                        </Button>
                      </Link>
                      <Link href="/captura-estadistica">
                        <Button className="w-full bg-guinda-500/30 text-white hover:bg-guinda-500/50 rounded-2xl h-14 font-black flex gap-2 border border-guinda-400/30 transition-all text-sm">
                          <Database className="h-5 w-5" /> Anexo Estadístico
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="text-lg">Acción Rápida</CardTitle>
                    <CardDescription>Localización inmediata de recursos</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="search" className="text-xs font-bold text-slate-500 uppercase">Folio o PPA</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="search"
                          className="pl-10 h-11 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-guinda-500/20"
                          placeholder="Ej. PPA-2026..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                      </div>
                    </div>
                    <Button className="w-full bg-guinda-600 hover:bg-guinda-700 text-white shadow-lg shadow-indigo-200 h-11 transition-all active:scale-[0.98] font-bold" onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? "Buscando..." : "Buscar en Base de Datos"}
                    </Button>

                    {searchResults.length > 0 && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 max-h-60 overflow-y-auto space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Resultados</p>
                        {searchResults.map((res: any, idx: number) => (
                          <div key={idx} className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-guinda-200 transition-colors">
                            <div>
                              <p className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{res.title}</p>
                              <p className="text-[9px] font-black text-guinda-500 uppercase">{res.type}</p>
                            </div>
                            <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-slate-200 text-slate-400 group-hover:bg-guinda-600 group-hover:text-white transition-colors">{res.status}</Badge>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="w-full text-[10px] font-bold text-slate-400 hover:text-red-500" onClick={() => setSearchResults([])}>Limpiar resultados</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : user?.roles?.includes('capturista') ? (
              <>
                <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="text-lg">Tarea Actual</CardTitle>
                    <CardDescription>Módulo de captura operativa</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Link href="/captura-narrativa">
                      <Button className="w-full bg-guinda-600 hover:bg-guinda-700 text-white font-black h-12 rounded-xl">
                        Continuar Captura
                      </Button>
                    </Link>
                    <Link href="/captura-estadistica">
                      <Button variant="outline" className="w-full font-bold h-12 rounded-xl border-slate-200">
                        Anexo Estadístico
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </>
            ) : user?.roles?.includes('validador') ? (
              <>
                <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="text-lg">Acciones de Validación</CardTitle>
                    <CardDescription>Revisa y aprueba informes pendientes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Link href="/inbox/validaciones">
                      <Button className="w-full bg-guinda-600 hover:bg-guinda-700 text-white font-black h-12 rounded-xl">
                        Ver Pendientes ({loading ? "..." : "5"})
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full font-bold h-12 rounded-xl border-slate-200">
                      Historial de Validaciones
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="text-lg">Tarea Actual</CardTitle>
                    <CardDescription>Módulo de captura operativa</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Link href="/captura-narrativa">
                      <Button className="w-full bg-guinda-600 hover:bg-guinda-700 text-white font-black h-12 rounded-xl">
                        Continuar Captura
                      </Button>
                    </Link>
                    <Link href="/captura-estadistica">
                      <Button variant="outline" className="w-full font-bold h-12 rounded-xl border-slate-200">
                        Anexo Estadístico
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </>
            )}

            {/* AI Assistant Card - Repositioned to Sidebar */}
            <Card className="border-none bg-gradient-to-br from-guinda-600 to-guinda-800 text-white shadow-xl shadow-indigo-200 overflow-hidden relative group rounded-[2rem]">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Sparkles className="h-24 w-24" />
              </div>
              <CardHeader>
                <CardTitle className="text-white text-lg">Asistente IA V2</CardTitle>
                <CardDescription className="text-guinda-100 text-[10px]">Optimiza tus narrativas con un clic.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  className="w-full font-bold text-guinda-700 hover:bg-white transition-colors h-11 rounded-xl"
                  onClick={() => setIsAIModalOpen(true)}
                >
                  Comenzar ahora
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* AI Assistant Modal */}
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-500 ${isAIModalOpen ? 'opacity-100 backdrop-blur-xl' : 'opacity-0 backdrop-blur-0 pointer-events-none'}`}>
        <div className={`fixed inset-0 bg-slate-900/60 transition-opacity duration-500 ${isAIModalOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsAIModalOpen(false)} />

        <div className={`bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden border border-slate-100 dark:border-slate-800 transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) transform ${isAIModalOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-12 opacity-0'}`}>
          <div className="relative p-1">
            <button
              onClick={() => setIsAIModalOpen(false)}
              className="absolute top-8 right-8 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors z-10"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Score Section */}
                <div className="flex-shrink-0 flex flex-col items-center gap-4 bg-guinda-50 dark:bg-guinda-900/20 p-8 rounded-[2.5rem] border border-guinda-100 dark:border-guinda-500/10">
                  <div className="relative h-32 w-32 flex items-center justify-center">
                    <svg className="h-full w-full rotate-[-90deg]">
                      <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-guinda-100 dark:text-guinda-900/40" />
                      <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364" strokeDashoffset={364 - (364 * 85 / 100)} strokeLinecap="round" className="text-guinda-600 transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-guinda-600">85%</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-guinda-400 mb-1">Score de Calidad</p>
                    <p className="font-bold text-guinda-900 dark:text-guinda-100 text-sm italic">"Nivel Institucional"</p>
                  </div>
                </div>

                {/* Insights Section */}
                <div className="flex-1 space-y-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Análisis IA V2 <Sparkles className="h-5 w-5 text-guinda-600 animate-pulse" />
                    </h3>
                    <p className="text-slate-500 font-bold text-sm">3 puntos críticos detectados en el Informe {selectedPeriod}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-4 group">
                      <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Densidad Narrativa Baja</p>
                        <p className="text-xs text-slate-500 font-medium">El sector de **Infraestructura** tiene justificaciones menores a 100 palabras. Se recomienda expandir resultados.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 group">
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Consistencia de Metas</p>
                        <p className="text-xs text-slate-500 font-medium">Se detectó una discrepancia del 15% entre las metas descritas y las estadísticas en **Desarrollo Social**.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 group">
                      <div className="h-10 w-10 rounded-xl bg-guinda-50 dark:bg-guinda-900/20 text-guinda-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Lightbulb className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Oportunidad de Impacto</p>
                        <p className="text-xs text-slate-500 font-medium">Sugerencia: Integrar lenguaje de "Sostenibilidad" en las narrativas de **Economía y Ambiente** para alineación con el PED.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex flex-col sm:flex-row gap-4">
                <Link href="/captura-narrativa" className="flex-1">
                  <Button className="w-full h-16 rounded-[1.5rem] bg-guinda-600 hover:bg-guinda-700 text-white text-xl font-black shadow-2xl shadow-indigo-200 transition-all active:scale-95 flex gap-3">
                    <Brain className="h-6 w-6" /> Optimizar Ahora
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="h-16 rounded-[1.5rem] px-8 font-black border-slate-200 text-slate-500"
                  onClick={() => setIsAIModalOpen(false)}
                >
                  Más tarde
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
