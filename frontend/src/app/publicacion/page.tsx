"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TopHeader } from "@/components/TopHeader";
import {
    BookOpen,
    Download,
    CheckCircle2,
    Clock,
    FileText,
    BarChart3,
    ArrowRight,
    Loader2,
    ShieldCheck,
    Layers,
    Sparkles,
    Eye,
    X,
    TrendingUp,
    Users as UsersIcon,
    Wallet,
    Info,
    Calendar,
    HeadphonesIcon
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";

interface AxisProgress {
    id: number;
    name: string;
    total: number;
    approved: number;
}

interface StatsProgress {
    totalEntities: number;
    capturedEntities: number;
    validatedEntities: number;
}

interface PreviewItem {
    id: number;
    title: string;
    content: string;
    highlights: string | null;
    beneficiaries: number;
    investment: string;
    date: string;
}

import { useRouter } from "next/navigation";

export default function PublicationHub() {
    const { user, token, selectedPeriod } = useAuth();
    const router = useRouter();

    // Permission check for SEPLAN or Administrators
    const canConsolidate = user?.dependency?.toUpperCase() === 'SEPLAN' ||
        user?.roles?.includes('Administrador');

    const [axes, setAxes] = useState<AxisProgress[]>([]);
    const [stats, setStats] = useState<StatsProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Preview Mode State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Notification Modal State
    const [notification, setNotification] = useState({ isOpen: false, title: "", message: "", type: "success" as any });

    useEffect(() => {
        const fetchStatus = async () => {
            if (!token) return;
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                const res = await fetch(`${baseUrl}/api/consolidation/status?periodo=${selectedPeriod}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAxes(data.axes);
                    setStats(data.statsProgress);
                }
            } catch (error) {
                console.error("Consolidation fetch failed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [token]);

    const handlePreview = async () => {
        setLoadingPreview(true);
        setIsPreviewOpen(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/consolidation/preview?periodo=${selectedPeriod}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPreviewData(data);
            }
        } catch (error) {
            console.error("Preview fetch failed", error);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleConsolidate = async (type: 'word' | 'excel') => {
        setExporting(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const endpoint = type === 'word' ? '/api/export/consolidated/word' : '/api/export/consolidated/excel';
            const res = await fetch(`${baseUrl}${endpoint}?periodo=${selectedPeriod}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Export failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = type === 'word' ? `Libro_Informe_Consolidado_${selectedPeriod}.docx` : `Anexo_Estadistico_Consolidado_${selectedPeriod}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            setNotification({
                isOpen: true,
                title: type === 'word' ? "Libro Narrativo Generado" : "Anexo Estadístico Consolidado",
                message: `Se han ensamblado correctamente todas las secciones aprobadas en un solo archivo institucional.`,
                type: "success"
            });
        } catch (error) {
            console.error("Consolidated export failed", error);
            setNotification({
                isOpen: true,
                title: "Error de Exportación",
                message: "No se pudo generar el archivo consolidado. Verifique la conexión con el servidor.",
                type: "error"
            });
        } finally {
            setExporting(false);
        }
    };

    const totalApproved = axes.reduce((acc, axis) => acc + axis.approved, 0);
    const totalChapters = axes.reduce((acc, axis) => acc + axis.total, 0);
    const overallPercentage = totalChapters > 0 ? Math.round((totalApproved / totalChapters) * 100) : 0;

    return (
        <>
            <TopHeader title="Centro de Consolidación y Publicación" />

            <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">

                {/* Hero Status Banner */}
                <Card className="border-none bg-gradient-to-br from-guinda-900 via-guinda-950 to-slate-900 text-white rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 h-full w-1/2 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <Badge className="bg-guinda-500/20 text-guinda-200 border-guinda-500/30 px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase">Estatus Global del Informe</Badge>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">Preparando el Libro del <span className="text-guinda-400">Informe {selectedPeriod}</span></h2>
                            <p className="text-guinda-100/70 text-lg font-medium max-w-lg">Resumen ejecutivo del flujo editorial. Una vez que todos los capítulos alcancen la validación técnica, podrá generar la versión oficial de imprenta.</p>

                            {canConsolidate && (
                                <div className="flex flex-wrap gap-4 pt-4">
                                    <Button size="lg" className="bg-white text-guinda-900 hover:bg-guinda-50 h-14 px-8 rounded-2xl font-black gap-2 shadow-xl" onClick={() => handleConsolidate('word')} disabled={exporting}>
                                        {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />} Generar Libro Word
                                    </Button>
                                    <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white h-14 px-8 rounded-2xl font-black gap-2 shadow-xl" onClick={() => handleConsolidate('excel')} disabled={exporting}>
                                        {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <BarChart3 className="h-5 w-5" />} Excel Consolidado
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-guinda-300 uppercase tracking-widest">Avance de Integración</p>
                                    <p className="text-4xl font-black">{overallPercentage}%</p>
                                </div>
                                <div className="h-16 w-16 rounded-2xl bg-guinda-500/20 flex items-center justify-center border border-guinda-500/30">
                                    <Sparkles className="h-8 w-8 text-guinda-300" />
                                </div>
                            </div>
                            <Progress value={overallPercentage} className="h-4 bg-white/10" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-bold text-guinda-300 uppercase">Capítulos Listos</p>
                                    <p className="text-xl font-bold">{totalApproved} / {totalChapters}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-bold text-guinda-300 uppercase">Anexos Validados</p>
                                    <p className="text-xl font-bold">{stats?.validatedEntities || 0} / {stats?.totalEntities || 56}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

                    {/* Progress Detail per Axis */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <Layers className="h-6 w-6 text-guinda-600" /> Detalle por Ejes Temáticos
                            </h3>
                            <Badge variant="outline" className="rounded-full border-slate-200 text-slate-500 font-bold">Ciclo {selectedPeriod}</Badge>
                        </div>

                        <div className="grid gap-4">
                            {axes.map((axis) => (
                                <Card
                                    key={axis.id}
                                    className="border-none shadow-lg shadow-slate-100/50 rounded-[2rem] overflow-hidden group hover:bg-white hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                                    onClick={() => router.push(`/inbox?search=${axis.name}`)}
                                >
                                    <CardContent className="p-6 md:p-8 flex items-center gap-6">
                                        <div className="flex-1 space-y-4 text-left">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-lg font-black text-slate-800 group-hover:text-guinda-600 transition-colors">{axis.name}</h4>
                                                <span className="text-sm font-black text-guinda-600 bg-guinda-50 px-3 py-1 rounded-full">
                                                    {Math.round((axis.approved / axis.total) * 100)}%
                                                </span>
                                            </div>
                                            <Progress value={(axis.approved / axis.total) * 100} className="h-2 bg-slate-100" />
                                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {axis.approved} Aprobados
                                                </div>
                                                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                                                    <Clock className="h-3.5 w-3.5 text-amber-500" /> {axis.total - axis.approved} Pendientes
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-guinda-600 group-hover:text-white group-hover:border-guinda-600 group-hover:scale-110 transition-all duration-300 shadow-sm group-hover:shadow-indigo-200">
                                            <ArrowRight className="h-6 w-6 transform group-hover:translate-x-0.5" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Quick Publishing Tools / Help Section */}
                    <div className="space-y-8">
                        {canConsolidate ? (
                            <Card className="border-none shadow-2xl shadow-indigo-50/50 rounded-[2.5rem] bg-white h-fit">
                                <CardHeader className="p-8 border-b border-slate-50">
                                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                                        <ShieldCheck className="h-6 w-6 text-guinda-600" />
                                        Herramientas de Cierre
                                    </CardTitle>
                                    <CardDescription>Acciones finales de ensamblado</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
                                    <div className="space-y-4">
                                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pre-visualización</p>
                                            <p className="text-sm font-medium text-slate-600 leading-relaxed">Revise el cuerpo del mensaje e imágenes antes del cierre editorial.</p>
                                            <Button
                                                variant="outline"
                                                className="w-full rounded-xl border-guinda-200 text-guinda-600 hover:bg-guinda-50 font-bold mt-2 gap-2"
                                                onClick={handlePreview}
                                            >
                                                <Eye className="h-4 w-4" /> Modo Lectura Premium
                                            </Button>
                                        </div>

                                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Anexo Estadístico</p>
                                            <p className="text-sm font-medium text-slate-600 leading-relaxed">Combine las {stats?.totalEntities || 56} entidades en un único libro maestro.</p>
                                            <Button
                                                variant="outline"
                                                className="w-full rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold mt-2"
                                                onClick={() => handleConsolidate('excel')}
                                                disabled={exporting}
                                            >
                                                Consolidar Excel
                                            </Button>
                                        </div>
                                    </div>

                                    <Card className="bg-guinda-50 border-guinda-100 rounded-3xl p-6">
                                        <div className="flex gap-4">
                                            <div className="h-10 w-10 rounded-full bg-guinda-100 border border-guinda-200 flex items-center justify-center text-guinda-600">
                                                <BookOpen className="h-5 w-5" />
                                            </div>
                                            <div className="space-y-2 flex-1">
                                                <p className="text-sm font-bold text-guinda-900 leading-tight">¿Listo para el cierre del Ciclo {selectedPeriod}?</p>
                                                <p className="text-xs text-guinda-700 font-medium">Esta acción notificará a todos los coordinadores de eje que el documento ha sido ensamblado.</p>
                                                <Button className="w-full bg-guinda-600 text-white rounded-xl shadow-lg shadow-indigo-200 font-black mt-2">
                                                    Cierre Editorial Final
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-6">
                                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] bg-white overflow-hidden">
                                    <CardHeader className="p-8 border-b border-slate-50 bg-guinda-50/30">
                                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-guinda-900">
                                            <Info className="h-6 w-6 text-guinda-600" />
                                            Guía del Capturista
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-6">
                                        <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                            <Calendar className="h-5 w-5 text-guinda-500 mt-1" />
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">Fecha Límite: 15 de Mayo</p>
                                                <p className="text-xs text-slate-500 leading-relaxed">Asegúrese de cargar todas sus narrativas y cuadros estadísticos antes del cierre trimestral.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Próximos Pasos</p>
                                            <ul className="space-y-3">
                                                <li className="flex items-start gap-3 text-sm text-slate-600">
                                                    <div className="h-5 w-5 rounded-full bg-guinda-100 flex items-center justify-center text-guinda-600 text-[10px] font-black shrink-0">1</div>
                                                    Subir Narrativa Institucional con fotografías.
                                                </li>
                                                <li className="flex items-start gap-3 text-sm text-slate-600">
                                                    <div className="h-5 w-5 rounded-full bg-guinda-100 flex items-center justify-center text-guinda-600 text-[10px] font-black shrink-0">2</div>
                                                    Validar Anexo Estadístico en la sección de capturas.
                                                </li>
                                                <li className="flex items-start gap-3 text-sm text-slate-600">
                                                    <div className="h-5 w-5 rounded-full bg-guinda-100 flex items-center justify-center text-guinda-600 text-[10px] font-black shrink-0">3</div>
                                                    Revisar estatus de aprobación en tiempo real.
                                                </li>
                                            </ul>
                                        </div>

                                        <Button className="w-full bg-slate-900 text-white rounded-xl h-12 font-bold gap-2">
                                            <BookOpen className="h-4 w-4" /> Ver Manual de Usuario
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] bg-gradient-to-br from-guinda-600 to-guinda-800 text-white p-8 space-y-4">
                                    <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                        <HeadphonesIcon className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-lg font-black leading-tight">¿Necesitas ayuda técnica?</p>
                                        <p className="text-xs text-guinda-100 font-medium">Contáctanos vía chat de soporte o extensión 2405 para asistencia con la plataforma.</p>
                                    </div>
                                    <Button variant="secondary" className="w-full rounded-xl bg-white text-guinda-900 font-black h-12">
                                        Contactar Soporte
                                    </Button>
                                </Card>
                            </div>
                        )}
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

            {/* Premium Review Modal */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-10 animate-in fade-in zoom-in duration-500">
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setIsPreviewOpen(false)}></div>

                    <div className="relative bg-white w-full max-w-5xl h-full md:h-[90vh] rounded-none md:rounded-[3rem] shadow-[0_32px_128px_-32px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden border border-white/20">
                        {/* Modal Header */}
                        <div className="p-8 border-b flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-guinda-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pre-visualización Editorial</h2>
                                    <p className="text-sm font-bold text-slate-400">Versión Consolidada del Informe {selectedPeriod}</p>
                                </div>
                            </div>
                            <Button variant="ghost" className="h-12 w-12 rounded-full hover:bg-slate-200 transition-colors" onClick={() => setIsPreviewOpen(false)}>
                                <X className="h-6 w-6 text-slate-500" />
                            </Button>
                        </div>

                        {/* Modal Content - The Document */}
                        <div className="flex-1 overflow-y-auto p-10 md:p-20 bg-slate-100/30 font-serif">
                            {loadingPreview ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <Loader2 className="h-12 w-12 text-guinda-600 animate-spin" />
                                    <p className="text-xl font-bold text-slate-400">Ensamblando capítulos...</p>
                                </div>
                            ) : previewData.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
                                    <Clock className="h-16 w-16 text-slate-200" />
                                    <h3 className="text-2xl font-bold text-slate-800">No hay contenido aprobado</h3>
                                    <p className="text-slate-500">Aún no se han aprobado narrativas para incluir en el libro oficial. Valida algunos registros en la sección de Seguimiento para verlos aquí.</p>
                                    <Button className="mt-4 bg-guinda-600 rounded-xl" onClick={() => setIsPreviewOpen(false)}>Regresar</Button>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto space-y-24">
                                    {/* Cover Page Representation */}
                                    <div className="text-center space-y-12 border-b border-slate-200 pb-24">
                                        <Badge className="bg-guinda-600 text-white rounded-full px-6 py-2">BORRADOR INSTITUCIONAL</Badge>
                                        <h1 className="text-6xl font-black text-guinda-950 leading-tight tracking-tighter capitalize underline decoration-indigo-200 decoration-8 underline-offset-8">Informe de Gobierno Estatal</h1>
                                        <p className="text-2xl font-bold text-slate-400 tracking-widest uppercase">Gobernanza y Resultados {selectedPeriod}</p>
                                        <div className="flex justify-center gap-10">
                                            <div className="text-center">
                                                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Estado</p>
                                                <p className="text-lg font-bold text-slate-700">Campeche</p>
                                            </div>
                                            <div className="text-center border-l border-slate-200 pl-10">
                                                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Ciclo</p>
                                                <p className="text-lg font-bold text-slate-700">Segundo Trimestre</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chapters */}
                                    {previewData.map((item, index) => (
                                        <div key={item.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000" style={{ animationDelay: `${index * 150}ms` }}>
                                            <div className="flex items-start gap-8">
                                                <div className="text-8xl font-black text-slate-100 select-none">
                                                    0{index + 1}
                                                </div>
                                                <div className="space-y-6 pt-6 flex-1">
                                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight capitalize leading-tight">{item.title}</h3>
                                                    <div className="h-1 w-20 bg-guinda-600 rounded-full"></div>

                                                    {/* Metrics Bar */}
                                                    <div className="flex flex-wrap gap-8 py-4 border-y border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                                <UsersIcon className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Beneficiarios</p>
                                                                <p className="text-sm font-bold text-slate-700">{(item.beneficiaries || 0).toLocaleString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                                                                <Wallet className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Inversión</p>
                                                                <p className="text-sm font-bold text-slate-700">{item.investment}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <p className="text-xl leading-relaxed text-slate-700 text-justify first-letter:text-5xl first-letter:font-black first-letter:text-guinda-600 first-letter:mr-3 first-letter:float-left">
                                                        {item.content}
                                                    </p>

                                                    {item.highlights && (
                                                        <div className="bg-guinda-50/50 rounded-3xl p-8 border border-guinda-100 relative overflow-hidden group">
                                                            <Sparkles className="absolute top-4 right-4 h-6 w-6 text-guinda-400 opacity-20 group-hover:opacity-40 transition-opacity" />
                                                            <p className="text-xs font-black text-guinda-600 uppercase tracking-widest mb-2">Puntos Destacados</p>
                                                            <p className="text-lg font-bold text-guinda-900 italic leading-relaxed">"{item.highlights}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Institutional Footer Page */}
                                    <div className="pt-20 border-t border-slate-200 text-center space-y-4">
                                        <p className="text-sm font-bold text-slate-300 tracking-widest uppercase">Secretaría de Modernización Administrativa e Innovación Gubernamental</p>
                                        <p className="text-xs text-slate-400 italic">Pre-visualización generada el {new Date().toLocaleDateString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 border-t bg-white flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-500 leading-relaxed">
                                Esta es una vista previa de alta fidelidad. <br />
                                Los cambios realizados en las narrativas se verán reflejados aquí inmediatamente.
                            </p>
                            <div className="flex gap-4">
                                <Button variant="outline" className="h-14 px-8 rounded-2xl font-bold border-slate-200" onClick={() => setIsPreviewOpen(false)}>
                                    Cerrar Vista
                                </Button>
                                <Button className="h-14 px-8 rounded-2xl font-black bg-guinda-600 hover:bg-guinda-700 shadow-xl shadow-indigo-100 gap-2" onClick={() => { setIsPreviewOpen(false); handleConsolidate('word'); }}>
                                    <Download className="h-5 w-5" /> Descargar Versión Final
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
