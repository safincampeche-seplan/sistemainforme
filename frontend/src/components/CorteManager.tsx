'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Layers, CheckCircle, AlertTriangle, Clock, Server } from "lucide-react";

interface CorteStatus {
    first_corte: { count: number; status: string };
    second_corte: { count: number; status: string };
    last_activity: string | null;
}

export default function CorteManager() {
    const [status, setStatus] = useState<CorteStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/admin/corte-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (error) {
            console.error("Error fetching corte status:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleTrigger = async () => {
        setTriggering(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/admin/trigger-second-corte`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                await fetchStatus();
                setConfirming(false);
                alert("Corte final generado con éxito.");
            } else {
                const err = await res.json();
                alert("Error: " + err.error);
            }
        } catch (error) {
            console.error("Error triggering corte:", error);
            alert("Error de conexión con el servidor.");
        } finally {
            setTriggering(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
    );

    return (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-guinda-500" />
                        <CardTitle className="text-lg font-bold">Gestión de Cortes Finales (Snapshots)</CardTitle>
                    </div>
                    <CardDescription>Controla los momentos de congelación de información para el Informe Anual.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchStatus} className="rounded-full text-slate-400 hover:text-guinda-600">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    {/* Primer Corte */}
                    <div className={`p-5 rounded-2xl border-2 transition-all ${status?.first_corte.status === 'active' ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-100 bg-slate-50/50 opacity-60'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-white p-2 rounded-xl shadow-sm">
                                <CheckCircle className={`h-5 w-5 ${status?.first_corte.status === 'active' ? 'text-emerald-500' : 'text-slate-300'}`} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paso 1</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mb-1">Primer Corte Final</h4>
                        <p className="text-2xl font-black text-slate-900 mb-1">{status?.first_corte.count || 0}</p>
                        <p className="text-xs text-slate-500 font-medium">Registros capturados al cierre inicial.</p>
                    </div>

                    {/* Segundo Corte */}
                    <div className={`p-5 rounded-2xl border-2 transition-all ${status?.second_corte.status === 'active' ? 'border-blue-100 bg-blue-50/10' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-white p-2 rounded-xl shadow-sm">
                                <Clock className={`h-5 w-5 ${status?.second_corte.status === 'active' ? 'text-blue-500' : 'text-slate-300'}`} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paso 2</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mb-1">Segundo Corte Final</h4>
                        <p className="text-2xl font-black text-slate-900 mb-1">{status?.second_corte.count || 0}</p>
                        <p className="text-xs text-slate-500 font-medium">Versión corregida y aprobada por SECONT.</p>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                        <div className="bg-white/10 p-4 rounded-full">
                            <Server className="h-8 w-8 text-blue-300" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h3 className="text-lg font-black tracking-tight">Cruce de Información Local → Histórico</h3>
                            <p className="text-sm text-slate-400 font-medium">
                                Al disparar el 2do corte, todas las narrativas con estado <span className="text-blue-400 font-bold">"Aprobado SECONT"</span> se copiarán a la tabla histórica definitiva.
                            </p>
                            {status?.last_activity && (
                                <p className="text-[10px] text-slate-500 flex items-center gap-2 justify-center md:justify-start mt-2">
                                    <Clock className="h-3 w-3" /> Última actualización global: {new Date(status.last_activity).toLocaleString()}
                                </p>
                            )}
                        </div>

                        {!confirming ? (
                            <Button
                                onClick={() => setConfirming(true)}
                                className="h-14 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl shadow-blue-900/40 gap-3 transition-all active:scale-95"
                            >
                                Iniciar Proceso de Corte
                            </Button>
                        ) : (
                            <div className="flex flex-col gap-3 w-full md:w-auto">
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest text-center mb-1 animate-pulse">
                                    ¿Estás completamente seguro?
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleTrigger}
                                        disabled={triggering}
                                        className="h-12 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition-all"
                                    >
                                        {triggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        SÍ, GENERAR AHORA
                                    </Button>
                                    <Button
                                        onClick={() => setConfirming(false)}
                                        disabled={triggering}
                                        variant="outline"
                                        className="h-12 px-6 rounded-xl border-white/20 text-white hover:bg-white/10 font-black transition-all"
                                    >
                                        CANCELAR
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Glass Decor */}
                    <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-white/5 to-transparent pointer-none" />
                </div>

                <div className="mt-6 flex items-start gap-3 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                            IMPORTANTE: El proceso de segundo corte sobreescribirá los registros existentes en la tabla histórica si ya existen (por ID). Asegúrese de que toda la información haya sido validada por los auditores correspondientes.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
