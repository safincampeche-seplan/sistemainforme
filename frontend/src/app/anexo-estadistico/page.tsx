"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopHeader } from "@/components/TopHeader";
import { useAuth } from "@/context/AuthContext";
import {
    BarChart3,
    ArrowUpRight,
    Search,
    Filter,
    Table as TableIcon,
    PieChart as PieChartIcon,
    Download,
    Calendar,
    Clock
} from "lucide-react";

interface StatisticalTable {
    id: string;
    name: string;
    department: string;
    status: string;
    lastUpdate: string;
}

export default function AnexoEstadistico() {
    const { token } = useAuth();
    const [tables, setTables] = useState<StatisticalTable[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        async function fetchTables() {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                const res = await fetch(`${baseUrl}/api/entities`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setTables(data);
            } catch (error) {
                console.error("Failed to fetch tables:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchTables();
    }, [token]);

    return (
        <>
            <TopHeader title="Control de Anexo Estadístico" />

            <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-700">
                {/* Filters and Search Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input className="pl-10 h-11 bg-white border-slate-200 focus-visible:ring-guinda-500" placeholder="Buscar variable o tabla..." />
                    </div>
                    <div className="flex w-full md:w-auto gap-3">
                        <Button variant="outline" className="flex-1 md:flex-none gap-2 h-11 border-slate-200 hover:bg-slate-50">
                            <Filter className="h-4 w-4 text-slate-500" />
                            Filtrar
                        </Button>
                        <Button className="flex-1 md:flex-none gap-2 h-11 bg-guinda-600 hover:bg-guinda-700 shadow-md transition-all active:scale-95">
                            <Download className="h-4 w-4" />
                            Exportar Todo
                        </Button>
                    </div>
                </div>

                {/* Dashboards and Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Visual Board */}
                    <Card className="lg:col-span-2 shadow-xl shadow-slate-200/40 border-slate-200 dark:border-slate-800 dark:shadow-none bg-white">
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                            <div>
                                <CardTitle className="text-lg">Progreso General por Sector</CardTitle>
                                <CardDescription>Visualización del cumplimiento de metas 2026.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-lg">
                                <Button variant="ghost" size="sm" className="h-8 px-3 rounded-md bg-white shadow-sm text-xs font-semibold text-guinda-600">Sectores</Button>
                                <Button variant="ghost" size="sm" className="h-8 px-3 rounded-md text-xs font-semibold text-slate-500">Municipios</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="h-[300px] w-full flex items-end gap-6 justify-between">
                                {[
                                    { label: "Educación", value: "85%", h: "85%" },
                                    { label: "Infra", value: "62%", h: "62%" },
                                    { label: "Salud", value: "94%", h: "94%" },
                                    { label: "Turismo", value: "45%", h: "45%" },
                                    { label: "Seguridad", value: "78%", h: "78%" },
                                    { label: "Cultura", value: "55%", h: "55%" },
                                ].map((bar, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                                        <div className="w-full relative">
                                            <div
                                                className="w-full bg-guinda-600 rounded-t-xl transition-all duration-500 group-hover:bg-guinda-500 relative flex items-center justify-center"
                                                style={{ height: bar.h }}
                                            >
                                                <span className="absolute -top-8 text-xs font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{bar.value}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 rotate-45 sm:rotate-0 mt-4">{bar.label}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Statistics */}
                    <div className="space-y-6">
                        <Card className="shadow-xl shadow-slate-200/40 border-none bg-gradient-to-br from-guinda-600 to-guinda-800 text-white p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <PieChartIcon className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full border border-emerald-500/20">
                                    <ArrowUpRight className="h-3 w-3" />
                                    +4.2%
                                </div>
                            </div>
                            <h3 className="text-guinda-100 text-sm font-medium mb-1">Índice de Captura</h3>
                            <p className="text-3xl font-bold mb-4">78.4% <span className="text-lg font-normal text-guinda-300">/ 100%</span></p>
                            <div className="w-full h-2 bg-guinda-900/40 rounded-full overflow-hidden">
                                <div className="h-full bg-guinda-300 w-[78.4%] rounded-full shadow-[0_0_12px_rgba(165,180,252,0.5)]"></div>
                            </div>
                            <p className="text-xs text-guinda-200 mt-4 leading-relaxed italic opacity-80">
                                Faltan 22 cuadros estadísticos críticos para completar el periodo actual.
                            </p>
                        </Card>

                        <Card className="shadow-xl shadow-slate-200/40 border-slate-200 bg-white">
                            <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-amber-500" />
                                    Próximos Cierres
                                </CardTitle>
                                <Button variant="link" size="sm" className="text-xs text-guinda-600 font-bold p-0">Ver todos</Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {[
                                        { title: "Reporte Trimestral IV", date: "Marzo 15", status: "Pendiente" },
                                        { title: "Cierre Fiscal Anual", date: "Abril 02", status: "Urgente" },
                                        { title: "Metas de Secretaría", date: "Junio 10", status: "Programado" },
                                    ].map((item, id) => (
                                        <div key={id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">{item.title}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{item.date}</p>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.status === 'Urgente' ? 'bg-red-50 text-red-600' :
                                                item.status === 'Pendiente' ? 'bg-amber-50 text-amber-600' :
                                                    'bg-guinda-50 text-guinda-600'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Data Table */}
                <Card className="shadow-xl shadow-slate-200/40 border-slate-200 dark:border-slate-800 dark:shadow-none bg-white">
                    <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-3">
                                    <TableIcon className="h-5 w-5 text-guinda-600" />
                                    Listado de Cédulas Estadísticas
                                </CardTitle>
                                <CardDescription>Explora y edita las tablas registradas por tu dependencia.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b bg-slate-50/50">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cédula ID</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre de la Tabla</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dependencia</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Estatus</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-400 font-bold text-sm uppercase animate-pulse">Consultando catálogos...</td>
                                        </tr>
                                    ) : tables.map((row) => (
                                        <tr key={row.id} className="hover:bg-guinda-50/30 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-bold text-guinda-600">{row.id}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900 truncate max-w-[400px]" title={row.name}>{row.name}</td>
                                            <td className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-tight truncate max-w-[200px]" title={row.department || "SEPLAN"}>{row.department || "SEPLAN"}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${row.status === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' :
                                                    row.status === 'En Revisión' ? 'bg-guinda-100 text-guinda-700' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-slate-500 hover:text-guinda-600 hover:bg-guinda-50 transition-all active:scale-95">
                                                    Gestionar
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                            <span>Mostrando {tables.length} de {tables.length} tablas totales</span>
                            <div className="flex gap-2">
                                <Button disabled variant="outline" size="sm" className="h-8 px-3 rounded-md transition-all active:scale-95">Anterior</Button>
                                <Button variant="outline" size="sm" className="h-8 px-3 rounded-md border-slate-200 transition-all active:scale-95">Siguiente</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
