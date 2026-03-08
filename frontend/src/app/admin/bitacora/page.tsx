"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopHeader } from "@/components/TopHeader";
import {
    Clock,
    User,
    FileText,
    Database,
    ShieldCheck,
    Search,
    Download,
    Filter,
    Calendar,
    Building2,
    Activity as ActivityIcon,
    LogIn,
    LogOut,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    ChevronLeft,
    ChevronRight,
    X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";

interface AuditLog {
    id: number;
    user_name?: string;
    user_email?: string;
    user_role?: string;
    dependency?: string;
    action?: string;
    type?: string;
    detail?: string;
    timestamp?: string;
}

const ACTION_TYPES = [
    { value: '', label: 'Todos los tipos' },
    { value: 'login', label: 'Inicio de sesión' },
    { value: 'logout', label: 'Cierre de sesión' },
    { value: 'create', label: 'Creación' },
    { value: 'update', label: 'Actualización' },
    { value: 'delete', label: 'Eliminación' },
    { value: 'export', label: 'Exportación' },
    { value: 'access', label: 'Acceso' },
    { value: 'user_admin', label: 'Administración' },
    { value: 'system', label: 'Sistema' },
];

const PAGE_SIZE = 20;

export default function BitacoraPage() {
    const { token, selectedPeriod } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const baseUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : 'http://localhost:3001';

    useEffect(() => {
        const fetchLogs = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const res = await fetch(`${baseUrl}/api/logs?periodo=${selectedPeriod}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Sort by timestamp descending
                    setLogs(Array.isArray(data) ? data.sort((a, b) =>
                        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
                    ) : []);
                }
                else setLogs([]);
            } catch (e) {
                console.error("Error cargando bitácora", e);
                setLogs([]);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [token, selectedPeriod]);

    // Reset page on filter change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, typeFilter, dateFrom, dateTo]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const query = searchTerm.toLowerCase();
            const matchSearch = !query ||
                (log.user_name || '').toLowerCase().includes(query) ||
                (log.user_email || '').toLowerCase().includes(query) ||
                (log.action || '').toLowerCase().includes(query) ||
                (log.detail || '').toLowerCase().includes(query) ||
                (log.dependency || '').toLowerCase().includes(query);

            const matchType = !typeFilter || (log.type || '') === typeFilter;

            const logDate = log.timestamp ? new Date(log.timestamp) : null;
            const matchFrom = !dateFrom || (logDate && logDate >= new Date(dateFrom + 'T00:00:00'));
            const matchTo = !dateTo || (logDate && logDate <= new Date(dateTo + 'T23:59:59'));

            return matchSearch && matchType && matchFrom && matchTo;
        });
    }, [logs, searchTerm, typeFilter, dateFrom, dateTo]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    // Group logs by date for timeline display
    const groupedLogs = useMemo(() => {
        const groups: Record<string, AuditLog[]> = {};
        paginatedLogs.forEach(log => {
            const date = log.timestamp
                ? new Date(log.timestamp).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : 'Sin fecha';
            if (!groups[date]) groups[date] = [];
            groups[date].push(log);
        });
        return groups;
    }, [paginatedLogs]);

    const getIcon = (type: string) => {
        const cls = "h-5 w-5";
        switch (type) {
            case 'login': return <LogIn className={`${cls} text-emerald-500`} />;
            case 'logout': return <LogOut className={`${cls} text-slate-400`} />;
            case 'create': return <Plus className={`${cls} text-guinda-500`} />;
            case 'update': return <Pencil className={`${cls} text-amber-500`} />;
            case 'delete': return <Trash2 className={`${cls} text-red-500`} />;
            case 'export': return <Download className={`${cls} text-guinda-500`} />;
            case 'user_admin': return <ShieldCheck className={`${cls} text-guinda-500`} />;
            case 'backup': return <Database className={`${cls} text-teal-600`} />;
            case 'config': return <ActivityIcon className={`${cls} text-orange-500`} />;
            default: return <FileText className={`${cls} text-slate-400`} />;
        }
    };

    const getBadgeStyles = (type: string) => {
        switch (type) {
            case 'login': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'logout': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'create': return 'bg-guinda-100 text-guinda-700 border-guinda-200';
            case 'update': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'delete': return 'bg-red-100 text-red-700 border-red-200';
            case 'user_admin': return 'bg-guinda-100 text-guinda-700 border-guinda-200';
            case 'backup': return 'bg-teal-100 text-teal-700 border-teal-200';
            default: return 'bg-slate-100 text-slate-500 border-slate-200';
        }
    };

    const handleExportCSV = () => {
        const header = 'ID,Fecha,Hora,Tipo,Acción,Detalle,Usuario,Email,Dependencia';
        const rows = filteredLogs.map(log => {
            const dt = log.timestamp ? new Date(log.timestamp) : null;
            const fecha = dt ? dt.toLocaleDateString('es-MX') : '';
            const hora = dt ? dt.toLocaleTimeString('es-MX') : '';
            const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
            return [
                log.id,
                escape(fecha),
                escape(hora),
                escape(log.type || ''),
                escape(log.action || ''),
                escape(log.detail || ''),
                escape(log.user_name || ''),
                escape(log.user_email || ''),
                escape(log.dependency || '')
            ].join(',');
        });
        const csv = '\uFEFF' + [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria_seplan_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setTypeFilter('');
        setDateFrom('');
        setDateTo('');
    };

    const hasFilters = searchTerm || typeFilter || dateFrom || dateTo;

    // Summary stats
    const stats = useMemo(() => ({
        total: logs.length,
        logins: logs.filter(l => l.type === 'login').length,
        updates: logs.filter(l => l.type === 'update' || l.type === 'create').length,
        critical: logs.filter(l => l.type === 'delete' || l.type === 'user_admin').length,
    }), [logs]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 px-4 md:px-0">
            <TopHeader title="Auditoría Avanzada" />

            <main className="max-w-6xl mx-auto w-full py-8 space-y-8 pb-20">
                {/* Intro Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-2">
                        <Badge variant="outline" className="text-guinda-600 border-guinda-200 bg-guinda-50 px-3 py-1 font-bold">FASE 12: TRANSPARENCIA</Badge>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Timeline de Actividad</h1>
                        <p className="text-slate-500 font-medium">Línea de tiempo cronológica de todas las interacciones con el sistema.</p>
                    </div>
                    <Button
                        onClick={handleExportCSV}
                        disabled={filteredLogs.length === 0}
                        className="bg-guinda-600 hover:bg-guinda-700 text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-indigo-200 flex gap-3 group transition-all"
                    >
                        <Download className="h-5 w-5 group-hover:translate-y-0.5 transition-transform" />
                        Exportar Reporte ({filteredLogs.length})
                    </Button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Registros', value: stats.total, icon: ActivityIcon, color: 'text-guinda-600', bg: 'bg-guinda-50 border-blue-100' },
                        { label: 'Sesiones', value: stats.logins, icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                        { label: 'Cambios', value: stats.updates, icon: Pencil, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
                        { label: 'Críticos', value: stats.critical, icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
                    ].map((s, idx) => (
                        <div key={idx} className={`${s.bg} border p-5 rounded-[2rem] flex flex-col justify-between h-32 hover:scale-[1.02] transition-transform cursor-default`}>
                            <div className="flex justify-between items-start">
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                                <s.icon className={`h-5 w-5 ${s.color} opacity-30`} />
                            </div>
                            <p className={`text-3xl font-black ${s.color}`}>{loading ? '...' : s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Filters Section */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                placeholder="Filtrar por usuario, acción o detalle..."
                                className="w-full pl-12 pr-4 h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-guinda-500 outline-none transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}
                            className="px-4 h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-guinda-500 outline-none min-w-[200px] appearance-none"
                        >
                            {ACTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-700 flex-1 md:flex-none">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent border-none text-xs font-bold focus:ring-0 outline-none w-32" />
                            <span className="text-slate-300">|</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent border-none text-xs font-bold focus:ring-0 outline-none w-32" />
                        </div>

                        {hasFilters && (
                            <Button variant="ghost" onClick={clearFilters} className="text-red-500 hover:text-red-600 font-black text-xs gap-2">
                                <X className="h-4 w-4" /> REINICIAR FILTROS
                            </Button>
                        )}

                        <div className="ml-auto text-xs font-bold text-slate-400">
                            Total filtrados: {filteredLogs.length}
                        </div>
                    </div>
                </div>

                {/* Timeline Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="h-12 w-12 text-guinda-600 animate-spin" />
                        <p className="text-slate-400 font-black tracking-widest uppercase text-xs">Sincronizando línea de tiempo...</p>
                    </div>
                ) : paginatedLogs.length === 0 ? (
                    <div className="text-center py-32 bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <ActivityIcon className="h-16 w-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                        <h3 className="text-xl font-black text-slate-400 uppercase">Sin Actividad</h3>
                        <p className="text-slate-500 font-medium">Ajusta los filtros para ver otros periodos o eventos.</p>
                    </div>
                ) : (
                    <div className="relative space-y-12 pl-4 md:pl-0">
                        {/* THE LINE (Vertical) */}
                        <div className="absolute left-8 md:left-1/2 top-4 bottom-4 w-0.5 bg-gradient-to-b from-guinda-500 via-slate-200 to-transparent hidden md:block transform -translate-x-1/2 opacity-20" />

                        {Object.entries(groupedLogs).map(([date, dayLogs]) => (
                            <div key={date} className="relative">
                                {/* Date Heading */}
                                <div className="flex justify-center mb-10 sticky top-24 z-10">
                                    <span className="px-6 py-2.5 bg-slate-900 dark:bg-guinda-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl">
                                        {date}
                                    </span>
                                </div>

                                <div className="space-y-6">
                                    {dayLogs.map((log, lIdx) => (
                                        <div key={log.id} className={`flex flex-col md:flex-row items-center gap-8 ${lIdx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                                            {/* Node Circle */}
                                            <div className="absolute left-8 md:left-1/2 h-4 w-4 rounded-full border-4 border-white bg-guinda-500 shadow-[0_0_10px_rgba(79,70,229,0.5)] md:transform md:-translate-x-1/2 z-20 hidden md:block" />

                                            {/* Log Card */}
                                            <div className="w-full md:w-[45%] group">
                                                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 group-hover:shadow-2xl group-hover:shadow-indigo-100 dark:group-hover:shadow-none group-hover:-translate-y-1 transition-all">
                                                    <div className="flex items-start justify-between gap-4 mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-50 dark:border-slate-700 flex items-center justify-center">
                                                                {getIcon(log.type || '')}
                                                            </div>
                                                            <div>
                                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${getBadgeStyles(log.type || '')}`}>
                                                                    {log.type}
                                                                </span>
                                                                <p className="text-xs text-slate-400 font-bold mt-1">
                                                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tight">
                                                        {log.action}
                                                    </h4>

                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 italic">
                                                        "{log.detail || 'Sin detalles registrados'}"
                                                    </p>

                                                    <div className="flex items-center gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                                                        <div className="h-9 w-9 rounded-xl bg-guinda-600 flex items-center justify-center text-white font-black text-xs">
                                                            {(log.user_name || 'SIS').substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-none truncate">{log.user_name || 'Sistema Automatico'}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 truncate">{log.dependency || 'OFICINA CENTRAL'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Spacer for other side */}
                                            <div className="hidden md:block w-[45%]" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-12 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-400">
                            Mostrando {paginatedLogs.length} de {filteredLogs.length} eventos históricos
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-2xl"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>

                            {Array.from({ length: totalPages }).map((_, i) => {
                                const page = i + 1;
                                // Basic logic to show limited page numbers
                                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                    return (
                                        <Button
                                            key={page}
                                            variant={currentPage === page ? 'default' : 'ghost'}
                                            className={`rounded-2xl w-12 h-12 font-black ${currentPage === page ? 'bg-guinda-600 shadow-xl shadow-indigo-100' : 'text-slate-400'}`}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </Button>
                                    );
                                }
                                if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="text-slate-300">...</span>;
                                return null;
                            })}

                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-2xl"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
