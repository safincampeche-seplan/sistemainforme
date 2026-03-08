"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Pencil, Eye, Download, Loader2, CloudOff, Cloud } from "lucide-react";

interface Narrative {
    id: string;
    ppa_name: string;
    new_ppa_name?: string;
    narrative_breakdown?: string;
    status: string;
    origin?: 'mysql' | 'local';
    cat_narrative_titles?: { name: string };
    cat_narrative_themes?: { name: string };
    updated_at: string;
}

export default function HistorialCapturas() {
    const { token, selectedPeriod, user } = useAuth();
    const router = useRouter();
    const [narratives, setNarratives] = useState<Narrative[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        const fetchData = async () => {
            try {
                const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
                const res = await fetch(`${baseUrl}/api/narratives/my-captures?periodo=${selectedPeriod}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setNarratives(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error("Error fetching my captures:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, selectedPeriod]);

    const handleExportWord = (id: string) => {
        const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
        window.open(`${baseUrl}/api/export/word/narrative/${id}?token=${token}`, '_blank');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft': case 'Borrador':
                return <Badge variant="outline" className="bg-slate-100 text-slate-700">Borrador</Badge>;
            case 'finalized':
                return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Finalizado (Pendiente SAFIN)</Badge>;
            case 'under_validation_semaig': case 'En Validación':
                return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">En Validación SAFIN</Badge>;
            case 'with_observations_semaig': case 'observed': case 'Observado':
                return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Observado por SAFIN</Badge>;
            case 'approved_semaig': case 'approved': case 'Aprobado':
                return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Aprobado por SAFIN</Badge>;
            case 'under_validation_secont':
                return <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200">En Validación SECONT</Badge>;
            case 'with_observations_secont':
                return <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">Observado por SECONT</Badge>;
            case 'approved_secont':
                return <Badge variant="outline" className="bg-teal-100 text-teal-700 border-teal-200">Aprobado por SECONT</Badge>;
            case 'finished':
                return <Badge variant="outline" className="bg-slate-800 text-white border-slate-900">Terminado (Cerrado)</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getOriginBadge = (origin?: string) => {
        if (origin === 'local') {
            return (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200" title="Guardado localmente, pendiente de sincronizar con la base de datos">
                    <CloudOff className="h-2.5 w-2.5" /> Local
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200" title="Guardado en la base de datos oficial">
                <Cloud className="h-2.5 w-2.5" /> Sincronizado
            </span>
        );
    };

    const localCount = narratives.filter(n => n.origin === 'local').length;
    const syncedCount = narratives.filter(n => n.origin === 'mysql').length;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-guinda-600" />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <FileText className="h-8 w-8 text-guinda-600" />
                        Mis Capturas
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Consulta y administra las narrativas que pertenecen a tu dependencia ({user?.dependency || "SEPLAN"}).
                    </p>
                </div>
                <Button onClick={() => router.push('/captura-narrativa')} className="bg-guinda-600 hover:bg-guinda-700 text-white shadow-md">
                    + Nueva Captura
                </Button>
            </div>

            {/* Summary strip */}
            {narratives.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-100 shadow-sm">
                        <span className="text-lg font-black text-slate-800">{narratives.length}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
                        <Cloud className="h-4 w-4 text-emerald-500" />
                        <span className="text-lg font-black text-emerald-700">{syncedCount}</span>
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Sincronizados</span>
                    </div>
                    {localCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 shadow-sm">
                            <CloudOff className="h-4 w-4 text-amber-500" />
                            <span className="text-lg font-black text-amber-700">{localCount}</span>
                            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Solo Local</span>
                        </div>
                    )}
                </div>
            )}

            {localCount > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
                    <CloudOff className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium">
                        <strong>{localCount} captura{localCount > 1 ? 's' : ''}</strong> {localCount > 1 ? 'están guardadas' : 'está guardada'} solo localmente en el servidor y aún no {localCount > 1 ? 'han sido sincronizadas' : 'ha sido sincronizada'} con la base de datos oficial MySQL. Para migrarlas, pide al administrador que ejecute el script de migración.
                    </p>
                </div>
            )}

            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-semibold">PPA / Resumen</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Alineación</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Última Modificación</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Estatus</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Origen</th>
                                <th scope="col" className="px-6 py-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {narratives.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No has guardado ni enviado ninguna narrativa en este periodo.
                                    </td>
                                </tr>
                            ) : (
                                narratives.map((narrative) => (
                                    <tr key={narrative.id} className={`hover:bg-slate-50/50 transition-colors ${narrative.origin === 'local' ? 'bg-amber-50/20' : ''}`}>
                                        <td className="px-6 py-4 font-medium text-slate-900 w-1/3">
                                            <div className="font-bold text-sm">
                                                {narrative.ppa_name || narrative.new_ppa_name || <span className="text-slate-400 italic font-normal">Sin PPA asignado</span>}
                                            </div>
                                            {narrative.narrative_breakdown && (
                                                <div className="text-xs text-slate-500 font-normal mt-1.5 line-clamp-2 leading-relaxed">
                                                    {narrative.narrative_breakdown}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {narrative.cat_narrative_titles?.name || <span className="text-slate-300 italic">Sin Eje</span>}
                                            <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                {narrative.cat_narrative_themes?.name || ""}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                            {new Date(narrative.updated_at).toLocaleDateString('es-MX', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(narrative.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getOriginBadge(narrative.origin)}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                                            {(narrative.status === 'draft' || narrative.status === 'Borrador' || narrative.status === 'observed' || narrative.status === 'Observado') ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    title="Editar"
                                                    onClick={() => router.push(`/captura-narrativa?id=${narrative.id}`)}
                                                >
                                                    <Pencil className="h-4 w-4 text-amber-600" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    title="Ver Detalle"
                                                    disabled
                                                    className="opacity-50 cursor-not-allowed"
                                                >
                                                    <Eye className="h-4 w-4 text-slate-400" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                title="Descargar versión en Word"
                                                onClick={() => handleExportWord(narrative.id)}
                                                disabled={narrative.origin === 'local'}
                                                className={narrative.origin === 'local' ? 'opacity-40 cursor-not-allowed' : ''}
                                            >
                                                <Download className="h-4 w-4 text-indigo-600" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
