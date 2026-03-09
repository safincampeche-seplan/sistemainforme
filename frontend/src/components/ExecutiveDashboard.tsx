"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard,
    FileText,
    BarChart3,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SummaryData {
    narrativas: {
        total: number;
        pendientes_safin: number;
        en_validacion_safin: number;
        aprobados_safin: number;
        pendientes_secont: number;
        aprobados_secont: number;
        observados: number;
    };
    anexos: {
        total: number;
        aprobados: number;
        pendientes: number;
        observados: number;
    };
}

export function ExecutiveDashboard() {
    const { token, selectedPeriod, user } = useAuth();
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'narrativas' | 'anexos'>('narrativas');

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/dashboard/executive-summary?period=${selectedPeriod}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setData(await res.json());
            }
        } catch (e) {
            console.error("Dashboard fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token, selectedPeriod]);

    const isSecont = user?.roles?.includes('secont');

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center p-8 bg-slate-50/50 rounded-2xl border border-slate-100 min-h-[140px]">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-3" />
                <span className="text-sm font-medium text-slate-500">Cargando resumen ejecutivo...</span>
            </div>
        );
    }

    const n = data?.narrativas;
    const a = data?.anexos;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-6 duration-1000 ease-in-out">
            <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                        <LayoutDashboard className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 leading-none">Resumen Ejecutivo</h3>
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-1">ESTADÍSTICAS EN TIEMPO REAL</p>
                    </div>
                </div>

                <div className="flex bg-slate-100/50 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
                    <button
                        onClick={() => setView('narrativas')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all duration-300 ${view === 'narrativas' ? 'bg-white text-indigo-700 shadow-md border border-slate-100 scale-100' : 'text-slate-400 hover:text-slate-600 scale-95 opacity-70 hover:opacity-100'}`}
                    >
                        Narrativas
                    </button>
                    <button
                        onClick={() => setView('anexos')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all duration-300 ${view === 'anexos' ? 'bg-white text-indigo-700 shadow-md border border-slate-100 scale-100' : 'text-slate-400 hover:text-slate-600 scale-95 opacity-70 hover:opacity-100'}`}
                    >
                        Anexos
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {view === 'narrativas' ? (
                    <>
                        <StatCard
                            title="Total General"
                            value={n?.total || 0}
                            icon={<FileText className="h-4 w-4" />}
                            gradient="from-slate-700 to-slate-900"
                        />
                        <StatCard
                            title={isSecont ? "Pendientes SECONT" : "Pendientes SAFIN"}
                            value={isSecont ? n?.pendientes_secont || 0 : n?.pendientes_safin || 0}
                            icon={<Clock className="h-4 w-4" />}
                            gradient="from-amber-500 to-orange-600"
                        />
                        <StatCard
                            title={isSecont ? "Aprobados SECONT" : "Aprobados SAFIN"}
                            value={isSecont ? n?.aprobados_secont || 0 : n?.aprobados_safin || 0}
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            gradient="from-emerald-500 to-teal-600"
                        />
                        <StatCard
                            title="Observados"
                            value={n?.observados || 0}
                            icon={<AlertCircle className="h-4 w-4" />}
                            gradient="from-rose-500 to-red-600"
                        />
                    </>
                ) : (
                    <>
                        <StatCard
                            title="Total Anexos"
                            value={a?.total || 0}
                            icon={<BarChart3 className="h-4 w-4" />}
                            gradient="from-indigo-700 to-blue-900"
                        />
                        <StatCard
                            title="En Validación"
                            value={a?.pendientes || 0}
                            icon={<Clock className="h-4 w-4" />}
                            gradient="from-blue-500 to-indigo-600"
                        />
                        <StatCard
                            title="Aprobados"
                            value={a?.aprobados || 0}
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            gradient="from-teal-500 to-emerald-600"
                        />
                        <StatCard
                            title="Con Observaciones"
                            value={a?.observados || 0}
                            icon={<AlertCircle className="h-4 w-4" />}
                            gradient="from-pink-500 to-rose-600"
                        />
                    </>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, gradient }: { title: string; value: number; icon: React.ReactNode; gradient: string }) {
    return (
        <Card className="relative overflow-hidden border-none shadow-xl shadow-slate-200/40 rounded-3xl h-full group hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-500 bg-white border border-transparent hover:border-slate-100">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-700`} />
            <div className="p-6 flex flex-col justify-between h-full relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
                    <div className="p-2.5 rounded-xl bg-slate-50 text-slate-400 group-hover:text-indigo-600 group-hover:bg-white group-hover:shadow-sm transition-all duration-300 border border-transparent group-hover:border-slate-50">
                        {icon}
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900 tracking-tighter group-hover:scale-110 transition-transform origin-left duration-500">{value}</span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Registros</span>
                </div>
            </div>
            <div className={`absolute bottom-0 left-0 h-1.5 bg-gradient-to-r ${gradient} w-0 group-hover:w-full transition-all duration-700 ease-in-out`} />
        </Card>
    );
}
