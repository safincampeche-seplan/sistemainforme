"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopHeader } from "@/components/TopHeader";
import {
    Calendar,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    CheckCircle2,
    Lock,
    Unlock,
    Star,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Settings
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

interface Stage {
    id: number;
    name: string;
    description: string;
    order: number;
    isOpen: boolean;
}

interface Period {
    id: number;
    year: number;
    name: string;
    description: string;
    isActive: boolean;
    status?: 'closed' | 'active' | 'upcoming';
    currentStage: number;
    createdAt: string;
    stages: Stage[];
}

export default function PeriodosPage() {
    const { token } = useAuth();
    const { confirmEl, askConfirm } = useConfirmDialog();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [togglingStage, setTogglingStage] = useState<string | null>(null);
    const [activating, setActivating] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);

    // Create modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ year: new Date().getFullYear() + 1, name: '', description: '' });

    const [notification, setNotification] = useState({ isOpen: false, title: '', message: '', type: 'success' as 'success' | 'error' });

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

    const fetchPeriods = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/periods`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setPeriods(data);
                // Auto-expand active period
                const active = data.find((p: Period) => p.isActive);
                if (active) setExpandedId(active.id);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPeriods(); }, [token]);

    const handleCreate = () => {
        setEditingPeriod(null);
        setFormData({ year: new Date().getFullYear() + 1, name: '', description: '' });
        setIsModalOpen(true);
    };

    const handleEdit = (p: Period) => {
        setEditingPeriod(p);
        setFormData({ year: p.year, name: p.name, description: p.description });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const url = editingPeriod ? `${baseUrl}/api/periods/${editingPeriod.id}` : `${baseUrl}/api/periods`;
            const method = editingPeriod ? 'PUT' : 'POST';
            const body = editingPeriod
                ? { name: formData.name, description: formData.description }
                : { year: formData.year, name: formData.name || undefined, description: formData.description };
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                setNotification({ isOpen: true, title: '✅ Guardado', message: editingPeriod ? 'Periodo actualizado.' : 'Periodo creado con 6 etapas predeterminadas.', type: 'success' });
                setIsModalOpen(false);
                fetchPeriods();
            } else {
                setNotification({ isOpen: true, title: 'Error', message: data.error, type: 'error' });
            }
        } catch {
            setNotification({ isOpen: true, title: 'Error', message: 'Error de conexión.', type: 'error' });
        } finally { setIsSaving(false); }
    };

    const handleActivate = async (period: Period) => {
        if (period.isActive) return;
        const ok = await askConfirm({
            title: 'Activar Periodo',
            message: `¿Establecer "${period.name}" como periodo activo? El periodo actual se desactivará.`,
            confirmLabel: 'Activar',
            variant: 'warning',
        });
        if (!ok) return;
        setActivating(period.id);
        try {
            const res = await fetch(`${baseUrl}/api/periods/${period.id}/activate`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setNotification({ isOpen: true, title: '✅ Activado', message: `${period.name} es ahora el período activo.`, type: 'success' });
                fetchPeriods();
            } else {
                const d = await res.json();
                setNotification({ isOpen: true, title: 'Error', message: d.error, type: 'error' });
            }
        } catch {
            setNotification({ isOpen: true, title: 'Error', message: 'Error de conexión.', type: 'error' });
        } finally { setActivating(null); }
    };

    const handleToggleStage = async (period: Period, stage: Stage) => {
        const key = `${period.id}-${stage.id}`;
        setTogglingStage(key);
        try {
            const res = await fetch(`${baseUrl}/api/periods/${period.id}/stages/${stage.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ isOpen: !stage.isOpen })
            });
            if (res.ok) {
                fetchPeriods();
            } else {
                const d = await res.json();
                setNotification({ isOpen: true, title: 'Error', message: d.error, type: 'error' });
            }
        } catch {
            setNotification({ isOpen: true, title: 'Error', message: 'Error de conexión.', type: 'error' });
        } finally { setTogglingStage(null); }
    };

    const handleDelete = async (period: Period) => {
        const ok = await askConfirm({
            title: 'Eliminar Periodo',
            message: `¿Eliminar "${period.name}"? Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            variant: 'danger',
        });
        if (!ok) return;
        setDeleting(period.id);
        try {
            const res = await fetch(`${baseUrl}/api/periods/${period.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const d = await res.json();
            if (res.ok) {
                setNotification({ isOpen: true, title: '✅ Eliminado', message: d.message, type: 'success' });
                fetchPeriods();
            } else {
                setNotification({ isOpen: true, title: 'Error', message: d.error, type: 'error' });
            }
        } catch {
            setNotification({ isOpen: true, title: 'Error', message: 'Error de conexión.', type: 'error' });
        } finally { setDeleting(null); }
    };

    const CURRENT_YEAR = new Date().getFullYear();

    const getPeriodStatus = (period: Period) => {
        if (period.isActive) return 'active';
        if (period.year < CURRENT_YEAR) return 'closed';
        return 'upcoming';
    };

    const statusConfig = {
        active: { label: 'Activo', badgeCls: 'bg-guinda-50 text-guinda-700 border-guinda-100', yearCls: 'bg-guinda-600 text-white', ring: 'ring-2 ring-guinda-200 shadow-indigo-200/60' },
        closed: { label: 'Histórico', badgeCls: 'bg-slate-100 text-slate-500 border-slate-200', yearCls: 'bg-slate-200 text-slate-500', ring: 'shadow-slate-100/60' },
        upcoming: { label: 'Próximo', badgeCls: 'bg-amber-50 text-amber-700 border-amber-100', yearCls: 'bg-amber-100 text-amber-700', ring: 'shadow-amber-100/30' },
    };

    const stageColors = [
        'bg-guinda-50 border-guinda-100 text-guinda-700',
        'bg-guinda-50 border-guinda-100 text-guinda-700',
        'bg-teal-50 border-teal-100 text-teal-700',
        'bg-cyan-50 border-cyan-100 text-cyan-700',
        'bg-amber-50 border-amber-100 text-amber-700',
        'bg-emerald-50 border-emerald-100 text-emerald-700',
    ];

    return (
        <>
            {confirmEl}
            <TopHeader title="Configuración de Periodos" />
            <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Periodos y Etapas</h2>
                        <p className="text-slate-500 font-medium">Configure los ciclos de captura y controle qué etapas están abiertas.</p>
                    </div>
                    <Button
                        onClick={handleCreate}
                        className="bg-guinda-600 hover:bg-guinda-700 text-white rounded-[1.25rem] px-8 py-7 font-black text-lg shadow-xl shadow-indigo-100 flex gap-3 transition-all hover:scale-105"
                    >
                        <Plus className="h-5 w-5" /> Nuevo Periodo
                    </Button>
                </div>

                {/* Info card */}
                <div className="flex items-start gap-4 p-5 bg-amber-50 rounded-3xl border border-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm font-medium text-amber-800 space-y-1">
                        <p className="font-black">Solo puede haber un periodo activo a la vez.</p>
                        <p className="text-amber-700">Las etapas abiertas determinan qué acciones pueden realizar los Capturistas y Validadores en el sistema.</p>
                    </div>
                </div>

                {/* Periods list */}
                {loading ? (
                    <div className="flex items-center justify-center py-24 gap-4">
                        <Loader2 className="h-10 w-10 text-guinda-600 animate-spin" />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Cargando periodos...</p>
                    </div>
                ) : periods.length === 0 ? (
                    <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 space-y-4">
                        <Calendar className="h-14 w-14 text-slate-200 mx-auto" />
                        <p className="text-lg font-black text-slate-400">No hay periodos configurados.</p>
                        <Button onClick={handleCreate} className="bg-guinda-600 text-white rounded-2xl px-8 py-4 font-black">
                            <Plus className="h-4 w-4 mr-2" /> Crear primer periodo
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {periods.sort((a, b) => b.year - a.year).map(period => {
                            const isExpanded = expandedId === period.id;
                            const openStages = period.stages?.filter(s => s.isOpen).length || 0;
                            const status = getPeriodStatus(period);
                            const cfg = statusConfig[status];
                            const isClosed = status === 'closed';

                            return (
                                <Card key={period.id} className={`border-none shadow-lg transition-all rounded-[2rem] overflow-hidden ${cfg.ring}`}>
                                    <CardContent className="p-0">
                                        {/* Period Header */}
                                        <div
                                            className="flex items-center gap-4 p-7 cursor-pointer hover:bg-slate-50/50 transition-all"
                                            onClick={() => setExpandedId(isExpanded ? null : period.id)}
                                        >
                                            {/* Year badge */}
                                            <div className={`h-16 w-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${cfg.yearCls}`}>
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Año</p>
                                                <p className="text-xl font-black">{period.year}</p>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 flex-wrap mb-1">
                                                    <h3 className={`text-lg font-black truncate ${isClosed ? 'text-slate-400' : 'text-slate-900'}`}>{period.name}</h3>
                                                    <span className={`flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-xl border ${cfg.badgeCls}`}>
                                                        {status === 'active' && <Star className="h-3 w-3 fill-current" />}
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 font-medium truncate">{period.description}</p>
                                                <p className="text-xs text-slate-300 font-bold mt-1">
                                                    {isClosed ? 'Ciclo concluido — solo lectura' : `${openStages} de ${period.stages?.length || 6} etapas abiertas`}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                {!period.isActive && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={!!activating}
                                                        onClick={() => handleActivate(period)}
                                                        className="rounded-xl text-xs font-black text-guinda-500 hover:bg-guinda-50 px-4"
                                                    >
                                                        {activating === period.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-3.5 w-3.5 mr-1" />}
                                                        Activar
                                                    </Button>
                                                )}
                                                <button onClick={() => handleEdit(period)}
                                                    className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-guinda-600 hover:bg-guinda-50 transition-all">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                {!period.isActive && (
                                                    <button onClick={() => handleDelete(period)} disabled={!!deleting}
                                                        className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                                        {deleting === period.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </button>
                                                )}
                                                <div className="h-9 w-9 flex items-center justify-center text-slate-300">
                                                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stages */}
                                        {isExpanded && (
                                            <div className="px-7 pb-7 space-y-3">
                                                <div className="h-px bg-slate-50 mb-5" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                                    <Settings className="h-3 w-3" />
                                                    {isClosed ? 'Etapas del Ciclo — Periodo histórico (solo lectura)' : 'Etapas del Ciclo — Habilite o deshabilite según el avance'}
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {(period.stages || []).sort((a, b) => a.order - b.order).map((stage, idx) => {
                                                        const colorClass = stageColors[idx % stageColors.length];
                                                        const isToggling = togglingStage === `${period.id}-${stage.id}`;

                                                        return (
                                                            <div key={stage.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${stage.isOpen ? colorClass : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${stage.isOpen ? 'bg-white/60' : 'bg-slate-100'}`}>
                                                                        {stage.order}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-black leading-tight">{stage.name}</p>
                                                                        <p className="text-[10px] font-bold opacity-60 truncate max-w-[160px]">{stage.description}</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => !isClosed && handleToggleStage(period, stage)}
                                                                    disabled={isToggling || isClosed}
                                                                    title={isClosed ? 'Periodo cerrado' : stage.isOpen ? 'Cerrar etapa' : 'Abrir etapa'}
                                                                    className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${isClosed ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400' : stage.isOpen ? 'bg-white/60 hover:bg-white/80 text-inherit' : 'bg-slate-100 hover:bg-guinda-50 hover:text-guinda-600 text-slate-400'}`}
                                                                >
                                                                    {isToggling
                                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                        : stage.isOpen
                                                                            ? <Unlock className="h-4 w-4" />
                                                                            : <Lock className="h-4 w-4" />
                                                                    }
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Stage Legend */}
                                                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50 text-xs font-bold text-slate-400">
                                                    <span className="flex items-center gap-1.5"><Unlock className="h-3 w-3 text-emerald-500" /> Abierta — usuarios pueden capturar/validar</span>
                                                    <span className="flex items-center gap-1.5"><Lock className="h-3 w-3 text-slate-300" /> Cerrada — acceso bloqueado</span>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <Card className="w-full max-w-lg border-none shadow-2xl rounded-[2.5rem]">
                        <CardContent className="p-10 space-y-7">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <div className="h-12 w-12 rounded-2xl bg-guinda-50 flex items-center justify-center mb-3">
                                        <Calendar className="h-6 w-6 text-guinda-600" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900">
                                        {editingPeriod ? 'Editar Periodo' : 'Nuevo Periodo'}
                                    </h3>
                                    <p className="text-sm text-slate-400 font-medium">
                                        {editingPeriod ? 'Actualice el nombre o descripción.' : 'Se crearán 6 etapas predeterminadas, todas cerradas.'}
                                    </p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)}
                                    className="h-9 w-9 rounded-2xl flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-all">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-5">
                                {!editingPeriod && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Año <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            required
                                            min={2020}
                                            max={2040}
                                            value={formData.year}
                                            onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-guinda-500 outline-none"
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Periodo</label>
                                    <input
                                        type="text"
                                        placeholder={`Ej. Informe de Gobierno ${formData.year}`}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-guinda-500 outline-none placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Descripción breve del periodo..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-guinda-500 outline-none placeholder:text-slate-300 resize-none"
                                    />
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}
                                        className="flex-1 rounded-[1.25rem] py-7 font-black text-slate-400 hover:bg-slate-50">
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={isSaving}
                                        className="flex-1 bg-guinda-600 hover:bg-guinda-700 text-white rounded-[1.25rem] py-7 font-black shadow-xl shadow-indigo-100 flex gap-2 justify-center">
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                        {isSaving ? 'Guardando...' : 'Guardar'}
                                    </Button>
                                </div>
                            </form>
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
