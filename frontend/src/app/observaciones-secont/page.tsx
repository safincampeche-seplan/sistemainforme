"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { TopHeader } from "@/components/TopHeader";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Activity {
    id: number;
    type: string;
    title: string;
    status: string;
    date: string;
}

export default function ObservacionesSECONT() {
    const { user, token, selectedPeriod } = useAuth();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        async function fetchData() {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                const res = await fetch(`${baseUrl}/api/activities?periodo=${selectedPeriod}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                const safeData = Array.isArray(data) ? data : [];
                // Filtramos solo las que dicen "Observado"
                const observadas = safeData.filter((act: Activity) =>
                    act.status?.toLowerCase().includes('observado') && act.type === 'narrative'
                );
                setActivities(observadas);
            } catch (error) {
                console.error("Failed to fetch activities:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [token, selectedPeriod]);

    return (
        <>
            <TopHeader title="Observaciones SECONT" />
            <div className="p-6 md:p-8 animate-in fade-in duration-700 max-w-5xl mx-auto">
                <div className="mb-8 space-y-2">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                        Bandeja de Observaciones
                    </h1>
                    <p className="text-slate-500 text-lg">
                        Revisa y corrige las narrativas que han sido observadas por la Contraloría (SECONT).
                    </p>
                </div>

                <Card className="border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden rounded-[2rem]">
                    <CardHeader className="border-b border-slate-50 pb-6 bg-red-50/30">
                        <div className="space-y-1">
                            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                                Narrativas Pendientes de Atención
                            </CardTitle>
                            <CardDescription>
                                Debes editar la narrativa y volver a guardarla para solventar la observación.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-50 min-h-[440px]">
                            {loading ? (
                                <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
                                    <Loader2 className="h-8 w-8 text-red-400 animate-spin" />
                                    <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Consultando API...</p>
                                </div>
                            ) : activities.length > 0 ? activities.map((item) => (
                                <Link
                                    key={item.id}
                                    href={`/captura-narrativa?id=${item.id}`}
                                    className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-all group/item cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm group-hover/item:scale-110 transition-transform bg-red-50 text-red-600">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-slate-900 group-hover/item:text-red-600 transition-colors tracking-tight">{item.title}</p>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-tight mt-1">
                                                Folio de Gestión: {item.id ? `#${item.id.toString().slice(-6)}` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div className="hidden sm:block">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-100 px-2 py-1 rounded-md inline-block">
                                                {item.status || "Observado"}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-1 mt-2">
                                                <Clock className="h-3 w-3" />
                                                {item.date}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover/item:text-red-500 transform group-hover/item:translate-x-1 transition-all" />
                                    </div>
                                </Link>
                            )) : (
                                <div className="py-32 text-center flex flex-col items-center justify-center space-y-4 opacity-50">
                                    <div className="h-24 w-24 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                                        <AlertCircle className="h-12 w-12 text-emerald-400" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-700">Todo al día</h3>
                                    <p className="text-slate-400 font-bold max-w-sm">No tienes narrativas con observaciones de SECONT en este periodo.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
