"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopHeader } from "@/components/TopHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Save, Plus, Database, Loader2, CheckCircle2, AlertCircle,
    FileSpreadsheet, AlertTriangle, Upload, Clock, BarChart3,
    Eye, Trash2, ChevronRight, ArrowLeft, X, Search, ChevronLeft,
    Filter, ListFilter, RefreshCw
} from "lucide-react";
import { useState, useEffect, useRef } from "react";


import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Link from "next/link";


// =============================================================
// FLOW STATES
// 'dashboard'  => Vista principal con tarjetas de progreso
// 'editor'     => Edición de filas de una entidad seleccionada
// =============================================================

export default function CapturaEstadistica() {
    const { token, selectedPeriod } = useAuth();
    const isReadOnly = selectedPeriod < 2026;

    const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
    const [entities, setEntities] = useState<any[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<any>(null);
    const [loadingEntities, setLoadingEntities] = useState(false);
    const [loadingRows, setLoadingRows] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [entryMap, setEntryMap] = useState<Record<number, boolean>>({});
    const [rows, setRows] = useState<any[]>([]);
    const [originalRows, setOriginalRows] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedSector, setSelectedSector] = useState<string>("all");
    const [selectedMission, setSelectedMission] = useState<string>("all");
    const [sectors, setSectors] = useState<any[]>([]);
    const [missions, setMissions] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const PAGE_SIZE = 9;


    const fileInputRef = useRef<HTMLInputElement>(null);

    const [notification, setNotification] = useState<{
        isOpen: boolean; title: string; message: string; type: "success" | "error" | "info";
    }>({ isOpen: false, title: "", message: "", type: "success" });

    const showNotification = (title: string, message: string, type: "success" | "error" | "info" = "success") => {
        setNotification({ isOpen: true, title, message, type });
    };

    const baseUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : 'http://localhost:3001';

    // -------------------------------------------------------
    // Cargar catálogos (Sectores y Misiones)
    // -------------------------------------------------------
    useEffect(() => {
        if (!token) return;

        const fetchCatalogs = async () => {
            try {
                const [secRes, missRes] = await Promise.all([
                    fetch(`${baseUrl}/api/catalogs/sectors`, { headers: { "Authorization": `Bearer ${token}` } }),
                    fetch(`${baseUrl}/api/catalogs/ped/missions`, { headers: { "Authorization": `Bearer ${token}` } })
                ]);

                if (secRes.ok) setSectors(await secRes.json());
                if (missRes.ok) setMissions(await missRes.json());
            } catch (err) {
                console.error("Error loading catalogs:", err);
            }
        };

        fetchCatalogs();
    }, [token, baseUrl]);

    // -------------------------------------------------------
    // Cargar entidades y mapa de progreso
    // -------------------------------------------------------
    useEffect(() => {
        if (!token) return;

        const fetchEntities = async () => {
            setLoadingEntities(true);
            try {
                let url = `${baseUrl}/api/entities?periodo=${selectedPeriod}`;
                if (selectedSector !== "all") url += `&sector_id=${selectedSector}`;
                if (selectedMission !== "all") url += `&mission_id=${selectedMission}`;

                const res = await fetch(url, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                const contentType = res.headers.get('content-type') || '';
                if (!res.ok || !contentType.includes('application/json')) {
                    console.error('Entities endpoint error:', res.status, await res.text());
                    setEntities([]);
                    setLoadingEntities(false);
                    return;
                }
                const raw = await res.json();
                const data: any[] = Array.isArray(raw) ? raw : [];
                setEntities(data);

                const map: Record<number, boolean> = {};
                await Promise.all(
                    data.map(async (e: any) => {
                        try {
                            const r = await fetch(`${baseUrl}/api/entries/${e.id}?periodo=${selectedPeriod}`, {
                                headers: { "Authorization": `Bearer ${token}` }
                            });
                            if (!r.ok) { map[e.id] = false; return; }
                            const ct = r.headers.get('content-type') || '';
                            if (!ct.includes('application/json')) { map[e.id] = false; return; }
                            const entryRows = await r.json();
                            map[e.id] = Array.isArray(entryRows) && entryRows.length > 0 && Object.values(entryRows[0] || {}).some(v => v !== "");
                        } catch { map[e.id] = false; }
                    })
                );
                setEntryMap(map);
            } catch (err) {
                console.error(err);
                showNotification("Error", "No se pudieron cargar las matrices. Verifica tu conexión.", "error");
            } finally {
                setLoadingEntities(false);
            }
        };

        fetchEntities();
    }, [token, selectedPeriod, selectedSector, selectedMission]);

    // -------------------------------------------------------
    // Reiniciar página al buscar o filtrar
    // -------------------------------------------------------
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedSector, selectedMission]);



    // -------------------------------------------------------
    // Abrir editor para una entidad
    // -------------------------------------------------------
    const openEditor = async (entity: any) => {
        setSelectedEntity(entity);
        setLoadingRows(true);
        setView('editor');
        setSuccess(false);

        try {
            const res = await fetch(`${baseUrl}/api/entries/${entity.id}?periodo=${selectedPeriod}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json')) {
                    // Respuesta no-JSON, posiblemente error HTML
                    const emptyRow = makeEmptyRow(entity);
                    setRows([emptyRow]);
                    setOriginalRows([emptyRow]);
                    return;
                }
                const existingRows = await res.json();
                if (Array.isArray(existingRows) && existingRows.length > 0) {
                    setRows(existingRows);
                    setOriginalRows(JSON.parse(JSON.stringify(existingRows)));
                } else {
                    const emptyRow = makeEmptyRow(entity);
                    setRows([emptyRow]);
                    setOriginalRows([emptyRow]);
                }
            } else {
                const emptyRow = makeEmptyRow(entity);
                setRows([emptyRow]);
                setOriginalRows([emptyRow]);
            }
        } catch (error) {
            console.error("Fetch entries failed", error);
            const emptyRow = makeEmptyRow(entity);
            setRows([emptyRow]);
            setOriginalRows([emptyRow]);
        } finally {
            setLoadingRows(false);
        }
    };

    const makeEmptyRow = (entity: any) =>
        entity.properties.reduce((acc: any, prop: any) => {
            acc[prop.id] = "";
            return acc;
        }, {});

    // -------------------------------------------------------
    // Cancelar => regresa al dashboard SIN guardar
    // -------------------------------------------------------
    const handleCancel = () => {
        setRows([]);
        setOriginalRows([]);
        setSelectedEntity(null);
        setSuccess(false);
        setView('dashboard');
    };

    // -------------------------------------------------------
    // Agregar fila vacía
    // -------------------------------------------------------
    const addRow = () => {
        if (!selectedEntity) return;
        setRows(prev => [...prev, makeEmptyRow(selectedEntity)]);
    };

    // -------------------------------------------------------
    // Eliminar fila
    // -------------------------------------------------------
    const removeRow = (idx: number) => {
        if (rows.length === 1) {
            showNotification("Aviso", "Debe existir al menos una fila. Limpia sus valores si no tienes datos.", "info");
            return;
        }
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    // -------------------------------------------------------
    // Actualizar valor en celda
    // -------------------------------------------------------
    const updateValue = (rowIdx: number, propId: number, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            updated[rowIdx] = { ...updated[rowIdx], [propId]: value };
            return updated;
        });
    };

    // -------------------------------------------------------
    // Guardar datos
    // -------------------------------------------------------
    const handleSave = async () => {
        if (!selectedEntity || rows.length === 0) return;

        setSaveLoading(true);
        try {
            const cleanRows = rows.map(row => {
                const clean: any = {};
                selectedEntity.properties.forEach((prop: any) => {
                    clean[prop.id] = row[prop.id] || "";
                });
                return clean;
            });

            const res = await fetch(`${baseUrl}/api/entries`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    entity_id: selectedEntity.id,
                    rows: cleanRows,
                    periodo: selectedPeriod
                }),
            });

            const ct = res.headers.get('content-type') || '';
            const result = ct.includes('application/json') ? await res.json() : { warning: `Respuesta no-JSON del servidor (status ${res.status})` };

            if (res.ok) {
                setSuccess(true);
                setEntryMap(prev => ({ ...prev, [selectedEntity.id]: true }));
                setOriginalRows(JSON.parse(JSON.stringify(rows)));
                if (result.warning) {
                    showNotification("Guardado (Modo Local)", `Datos guardados localmente. Aviso: ${result.warning}`, "info");
                } else {
                    showNotification("¡Éxito!", "Los datos han sido guardados y sincronizados correctamente.", "success");
                }
            } else {
                showNotification("Error al Guardar", result.error || "No se pudo guardar. Intente de nuevo.", "error");
            }
        } catch (error) {
            console.error("Save failed", error);
            showNotification("Error de Conexión", "No se pudo comunicar con el servidor.", "error");
        } finally {
            setSaveLoading(false);
        }
    };

    // -------------------------------------------------------
    // Exportar plantilla Excel
    // -------------------------------------------------------
    const handleDownloadExcel = async (entityOverride?: any) => {
        const entity = entityOverride || selectedEntity;
        if (!entity) return;
        try {
            const authToken = token || localStorage.getItem('v2_token');
            const res = await fetch(
                `${baseUrl}/api/admin/entities/${entity.id}/template`,
                { headers: { "Authorization": `Bearer ${authToken}` } }
            );
            if (!res.ok) {
                const ct = res.headers.get('content-type') || '';
                const errMsg = ct.includes('application/json')
                    ? (await res.json()).error
                    : await res.text();
                showNotification("Error al descargar plantilla", errMsg || `Error ${res.status}`, "error");
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Plantilla_${entity.name.substring(0, 40).replace(/[\s\/\\:*?"<>|]/g, '_')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showNotification("Plantilla lista", "Descarga de plantilla completada.", "success");
        } catch (error) {
            showNotification("Error de conexión", "No se pudo descargar la plantilla.", "error");
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, entityOverride?: any) => {
        const file = event.target.files?.[0];
        const entity = entityOverride || selectedEntity;
        if (!file || !entity) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("periodo", selectedPeriod.toString());

        setLoadingRows(true);
        if (view === 'dashboard') {
            // No cambiamos la vista, solo mostramos el loader local si fuera necesario
            // Pero setLoadingRows(true) disparará el loader del editor si entramos
        }

        try {
            const res = await fetch(`${baseUrl}/api/admin/entities/${entity.id}/import`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            const result = await res.json();
            if (res.ok) {
                showNotification("Importación Exitosa", result.message, "success");
                // Actualizar el mapa de entries
                setEntryMap(prev => ({ ...prev, [entity.id]: true }));
                if (view === 'editor' && selectedEntity?.id === entity.id) {
                    openEditor(entity);
                }
            } else {
                showNotification("Error de Importación", result.error || "No se pudo procesar el archivo.", "error");
            }
        } catch (error) {
            console.error("Import failed", error);
            showNotification("Error de Conexión", "No se pudo comunicar con el servidor para la importación.", "error");
        } finally {
            setLoadingRows(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // -------------------------------------------------------
    // Filtrado y Paginación para el Dashboard
    // -------------------------------------------------------
    const filteredEntities = entities.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase())
    );



    const totalPages = Math.ceil(filteredEntities.length / PAGE_SIZE);
    const paginatedEntities = filteredEntities.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    const filledEntities = paginatedEntities.filter(e => entryMap[e.id]);
    const pendingEntities = paginatedEntities.filter(e => !entryMap[e.id]);

    const totalFilledBase = entities.filter(e => entryMap[e.id]).length;
    const fillPercent = entities.length > 0 ? Math.round((totalFilledBase / entities.length) * 100) : 0;

    // ===============================================================
    //  RENDER: EDITOR DE FILAS
    // ===============================================================
    if (view === 'editor' && selectedEntity) {
        return (
            <>
                <TopHeader title={`Editando: ${selectedEntity.name}`} />

                <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">

                    {/* Breadcrumb / Header */}
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" onClick={handleCancel} className="gap-2 text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-4 w-4" /> Volver a Matrices
                        </Button>
                        <div className="flex items-center gap-3">
                            {success && (
                                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-right-4 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                                    <CheckCircle2 className="h-4 w-4" /> Guardado
                                </div>
                            )}
                            {isReadOnly && (
                                <div className="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
                                    <AlertTriangle className="h-4 w-4" /> Periodo Cerrado
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Matrix Title Card */}
                    <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-guinda-100 text-guinda-600 flex items-center justify-center">
                                        <Database className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold">{selectedEntity.name}</CardTitle>
                                        <CardDescription>Ciclo Informe {selectedPeriod} · {selectedEntity.properties?.length || 0} columnas</CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                                        disabled={!selectedEntity || isReadOnly}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="h-4 w-4" /> Importar Excel
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                                        disabled={!selectedEntity}
                                        onClick={handleDownloadExcel}
                                    >
                                        <FileSpreadsheet className="h-4 w-4" /> Plantilla Excel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-guinda-600 hover:bg-guinda-700 gap-2"
                                        onClick={addRow}
                                        disabled={isReadOnly}
                                    >
                                        <Plus className="h-4 w-4" /> Nueva Fila
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Data Grid */}
                    <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
                        <CardContent className="p-0">
                            {loadingRows ? (
                                <div className="p-20 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-guinda-500" />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 border-b-2 border-slate-100">
                                                <TableHead className="w-10 text-center text-slate-400 font-bold pl-4">#</TableHead>
                                                {selectedEntity.properties.map((prop: any) => (
                                                    <TableHead key={prop.id} className="font-bold text-slate-700 py-5 px-4 min-w-[180px]">
                                                        {prop.name || prop.column_name}
                                                        <span className="block text-[10px] text-slate-400 font-medium uppercase mt-0.5 tracking-tighter">
                                                            {prop.type || prop.column_type}
                                                        </span>
                                                    </TableHead>
                                                ))}
                                                <TableHead className="w-14 text-center"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((row, rowIdx) => (
                                                <TableRow key={rowIdx} className="hover:bg-slate-50/50 transition-colors group border-b">
                                                    <TableCell className="text-center text-xs text-slate-300 font-black pl-4">
                                                        {rowIdx + 1}
                                                    </TableCell>
                                                    {selectedEntity.properties.map((prop: any) => (
                                                        <TableCell key={prop.id} className="p-2 px-4">
                                                            <Input
                                                                className="border-slate-100 bg-white focus:border-guinda-300 placeholder:text-slate-300 h-10 rounded-lg text-sm font-medium shadow-none focus-visible:ring-1 focus-visible:ring-guinda-300"
                                                                placeholder="Ingrese valor..."
                                                                value={row[prop.id] || ""}
                                                                onChange={(e) => updateValue(rowIdx, prop.id, e.target.value)}
                                                                disabled={isReadOnly}
                                                            />
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-center pr-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-slate-200 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                            onClick={() => removeRow(rowIdx)}
                                                            disabled={isReadOnly}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Footer Actions */}
                            <div className="p-6 bg-slate-50/50 flex items-center justify-between border-t">
                                <p className="text-xs text-slate-400 font-medium">
                                    {rows.length} fila{rows.length !== 1 ? 's' : ''} · Periodo {selectedPeriod}
                                </p>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-11 px-8 rounded-xl font-bold border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                                        onClick={handleCancel}
                                    >
                                        <X className="h-4 w-4 mr-2" /> Cancelar
                                    </Button>
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700 h-11 px-10 rounded-xl gap-2 font-bold shadow-md shadow-emerald-100/80 transition-all active:scale-95"
                                        onClick={handleSave}
                                        disabled={saveLoading || isReadOnly}
                                    >
                                        {saveLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                        {saveLoading ? "Guardando..." : "Guardar Cambios"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* View Formal Link */}
                    {entryMap[selectedEntity.id] && (
                        <div className="flex justify-end">
                            <Link href={`/admin/anexo-estadistico/${selectedEntity.id}`}>
                                <Button variant="outline" className="gap-2 text-blue-600 border-blue-100 hover:bg-blue-50">
                                    <Eye className="h-4 w-4" /> Ver Vista Formal del Reporte
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>

                <NotificationModal
                    isOpen={notification.isOpen}
                    title={notification.title}
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                />
            </>
        );
    }

    // ===============================================================
    //  RENDER: DASHBOARD PRINCIPAL (selección de matriz)
    // ===============================================================
    return (
        <>
            <TopHeader title="Captura de Anexo Estadístico V2" />

            <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">

                {/* Progress Banner */}
                {!loadingEntities && entities.length > 0 && (
                    <Card className="border-none shadow-lg rounded-3xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${fillPercent === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        <BarChart3 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                            Progreso del Anexo Estadístico {selectedPeriod}
                                        </p>
                                        <p className="text-xs text-slate-400 font-medium">
                                            {filledEntities.length} de {entities.length} matrices completadas
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-2xl font-black ${fillPercent === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {fillPercent}%
                                </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${fillPercent === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                    style={{ width: `${fillPercent}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Dashboard Controls: Search & Filters */}
                {!loadingEntities && entities.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="relative w-full max-w-lg">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar matriz por nombre..."
                                    className="pl-10 h-12 rounded-2xl bg-white border-slate-100 shadow-sm focus:border-guinda-300"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                                    <Select value={selectedSector} onValueChange={setSelectedSector}>
                                        <SelectTrigger className="h-9 w-[180px] rounded-xl border-none bg-slate-50/50 hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <ListFilter className="h-3.5 w-3.5 text-slate-400" />
                                                <SelectValue placeholder="Sector" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los Sectores</SelectItem>
                                            {sectors.map((s) => (
                                                <SelectItem key={s.id} value={s.id.toString()}>
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={selectedMission} onValueChange={setSelectedMission}>
                                        <SelectTrigger className="h-9 w-[180px] rounded-xl border-none bg-slate-50/50 hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <Filter className="h-3.5 w-3.5 text-slate-400" />
                                                <SelectValue placeholder="Misión/Eje" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las Misiones</SelectItem>
                                            {missions.map((m) => (
                                                <SelectItem key={m.id} value={m.id.toString()}>
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {(selectedSector !== "all" || selectedMission !== "all") && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedSector("all");
                                                setSelectedMission("all");
                                            }}
                                            className="h-9 w-9 p-0 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                                            title="Limpiar filtros"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setIsRefreshing(true);
                                            // Trigger refetch by just setting state again which triggers useEffect
                                            setEntities([...entities]);
                                            setTimeout(() => setIsRefreshing(false), 500);
                                        }}
                                        className="h-9 w-9 p-0 rounded-xl text-slate-400 hover:text-guinda-600 hover:bg-slate-50"
                                        title="Actualizar lista"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => prev - 1)}
                                            className="h-10 w-10 p-0 rounded-xl"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs font-bold px-3 text-slate-600 uppercase tracking-widest leading-none whitespace-nowrap">
                                            {currentPage} / {totalPages}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                            className="h-10 w-10 p-0 rounded-xl"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {loadingEntities ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-guinda-500" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Filled Entities */}
                        {filledEntities.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" /> Matrices con datos guardados ({filledEntities.length})
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filledEntities.map(e => (
                                        <div key={e.id} className="group relative">
                                            <button
                                                onClick={() => openEditor(e)}
                                                className="w-full text-left p-5 rounded-2xl border-2 border-emerald-100 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 hover:shadow-md transition-all active:scale-95"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-24">
                                                        <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors leading-tight">{e.name}</p>
                                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                                                            Datos registrados · Clic para editar
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                            <div className="absolute top-3 right-3 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => handleDownloadExcel(e)}
                                                    className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-indigo-500 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-200 shadow-sm"
                                                    title="Descargar Plantilla Excel"
                                                >
                                                    <FileSpreadsheet className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedEntity(e);
                                                        fileInputRef.current?.click();
                                                    }}
                                                    className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-emerald-600 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 shadow-sm"
                                                    title="Importar desde Excel"
                                                >
                                                    <Upload className="h-4 w-4" />
                                                </button>
                                                <Link
                                                    href={`/admin/anexo-estadistico/${e.id}`}
                                                    className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                                                    title="Ver Vista Formal"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending Entities */}
                        {pendingEntities.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Matrices pendientes de captura ({pendingEntities.length})
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {pendingEntities.map(e => (
                                        <div key={e.id} className="group relative">
                                            <button
                                                onClick={() => openEditor(e)}
                                                disabled={isReadOnly}
                                                className="w-full text-left p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-white hover:border-guinda-300 hover:bg-guinda-50/30 hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                                                        <Database className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-20">
                                                        <p className="text-sm font-bold text-slate-600 group-hover:text-guinda-700 transition-colors leading-tight">{e.name}</p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                            {isReadOnly ? 'Periodo cerrado' : 'Sin datos · Clic para capturar'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                            <div className="absolute top-3 right-3 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => handleDownloadExcel(e)}
                                                    className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-indigo-500 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-200 shadow-sm"
                                                    title="Descargar Plantilla Excel"
                                                >
                                                    <FileSpreadsheet className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedEntity(e);
                                                        fileInputRef.current?.click();
                                                    }}
                                                    className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-emerald-600 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 shadow-sm"
                                                    title="Importar desde Excel"
                                                    disabled={isReadOnly}
                                                >
                                                    <Upload className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {entities.length === 0 && !loadingEntities && (
                            <div className="text-center py-20 space-y-4">
                                <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                                    <Database className="h-8 w-8 text-slate-300" />
                                </div>
                                <p className="text-slate-400 font-medium">No hay matrices de datos configuradas para este periodo.</p>
                                <p className="text-slate-300 text-xs">Contacta al administrador del sistema para configurar las entidades.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                title={notification.title}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
            />
        </>
    );
}
