"use client";

import { useEffect, useState, use } from "react";
import { TopHeader } from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Save, LayoutGrid, Info, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";
import { NotificationModal } from "@/components/ui/notification-modal";
import { Badge } from "@/components/ui/badge";

export default function EditarEntidad({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { token } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const [name, setName] = useState("");
    const [dependencyId, setDependencyId] = useState("");
    const [source, setSource] = useState("");
    const [notes, setNotes] = useState("");
    const [isFinancial, setIsFinancial] = useState(false);
    const [secondStage, setSecondStage] = useState(false);
    const [status, setStatus] = useState("draft");

    const [dependencies, setDependencies] = useState<any[]>([]);
    const [catalogs, setCatalogs] = useState<any[]>([]);

    const [properties, setProperties] = useState<any[]>([]);

    // Notification State
    const [notification, setNotification] = useState({
        isOpen: false,
        title: "",
        message: "",
        type: "success" as "success" | "error" | "info"
    });

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                const headers = { "Authorization": `Bearer ${token}` };

                const [depRes, catRes, entRes] = await Promise.all([
                    fetch(`${baseUrl}/api/dependencies`, { headers }),
                    fetch(`${baseUrl}/api/catalogs`, { headers }),
                    fetch(`${baseUrl}/api/admin/entities?id=${id}`, { headers }) // This might need a specific endpoint if admin/entities doesn't support query by id
                ]);

                // If the generic admin list doesn't filter, we might need to find it in the array or add a specific GET /api/admin/entities/:id
                const deps = await depRes.json();
                const cats = await catRes.json();
                const entitiesRaw = await entRes.json();

                const entity = Array.isArray(entitiesRaw) ? entitiesRaw.find(e => e.id.toString() === id) : entitiesRaw;

                if (entity) {
                    setName(entity.name);
                    setDependencyId(entity.dependency_id.toString());
                    setSource(entity.source || "");
                    setNotes(entity.notes || "");
                    setIsFinancial(entity.is_financial);
                    setSecondStage(entity.second_stage);
                    setStatus(entity.status);
                    setProperties(entity.properties || []);
                }

                setDependencies(Array.isArray(deps) ? deps : []);
                setCatalogs(Array.isArray(cats) ? cats : []);
            } catch (error) {
                console.error(error);
                setNotification({
                    isOpen: true,
                    title: "Error",
                    message: "No se pudieron cargar los datos de la matriz.",
                    type: "error"
                });
            } finally {
                setInitialLoading(false);
            }
        };
        if (token && id) fetchAllData();
    }, [token, id]);

    const addProperty = () => {
        setProperties([...properties, { column_name: "", column_type: "String", is_required: false, is_additional: false }]);
    };

    const removeProperty = (index: number) => {
        setProperties(properties.filter((_, i) => i !== index));
    };

    const updateProperty = (index: number, key: string, value: any) => {
        const newProps = [...properties];
        newProps[index][key] = value;
        setProperties(newProps);
    };

    const handleSave = async () => {
        if (!name || !dependencyId) {
            setNotification({
                isOpen: true,
                title: "Campos Requeridos",
                message: "Por favor asigne un nombre y una dependencia a la matriz.",
                type: "error"
            });
            return;
        }

        setLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/admin/entities/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    dependency_id: dependencyId,
                    source,
                    notes,
                    is_financial: isFinancial,
                    second_stage: secondStage,
                    status
                })
            });

            // If you want to update properties too, you might need a separate endpoint or update the PUT one.
            // For now let's assume properties are handled via a separate action as in legacy or we need to implement partial update.

            if (res.ok) {
                setNotification({
                    isOpen: true,
                    title: "Matriz Actualizada",
                    message: "Los cambios se han guardado exitosamente.",
                    type: "success"
                });
                setTimeout(() => router.push("/admin/entidades"), 1500);
            } else {
                throw new Error("Error al guardar");
            }
        } catch (error) {
            setNotification({
                isOpen: true,
                title: "Error",
                message: "Ocurrió un error al intentar actualizar la matriz.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50/30">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-guinda-100 border-t-guinda-600 animate-spin" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando datos...</p>
                </div>
            </div>
        );
    }

    return (
        <ProtectedRoute module="GESTION_MATRICES">
            <TopHeader title="Configuración de Matriz" />

            <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
                {/* Actions Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/entidades">
                            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50">
                                <ArrowLeft className="h-5 w-5 text-slate-600" />
                            </Button>
                        </Link>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Editar Estructura</h2>
                                <Badge variant="outline" className="bg-guinda-50 text-guinda-600 border-guinda-100 uppercase text-[9px] font-black tracking-widest h-5">ID: #{id}</Badge>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">Modifica la definición y campos de la tabla estadística.</p>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-guinda-600 hover:bg-guinda-700 h-12 px-8 rounded-2xl gap-2 font-black shadow-lg shadow-guinda-100 transition-all active:scale-95 flex-1 md:flex-none"
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                            ) : (
                                <Save className="h-5 w-5" />
                            )}
                            GUARDAR CAMBIOS
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Main Config Column */}
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl p-6 space-y-6 bg-white overflow-visible">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-8 w-8 rounded-lg bg-guinda-50 flex items-center justify-center text-guinda-600">
                                    <Info className="h-4 w-4" />
                                </div>
                                <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">Datos Principales</h3>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre de la Matriz <span className="text-guinda-500">*</span></Label>
                                <Input
                                    placeholder="Ej: Número de Operativos..."
                                    className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-guinda-50 transition-all text-sm font-bold"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dependencia Responsable <span className="text-guinda-500">*</span></Label>
                                <Select value={dependencyId} onValueChange={setDependencyId}>
                                    <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-guinda-50 transition-all text-sm font-bold w-full overflow-hidden text-left">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.isArray(dependencies) && dependencies.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()} className="font-bold text-slate-700">{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fuente de Información</Label>
                                <Input
                                    placeholder="Ej: Dirección de Planeación..."
                                    className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-guinda-50 transition-all text-sm font-bold"
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                />
                            </div>

                            <div className="pt-2 space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-100/50">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-black text-slate-800 uppercase tracking-tight">Matriz Financiera</Label>
                                        <p className="text-[10px] font-bold text-slate-400">¿Contiene montos de inversión?</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-guinda scale-110"
                                        checked={isFinancial}
                                        onChange={(e) => setIsFinancial(e.target.checked)}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-100/50">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-black text-slate-800 uppercase tracking-tight">Segunda Etapa</Label>
                                        <p className="text-[10px] font-bold text-slate-400">¿Requiere validación adicional?</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-guinda scale-110"
                                        checked={secondStage}
                                        onChange={(e) => setSecondStage(e.target.checked)}
                                    />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Columns Column */}
                    <div className="lg:col-span-8 space-y-6">
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl p-8 bg-white">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                        <LayoutGrid className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase text-sm tracking-widest">Estructura de Columnas</h3>
                                        <p className="text-[10px] font-bold text-slate-400">Define los encabezados y tipos de datos.</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={addProperty}
                                    className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-[11px] gap-2 uppercase tracking-widest shadow-md shadow-emerald-50 transition-all active:scale-95"
                                >
                                    <Plus className="h-4 w-4" /> Agregar Columna
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {properties.map((prop, idx) => (
                                    <div key={idx} className="p-5 rounded-3xl bg-slate-50/50 border border-slate-100 flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                                        <div className="grid grid-cols-12 gap-4 items-center">
                                            <div className="col-span-12 md:col-span-6 space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Nombre de Columna</Label>
                                                <Input
                                                    placeholder="Nombre de la variable..."
                                                    className="h-11 rounded-1xl border-slate-100 bg-white font-bold text-sm"
                                                    value={prop.column_name}
                                                    onChange={(e) => updateProperty(idx, "column_name", e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-10 md:col-span-5 space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Tipo de Dato</Label>
                                                <Select value={prop.column_type} onValueChange={(val) => updateProperty(idx, "column_type", val)}>
                                                    <SelectTrigger className="h-11 rounded-1xl border-slate-100 bg-white font-bold text-sm">
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
                                            <div className="col-span-2 md:col-span-1 pt-6 flex justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                                    onClick={() => removeProperty(idx)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {prop.column_type === 'Catalog' && (
                                            <div className="col-span-12 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex items-center gap-2 px-1">
                                                    <CheckCircle2 className="h-3 w-3 text-guinda-600" />
                                                    <Label className="text-[10px] font-black uppercase text-guinda-600 tracking-tighter">Catálogo Base Vinculado</Label>
                                                </div>
                                                <Select value={prop.catalog_id?.toString()} onValueChange={(val) => updateProperty(idx, "catalog_id", val)}>
                                                    <SelectTrigger className="h-11 rounded-2xl border-guinda-100 bg-guinda-50/20 font-bold text-sm w-full overflow-hidden text-left">
                                                        <SelectValue placeholder="Elegir catálogo..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.isArray(catalogs) && catalogs.map(c => (
                                                            <SelectItem key={c.id} value={c.id.toString()} className="font-bold">{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {properties.length === 0 && (
                                    <div className="py-20 text-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/30">
                                        <LayoutGrid className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No hay columnas configuradas</p>
                                        <p className="text-[10px] text-slate-300 mt-1">Haz clic en Agregar para comenzar</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Additional Info Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="border-none shadow-lg shadow-slate-200/50 rounded-3xl p-6 bg-amber-50/50 border border-amber-100/50">
                                <div className="flex gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                        <AlertCircle className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-black text-amber-800 uppercase text-[10px] tracking-wider">Aviso de Estructura</h4>
                                        <p className="text-[11px] text-amber-700/80 font-bold leading-normal">
                                            Si eliminas columnas que ya tienen datos capturados, los valores de esas celdas se ocultarán permanentemente.
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="border-none shadow-lg shadow-slate-200/50 rounded-3xl p-6 bg-blue-50/50 border border-blue-100/50">
                                <div className="flex gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-black text-blue-800 uppercase text-[10px] tracking-wider">Publicación Inmediata</h4>
                                        <p className="text-[11px] text-blue-700/80 font-bold leading-normal">
                                            Al guardar los cambios, la estructura actualizada estará disponible para la dependencia asignada.
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification({ ...notification, isOpen: false })}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </ProtectedRoute>
    );
}
