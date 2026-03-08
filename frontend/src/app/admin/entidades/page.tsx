"use client";

import { useEffect, useState } from "react";
import { TopHeader } from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Database, Pencil, Trash2, Search, Filter, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function GestionEntidades() {
    const { token } = useAuth();
    const [entities, setEntities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 8;

    useEffect(() => {
        const fetchEntities = async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                const res = await fetch(`${baseUrl}/api/admin/entities?periodo=2026`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                setEntities(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Fetch entities failed", error);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchEntities();
    }, [token]);

    const filteredEntities = entities.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.dependency?.name?.toLowerCase().includes(search.toLowerCase())
    );

    // Reiniciar página al buscar
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const totalPages = Math.ceil(filteredEntities.length / PAGE_SIZE);
    const paginatedEntities = filteredEntities.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    return (
        <ProtectedRoute module="GESTION_MATRICES">
            <TopHeader title="Gestión de Matrices (Anexo Estadístico)" />

            <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
                {/* Actions Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Matrices de Datos</h2>
                        <p className="text-sm text-slate-500">Administra las estructuras de tablas para el Anexo Estadístico.</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/admin/entidades/nueva">
                            <Button className="bg-guinda-600 hover:bg-guinda-700 h-11 px-6 rounded-xl gap-2 font-bold shadow-lg shadow-guinda-100 transition-all active:scale-95">
                                <Plus className="h-5 w-5" /> Nueva Matriz
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Filters */}
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100">
                    <CardContent className="p-4 flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nombre o dependencia..."
                                className="pl-10 h-11 rounded-xl border-slate-200 focus:border-guinda-300"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-11 rounded-xl gap-2 border-slate-200">
                            <Filter className="h-4 w-4" /> Filtros Avanzados
                        </Button>
                    </CardContent>
                </Card>

                {/* Grid View */}
                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 border-b">
                                    <TableHead className="font-bold py-5 pl-8">Nombre de la Matriz</TableHead>
                                    <TableHead className="font-bold">Dependencia</TableHead>
                                    <TableHead className="font-bold">Columnas</TableHead>
                                    <TableHead className="font-bold">Estado</TableHead>
                                    <TableHead className="text-right pr-8">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-20 text-center text-slate-400 font-medium">
                                            Cargando catálogo de matrices...
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedEntities.length > 0 ? (
                                    paginatedEntities.map((entity) => (
                                        <TableRow key={entity.id} className="hover:bg-slate-50/30 transition-colors border-b last:border-0 group">
                                            <TableCell className="py-5 pl-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-guinda-50 group-hover:text-guinda-600 transition-colors">
                                                        <LayoutGrid className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 uppercase text-sm leading-tight max-w-[300px] truncate" title={entity.name}>{entity.name}</p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">ID: #{entity.id}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="rounded-full bg-slate-50 border-slate-200 text-slate-600 font-bold text-[10px] px-3 max-w-[180px] truncate" title={entity.dependency?.name || "Global"}>
                                                    {entity.dependency?.name || "Global"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex -space-x-2 text-slate-500 font-medium text-xs">
                                                    {entity.properties?.length || 0} columnas configuradas
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-bold uppercase tracking-widest">
                                                    Activa
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/admin/anexo-estadistico/${entity.id}`}>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl" title="Ver Datos del Cajero">
                                                            <Database className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/admin/entidades/${entity.id}`}>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-24 text-center">
                                            <Database className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">No se encontraron matrices con ese nombre</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination Footer */}
                        {!loading && totalPages > 1 && (
                            <div className="p-6 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                                    Página {currentPage} de {totalPages} · {filteredEntities.length} Matrices
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="h-9 w-9 p-0 rounded-xl"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    {/* Números de página simples */}
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;

                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`h-9 w-9 p-0 rounded-xl font-bold ${currentPage === pageNum ? 'bg-guinda-600 shadow-md shadow-guinda-100' : ''}`}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="h-9 w-9 p-0 rounded-xl"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
