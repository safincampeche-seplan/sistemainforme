"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopHeader } from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus,
    Trash2,
    Save,
    ArrowLeft,
    LayoutGrid,
    Type,
    Settings2,
    AlertCircle,
    CheckCircle2,
    Loader2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function NuevaEntidad() {
    const router = useRouter();
    const { token } = useAuth();
    const [dependencies, setDependencies] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [dependencyId, setDependencyId] = useState("");
    const [source, setSource] = useState("");
    const [notes, setNotes] = useState("");
    const [properties, setProperties] = useState([
        { column_name: "", column_type: "String", is_required: false }
    ]);

    const [isFinancial, setIsFinancial] = useState(false);
    const [secondStage, setSecondStage] = useState(false);
    const [catalogs, setCatalogs] = useState<any[]>([]);

    // Notification State
    const [notification, setNotification] = useState({
        isOpen: false,
        title: "",
        message: "",
        type: "success" as "success" | "error" | "info"
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                const headers = { "Authorization": `Bearer ${token}` };

                const [depRes, catRes] = await Promise.all([
                    fetch(`${baseUrl}/api/dependencies`, { headers }),
                    fetch(`${baseUrl}/api/catalogs`, { headers })
                ]);

                const deps = await depRes.json();
                const cats = await catRes.json();

                setDependencies(Array.isArray(deps) ? deps : []);
                setCatalogs(Array.isArray(cats) ? cats : []);
            } catch (error) { console.error(error); }
        };
        if (token) fetchInitialData();
    }, [token]);

    const addProperty = () => {
        setProperties([...properties, { column_name: "", column_type: "String", is_required: false }]);
    };

    const removeProperty = (index: number) => {
        if (properties.length === 1) return;
        setProperties(properties.filter((_, i) => i !== index));
    };

    const updateProperty = (index: number, field: string, value: any) => {
        const newProps = [...properties];
        (newProps[index] as any)[field] = value;
        setProperties(newProps);
    };

    const handleSave = async () => {
        if (!name || !dependencyId || properties.some(p => !p.column_name)) {
            setNotification({
                isOpen: true,
                title: "Campos Incompletos",
                message: "Por favor llene el nombre, la dependencia y todos los nombres de columna.",
                type: "error"
            });
            return;
        }

        setLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/entities`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    dependency_id: dependencyId,
                    period_id: 5, // 2026 default
                    source,
                    notes,
                    is_financial: isFinancial,
                    second_stage: secondStage,
                    properties: properties.map(p => ({
                        ...p,
                        column_type: p.column_type === 'Catalog' ? 'Catalog' : p.column_type
                    }))
                })
            });

            if (res.ok) {
                setNotification({
                    isOpen: true,
                    title: "Matriz Creada",
                    message: "La estructura de la nueva tabla ha sido registrada correctamente.",
                    type: "success"
                });
                setTimeout(() => router.push("/admin/entidades"), 2000);
            } else {
                const err = await res.json();
                throw new Error(err.error);
            }
        } catch (error: any) {
            setNotification({
                isOpen: true,
                title: "Error al Guardar",
                message: error.message || "Ocurrió un problema al intentar crear la matriz.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <ProtectedRoute module="GESTION_MATRICES">
            <TopHeader title="Configurar Nueva Matriz de Datos" />

            <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto mb-20">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" className="gap-2 text-slate-500" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" /> Cancelar y Volver
                    </Button>
                    <div className="flex items-center gap-2 text-xs font-bold text-guinda-600 uppercase tracking-widest bg-guinda-50 px-3 py-1.5 rounded-full">
                        <Settings2 className="h-3.5 w-3.5" /> Modo Configuración
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* General Info */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-900">Información General</h3>
                            <p className="text-sm text-slate-500">Define los datos básicos de la tabla y la dependencia responsable de su captura.</p>
                        </div>

                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl p-6 space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nombre de la Matriz</Label>
                                <Input
                                    placeholder="Ej: Infraestructura de Salud"
                                    className="h-11 rounded-xl border-slate-200 focus:border-guinda-300"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Dependencia Responsable</Label>
                                <Select onValueChange={setDependencyId}>
                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 w-full overflow-hidden text-left">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.isArray(dependencies) && dependencies.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Fuente de Información</Label>
                                <Input
                                    placeholder="Ej: Dirección de Planeación..."
                                    className="h-11 rounded-xl border-slate-200 focus:border-guinda-300"
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                />
                            </div>

                            <div className="pt-2 space-y-4">
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold text-slate-700">Matriz Financiera</Label>
                                        <p className="text-[10px] text-slate-500">¿Contiene montos de inversión?</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-guinda"
                                        checked={isFinancial}
                                        onChange={(e) => setIsFinancial(e.target.checked)}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold text-slate-700">Segunda Etapa</Label>
                                        <p className="text-[10px] text-slate-500">¿Requiere validación adicional?</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-guinda"
                                        checked={secondStage}
                                        onChange={(e) => setSecondStage(e.target.checked)}
                                    />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Columns Design */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-slate-900">Diseño de Columnas</h3>
                                <p className="text-sm text-slate-500">Agrega las columnas que compondrán la tabla de captura.</p>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2 h-10 px-4" onClick={addProperty}>
                                <Plus className="h-4 w-4" /> Agregar Columna
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {properties.map((prop, idx) => (
                                <Card key={idx} className="border-none shadow-lg shadow-slate-100/50 rounded-2xl p-4 relative group animate-in fade-in slide-in-from-bottom-2">
                                    <div className="grid grid-cols-12 gap-4 items-end">
                                        <div className="col-span-6 space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Nombre de Columna</Label>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                                    <LayoutGrid className="h-5 w-5" />
                                                </div>
                                                <Input
                                                    placeholder="Ej: Número de beneficiarios"
                                                    className="h-10 rounded-lg border-slate-100 focus:border-guinda-200"
                                                    value={prop.column_name}
                                                    onChange={(e) => updateProperty(idx, "column_name", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-4 space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Tipo de Dato</Label>
                                            <Select value={prop.column_type} onValueChange={(val) => updateProperty(idx, "column_type", val)}>
                                                <SelectTrigger className="h-10 rounded-lg border-slate-100">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="String">Texto (String)</SelectItem>
                                                    <SelectItem value="Number">Número (Entero)</SelectItem>
                                                    <SelectItem value="Decimal">Decimal (Moneda/%)</SelectItem>
                                                    <SelectItem value="Date">Fecha</SelectItem>
                                                    <SelectItem value="Catalog">Catálogo (Lista desplegable)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {prop.column_type === 'Catalog' && (
                                            <div className="col-span-12 md:col-span-8 md:col-offset-6 mt-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                                <Label className="text-[10px] font-black uppercase text-guinda-600 tracking-tighter">Seleccionar Catálogo Base</Label>
                                                <Select onValueChange={(val) => updateProperty(idx, "catalog_id", val)}>
                                                    <SelectTrigger className="h-10 rounded-lg border-guinda-100 bg-guinda-50/30 w-full overflow-hidden text-left">
                                                        <SelectValue placeholder="Elegir catálogo..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.isArray(catalogs) && catalogs.map(c => (
                                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <div className="col-span-2 flex justify-end">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                onClick={() => removeProperty(idx)}
                                                disabled={properties.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 h-12 px-12 rounded-2xl gap-2 font-bold shadow-xl shadow-emerald-100 transition-all active:scale-95"
                                onClick={handleSave}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                Guardar y Publicar Matriz
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </ProtectedRoute>
    );
}
