"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TopHeader } from "@/components/TopHeader";
import {
    ChevronLeft, Clock, CheckCircle2, AlertCircle, MessageSquare,
    FileText, BarChart3, ShieldCheck, History, Loader2, MapPin,
    DollarSign, Users, Target, Link2, BookOpen, Eye, FileDown
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

interface TimelineEvent { status: string; date: string; user: string; }

interface DetailData {
    id: number; type: string;
    title?: string; ppa_name?: string;
    investment_amount?: string; beneficiaries?: string;
    beneficiary_type?: string; ppa_type?: string;
    funding_source?: string; budget_program?: string;
    ods?: any[]; ods_ids?: string[];
    title_name?: string; theme_name?: string; subtheme_name?: string;
    locations?: any[]; peds?: any[];
    narrative_breakdown?: string; highlighted?: string;
    dependency?: string; statistical_link?: string;
    status: string; timeline: TimelineEvent[];
    rows?: any[]; pivot_rows?: any[]; evolution_data?: any[];
    available_years?: number[]; source?: string; notes?: string;
    properties?: any[];
}

function InfoField({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
    if (!value) return null;
    return (
        <div className={wide ? "col-span-full" : ""}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
            <div className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 min-h-[42px] leading-relaxed">{value}</div>
        </div>
    );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-guinda-50 text-guinda-600 flex items-center justify-center shrink-0">{icon}</div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h4>
                <div className="flex-1 h-px bg-slate-100" />
            </div>
            {children}
        </div>
    );
}

export default function ValidationDetail() {
    const { type, id } = useParams();
    const router = useRouter();
    const { token, user } = useAuth();
    const [data, setData] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [observation, setObservation] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState({ isOpen: false, title: "", message: "", type: "success" as any });
    const showNotification = (t: string, m: string, tp: any = "info") => setNotification({ isOpen: true, title: t, message: m, type: tp });
    const { confirmEl } = useConfirmDialog();
    const isNarrative = type === "narrativa";

    useEffect(() => {
        const fetchDetail = async () => {
            if (!token) return;
            try {
                const baseUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "http://localhost:3001";
                const res = await fetch(`${baseUrl}/api/tracking/${type}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) setData(await res.json());
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchDetail();
    }, [token, type, id]);

    const handleAction = async (action: "approve" | "observe") => {
        if (!data) return;
        setSubmitting(true);
        try {
            const baseUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "http://localhost:3001";

            if (type === "narrativa") {
                let endpointType = "";
                const current = data.status || "";

                // Determinar si corresponde a SAFIN o SECONT según el estatus
                if (["draft", "Borrador", "Completado", "Aprobado", "under_validation_semaig", "with_observations_semaig"].includes(current)) {
                    endpointType = "safin";
                } else if (["finalized", "under_validation_secont", "with_observations_secont"].includes(current)) {
                    endpointType = "secont";
                } else {
                    showNotification("Error", `El estatus actual (${current}) no permite validación en esta pantalla.`, "error");
                    return;
                }

                const endpoint = `/api/narratives/${data.id}/${action}-${endpointType}`;
                const res = await fetch(`${baseUrl}${endpoint}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ observations: observation })
                });

                const resData = await res.json();
                if (res.ok) {
                    showNotification(action === "approve" ? "Aprobado" : "Observado",
                        action === "approve" ? "La narrativa fue aprobada." : "Observaciones registradas.", "success");
                    setData(prev => prev ? { ...prev, status: resData.status } : prev);
                    setObservation(""); // Limpiar caja de texto
                } else {
                    showNotification("Error", resData.error || "No se pudo actualizar.", "error");
                }
            } else if (type === "estadística") {
                let endpointType = "";
                const current = data.status || "";

                if (["draft", "Borrador", "Completado", "Aprobado", "under_validation_semaig", "with_observations_semaig"].includes(current)) {
                    endpointType = "safin";
                } else if (["approved_semaig", "under_validation_secont", "with_observations_secont"].includes(current)) {
                    endpointType = "secont";
                } else {
                    showNotification("Error", `El estatus actual (${current}) no permite validación en esta pantalla.`, "error");
                    return;
                }

                const endpoint = `/api/entities/${data.id}/${action}-${endpointType}`;
                const res = await fetch(`${baseUrl}${endpoint}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ observations: observation })
                });

                const resData = await res.json();
                if (res.ok) {
                    showNotification(action === "approve" ? "Aprobado" : "Observado",
                        action === "approve" ? "El anexo estadístico fue aprobado." : "Observaciones registradas.", "success");
                    setData(prev => prev ? { ...prev, status: resData.status } : prev);
                    setObservation("");
                } else {
                    showNotification("Error", resData.error || "No se pudo actualizar.", "error");
                }
            }
        } catch (e) {
            console.error(e);
            showNotification("Error", "Fallo en la red o servidor.", "error");
        } finally { setSubmitting(false); }
    };

    const handleExport = async (format: "word" | "pdf") => {
        if (!data || !isNarrative) return;
        try {
            const baseUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "http://localhost:3001";
            const endpoint = format === "pdf" ? `/api/export/pdf/narrative/${data.id}` : `/api/export/word/narrative/${data.id}`;
            const res = await fetch(`${baseUrl}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = format === "pdf" ? `Narrativa_${data.id}.pdf` : `Narrativa_${data.id}.docx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                showNotification("Error", `No se pudo exportar a ${format.toUpperCase()}.`, "error");
            }
        } catch (e) {
            console.error(e);
            showNotification("Error", "Fallo al conectar con el servidor.", "error");
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 text-guinda-600 animate-spin" /></div>;
    if (!data) return (
        <div className="p-20 text-center space-y-4">
            <AlertCircle className="h-20 w-20 text-red-100 mx-auto" />
            <h2 className="text-2xl font-bold">Registro no encontrado</h2>
            <Button onClick={() => router.back()}>Regresar</Button>
        </div>
    );

    const displayTitle = isNarrative ? (data.ppa_name || data.title_name || data.title) : data.title;
    const currentStatus = data.status || "Pendiente";
    const isValidador = user?.roles?.some(r => ["Validador", "Administrador", "SuperAdministrador", "SAFIN", "SECONT"].includes(r));

    const STATUS_MAP: Record<string, { label: string, color: string }> = {
        'draft': { label: 'Borrador', color: 'bg-slate-500' },
        'finalized': { label: 'Pendiente SAFIN', color: 'bg-blue-500' },
        'under_validation_semaig': { label: 'En Validación SAFIN', color: 'bg-amber-500' },
        'with_observations_semaig': { label: 'Observado por SAFIN', color: 'bg-red-500' },
        'approved_semaig': { label: 'Aprobado por SAFIN', color: 'bg-emerald-500' },
        'under_validation_secont': { label: 'En Validación SECONT', color: 'bg-indigo-500' },
        'with_observations_secont': { label: 'Observado por SECONT', color: 'bg-rose-500' },
        'approved_secont': { label: 'Aprobado por SECONT', color: 'bg-teal-500' },
        'finished': { label: 'Terminado (Cerrado)', color: 'bg-slate-800' },
        // Legacy fallbacks
        'Aprobado': { label: 'Aprobado', color: 'bg-emerald-500' },
        'Borrador': { label: 'Borrador', color: 'bg-slate-400' },
        'Observado': { label: 'Observado', color: 'bg-red-500' }
    };
    const statusInfo = STATUS_MAP[currentStatus] || { label: currentStatus, color: 'bg-guinda-600' };

    return (
        <>
            {confirmEl}
            <NotificationModal isOpen={notification.isOpen} title={notification.title} message={notification.message} type={notification.type} onClose={() => setNotification(p => ({ ...p, isOpen: false }))} />
            <TopHeader title={isNarrative ? "Historial de Narrativa Capturada" : "Historial de Anexo Estadístico"} />

            <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">

                {/* Read-only banner */}
                <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
                    <Eye className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                        <span className="font-bold text-sm">Vista de Solo Lectura — Historial</span>
                        <span className="text-xs ml-2 text-amber-600">Esta pantalla es solo para consulta. No se pueden realizar cambios aquí.</span>
                    </div>
                </div>

                {/* Header bar */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()} className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-100 p-0">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historial / {type}</p>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight truncate">{displayTitle || `Registro #${data.id}`}</h2>
                    </div>
                    <div className="flex gap-2 shrink-0 items-center">
                        {isNarrative && (
                            <div className="flex gap-2 mr-2 border-r pr-4 border-slate-100 hidden md:flex">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold gap-2"
                                    onClick={() => handleExport("word")}
                                >
                                    <FileText className="h-4 w-4" />
                                    Word
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 rounded-xl border-red-100 bg-red-50 text-red-600 hover:bg-red-100 font-bold gap-2"
                                    onClick={() => handleExport("pdf")}
                                >
                                    <FileDown className="h-4 w-4" />
                                    PDF
                                </Button>
                            </div>
                        )}
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-bold text-slate-500 border-slate-200">ID: {data.id}</Badge>
                        <Badge className={`rounded-full px-3 py-1 text-xs font-bold uppercase text-white ${statusInfo.color}`}>{statusInfo.label}</Badge>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── MAIN CONTENT ── */}
                    <div className="lg:col-span-2 space-y-5">
                        {isNarrative ? (
                            <>
                                {/* 1. Datos Iniciales — consolidado con todos los campos */}
                                <SectionCard icon={<BookOpen className="h-4 w-4" />} title="Datos Iniciales">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <InfoField label="Título Estratégico" value={data.title_name} />
                                        <InfoField label="Tema Institucional" value={data.theme_name} />
                                        <InfoField label="Subtema" value={data.subtheme_name} />
                                        <InfoField label="Tipo PPA" value={data.ppa_type} />
                                        <InfoField label="Monto de Inversión" value={data.investment_amount ? `$${Number(data.investment_amount).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : undefined} />
                                        <InfoField label="Beneficiarios" value={data.beneficiaries ? Number(data.beneficiaries).toLocaleString() : undefined} />
                                        <InfoField label="Tipo de Beneficiario" value={data.beneficiary_type} />
                                        <InfoField label="Programa Presupuestario" value={data.budget_program} />
                                    </div>

                                    {/* ODS */}
                                    {data.ods && data.ods.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">ODS</p>
                                            <div className="flex flex-wrap gap-2">
                                                {data.ods.map((o: any, i: number) => (
                                                    <span key={i} className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1">
                                                        {o.name || o.label || String(o)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Ubicación */}
                                    {data.locations && data.locations.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                <MapPin className="h-3 w-3" /> Ubicación
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {data.locations.map((loc: any, i: number) => {
                                                    // Intentar parsear si viene como string
                                                    let parsedLoc = loc;
                                                    if (typeof loc === 'string') {
                                                        try { parsedLoc = JSON.parse(loc); }
                                                        catch (e) { /* ignore */ }
                                                    }

                                                    // Diccionario local rápido para resolver ID -> Nombre
                                                    const munMap: Record<string, string> = {
                                                        "1": "Campeche", "2": "Calkiní", "3": "Carmen", "4": "Champotón",
                                                        "5": "Hecelchakán", "6": "Hopelchén", "7": "Palizada", "8": "Tenabo",
                                                        "9": "Escárcega", "10": "Calakmul", "11": "Candelaria",
                                                        "12": "Seybaplaya", "13": "Dzitbalché"
                                                    };

                                                    let displayText = "";
                                                    if (typeof parsedLoc === "string") {
                                                        displayText = parsedLoc;
                                                    } else if (parsedLoc && typeof parsedLoc === "object") {
                                                        const mName = parsedLoc.municipality || munMap[String(parsedLoc.municipality_id)] || `Municipio ${parsedLoc.municipality_id}`;
                                                        displayText = `${mName}${parsedLoc.localities ? ": " + parsedLoc.localities : ""}`;
                                                    }

                                                    return (
                                                        <span key={i} className="text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100 rounded-lg px-3 py-1.5">
                                                            {displayText || "Ubicación desconocida"}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Vinculación PED */}
                                    {data.peds && data.peds.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                <Target className="h-3 w-3" /> Vinculación PED
                                            </p>
                                            <div className="space-y-3">
                                                {data.peds.map((ped: any, i: number) => (
                                                    <div key={i} className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1">
                                                        {ped.mission && <p><span className="font-bold text-slate-500 text-xs">Misión:</span> {ped.mission}</p>}
                                                        {ped.objective && <p><span className="font-bold text-slate-500 text-xs">Objetivo:</span> {ped.objective}</p>}
                                                        {ped.strategy && <p><span className="font-bold text-slate-500 text-xs">Estrategia:</span> {ped.strategy}</p>}
                                                        {ped.action_line && <p><span className="font-bold text-slate-500 text-xs">Línea de Acción:</span> {ped.action_line}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Anexo Estadístico */}
                                    {data.statistical_link && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                <Link2 className="h-3 w-3" /> Anexo Estadístico
                                            </p>
                                            <p className="text-sm font-medium text-guinda-600 underline">{data.statistical_link}</p>
                                        </div>
                                    )}
                                </SectionCard>

                                {/* 6. Desglose Narrativa */}
                                <SectionCard icon={<FileText className="h-4 w-4" />} title="Desglose Narrativa">
                                    <div className="text-sm leading-relaxed text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-5 whitespace-pre-line min-h-[80px]">
                                        {data.narrative_breakdown || <span className="italic text-slate-400">Sin contenido</span>}
                                    </div>
                                </SectionCard>

                                {/* 7. Texto Resaltado */}
                                {data.highlighted && (
                                    <div className="bg-white border border-guinda-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-guinda-600 to-amber-500 rounded-l-2xl" />
                                        <div className="pl-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-guinda-500 mb-3 flex items-center gap-1.5">
                                                <CheckCircle2 className="h-3.5 w-3.5" />Texto Resaltado
                                            </p>
                                            <p className="text-base font-bold text-slate-900 leading-snug italic">&ldquo;{data.highlighted}&rdquo;</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* ── ESTADÍSTICO ── */
                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-1.5">
                                    <p className="text-sm font-semibold text-slate-700">{data.title}</p>
                                    {data.dependency && <p className="text-xs text-slate-500"><span className="font-bold">Dependencia:</span> {data.dependency}</p>}
                                    <p className="text-xs text-slate-500"><span className="font-bold">Estado:</span> <span className="text-guinda-600 font-bold">{currentStatus}</span></p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50">
                                                {(data.properties || []).map((prop: any) => (
                                                    <th key={prop.id} className="p-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 border-r border-slate-100 last:border-r-0">{prop.name}</th>
                                                ))}
                                                {!data.properties?.length && <th className="p-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Datos</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const rawRows: any[] = (data as any).raw_rows || data.rows || [];
                                                const props = data.properties || [];
                                                if (!rawRows.length) return (
                                                    <tr><td colSpan={props.length || 5} className="p-8 text-center text-slate-400 italic text-sm">Sin datos capturados.</td></tr>
                                                );
                                                return rawRows.map((row: any, idx: number) => (
                                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                                                        {props.length > 0
                                                            ? props.map((p: any) => <td key={p.id} className="p-4 text-slate-700 border-r border-slate-50 last:border-r-0 align-top">{row[p.id] ?? row[p.name] ?? ""}</td>)
                                                            : Object.values(row).map((v: any, vi: number) => <td key={vi} className="p-4 text-slate-700 border-r border-slate-50 last:border-r-0">{String(v)}</td>)
                                                        }
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                {data.source && (
                                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                                        <p className="text-xs text-slate-500 italic"><span className="font-bold not-italic">Fuente:</span> {data.source}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── SIDEBAR ── */}
                    <div className="space-y-5">
                        {/* Timeline */}
                        <SectionCard icon={<Clock className="h-4 w-4" />} title="Historial de Estatus">
                            <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
                                {(data.timeline || []).map((evt: any, i) => (
                                    <div key={i} className="flex gap-3 relative">
                                        <div className="h-7 w-7 rounded-full bg-guinda-50 border-2 border-guinda-200 flex items-center justify-center shrink-0 z-10">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-guinda-600" />
                                        </div>
                                        <div className="pt-0.5 w-full">
                                            <div className="flex justify-between items-start">
                                                <p className="text-xs font-bold text-slate-800">{evt.status}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{new Date(evt.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</p>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-medium">Por: {evt.user}</p>
                                            {evt.observations && (
                                                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100 italic">
                                                    &quot;{evt.observations}&quot;
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        {/* Validator Actions */}
                        {isValidador && (
                            <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-guinda-300" />
                                    <h3 className="font-bold text-sm">Evaluación y Observaciones</h3>
                                </div>
                                <Textarea
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                    placeholder="Escribe tus observaciones aquí..."
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl resize-none text-sm"
                                    rows={4}
                                />
                                <div className="flex gap-2">
                                    <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold" disabled={submitting} onClick={() => handleAction("approve")}>
                                        <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar
                                    </Button>
                                    <Button variant="outline" className="flex-1 border-red-400 text-red-300 hover:bg-red-950 rounded-xl text-sm font-bold" disabled={submitting || !observation.trim()} onClick={() => handleAction("observe")}>
                                        <MessageSquare className="h-4 w-4 mr-1" /> Observar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
