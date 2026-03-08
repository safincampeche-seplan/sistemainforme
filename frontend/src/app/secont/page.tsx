"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopHeader } from "@/components/TopHeader";
import {
    ShieldCheck, FileText, BarChart3, Clock, CheckCircle2,
    AlertTriangle, Eye, Loader2, ChevronRight, Building2, Search
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "next/link";

interface SecontItem {
    id: number;
    type: 'narrativa' | 'anexo';
    ppa_name?: string;
    entity_name?: string;
    dependency: string;
    status: string;
    created_at?: string;
    date?: string;
    secont_observations?: string | null;
    validated_by?: string | null;
    rows_count?: number;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    'Enviado a SECONT': {
        label: 'Pendiente de Revisión',
        cls: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <Clock className="h-3.5 w-3.5" />
    },
    'Aprobado SECONT': {
        label: 'Aprobado',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />
    },
    'Observaciones SECONT': {
        label: 'Con Observaciones',
        cls: 'bg-red-50 text-red-700 border-red-200',
        icon: <AlertTriangle className="h-3.5 w-3.5" />
    }
};

export default function SecontPage() {
    const { token, user, selectedPeriod } = useAuth();
    const { confirmEl, askConfirm } = useConfirmDialog();
    const [tab, setTab] = useState<'narrativas' | 'anexos'>('narrativas');
    const [items, setItems] = useState<SecontItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pendientes: 0, aprobados: 0, observaciones: 0, total: 0 });
    const [search, setSearch] = useState('');
    const [notification, setNotification] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

    const showNotif = (title: string, message: string, type: any = 'success') =>
        setNotification({ isOpen: true, title, message, type });

    const fetchItems = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const endpoint = tab === 'narrativas' ? 'narrativas' : 'anexos';
            const res = await fetch(`${baseUrl}/api/secont/${endpoint}?periodo=${selectedPeriod}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data.map((d: any) => ({ ...d, type: tab === 'narrativas' ? 'narrativa' : 'anexo' })));
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [token, tab, selectedPeriod, baseUrl]);

    const fetchStats = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${baseUrl}/api/secont/stats?periodo=${selectedPeriod}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setStats(await res.json());
        } catch (e) { console.error(e); }
    }, [token, selectedPeriod, baseUrl]);

    useEffect(() => { fetchItems(); }, [fetchItems]);
    useEffect(() => { fetchStats(); }, [fetchStats]);

    const handleReview = async (item: SecontItem, action: 'approve' | 'observe') => {
        if (item.status !== 'Enviado a SECONT') {
            showNotif('No disponible', 'Solo puede revisar registros pendientes.', 'error');
            return;
        }

        let observations = '';
        if (action === 'observe') {
            const inputVal = await askConfirm({
                title: 'Devolver con Observaciones',
                message: 'Ingrese las observaciones técnicas para devolver este registro a la dependencia:',
                confirmLabel: 'Confirmar y Devolver',
                variant: 'warning',
                isPrompt: true,
                promptPlaceholder: 'Escriba las observaciones aquí...'
            });
            if (!inputVal) return;
            observations = inputVal as string;
            if (!observations.trim()) {
                showNotif('Requerido', 'Debe ingresar observaciones para devolver el registro.', 'error');
                return;
            }
        } else {
            const ok = await askConfirm({
                title: 'Aprobar Registro',
                message: `¿Aprobar este ${item.type} como dictamen final de Contraloría (SECONT)?`,
                confirmLabel: 'Aprobar',
                variant: 'info',
            });
            if (!ok) return;
        }

        try {
            const res = await fetch(`${baseUrl}/api/secont/review/${item.type}/${item.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action, observations })
            });
            const data = await res.json();
            if (res.ok) {
                showNotif(action === 'approve' ? '✅ Aprobado' : '📋 Devuelto', data.message, action === 'approve' ? 'success' : 'info');
                fetchItems();
                fetchStats();
            } else {
                showNotif('Error', data.error, 'error');
            }
        } catch (e) {
            showNotif('Error', 'Error de conexión.', 'error');
        }
    };

    const filtered = items.filter(item => {
        const name = item.ppa_name || item.entity_name || '';
        return name.toLowerCase().includes(search.toLowerCase()) ||
            item.dependency.toLowerCase().includes(search.toLowerCase());
    });

    const statCards = [
        { label: 'Pendientes de Revisión', value: stats.pendientes, color: 'bg-amber-50 text-amber-700', icon: Clock },
        { label: 'Aprobados por Contraloría', value: stats.aprobados, color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
        { label: 'Con Observaciones', value: stats.observaciones, color: 'bg-red-50 text-red-700', icon: AlertTriangle },
        { label: 'Total en Bandeja', value: stats.total, color: 'bg-guinda-50 text-guinda-700', icon: ShieldCheck },
    ];

    return (
        <>
            {confirmEl}
            <TopHeader title="Módulo SECONT — Contraloría" />
            <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">

                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-guinda-600 flex items-center justify-center shadow-lg shadow-guinda-200">
                            <ShieldCheck className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bandeja de Contraloría</h2>
                            <p className="text-slate-400 font-medium text-sm">
                                Secretaría de la Contraloría — Revisión final del Informe de Gobierno {selectedPeriod}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {statCards.map(s => {
                        const Icon = s.icon;
                        return (
                            <div key={s.label} className={`${s.color} rounded-3xl p-5 space-y-2`}>
                                <Icon className="h-5 w-5 opacity-60" />
                                <p className="text-3xl font-black">{s.value}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{s.label}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Flujo explicativo */}
                <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-500">
                    <span className="px-3 py-1.5 bg-white rounded-xl border border-slate-200">Capturista</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                    <span className="px-3 py-1.5 bg-white rounded-xl border border-slate-200">Validador</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                    <span className="px-3 py-1.5 bg-guinda-100 text-guinda-700 rounded-xl border border-guinda-200 font-black">SECONT ← Aquí</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">Publicación</span>
                </div>

                {/* Tabs + Search */}
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTab('narrativas')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${tab === 'narrativas'
                                ? 'bg-guinda-600 text-white shadow-md shadow-guinda-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            <FileText className="h-4 w-4" /> Narrativas
                        </button>
                        <button
                            onClick={() => setTab('anexos')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${tab === 'anexos'
                                ? 'bg-guinda-600 text-white shadow-md shadow-guinda-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            <BarChart3 className="h-4 w-4" /> Anexo Estadístico
                        </button>
                    </div>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o dependencia..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-guinda-500 outline-none"
                        />
                    </div>
                </div>

                {/* Table */}
                <Card className="border-none shadow-xl shadow-slate-100/50 bg-white rounded-3xl overflow-hidden">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-24 gap-4">
                                <Loader2 className="h-10 w-10 text-guinda-600 animate-spin" />
                                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Cargando bandeja...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-24 space-y-4">
                                <ShieldCheck className="h-14 w-14 text-slate-200 mx-auto" />
                                <p className="text-lg font-black text-slate-400">Bandeja vacía</p>
                                <p className="text-sm text-slate-300 font-medium">No hay registros en revisión SECONT para el periodo {selectedPeriod}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/60 border-b border-slate-100">
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {tab === 'narrativas' ? 'Acción/Programa' : 'Entidad Estadística'}
                                            </th>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dependencia</th>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filtered.map(item => {
                                            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG['Enviado a SECONT'];
                                            const isPending = item.status === 'Enviado a SECONT';
                                            const name = item.ppa_name || item.entity_name || `Registro #${item.id}`;
                                            return (
                                                <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/40 transition-colors group">
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-2xl bg-guinda-50 flex items-center justify-center shrink-0">
                                                                {tab === 'narrativas'
                                                                    ? <FileText className="h-5 w-5 text-guinda-500" />
                                                                    : <BarChart3 className="h-5 w-5 text-guinda-500" />
                                                                }
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-900 text-sm group-hover:text-guinda-600 transition-colors leading-tight">
                                                                    {name}
                                                                </p>
                                                                {item.secont_observations && (
                                                                    <p className="text-[10px] font-bold text-red-500 mt-0.5 truncate max-w-xs">
                                                                        Obs: {item.secont_observations}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                                                            <Building2 className="h-3.5 w-3.5 text-slate-300" />
                                                            {item.dependency}
                                                        </div>
                                                    </td>
                                                    <td className="p-5">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${cfg.cls}`}>
                                                            {cfg.icon}
                                                            {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-5">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isPending && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleReview(item, 'approve')}
                                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs px-4 h-8 font-black"
                                                                    >
                                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                                        Aprobar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleReview(item, 'observe')}
                                                                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs px-4 h-8 font-black border-none"
                                                                    >
                                                                        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                                                        Observar
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {!isPending && (
                                                                <span className="text-xs text-slate-400 font-bold">
                                                                    {item.status === 'Aprobado SECONT' ? '✅ Dictamen emitido' : '📋 Devuelto'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification(n => ({ ...n, isOpen: false }))}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </>
    );
}
