"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
    Activity,
    User,
    Calendar,
    Tag,
    Search,
    Loader2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function AuditLogTable() {
    const { token } = useAuth();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/history/activity-logs?limit=50`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setLogs(await res.json());
            }
        } catch (e) {
            console.error("Audit log fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchLogs();
    }, [token]);

    const filteredLogs = logs.filter(log =>
        log.event?.toLowerCase().includes(filter.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(filter.toLowerCase()) ||
        log.user?.email?.toLowerCase().includes(filter.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
            <span className="text-sm font-bold text-slate-500">Cargando bitácora de auditoría...</span>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Bitácora de Actividad</h3>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filtrar por evento o usuario..."
                        className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-[10px] font-bold w-64 focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Card className="border-slate-100 shadow-sm overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-tighter">
                            <tr>
                                <th className="px-4 py-3">Fecha y Hora</th>
                                <th className="px-4 py-3">Usuario</th>
                                <th className="px-4 py-3">Evento / Acción</th>
                                <th className="px-4 py-3">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-slate-600 font-bold">
                                            <Calendar className="h-3 w-3 text-slate-300" />
                                            {new Date(log.created_at).toLocaleString('es-MX', {
                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[9px] group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                {log.user?.name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 leading-none">{log.user?.name || 'Sistema'}</p>
                                                <p className="text-[9px] text-slate-400 mt-0.5">{log.user?.email || 'system@seplan.gob'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-tighter text-[9px] ${log.event?.includes('approved') ? 'bg-emerald-50 text-emerald-600' :
                                                log.event?.includes('observed') ? 'bg-rose-50 text-rose-600' :
                                                    'bg-slate-100 text-slate-600'
                                            }`}>
                                            {log.event?.replace(/_/g, ' ') || 'Evento'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-slate-500 max-w-xs truncate">{log.description || '-'}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
