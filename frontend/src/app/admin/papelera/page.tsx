"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    ArchiveRestore, Users, Building2, Database, CheckCircle2,
    RefreshCw, Search, AlertTriangle, ArrowLeft, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ENTITY_TYPES = [
    { id: "narratives", label: "Narrativas Capturadas", icon: Database },
    { id: "dependencies", label: "Dependencias (Directorios)", icon: Building2 }
];

export default function RecycleBinPage() {
    const { token, user } = useAuth();
    const [selectedType, setSelectedType] = useState<string>("narratives");
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Restore Dialog State
    const [recordToRestore, setRecordToRestore] = useState<any>(null);
    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        if (token) {
            fetchDeletedRecords(selectedType);
        }
    }, [token, selectedType]);

    const fetchDeletedRecords = async (type: string) => {
        setLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/admin/recycle-bin/${type}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setRecords(data);
            } else {
                setRecords([]);
            }
        } catch (error) {
            console.error("Error fetching deleted records:", error);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreConfirm = async () => {
        if (!recordToRestore) return;
        setRestoring(true);

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/admin/recycle-bin/${selectedType}/${recordToRestore.id}/restore`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                // Remove restored item from local state
                setRecords(prev => prev.filter(r => r.id !== recordToRestore.id));
                setIsRestoreDialogOpen(false);
                setRecordToRestore(null);
            } else {
                const errorData = await res.json();
                alert(errorData.error || "No se pudo restaurar el registro.");
            }
        } catch (error) {
            console.error("Error restoring record:", error);
            alert("Ocurrió un error al restaurar.");
        } finally {
            setRestoring(false);
        }
    };

    const openRestoreDialog = (record: any) => {
        setRecordToRestore(record);
        setIsRestoreDialogOpen(true);
    };

    const filteredRecords = records.filter(record =>
        (record.name && record.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.email && record.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.acronym && record.acronym.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!user?.roles?.includes('SuperAdministrador')) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-slate-50">
                <div className="max-w-md text-center p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
                    <p className="text-slate-500">Solo los Super Administradores pueden acceder a la Papelera de Reciclaje.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-8 bg-slate-50/50 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col gap-2 relative">
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-guinda-600 rounded-r-md"></div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-guinda-100/50 text-guinda-700 rounded-xl">
                            <ArchiveRestore className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Papelera de Reciclaje
                        </h1>
                    </div>
                    <p className="text-slate-500 ml-14">
                        Visualiza y recupera registros eliminados de forma segura con el sistema "Cero Backups".
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar menu for types */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 px-2">Categorías</h3>
                        {ENTITY_TYPES.map(type => {
                            const Icon = type.icon;
                            const isActive = selectedType === type.id;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${isActive
                                        ? "bg-guinda-600 text-white shadow-md shadow-guinda-600/20"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-transparent shadow-sm"
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {type.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Content Area */}
                    <div className="md:col-span-3 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col min-h-[500px]">

                        {/* Toolbar */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar en papelera..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-guinda-500 focus:border-transparent transition-all bg-white"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchDeletedRecords(selectedType)}
                                className="gap-2 text-slate-600 border-slate-200 hover:bg-slate-100"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                Refrescar
                            </Button>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 p-0 overflow-auto">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[300px]">
                                    <Loader2 className="h-8 w-8 animate-spin mb-4 text-guinda-600" />
                                    <p className="font-medium">Cargando registros eliminados...</p>
                                </div>
                            ) : filteredRecords.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[300px]">
                                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                                        <ArchiveRestore className="h-10 w-10 text-slate-300" />
                                    </div>
                                    <p className="font-medium text-slate-600">La papelera está vacía</p>
                                    <p className="text-sm mt-1">No hay registros eliminados en esta categoría.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {filteredRecords.map((record) => (
                                        <li key={record.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                            <div className="flex flex-col gap-1 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-slate-900">{record.name}</span>
                                                    {record.acronym && (
                                                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
                                                            {record.acronym}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    {record.email && (
                                                        <span className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                            {record.email}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                        Eliminado: {new Date(record.deleted_at).toLocaleString('es-MX')}
                                                    </span>
                                                    <span className="text-slate-400 font-mono text-[10px]">ID: {record.id}</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openRestoreDialog(record)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 hover:border-green-300 shrink-0"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                                Restaurar
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Restore Confirmation Dialog */}
            <ConfirmDialog
                isOpen={isRestoreDialogOpen}
                title="Restaurar Registro"
                message={`¿Estás seguro de que deseas reactivar este registro: ${recordToRestore?.name} ${recordToRestore?.email ? `(${recordToRestore.email})` : ''}? Este elemento volverá a estar disponible de forma inmediata en todo el sistema.`}
                confirmLabel="Restaurar"
                cancelLabel="Cancelar"
                variant="info"
                onConfirm={handleRestoreConfirm}
                onCancel={() => setIsRestoreDialogOpen(false)}
            />

        </div>
    );
}
