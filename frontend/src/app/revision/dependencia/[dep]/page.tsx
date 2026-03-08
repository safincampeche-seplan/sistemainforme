"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TopHeader } from "@/components/TopHeader";
import {
    Search,
    Filter,
    FileText,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Calendar,
    CheckCircle2,
    ArrowLeft
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface TrackingItem {
    id: number;
    type: 'narrativa' | 'estadística';
    title: string;
    entity: string;
    status: string;
    date: string;
    details: string;
}

export default function DependencyRevision() {
    const { dep } = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const [items, setItems] = useState<TrackingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [depName, setDepName] = useState("");

    useEffect(() => {
        const fetchDepData = async () => {
            if (!token) return;
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

                // 1. Obtener nombre de la dependencia
                const depsRes = await fetch(`${baseUrl}/api/catalogs/dependencies`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (depsRes.ok) {
                    const deps = await depsRes.json();
                    if (Array.isArray(deps)) {
                        const currentDep = deps.find((d: any) => d.id === parseInt(dep as string));
                        setDepName(currentDep ? currentDep.name : "Dependencia Ejecutora");
                    }
                }

                // 2. Obtener items filtrados (Usando el query param del backend)
                const res = await fetch(`${baseUrl}/api/tracking/all?dependencyId=${dep}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setItems(data);
                    }
                }
            } catch (error) {
                console.error("Dependency fetch failed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDepData();
    }, [token, dep]);

    const safeItems = Array.isArray(items) ? items : [];
    const filteredItems = safeItems.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="h-screen flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-guinda-600 animate-spin" />
        </div>
    );

    return (
        <>
            <TopHeader title={`Expediente: ${depName}`} />

            <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">

                {/* Header & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => router.back()}
                            className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-100 p-0"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="space-y-0.5">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Todas las Capturas</h2>
                            <p className="text-slate-500 font-medium text-sm">Mostrando el historial completo de esta entidad.</p>
                        </div>
                    </div>

                    <div className="flex w-full md:w-auto gap-3">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                className="h-11 pl-10 rounded-xl border-slate-200 bg-white"
                                placeholder="Filtrar capturas..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Items List */}
                <div className="grid gap-4">
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                            <Card key={`${item.type}-${item.id}`} className="group border-none shadow-md shadow-slate-100 hover:shadow-indigo-100/50 transition-all rounded-3xl overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="flex items-center p-6 gap-6">
                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${item.type === 'narrativa' ? 'bg-guinda-50 text-guinda-600' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                            {item.type === 'narrativa' ? <FileText className="h-6 w-6" /> : <BarChart3 className="h-6 w-6" />}
                                        </div>

                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 border-none">{item.type}</Badge>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(item.date).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 group-hover:text-guinda-600 transition-colors line-clamp-1">{item.title}</h4>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <Badge className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${item.status === 'Aprobado' ? 'bg-emerald-500' : 'bg-guinda-600'
                                                }`}>
                                                {item.status}
                                            </Badge>
                                            <Link href={`/inbox/${item.type}/${item.id}`}>
                                                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-slate-50 hover:bg-guinda-600 hover:text-white">
                                                    <ChevronRight className="h-5 w-5" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem] space-y-3">
                            <p className="text-slate-400 font-bold">No se encontraron registros para esta dependencia.</p>
                            <Button variant="link" onClick={() => setSearchTerm("")}>Limpiar filtros</Button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
