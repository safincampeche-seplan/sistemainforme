"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ClipboardCheck, History, Activity, FileText, Table, Download } from "lucide-react";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";
import { SnapshotsViewer } from "@/components/SnapshotsViewer";
import { AuditLogTable } from "@/components/AuditLogTable";

interface InboxItem {
    id: string;
    ppa_name: string;
    sequence_number: string;
    status: string;
    statusLabel: string;
    dependency: string;
    title: string;
    type?: string;
    period?: string;
    updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
    'draft': 'bg-slate-100 text-slate-700 border-slate-200',
    'finalized': 'bg-blue-100 text-blue-700 border-blue-200',
    'under_validation_semaig': 'bg-amber-100 text-amber-700 border-amber-200',
    'with_observations_semaig': 'bg-red-100 text-red-700 border-red-200',
    'approved_semaig': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'under_validation_secont': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'with_observations_secont': 'bg-rose-100 text-rose-700 border-rose-200',
    'approved_secont': 'bg-teal-100 text-teal-700 border-teal-200',
    'finished': 'bg-slate-800 text-white border-slate-900',
};

export default function BandejaSECONT() {
    const { token, selectedPeriod } = useAuth();
    const router = useRouter();
    const [items, setItems] = useState<InboxItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean; type: 'approve' | 'observe' | null; item: InboxItem | null }>({ open: false, type: null, item: null });
    const [observations, setObservations] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [showAudit, setShowAudit] = useState(false);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

    const fetchInbox = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/narratives/inbox?periodo=${selectedPeriod}&tab=${activeTab}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setItems(Array.isArray(data) ? data : []);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'word' | 'excel') => {
        try {
            const endpoint = `/api/export/consolidated/${format}?periodo=${selectedPeriod}&status=approved_secont`;
            const res = await fetch(`${baseUrl}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Reporte_SECONT_${selectedPeriod}_${format === 'word' ? 'Informe' : 'Anexo'}.${format === 'word' ? 'docx' : 'xlsx'}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert("Error al generar el reporte masivo.");
            }
        } catch (error) {
            console.error("Export error:", error);
            alert("Error de conexión al exportar.");
        }
    };

    useEffect(() => { if (token) fetchInbox(); }, [token, selectedPeriod, activeTab]);

    const openModal = (type: 'approve' | 'observe', item: InboxItem) => {
        setObservations('');
        setMsg('');
        setModal({ open: true, type, item });
    };
    const closeModal = () => setModal({ open: false, type: null, item: null });

    const handleAction = async () => {
        if (!modal.item) return;
        setSubmitting(true);
        const id = modal.item.id;
        const endpoint = modal.type === 'approve'
            ? `/api/narratives/${id}/approve-secont`
            : `/api/narratives/${id}/observe-secont`;
        try {
            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ observations }),
            });
            const data = await res.json();
            if (res.ok) {
                setMsg(`✅ ${data.statusLabel || 'Acción completada'}`);
                setTimeout(() => { closeModal(); fetchInbox(); }, 1500);
            } else {
                setMsg(`❌ ${data.error || 'Error'}`);
            }
        } catch {
            setMsg('❌ Error de conexión');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-guinda-600" />
        </div>
    );

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8 text-purple-600" />
                        Bandeja SECONT
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm md:text-base">
                        Gestión de validación final SECONT · Ciclo {selectedPeriod}
                    </p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-purple-700 shadow-sm border border-purple-100' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Pendientes
                    </button>
                    <button
                        onClick={() => setActiveTab('approved')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'approved' ? 'bg-white text-purple-700 shadow-sm border border-purple-100' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Aprobados
                    </button>
                </div>
            </div>

            <ExecutiveDashboard />

            <div className="flex flex-wrap gap-3">
                <Button
                    variant="outline"
                    onClick={() => setHistoryOpen(true)}
                    className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                >
                    <History className="h-4 w-4 mr-2 text-indigo-600" />
                    Histórico de Cortes
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleExport('word')}
                    className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                >
                    <FileText className="h-4 w-4 mr-2" />
                    Reporte Word
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleExport('excel')}
                    className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold"
                >
                    <Table className="h-4 w-4 mr-2" />
                    Anexo Excel
                </Button>
                <Button
                    variant="outline"
                    onClick={() => setShowAudit(!showAudit)}
                    className={`rounded-xl border-slate-200 font-bold transition-all ${showAudit ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <Activity className="h-4 w-4 mr-2" />
                    {showAudit ? "Ocultar Auditoría" : "Ver Bitácora de Auditoría"}
                </Button>
            </div>

            {showAudit && <AuditLogTable />}

            <SnapshotsViewer isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />

            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-4 font-semibold">Folio</th>
                                <th className="px-5 py-4 font-semibold">PPA</th>
                                <th className="px-5 py-4 font-semibold">Dependencia</th>
                                <th className="px-5 py-4 font-semibold">Clasificación</th>
                                <th className="px-5 py-4 font-semibold">Tipo</th>
                                <th className="px-5 py-4 font-semibold">Periodo</th>
                                <th className="px-5 py-4 font-semibold">Estatus</th>
                                <th className="px-5 py-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">
                                        No hay narrativas en tu bandeja SECONT para este periodo.
                                    </td>
                                </tr>
                            ) : items.map(item => (
                                <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{item.sequence_number}</td>
                                    <td className="px-5 py-4 font-semibold text-slate-900 max-w-xs">
                                        <span className="line-clamp-2">{item.ppa_name}</span>
                                    </td>
                                    <td className="px-5 py-4 text-slate-600">{item.dependency}</td>
                                    <td className="px-5 py-4 text-slate-500 text-xs">{item.title || '—'}</td>
                                    <td className="px-5 py-4 text-slate-600 text-xs">{item.type || '—'}</td>
                                    <td className="px-5 py-4 text-slate-600 text-xs">{item.period || '—'}</td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {item.statusLabel}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                                        {/* View Detail */}
                                        <Button variant="outline" size="sm" title="Ver Detalle y Historial" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                            onClick={() => router.push(`/inbox/narrativa/${item.id}`)}>
                                            <ClipboardCheck className="h-4 w-4" />
                                            <span className="ml-2 hidden md:inline">Ver Detalle</span>
                                        </Button>

                                        {activeTab === 'pending' && (
                                            <>
                                                <Button variant="outline" size="sm" title="Aprobar SECONT" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                    onClick={() => openModal('approve', item)}>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" title="Regresar con observaciones" className="border-red-200 text-red-600 hover:bg-red-50"
                                                    onClick={() => openModal('observe', item)}>
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {modal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-900">
                            {modal.type === 'approve' ? '✅ Aprobar — SECONT' : '⚠️ Regresar con Observaciones — SECONT'}
                        </h2>
                        <p className="text-sm text-slate-600 font-medium">{modal.item?.ppa_name}</p>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {modal.type === 'observe' ? 'Observaciones (obligatorio):' : 'Comentario (opcional):'}
                            </label>
                            <textarea rows={4}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                                placeholder={modal.type === 'observe' ? 'Describe qué debe corregirse...' : 'Comentario de aprobación...'}
                                value={observations}
                                onChange={e => setObservations(e.target.value)}
                            />
                        </div>
                        {msg && <p className={`text-sm font-semibold ${msg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</p>}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={closeModal} disabled={submitting}>Cancelar</Button>
                            <Button onClick={handleAction}
                                disabled={submitting || (modal.type === 'observe' && !observations.trim())}
                                className={modal.type === 'approve' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
