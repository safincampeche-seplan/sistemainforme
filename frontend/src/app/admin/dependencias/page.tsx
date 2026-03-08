"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopHeader } from "@/components/TopHeader";
import {
    Building2,
    Search,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    Users,
    Hash,
    ShieldAlert,
    FileSpreadsheet,
    UploadCloud
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

interface Dependency {
    id: string; // Changed from number to string to match backend BigInt serialization
    name: string;
    code: string;
    sector_id?: string;
    user_count?: number;
}

interface NotifState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
}

export default function DependenciasPage() {
    const { token } = useAuth();
    const { confirmEl, askConfirm } = useConfirmDialog();
    const [deps, setDeps] = useState<Dependency[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 15;

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDep, setEditingDep] = useState<Dependency | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', code: '' });
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const [notification, setNotification] = useState<NotifState>({
        isOpen: false, title: '', message: '', type: 'success'
    });

    const baseUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : 'http://localhost:3001';

    const fetchDeps = async () => {
        console.log("fetchDeps called. Token currently is:", token ? "Present" : "Null/Undefined");
        if (!token) return;
        setLoading(true);
        try {
            console.log("Fetching from:", `${baseUrl}/api/dependencies`);
            const res = await fetch(`${baseUrl}/api/dependencies`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Response status:", res.status);
            if (res.ok) {
                const data = await res.json();
                console.log("Data received:", data.length, "items");
                setDeps(data);
            } else {
                console.error("Response not OK:", res.status, res.statusText);
            }
        } catch (e) {
            console.error("Fetch error details:", e);
        }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchDeps(); }, [token]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const filtered = useMemo(() =>
        deps.filter(d =>
            d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        ), [deps, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const openCreate = () => {
        setEditingDep(null);
        setFormData({ name: '', code: '' });
        setIsModalOpen(true);
    };

    const openEdit = (dep: Dependency) => {
        setEditingDep(dep);
        setFormData({ name: dep.name, code: dep.code || '' });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;
        setIsSaving(true);
        try {
            const url = editingDep
                ? `${baseUrl}/api/dependencies/${editingDep.id}`
                : `${baseUrl}/api/dependencies`;
            const method = editingDep ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setNotification({ isOpen: true, title: '✅ Guardado', message: editingDep ? 'Dependencia actualizada correctamente.' : 'Dependencia creada correctamente.', type: 'success' });
                setIsModalOpen(false);
                fetchDeps();
            } else {
                setNotification({ isOpen: true, title: 'Error', message: data.error || 'Error al guardar.', type: 'error' });
            }
        } catch {
            setNotification({ isOpen: true, title: 'Error', message: 'Error de conexión.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (dep: Dependency) => {
        const ok = await askConfirm({
            title: 'Eliminar Dependencia',
            message: `¿Estás seguro de eliminar "${dep.name}"? Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            variant: 'danger',
        });
        if (!ok) return;
        setIsDeleting(dep.id);
        try {
            const res = await fetch(`${baseUrl}/api/dependencies/${dep.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setNotification({ isOpen: true, title: '✅ Eliminada', message: data.message, type: 'success' });
                fetchDeps();
            } else {
                setNotification({ isOpen: true, title: '⚠️ No se puede eliminar', message: data.error, type: 'error' });
            }
        } catch {
            setNotification({ isOpen: true, title: 'Error', message: 'Error de conexión.', type: 'error' });
        } finally {
            setIsDeleting(null);
        }
    };

    const handleImportExcel = async () => {
        if (!importFile || !token) return;
        setIsImporting(true);
        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const res = await fetch(`${baseUrl}/api/dependencies/import-excel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setNotification({
                    isOpen: true,
                    title: '✅ Importación Exitosa',
                    message: data.message,
                    type: 'success'
                });
                setIsImportModalOpen(false);
                setImportFile(null);
                fetchDeps();
            } else {
                setNotification({
                    isOpen: true,
                    title: 'Error de Importación',
                    message: data.error || 'No se pudo procesar el archivo.',
                    type: 'error'
                });
            }
        } catch (error) {
            setNotification({
                isOpen: true,
                title: 'Error de Red',
                message: 'Error al conectar con el servidor.',
                type: 'error'
            });
        } finally {
            setIsImporting(false);
        }
    };

    const totalUsers = deps.reduce((sum, d) => sum + (d.user_count || 0), 0);

    return (
        <>
            {confirmEl}
            <TopHeader title="Gestión de Dependencias" />
            <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Catálogo de Dependencias</h2>
                        <p className="text-slate-500 font-medium">Administre las {deps.length} dependencias registradas en el sistema.</p>
                    </div>
                    <div className="flex gap-4">
                        <Button
                            onClick={() => setIsImportModalOpen(true)}
                            variant="outline"
                            className="border-guinda-200 text-guinda-700 hover:bg-guinda-50 rounded-[1.25rem] px-6 py-7 font-black text-lg flex gap-3 transition-all"
                        >
                            <FileSpreadsheet className="h-5 w-5" /> Carga Masiva
                        </Button>
                        <Button
                            onClick={openCreate}
                            className="bg-guinda-600 hover:bg-guinda-700 text-white rounded-[1.25rem] px-8 py-7 font-black text-lg shadow-xl shadow-indigo-100 flex gap-3 transition-all hover:scale-105"
                        >
                            <Plus className="h-5 w-5" /> Nueva Dependencia
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Total Dependencias', value: deps.length, icon: Building2, color: 'text-guinda-700', bg: 'bg-guinda-50' },
                        { label: 'Con Usuarios Asignados', value: deps.filter(d => (d.user_count || 0) > 0).length, icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                        { label: 'Usuarios Totales', value: totalUsers, icon: Users, color: 'text-amber-700', bg: 'bg-amber-50' },
                    ].map(s => (
                        <div key={s.label} className={`${s.bg} rounded-3xl p-6 space-y-2`}>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                            <p className={`text-4xl font-black ${s.color}`}>{loading ? '0' : s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <Card className="border-none shadow-xl shadow-slate-100/50 bg-white rounded-3xl">
                    <CardContent className="p-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o clave de dependencia..."
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-guinda-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card className="border-none shadow-xl shadow-slate-100/50 bg-white rounded-3xl overflow-hidden">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-24 gap-4">
                                <Loader2 className="h-10 w-10 text-guinda-600 animate-spin" />
                                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Cargando catálogo...</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/60 border-b border-slate-50">
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dependencia</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clave</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Usuarios</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {paginated.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="p-20 text-center text-slate-400 font-bold">
                                                        No se encontraron dependencias.
                                                    </td>
                                                </tr>
                                            ) : paginated.map(dep => (
                                                <tr key={dep.id} className="hover:bg-slate-50/40 transition-colors group">
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-11 w-11 rounded-2xl bg-guinda-50 flex items-center justify-center shrink-0">
                                                                <Building2 className="h-5 w-5 text-guinda-500" />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-900 text-sm group-hover:text-guinda-600 transition-colors leading-tight">
                                                                    {dep.name}
                                                                </p>
                                                                <p className="text-xs text-slate-400 font-bold mt-0.5">ID: {dep.id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black">
                                                            <Hash className="h-3 w-3" />
                                                            {dep.code || <span className="text-slate-300 italic">Sin clave</span>}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black ${(dep.user_count || 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                                                            <Users className="h-3.5 w-3.5" />
                                                            {dep.user_count || 0}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => openEdit(dep)}
                                                                title="Editar"
                                                                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-guinda-600 hover:bg-guinda-50 transition-all"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(dep)}
                                                                disabled={isDeleting === dep.id}
                                                                title={dep.user_count ? 'Tiene usuarios asignados' : 'Eliminar'}
                                                                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${dep.user_count ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                                                            >
                                                                {isDeleting === dep.id
                                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                    : <Trash2 className="h-4 w-4" />
                                                                }
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-8 py-5 border-t border-slate-50">
                                        <p className="text-xs font-bold text-slate-400">
                                            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => p - 1)}
                                                className="rounded-xl font-black text-slate-400 hover:text-guinda-600">← Anterior</Button>
                                            <Button variant="ghost" size="sm" disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => p + 1)}
                                                className="rounded-xl font-black text-slate-400 hover:text-guinda-600">Siguiente →</Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <Card className="w-full max-w-lg border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                        <CardContent className="p-10 space-y-8">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-14 w-14 rounded-2xl bg-guinda-50 flex items-center justify-center mb-4">
                                        <Building2 className="h-7 w-7 text-guinda-600" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900">
                                        {editingDep ? 'Editar Dependencia' : 'Nueva Dependencia'}
                                    </h3>
                                    <p className="text-slate-400 font-medium text-sm">
                                        {editingDep ? 'Actualice el nombre o la clave de la dependencia.' : 'Registre una nueva dependencia en el catálogo.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-9 w-9 rounded-2xl flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-5">
                                {/* Name */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Nombre Completo <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej. Secretaría de Salud del Estado"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-guinda-500 outline-none placeholder:text-slate-300"
                                    />
                                </div>

                                {/* Code */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Clave / Siglas
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={20}
                                        placeholder="Ej. SSE"
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-guinda-500 outline-none placeholder:text-slate-300 uppercase"
                                    />
                                </div>

                                {editingDep && (editingDep.user_count || 0) > 0 && (
                                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-amber-700">
                                            Esta dependencia tiene <strong>{editingDep.user_count} usuario(s)</strong> asignados. Al cambiar el nombre se actualizarán automáticamente.
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-4 pt-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 rounded-[1.25rem] py-7 font-black text-slate-400 hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSaving || !formData.name.trim()}
                                        className="flex-1 bg-guinda-600 hover:bg-guinda-700 text-white rounded-[1.25rem] py-7 font-black shadow-xl shadow-indigo-100 flex gap-2 justify-center"
                                    >
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Building2 className="h-5 w-5" />}
                                        {isSaving ? 'Guardando...' : 'Guardar'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <Card className="w-full max-w-lg border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                        <CardContent className="p-10 space-y-8">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                                        <FileSpreadsheet className="h-7 w-7 text-indigo-600" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900">Carga Masiva desde Excel</h3>
                                    <p className="text-slate-400 font-medium text-sm">
                                        Sube un archivo .xlsx o .csv con las dependencias. El archivo debe contener al menos la columna "Nombre".
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="h-9 w-9 rounded-2xl flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div
                                    className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 transition-all ${importFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:border-guinda-300 bg-slate-50/50'
                                        }`}
                                >
                                    <div className={`h-16 w-16 rounded-full flex items-center justify-center ${importFile ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                        <UploadCloud className={`h-8 w-8 ${importFile ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    </div>
                                    <div className="text-center">
                                        {importFile ? (
                                            <>
                                                <p className="font-black text-emerald-900 text-lg">{importFile.name}</p>
                                                <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest">Archivo listo para importar</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="font-black text-slate-600 text-lg">Selecciona tu archivo Excel</p>
                                                <p className="text-slate-400 text-sm font-medium focus:outline-none">o arrastra y suelta aquí</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        className="absolute inset-x-10 h-40 opacity-0 cursor-pointer"
                                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                    />
                                </div>

                                <div className="flex flex-col gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Formato Sugerido con Sincronización</p>
                                        <div className="flex justify-center gap-6 text-xs text-slate-600 font-bold">
                                            <span>Nombre</span>
                                            <span className="text-slate-300">|</span>
                                            <span>Siglas</span>
                                            <span className="text-slate-300">|</span>
                                            <span>Sector (Nombre o ID)</span>
                                        </div>
                                    </div>

                                    <a
                                        href={`${baseUrl}/public/plantilla_dependencias.xlsx`}
                                        download
                                        className="text-center text-xs font-black text-guinda-600 hover:text-guinda-700 underline"
                                    >
                                        Descargar Plantilla de Ejemplo (.xlsx)
                                    </a>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsImportModalOpen(false)}
                                        className="flex-1 rounded-[1.25rem] py-7 font-black text-slate-400 hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleImportExcel}
                                        disabled={!importFile || isImporting}
                                        className="flex-1 bg-guinda-600 hover:bg-guinda-700 text-white rounded-[1.25rem] py-7 font-black shadow-xl shadow-indigo-100 flex gap-2 justify-center"
                                    >
                                        {isImporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                        {isImporting ? 'Importando...' : 'Iniciar Carga'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification(n => ({ ...n, isOpen: false }))}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </>
    );
}
