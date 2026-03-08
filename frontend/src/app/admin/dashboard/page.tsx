"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { TopHeader } from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    BarChart3,
    PieChart,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowUpRight,
    Building2,
    Zap,
    TrendingUp,
    LayoutGrid
} from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";

interface MissionStat {
    id: number;
    name: string;
    totalDependencies: number;
    approvedNarratives: number;
    progress: number;
}

interface LaggingDep {
    name: string;
    acronym: string;
    approved: number;
    status: string;
}

interface GlobalStats {
    periodo: number;
    globalProgress: number;
    totalNarratives: number;
    totalEntries: number;
    missionStats: MissionStat[];
    rankingRezagados: LaggingDep[];
    statusDistribution: {
        validated: number;
        inReview: number;
        draft: number;
    };
    deadline: {
        date: string;
        daysRemaining: number;
    };
}

export default function GlobalDashboardPage() {
    const { token, user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('SuperAdministrador');

    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState(2026);

    const fetchGlobalStats = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/stats/global?periodo=${selectedPeriod}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error("Failed to fetch global stats", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            fetchGlobalStats();
        }
    }, [token, isSuperAdmin, selectedPeriod]);

    if (!isSuperAdmin) return <AccessDenied />;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
            <TopHeader title="Tablero de Control Global" />

            <main className="flex-1 p-6 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
                {/* Global Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm bg-gradient-to-br from-guinda-600 to-guinda-700 text-white rounded-xl">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-medium opacity-80 uppercase tracking-widest">Avance General {selectedPeriod}</p>
                                    <h3 className="text-4xl font-black mt-2">{stats?.globalProgress || 0}%</h3>
                                </div>
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <BarChart3 className="size-5 opacity-80" />
                                </div>
                            </div>
                            <Progress value={stats?.globalProgress || 0} className="h-1 mt-6 bg-white/20 [&>div]:bg-white" />
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm shadow-slate-200/50 rounded-xl">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Narrativas Capturadas</p>
                                    <h3 className="text-3xl font-black mt-2 text-slate-900 dark:text-white">{stats?.totalNarratives || 0}</h3>
                                </div>
                                <div className="p-2 border border-emerald-100 bg-emerald-50 text-emerald-600 rounded-full">
                                    <CheckCircle2 className="size-4" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-6 text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                                <TrendingUp className="size-3" />
                                <span>+12% vs semana anterior</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm shadow-slate-200/50 rounded-xl">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anexos Estadísticos</p>
                                    <h3 className="text-3xl font-black mt-2 text-slate-900 dark:text-white">{stats?.totalEntries || 0}</h3>
                                </div>
                                <div className="p-2 border border-amber-100 bg-amber-50 text-amber-500 rounded-full">
                                    <Zap className="size-4" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-6 text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                                <Clock className="size-3" />
                                <span>Pendiente de validación</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm shadow-slate-200/50 rounded-xl">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Días para Cierre</p>
                                    <h3 className="text-3xl font-black mt-2 text-slate-900 dark:text-white">
                                        {stats?.deadline.daysRemaining || 0}
                                    </h3>
                                </div>
                                <div className="p-2 border border-rose-100 bg-rose-50 text-rose-500 rounded-full">
                                    <AlertCircle className="size-4" />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-wider">
                                Fecha límite: {stats?.deadline.date ? new Date(stats.deadline.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : "--"}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Mission Progress Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="size-4 text-guinda-600" />
                        <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">AVANCE POR MISIÓN DEL PED</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {stats?.missionStats?.map((mission) => (
                            <Card key={mission.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden rounded-xl">
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-xs font-bold leading-tight">{mission.name}</CardTitle>
                                        <ArrowUpRight className="size-3 text-slate-300 group-hover:text-guinda-600 transition-colors" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-end justify-between mb-2">
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">{mission.progress}%</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{mission.approvedNarratives} APROBADOS</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-slate-800 dark:bg-slate-300 rounded-full transition-all duration-1000"
                                            style={{ width: `${mission.progress}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-3 font-bold uppercase tracking-wider">{mission.totalDependencies} Dependencias vinculadas</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Detailed Table & Rankings */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <Card className="xl:col-span-2 border-none shadow-sm shadow-slate-200/50 rounded-2xl">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest">Estado Crítico de Dependencias por Misión</CardTitle>
                            <CardDescription className="text-xs font-medium text-rose-500/80">Instituciones con menor avance reportado a la fecha.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats?.rankingRezagados?.map((dep, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-700 font-bold text-[10px] text-slate-500 tracking-wider">
                                                {dep.acronym}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white">{dep.name}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">{dep.status}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={dep.approved > 0 ? "secondary" : "destructive"} className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${dep.approved === 0 ? 'bg-red-600 text-white border-transparent' : 'bg-slate-100 text-slate-600 border-transparent'}`}>
                                                {dep.approved} Metas
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm shadow-slate-200/50 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                                <PieChart className="size-4 text-slate-400" />
                                Distribución de Esfuerzo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="flex flex-col items-center justify-center py-2">
                                <div className="relative size-32">
                                    <svg className="size-full" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="2" />
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-900 dark:stroke-slate-100" strokeWidth="2" strokeDasharray={`${stats?.globalProgress || 0}, 100`} strokeLinecap="round" transform="rotate(-90 18 18)" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                                        <span className="text-3xl font-black">{stats?.globalProgress || 0}%</span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avance</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 px-2">
                                <div>
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                                        <span className="text-slate-500">Validado</span>
                                        <span className="text-emerald-500">{stats?.statusDistribution?.validated || 0}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${stats?.statusDistribution?.validated || 0}%` }} />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5 pt-2">
                                        <span className="text-slate-500">En Revisión</span>
                                        <span className="text-amber-500">{stats?.statusDistribution?.inReview || 0}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${stats?.statusDistribution?.inReview || 0}%` }} />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5 pt-2">
                                        <span className="text-slate-500">Borrador / Pendiente</span>
                                        <span className="text-rose-500">{stats?.statusDistribution?.draft || 0}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${stats?.statusDistribution?.draft || 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
