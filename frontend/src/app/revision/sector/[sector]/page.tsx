"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopHeader } from "@/components/TopHeader";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    ChevronRight,
    BarChart3,
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    LayoutGrid,
    List,
    AlertTriangle,
    Building2,
    Landmark,
    ChevronDown,
    ChevronUp,
    Folders,
    FolderTree,
    Loader2,
    Search,
    ArrowUpRight
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Input } from "@/components/ui/input";

interface DependencyProgress {
    id: number;
    name: string;
    code: string;
    is_secretary: boolean;
    is_decentralized: boolean;
    is_deconcentrated: boolean;
    is_company: boolean;
    is_trust: boolean;
    narratives: { total: number, approved: number, pending: number };
    statistics: { total: number, approved: number };
    lastActivity: string;
    status: 'Completo' | 'En Proceso' | 'Pendiente';
}

export default function SectorRevision() {
    const { sector } = useParams();
    const { token, selectedPeriod } = useAuth();
    const isReadOnly = selectedPeriod < 2026;
    const [dependencies, setDependencies] = useState<DependencyProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [sectorName, setSectorName] = useState("");
    const [sectors, setSectors] = useState<any[]>([]);
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        "Sector Central (Secretarías)": true,
        "Organismos Descentralizados": true,
        "Órganos Desconcentrados": true,
        "Fideicomisos y Empresas": true,
        "Otras Unidades": true
    });

    const PED_AXES = [
        { id: "I", name: "Misión I: Gobierno Honesto y Transparente" },
        { id: "II", name: "Misión II: Paz, Seguridad y Justicia" },
        { id: "III", name: "Misión III: Desarrollo Social e Incluyente" },
        { id: "IV", name: "Misión IV: Modernización Económica y Desarrollo" },
        { id: "V", name: "Misión V: Infraestructura y Servicios de Calidad" }
    ];

    const currentAxis = PED_AXES.find(a => a.id === sector) || PED_AXES[0];

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const expandAll = () => {
        const allExpanded = { ...expandedGroups };
        Object.keys(allExpanded).forEach(key => allExpanded[key] = true);
        setExpandedGroups(allExpanded);
    };

    const collapseAll = () => {
        const allCollapsed = { ...expandedGroups };
        Object.keys(allCollapsed).forEach(key => allCollapsed[key] = false);
        setExpandedGroups(allCollapsed);
    };

    useEffect(() => {
        const fetchSectorData = async () => {
            if (!token) return;
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

                setSectors(PED_AXES);
                setSectorName(currentAxis.name);

                const depsRes = await fetch(`${baseUrl}/api/catalogs/dependencies?axis=${sector}&periodo=${selectedPeriod}&withProgress=true`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (!depsRes.ok) throw new Error(`Status: ${depsRes.status}`);

                const deps = await depsRes.json();
                const safeDeps = Array.isArray(deps) ? deps : [];

                setDependencies(safeDeps);
            } catch (error) {
                console.error("Sector fetch failed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSectorData();
    }, [token, sector, selectedPeriod]);

    const safeDependencies = Array.isArray(dependencies) ? dependencies : [];

    // Calculate REAL KPIs
    const totalPending = safeDependencies.reduce((acc, dep) => acc + (dep.narratives?.pending || 0), 0);
    const totalItems = safeDependencies.reduce((acc, dep) =>
        acc + (dep.narratives?.total || 0) + (dep.statistics?.total || 0), 0);
    const totalDone = safeDependencies.reduce((acc, dep) =>
        acc + (dep.narratives?.approved || 0) + (dep.statistics?.approved || 0), 0);
    const globalCompliance = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

    const filteredDependencies = safeDependencies.filter(dep => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (dep.name || "").toLowerCase().includes(query) ||
            (dep.code || "").toLowerCase().includes(query) ||
            (dep.id?.toString() || "").includes(query);

        let matchesFilter = filterStatus === "all" || dep.status === filterStatus;

        const totalItems = (dep.narratives?.total || 0) + (dep.statistics?.total || 0);
        const totalDone = (dep.narratives?.approved || 0) + (dep.statistics?.approved || 0);
        const progress = totalItems > 0 ? (totalDone / totalItems) * 100 : 0;

        if (filterStatus === "criticos") {
            matchesFilter = progress < 50 && totalItems > 0;
        } else if (filterStatus === "pendientes_revision") {
            matchesFilter = (dep.narratives?.pending || 0) > 0;
        }

        return matchesSearch && matchesFilter;
    });

    // Grouping logic
    const getGroupName = (dep: DependencyProgress) => {
        if (dep.is_secretary) return "Sector Central (Secretarías)";
        if (dep.is_decentralized) return "Organismos Descentralizados";
        if (dep.is_deconcentrated) return "Órganos Desconcentrados";
        if (dep.is_company || dep.is_trust) return "Fideicomisos y Empresas";
        return "Otras Unidades";
    };

    const groupedDeps: Record<string, DependencyProgress[]> = {};
    filteredDependencies.forEach(dep => {
        const group = getGroupName(dep);
        if (!groupedDeps[group]) groupedDeps[group] = [];
        groupedDeps[group].push(dep);
    });

    const groupOrder = [
        "Sector Central (Secretarías)",
        "Organismos Descentralizados",
        "Órganos Desconcentrados",
        "Fideicomisos y Empresas",
        "Otras Unidades"
    ];

    const getStatusColor = (progress: number, total: number) => {
        if (total === 0) return "text-slate-400 bg-slate-100 border-slate-200";
        if (progress >= 90) return "text-emerald-700 bg-emerald-100 border-emerald-200";
        if (progress >= 50) return "text-amber-700 bg-amber-100 border-amber-200";
        return "text-red-700 bg-red-100 border-red-200";
    };

    const getProgressBarColor = (progress: number, total: number) => {
        if (total === 0) return "bg-slate-200";
        if (progress >= 90) return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
        if (progress >= 50) return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]";
        return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]";
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-guinda-600 animate-spin" />
        </div>
    );

    return (
        <>
            <TopHeader title={`Revisión Sectorial: ${sectorName}`} />

            <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
                {isReadOnly && (
                    <div className="p-6 bg-slate-900 rounded-[2rem] text-white flex flex-col md:flex-row items-center gap-6 shadow-2xl border border-slate-800">
                        <div className="h-14 w-14 rounded-2xl bg-guinda-500/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-7 w-7 text-guinda-400 animate-pulse" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-lg font-black uppercase tracking-tight">Archivo Histórico: Ciclo {selectedPeriod}</h3>
                            <p className="text-slate-400 font-medium text-sm mt-1">Estás visualizando datos consolidados de un ejercicio anterior. El sistema se encuentra en **Modo Auditoría** (Solo Lectura) para preservar la integridad de los resultados oficiales.</p>
                        </div>
                        <Badge className="bg-guinda-600 hover:bg-guinda-600 text-white font-black px-4 py-1.5 rounded-full uppercase text-[10px] tracking-widest border-none">Solo Lectura</Badge>
                    </div>
                )}

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Panel de Control Sectorial</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <Select
                                value={sector as string}
                                onValueChange={(val) => router.push(`/revision/sector/${val}`)}
                            >
                                <SelectTrigger className="w-full md:w-[450px] bg-white border-none shadow-sm rounded-xl h-10 font-bold text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <FolderTree className="h-4 w-4 text-guinda-600" />
                                        <SelectValue placeholder="Cambiar Sector..." />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-slate-100 shadow-2xl max-h-[400px]">
                                    {sectors.map((s) => (
                                        <SelectItem
                                            key={s.id}
                                            value={s.id.toString()}
                                            className="rounded-xl focus:bg-guinda-50 focus:text-guinda-700 font-medium py-2.5"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                                                {s.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-slate-400 font-medium italic hidden lg:inline whitespace-nowrap opacity-60">Supervisión en tiempo real v2.0</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar dependencia..."
                                className="pl-10 bg-white border-none shadow-sm focus-visible:ring-guinda-500 rounded-xl h-11"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                            <Button
                                variant={viewMode === 'grid' ? "default" : "ghost"}
                                size="sm"
                                className={`rounded-lg h-9 w-9 p-0 ${viewMode === 'grid' ? 'bg-guinda-600 text-white shadow-md shadow-indigo-100' : 'text-slate-400'}`}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? "default" : "ghost"}
                                size="sm"
                                className={`rounded-lg h-9 w-9 p-0 ${viewMode === 'list' ? 'bg-guinda-600 text-white shadow-md shadow-indigo-100' : 'text-slate-400'}`}
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats Summary - Hidden in List View for extreme density if needed, or kept for context */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2rem] bg-guinda-600 text-white">
                        <CardContent className="p-8 space-y-2">
                            <p className="text-guinda-100 font-bold uppercase tracking-widest text-[10px]">Dependencias Activas</p>
                            <h3 className="text-4xl font-black">{dependencies.length}</h3>
                            <div className="flex items-center gap-2 text-guinda-200 text-sm">
                                <Users className="h-4 w-4" />
                                <span>Monitoreadas en tiempo real</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2rem] bg-white">
                        <CardContent className="p-8 space-y-2">
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Promedio Cumplimiento</p>
                            <h3 className="text-4xl font-black text-slate-900">{globalCompliance}%</h3>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-4">
                                <div className="bg-emerald-500 h-full rounded-full shadow-sm shadow-emerald-200 transition-all duration-1000" style={{ width: `${globalCompliance}%` }}></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2rem] bg-white">
                        <CardContent className="p-8 space-y-2">
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Acciones Pendientes</p>
                            <h3 className="text-4xl font-black text-amber-500">{totalPending}</h3>
                            <Link href="/inbox" className="text-guinda-600 text-sm font-bold flex items-center gap-1 hover:underline">
                                Ver buzón de revisión <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pb-4">
                    <div className="flex gap-2 overflow-x-auto scrollbar-none items-center flex-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 mr-2 shrink-0 tracking-widest pl-2 font-inter">Filtrar por:</span>
                        <div className="flex gap-2">
                            {[
                                { id: "all", label: "Todas" },
                                { id: "Completo", label: "Completas" },
                                { id: "En Proceso", label: "En Proceso" },
                                { id: "Pendiente", label: "Sin Avance" },
                                { id: "criticos", label: "⚠️ Críticos (<50%)" },
                                { id: "pendientes_revision", label: "📥 Con Pendientes" }
                            ].map((f) => (
                                <Button
                                    key={f.id}
                                    variant="ghost"
                                    size="sm"
                                    className={`rounded-lg px-4 h-9 font-bold text-[10px] uppercase tracking-wider transition-all whitespace-nowrap
                                        ${filterStatus === f.id
                                            ? 'bg-guinda-600 text-white shadow-lg shadow-guinda-100'
                                            : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                                    onClick={() => setFilterStatus(f.id)}
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 gap-2"
                            onClick={collapseAll}
                        >
                            <ChevronUp className="h-3 w-3" />
                            Cerrar Grupos
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 gap-2"
                            onClick={expandAll}
                        >
                            <ChevronDown className="h-3 w-3" />
                            Abrir Todos
                        </Button>
                    </div>
                </div>

                {/* Results Section - Grouped Grid */}
                {viewMode === 'grid' ? (
                    <div className="space-y-12 pb-20">
                        {groupOrder.map(groupName => {
                            const groupDeps = groupedDeps[groupName] || [];
                            if (groupDeps.length === 0) return null;
                            const isExpanded = expandedGroups[groupName];

                            return (
                                <div key={groupName} className="space-y-6">
                                    <div
                                        className="flex items-center gap-4 cursor-pointer group/header"
                                        onClick={() => toggleGroup(groupName)}
                                    >
                                        <div className={`p-1 rounded-lg transition-colors ${isExpanded ? 'bg-guinda-600 text-white' : 'bg-slate-100 text-slate-400 group-hover/header:bg-slate-200'}`}>
                                            <ChevronRight className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                                            {groupName}
                                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] tracking-normal">{groupDeps.length}</span>
                                        </h3>
                                        <div className="flex-1 h-[1px] bg-slate-100"></div>
                                    </div>

                                    {isExpanded && (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                                            {groupDeps.map((dep) => {
                                                const totalItems = (dep.narratives?.total || 0) + (dep.statistics?.total || 0);
                                                const totalDone = (dep.narratives?.approved || 0) + (dep.statistics?.approved || 0);
                                                const progress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

                                                return (
                                                    <Card key={dep.id} className="group border-none shadow-xl shadow-slate-200/40 hover:shadow-guinda-100/30 transition-all duration-300 rounded-[2.5rem] overflow-hidden cursor-pointer">
                                                        <CardContent className="p-0">
                                                            <div className="flex flex-col sm:flex-row items-stretch">
                                                                <div className="w-full sm:w-24 bg-slate-50 flex items-center justify-center p-6 border-b sm:border-b-0 sm:border-r border-slate-100">
                                                                    <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-guinda-600 font-black text-xs uppercase transition-transform group-hover:scale-110 border border-slate-100">
                                                                        {dep.code ? (
                                                                            <span>{dep.code}</span>
                                                                        ) : (
                                                                            <Landmark className="h-6 w-6 text-slate-300" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 p-8 space-y-6">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="space-y-1">
                                                                            <h4 className="text-xl font-bold text-slate-900 group-hover:text-guinda-600 transition-colors uppercase tracking-tight leading-tight">{dep.name}</h4>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex items-center gap-1 text-slate-400 text-xs font-bold">
                                                                                    <Clock className="h-3 w-3" />
                                                                                    {dep.lastActivity ? "Reciente" : "Sin actividad"}
                                                                                </div>
                                                                                {dep.narratives?.pending > 0 && (
                                                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[10px] font-black px-2 py-0">
                                                                                        {dep.narratives?.pending} por revisar
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <Link href={`/revision/dependencia/${dep.id}`}>
                                                                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-slate-50 hover:bg-guinda-600 hover:text-white transform group-hover:translate-x-1 transition-all">
                                                                                <ChevronRight className="h-5 w-5" />
                                                                            </Button>
                                                                        </Link>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                                                                                <FileText className="h-5 w-5" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Narrativas</p>
                                                                                <p className={`text-sm font-black ${(dep.narratives?.approved || 0) > 0 ? 'text-guinda-900' : 'text-slate-300'}`}>{(dep.narratives?.approved || 0)} / {(dep.narratives?.total || 0)}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                                                                                <BarChart3 className="h-5 w-5" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Estadísticas</p>
                                                                                <p className={`text-sm font-black ${(dep.statistics?.approved || 0) > 0 ? 'text-guinda-900' : 'text-slate-300'}`}>{(dep.statistics?.approved || 0)} / {(dep.statistics?.total || 0)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-4">
                                                                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden p-[2px]">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-1000 ${getProgressBarColor(progress, totalItems)}`}
                                                                                style={{ width: `${progress}%` }}
                                                                            ></div>
                                                                        </div>
                                                                        <span className={`inline-flex px-2 px-1 rounded-md text-[10px] font-black border ${getStatusColor(progress, totalItems)}`}>
                                                                            {progress}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupOrder.map(groupName => {
                            const groupDeps = groupedDeps[groupName] || [];
                            if (groupDeps.length === 0) return null;
                            const isExpanded = expandedGroups[groupName];

                            return (
                                <div key={groupName} className="space-y-4">
                                    <div
                                        className="flex items-center gap-4 cursor-pointer group/header"
                                        onClick={() => toggleGroup(groupName)}
                                    >
                                        <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{groupName}</span>
                                        <div className="flex-1 h-[1px] bg-slate-50"></div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 overflow-hidden border border-slate-50">
                                            <div className="grid grid-cols-[80px_1fr_120px_120px_100px_60px] p-6 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                <div>Siglas</div>
                                                <div>Dependencia</div>
                                                <div className="text-center">Narrativas</div>
                                                <div className="text-center">Estadísticas</div>
                                                <div className="text-center">Progreso</div>
                                                <div></div>
                                            </div>
                                            <div className="divide-y divide-slate-50">
                                                {groupDeps.map((dep) => {
                                                    const totalItems = (dep.narratives?.total || 0) + (dep.statistics?.total || 0);
                                                    const totalDone = (dep.narratives?.approved || 0) + (dep.statistics?.approved || 0);
                                                    const progress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

                                                    return (
                                                        <div key={dep.id} className="grid grid-cols-[80px_1fr_120px_120px_100px_60px] items-center p-6 hover:bg-slate-50/50 transition-colors group">
                                                            <div className="font-black text-guinda-600 text-xs">
                                                                {dep.code ? (
                                                                    dep.code
                                                                ) : (
                                                                    <Landmark className="h-4 w-4 text-slate-300" />
                                                                )}
                                                            </div>
                                                            <div className="font-bold text-slate-900 group-hover:text-guinda-600 transition-colors truncate pr-4 uppercase text-sm">{dep.name}</div>
                                                            <div className="text-center">
                                                                <Badge variant="secondary" className={`${(dep.narratives?.approved || 0) === (dep.narratives?.total || 0) && (dep.narratives?.total || 0) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'} border-none font-bold`}>
                                                                    {(dep.narratives?.approved || 0)}/{(dep.narratives?.total || 0)}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-center">
                                                                <Badge variant="secondary" className={`${(dep.statistics?.approved || 0) === (dep.statistics?.total || 0) && (dep.statistics?.total || 0) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'} border-none font-bold`}>
                                                                    {(dep.statistics?.approved || 0)}/{(dep.statistics?.total || 0)}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex justify-center">
                                                                <div className={`h-8 w-8 rounded-full border-2 border-slate-50 flex items-center justify-center relative overflow-hidden ${getStatusColor(progress, totalItems)}`}>
                                                                    <div
                                                                        className={`absolute bottom-0 left-0 w-full transition-all duration-700 ${getProgressBarColor(progress, totalItems)} opacity-20`}
                                                                        style={{ height: `${progress}%` }}
                                                                    ></div>
                                                                    <span className="relative z-10 text-[9px] font-black leading-none">
                                                                        {progress}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-center">
                                                                <Link href={`/revision/dependencia/${dep.id}`}>
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-guinda-600 hover:text-white transition-all">
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    </Button>
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {filteredDependencies.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                        <div className="inline-flex p-4 rounded-full bg-slate-50 text-slate-300">
                            <Search className="h-10 w-10" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-slate-900">No se encontraron dependencias</p>
                            <p className="text-slate-500">Prueba con otros términos de búsqueda o filtros.</p>
                        </div>
                        <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => { setSearchQuery(""); setFilterStatus("all"); }}>
                            Limpiar filtros
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
