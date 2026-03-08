"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    History,
    ChevronLeft,
    FileText,
    Loader2,
    Clock,
    AlertCircle,
    CalendarDays
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export function SnapshotsViewer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [snapshotType, setSnapshotType] = useState<'narrativa' | 'anexo'>('narrativa');
    const [stage, setStage] = useState<'1' | '2'>('1');
    const [items, setItems] = useState<any[]>([]);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

    const fetchSnapshot = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/history/snapshots?type=${snapshotType}&stage=${stage}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setItems(await res.json());
            }
        } catch (e) {
            console.error("Snapshot fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && token) fetchSnapshot();
    }, [isOpen, snapshotType, stage, token]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={onClose} className="h-10 w-10 p-0 rounded-xl hover:bg-white shadow-sm transition-all border border-transparent hover:border-slate-100">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                <History className="h-5 w-5 text-indigo-600" />
                                Histórico de Cortes Finales
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consulta de Snapshots / Captura Congelada</p>
                        </div>
                    </div>

                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setSnapshotType('narrativa')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${snapshotType === 'narrativa' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Narrativas
                        </button>
                        <button
                            onClick={() => setSnapshotType('anexo')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${snapshotType === 'anexo' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Anexos
                        </button>
                    </div>
                </div>

                {/* Sub-Header: Stage Selector */}
                <div className="px-6 py-3 border-b border-slate-50 flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etapa del Corte:</span>
                    <div className="flex gap-2">
                        <Button
                            variant={stage === '1' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStage('1')}
                            className={`h-8 px-4 rounded-full text-[10px] font-black uppercase ${stage === '1' ? 'bg-amber-500 hover:bg-amber-600' : 'border-slate-200 text-slate-500'}`}
                        >
                            1er Corte (Preliminar)
                        </Button>
                        <Button
                            variant={stage === '2' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStage('2')}
                            className={`h-8 px-4 rounded-full text-[10px] font-black uppercase ${stage === '2' ? 'bg-teal-600 hover:bg-teal-700' : 'border-slate-200 text-slate-500'}`}
                        >
                            2do Corte (Final)
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                            <p className="text-sm font-bold text-slate-500 animate-pulse">Recuperando snapshot de base de datos...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-40">
                            <AlertCircle className="h-12 w-12 text-slate-300" />
                            <p className="text-sm font-bold text-slate-400">No se encontraron registros en este corte.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {items.map((item) => (
                                <div key={item.id} className="group bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:border-indigo-200 hover:shadow-md transition-all cursor-default relative overflow-hidden">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{item.ppa_name || item.name || `Folio #${item.id}`}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.dependency || 'Dependencia'}</span>
                                                <span className="h-1 w-1 rounded-full bg-slate-200" />
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">{item.status || 'Snapshot'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Fecha de Snapshot</p>
                                            <p className="text-[10px] font-bold text-slate-600 flex items-center gap-1 justify-end mt-0.5">
                                                <CalendarDays className="h-3 w-3" />
                                                {new Date(item.created_at || new Date()).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 hover:bg-indigo-50/50" disabled>
                                            Solo Lectura
                                        </Button>
                                    </div>
                                    <div className="absolute left-0 top-0 w-1 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex justify-end">
                    <Button onClick={onClose} className="rounded-xl bg-slate-900 text-white hover:bg-black font-bold h-10 px-6">
                        Cerrar Visor
                    </Button>
                </div>
            </div>
        </div>
    );
}
