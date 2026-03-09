"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TopHeader } from "@/components/TopHeader";
import {
    Search,
    Filter,
    FileText,
    BarChart3,
    Clock,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Calendar,
    ArrowUpRight
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { AccessDenied } from "@/components/AccessDenied";

interface TrackingItem {
    id: number;
    type: 'narrativa' | 'estadística';
    title: string;
    entity: string;
    status: string;
    date: string;
    details: string;
    axis?: string;
    secont_observations?: string | null;
}

import { useSearchParams } from "next/navigation";

export default function TrackingInbox() {
    const { token, user } = useAuth();
    const isAdmin = user?.roles?.some(role => ["Administrador", 'super_admin'].includes(role));

    if (isAdmin) {
        return <AccessDenied />;
    }
    const searchParams = useSearchParams();
    const initialSearch = searchParams.get("search") || "";

    const [items, setItems] = useState<TrackingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [filterStatus, setFilterStatus] = useState("Todos");
    const [submitting, setSubmitting] = useState(false);

    const fetchTracking = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/tracking/all`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (error) {
            console.error("Tracking fetch failed", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTracking();
    }, [token]);

    const handleBulkSubmit = async () => {
        if (!token) return;
        setSubmitting(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

            const pendingItems = safeItems.filter(i => i.status === 'Borrador' || i.status === 'Completado');

            const res = await fetch(`${baseUrl}/api/tracking/bulk-submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ items: pendingItems.map(i => ({ id: i.id, type: i.type })) })
            });

            if (res.ok) {
                alert(`¡Envío Exitoso! Se han enviado ${pendingItems.length} capturas a validación SAFIN.`);
                await fetchTracking(); // Refresh the list
            } else {
                throw new Error("Failed to submit");
            }
        } catch (error) {
            console.error("Error submitting bulk tracking items:", error);
            alert("Error: Hubo un problema al enviar sus capturas. Inténtelo de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        const fetchTracking = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                const res = await fetch(`${baseUrl}/api/tracking/all`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setItems(data);
                }
            } catch (error) {
                console.error("Tracking fetch failed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTracking();
    }, [token]);

    const safeItems = Array.isArray(items) ? items : [];
    const filteredItems = safeItems.filter(item => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
            item.title.toLowerCase().includes(query) ||
            item.entity.toLowerCase().includes(query) ||
            (item.axis && item.axis.toLowerCase().includes(query));

        const matchesFilter = filterStatus === "Todos" ||
            item.status === filterStatus ||
            (filterStatus === "Con Observaciones" && item.status.includes("Observaciones"));
        return matchesSearch && matchesFilter;
    });

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'aprobado': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'completado': return 'bg-sky-100 text-sky-700 border-sky-200';
            case 'en validación': return 'bg-guinda-100 text-guinda-700 border-guinda-200';
            case 'borrador': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'con observaciones': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-amber-100 text-amber-700 border-amber-200';
        }
    };

    return (
        <>
            <TopHeader title="Centro de Seguimiento y Validación" />

            <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">

                {/* Header Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Buzón de Control</h2>
                        <p className="text-slate-500 font-medium">Gestione el flujo de validación de sus capturas.</p>
                    </div>

                    <div className="flex w-full md:w-auto gap-3">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <Input
                                className="h-12 pl-12 rounded-2xl border-slate-200 bg-white dark:bg-slate-900 shadow-sm focus:ring-2 focus:ring-guinda-500/20"
                                placeholder="Buscar programa o entidad..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-12 w-12 rounded-2xl p-0 border-slate-200 bg-white">
                            <Filter className="h-5 w-5 text-slate-600" />
                        </Button>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {["Todos", "Borrador", "Completado", "Aprobado", "Con Observaciones"].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap border-2 ${filterStatus === status
                                ? "bg-guinda-600 text-white border-guinda-600 shadow-lg shadow-indigo-100"
                                : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                {/* Tracking List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="py-24 flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-10 w-10 text-guinda-500 animate-spin" />
                            <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Sincronizando Historial...</p>
                        </div>
                    ) : filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                            <Card key={`${item.type}-${item.id}`} className="group border-none shadow-xl shadow-slate-200/40 hover:shadow-indigo-100/50 transition-all duration-300 rounded-[2rem] overflow-hidden cursor-pointer active:scale-[0.99]">
                                <CardContent className="p-0">
                                    <div className="flex flex-col lg:flex-row items-stretch">
                                        {/* Type Indicator */}
                                        <div className={`w-2 lg:w-4 ${item.type === 'narrativa' ? 'bg-guinda-500' : 'bg-amber-500'}`}></div>

                                        <div className="flex-1 p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center gap-6">
                                            {/* Icon & Title */}
                                            <Link href={`/inbox/${item.type}/${item.id}`} className="flex items-start gap-5 flex-1">
                                                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner ${item.type === 'narrativa' ? 'bg-guinda-50 text-guinda-600' : 'bg-amber-50 text-amber-600'
                                                    }`}>
                                                    {item.type === 'narrativa' ? <FileText className="h-7 w-7" /> : <BarChart3 className="h-7 w-7" />}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.type}</span>
                                                        <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.entity}</span>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-guinda-600 transition-colors line-clamp-1">{item.title}</h3>
                                                    <p className="text-sm text-slate-500 font-medium line-clamp-1">{item.details}</p>

                                                    {item.status.includes('Observaciones') && item.secont_observations && (
                                                        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 flex gap-3 text-red-800">
                                                            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                                                            <div className="text-xs font-medium">
                                                                <strong className="block mb-0.5">Motivo de Devolución:</strong>
                                                                {item.secont_observations}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>

                                            {/* Status & Meta */}
                                            <div className="flex items-center justify-between lg:justify-end gap-8 border-t lg:border-none pt-4 lg:pt-0">
                                                <div className="text-left lg:text-right space-y-1">
                                                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter border ${getStatusColor(item.status)}`}>
                                                        {item.status}
                                                    </div>
                                                    <div className="flex items-center lg:justify-end gap-1.5 text-slate-400 font-bold text-[11px]">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(item.date).toLocaleDateString()}
                                                    </div>
                                                </div>

                                                <Link href={`/inbox/${item.type}/${item.id}`}>
                                                    <Button size="icon" variant="ghost" className="h-12 w-12 rounded-2xl bg-slate-50 hover:bg-guinda-600 hover:text-white transition-all transform group-hover:translate-x-1">
                                                        <ChevronRight className="h-6 w-6" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] space-y-4">
                            <div className="h-20 w-20 rounded-full bg-slate-50 mx-auto flex items-center justify-center text-slate-200">
                                <Search className="h-10 w-10" />
                            </div>
                            <p className="text-slate-400 font-bold">No se encontraron capturas coincidentes.</p>
                        </div>
                    )}
                </div>

                {/* Summary Footer */}
                <Card className="border-none bg-guinda-900 text-white rounded-[2.5rem] p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-guinda-800 to-transparent opacity-50"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold">Estado de Validación Global</h3>
                            <p className="text-guinda-200 font-medium">Usted tiene {safeItems.filter(i => i.status === 'Borrador').length} borradores y {safeItems.filter(i => i.status === 'Completado').length} capturas listas para envío.</p>
                        </div>
                        <Button
                            onClick={handleBulkSubmit}
                            disabled={submitting || (safeItems.filter(i => i.status === 'Borrador' || i.status === 'Completado').length === 0)}
                            className="bg-white text-guinda-900 hover:bg-white/90 disabled:opacity-50 h-14 px-8 rounded-2xl font-black text-lg shadow-2xl flex items-center gap-2 transition-all">
                            {submitting ? (
                                <><Loader2 className="h-6 w-6 animate-spin" /> Procesando...</>
                            ) : (
                                <>Enviar Todo a Validación <ArrowUpRight className="h-6 w-6" /></>
                            )}
                        </Button>
                    </div>
                </Card>
            </div>
        </>
    );
}
