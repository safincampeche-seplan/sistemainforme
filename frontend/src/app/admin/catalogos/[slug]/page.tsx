'use client';

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopHeader } from "@/components/TopHeader";
import {
    ArrowLeft,
    Plus,
    Save,
    Trash2,
    Edit2,
    Check,
    X,
    Loader2,
    Database,
    AlertTriangle,
    Link2,
    Search,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";

interface CatalogItem {
    id: any;
    name?: string;
    label?: string;
    description?: string;
    usageCount?: number;
    [key: string]: any;
}

const SLUG_LABELS: Record<string, string> = {
    'sectors': 'Sectores',
    'ppas-types': 'Tipos de PPA',
    'locations': 'Localidades',
    'periods': 'Periodos de Captura',
    'format-types': 'Tipos de Formato',
    'budget-programs': 'Programas Presupuestarios',
    'financing-sources': 'Fuentes de Financiamiento',
    'axis': 'Ejes Transversales',
    'dependencies': 'Dependencias',
    'beneficiary-types': 'Tipos de Beneficiario',
    'missions': 'Misiones (PED)',
    'narrative-titles': 'Títulos de Narrativa',
    'narrative-themes': 'Temas de Narrativa',
    'narrative-subthemes': 'Subtemas de Narrativa'
};

export default function CatalogEditorPage() {
    const { slug } = useParams();
    const router = useRouter();
    const { token } = useAuth();

    const [items, setItems] = useState<CatalogItem[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1, limit: 10 });
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState<any>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [newValue, setNewValue] = useState<string>("");
    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirmEl, askConfirm } = useConfirmDialog();

    const baseUrl = 'http://localhost:3001/api/admin/catalogs';

    const fetchItems = async (page: number = 1) => {
        setLoading(true);
        try {
            const url = new URL(`${baseUrl}/${slug}`);
            url.searchParams.append('page', page.toString());
            url.searchParams.append('limit', pagination.limit.toString());
            if (search) url.searchParams.append('search', search);

            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items);
                setPagination(data.pagination);
            } else {
                setItems([]); // Clear items on error to show "No hay elementos"
                const errorData = await res.json().catch(() => ({}));
                console.error("Fetch failed with status:", res.status, errorData.details || "");
            }
        } catch (error) {
            console.error("Error fetching catalog items:", error);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (token && slug) fetchItems(1);
        }, 300); // Debounce search
        return () => clearTimeout(timer);
    }, [token, slug, search]);

    const handleCreate = async () => {
        if (!newValue.trim()) return;
        setSaving(true);
        try {
            // Se asume que el campo principal es 'name'
            const res = await fetch(`${baseUrl}/${slug}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newValue })
            });
            if (res.ok) {
                setNewValue("");
                setIsAdding(false);
                fetchItems();
            }
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (id: any) => {
        if (!editValue.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`${baseUrl}/${slug}/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: editValue })
            });
            if (res.ok) {
                setEditingId(null);
                fetchItems();
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: CatalogItem) => {
        const isUsed = item.usageCount ? item.usageCount > 0 : false;

        const confirmed = await askConfirm({
            title: isUsed ? "¡Atención: Registro en Uso!" : "¿Eliminar Elemento?",
            message: isUsed
                ? `Este registro tiene ${item.usageCount} vínculos activos con narrativas capturadas. Eliminarlo causará inconsistencias en los datos históricos. ¿Estás absolutamente seguro?`
                : "Esta acción no se puede deshacer. El elemento se eliminará permanentemente del catálogo oficial.",
            confirmLabel: isUsed ? "Eliminar de todas formas" : "Eliminar",
            variant: "danger"
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`${baseUrl}/${slug}/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchItems();
            }
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

    const startEditing = (item: CatalogItem) => {
        setEditingId(item.id);
        setEditValue(item.name || item.label || "");
    };

    if (initialLoading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-guinda-600" />
        </div>
    );

    const catalogName = SLUG_LABELS[slug as string] || slug;

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            <TopHeader title={`Administrar: ${catalogName}`} />

            <main className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                <Button
                    variant="ghost"
                    onClick={() => router.push('/admin/catalogos')}
                    className="group text-slate-400 hover:text-guinda-600 font-bold mb-4 hover:bg-transparent -ml-2"
                >
                    <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Volver a Catálogos
                </Button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
                    <div className="space-y-2">
                        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter">{catalogName}</h1>
                        <p className="text-lg text-slate-500 font-medium max-w-md">Gestión centralizada de elementos y parámetros del sistema.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 min-w-[300px] group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                                {loading ? (
                                    <Loader2 className="h-4 w-4 text-guinda-500 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4 text-slate-400 group-focus-within:text-guinda-500 transition-colors" />
                                )}
                            </div>
                            <Input
                                placeholder="Buscar por nombre o ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-11 h-14 bg-white border-none shadow-lg shadow-slate-200/50 rounded-2xl focus-visible:ring-guinda-500 font-bold hover:shadow-xl hover:shadow-slate-300/50 transition-all text-base placeholder:text-slate-300"
                            />
                        </div>
                        {!isAdding && (
                            <Button
                                onClick={() => setIsAdding(true)}
                                className="bg-guinda-600 hover:bg-guinda-700 text-white font-extrabold rounded-2xl h-14 px-8 gap-3 shadow-xl shadow-guinda-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <Plus className="h-5 w-5" />
                                <span className="hidden sm:inline">Agregar Elemento</span>
                            </Button>
                        )}
                    </div>
                </div>

                <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-xl transition-all duration-500">
                    <CardHeader className="bg-white/50 border-b border-white px-10 py-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-guinda-50 rounded-2xl">
                                <Database className="h-6 w-6 text-guinda-600" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Listado de Elementos</CardTitle>
                                <CardDescription className="text-slate-400 font-bold">Base de datos maestra del catálogo</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isAdding && (
                            <div className="p-4 bg-guinda-50/30 border-b border-guinda-100 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex-1">
                                    <Input
                                        autoFocus
                                        placeholder="Nombre del nuevo elemento..."
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                        className="h-11 border-guinda-200 focus-visible:ring-guinda-500 font-bold"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={handleCreate} disabled={saving || !newValue.trim()} className="bg-guinda-600 hover:bg-guinda-700 text-white rounded-xl h-11 px-4">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        Guardar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="text-slate-500 hover:bg-white rounded-xl h-11 w-11 p-0">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="divide-y divide-slate-50">
                            {items.length === 0 ? (
                                <div className="px-10 py-24 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                                        <Database className="h-16 w-16 text-slate-300" />
                                        <p className="text-slate-500 font-extrabold text-xl font-outfit uppercase tracking-tighter">Sin registros</p>
                                    </div>
                                </div>
                            ) : (
                                items.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="px-10 py-6 flex items-center justify-between hover:bg-slate-50/50 transition-all duration-300 group"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <div className="flex-1 min-w-0 mr-8">
                                            {editingId === item.id ? (
                                                <div className="flex items-center gap-4 animate-in zoom-in-95 duration-200">
                                                    <Input
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(item.id)}
                                                        className="h-12 border-blue-200 focus-visible:ring-blue-500 font-bold bg-white shadow-inner rounded-xl"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" onClick={() => handleUpdate(item.id)} disabled={saving || !editValue.trim()} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-lg shadow-blue-100 font-bold">
                                                            <Check className="h-5 w-5 mr-1" />
                                                            Actualizar
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl h-11 w-11 p-0">
                                                            <X className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-6 text-slate-900">
                                                    <div className="flex items-center justify-center w-12 h-12 bg-slate-50 rounded-2xl group-hover:bg-white transition-all border border-transparent group-hover:border-slate-100 group-hover:shadow-sm">
                                                        <span className="text-[10px] font-black text-slate-300 group-hover:text-guinda-600/50 transition-colors uppercase tracking-widest">{item.id.toString()}</span>
                                                    </div>
                                                    <p className="text-lg font-bold text-slate-800 tracking-tight group-hover:text-guinda-700 transition-colors truncate">
                                                        {item.name || item.label || "Sin nombre"}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="min-w-[140px] flex justify-end">
                                                {(item.usageCount ?? 0) > 0 ? (
                                                    <Badge
                                                        variant="secondary"
                                                        className="bg-guinda-50/50 text-guinda-700 border-guinda-100/50 font-black px-3 py-1.5 rounded-xl flex gap-2 items-center whitespace-nowrap shadow-sm text-[10px] uppercase tracking-tighter"
                                                    >
                                                        <Link2 className="h-3.5 w-3.5" />
                                                        {item.usageCount} Vínculos
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-slate-300 border-slate-100 font-bold px-3 py-1.5 rounded-xl whitespace-nowrap text-[10px] uppercase tracking-tighter"
                                                    >
                                                        Sin Uso
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {editingId !== item.id && (
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => startEditing(item)}
                                                            className="h-11 w-11 p-0 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-blue-100"
                                                        >
                                                            <Edit2 className="h-5 w-5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(item)}
                                                            className="h-11 w-11 p-0 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-red-100"
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                    {pagination.pages > 1 && (
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Mostrando {items.length} de {pagination.total} registros
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.currentPage === 1 || loading}
                                    onClick={() => fetchItems(pagination.currentPage - 1)}
                                    className="h-10 px-4 rounded-xl border-slate-200 font-bold hover:bg-white hover:text-guinda-600 transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Anterior
                                </Button>
                                <div className="flex items-center gap-1 mx-2">
                                    <span className="text-sm font-black text-slate-900">{pagination.currentPage}</span>
                                    <span className="text-sm font-medium text-slate-400">/</span>
                                    <span className="text-sm font-medium text-slate-400">{pagination.pages}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.currentPage === pagination.pages || loading}
                                    onClick={() => fetchItems(pagination.currentPage + 1)}
                                    className="h-10 px-4 rounded-xl border-slate-200 font-bold hover:bg-white hover:text-guinda-600 transition-all"
                                >
                                    Siguiente
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-500 italic">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="text-xs font-medium leading-relaxed">
                        Los IDs de los elementos son inmutables para mantener la coherencia referencial en el sistema.
                    </p>
                </div>
            </main>
            {confirmEl}
        </div>
    );
}
