"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopHeader } from "@/components/TopHeader";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { AccessDenied } from "@/components/AccessDenied";
import CorteManager from "@/components/CorteManager";
import {
    Settings,
    Mail,
    ShieldCheck,
    Download,
    Save,
    Loader2,
    Database,
    AlertCircle,
    Server,
    Clock
} from "lucide-react";

interface ConfigSettings {
    narrative_limit: number;
    highlights_limit: number;
    capture_deadline?: string;
    smtp: {
        host: string;
        port: number;
        user: string;
        from: string;
    };
    backups: {
        frequency: string;
        last_backup: string | null;
    };
}

export default function ConfigPage() {
    const { token, user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('SuperAdministrador');

    const [settings, setSettings] = useState<ConfigSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [backingUp, setBackingUp] = useState(false);

    // Notifications
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "success"
    });

    const showNotification = (title: string, message: string, type: "success" | "error" | "info" = "success") => {
        setNotification({ isOpen: true, title, message, type });
    };

    const fetchConfig = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/config`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            } else {
                setError(`Error ${res.status}: ${res.statusText}`);
            }
        } catch (err) {
            console.error("Failed to fetch config", err);
            setError("No se pudo conectar con el servidor configurado.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            fetchConfig();
        }
    }, [token, isSuperAdmin]);

    const handleSave = async () => {
        if (!token || !settings) return;
        setSaving(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/config`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                showNotification("Configuración Guardada", "Los parámetros globales han sido actualizados.", "success");
            } else {
                showNotification("Error", "No se pudo actualizar la configuración.", "error");
            }
        } catch (error) {
            showNotification("Error", "Fallo de conexión con el servidor.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleBackup = async () => {
        if (!token) return;
        setBackingUp(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
            const res = await fetch(`${baseUrl}/api/system/backup`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Respaldo_Manual_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                showNotification("Respaldo Exitoso", "El archivo de datos ha sido descargado.", "success");
            } else {
                showNotification("Error", "No se pudo generar el respaldo.", "error");
            }
        } catch (error) {
            showNotification("Error", "Error al descargar el respaldo.", "error");
        } finally {
            setBackingUp(false);
        }
    };

    if (!isSuperAdmin) {
        return <AccessDenied />;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Loader2 className="h-12 w-12 animate-spin text-guinda-600 mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando Configuración...</p>
            </div>
        );
    }

    if (error || !settings) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200 max-w-md space-y-6">
                    <div className="bg-red-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto">
                        <AlertCircle className="h-10 w-10 text-red-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Error de Carga</h2>
                        <p className="text-slate-500 font-medium">{error || "No se pudieron obtener los ajustes."}</p>
                    </div>
                    <Button
                        onClick={fetchConfig}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl"
                    >
                        Reintentar Conexión
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <TopHeader title="Configuración del Sistema" />

            <main className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 text-guinda-600 mb-2">
                            <div className="bg-guinda-100 p-2 rounded-xl">
                                <Settings className="h-6 w-6" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-sm">Administración</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Paneles de Control Global</h1>
                        <p className="text-slate-500 font-medium max-w-2xl">
                            Ajusta los límites de captura, configura las notificaciones y gestiona los respaldos de seguridad del sistema.
                        </p>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-guinda-600 hover:bg-guinda-700 text-white font-bold h-14 px-8 rounded-2xl shadow-xl shadow-indigo-100 gap-2 transition-all active:scale-95"
                    >
                        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Guardar Cambios
                    </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-8">

                    {/* Character Limits */}
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                <CardTitle className="text-lg font-bold">Límites de Captura</CardTitle>
                            </div>
                            <CardDescription>Controla la extensión máxima de los textos.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-slate-400">Límite Narrativa (Caracteres)</label>
                                <Input
                                    type="number"
                                    value={settings.narrative_limit}
                                    onChange={(e) => setSettings({ ...settings, narrative_limit: parseInt(e.target.value) })}
                                    className="h-12 border-slate-200 focus-visible:ring-guinda-500 rounded-xl font-bold"
                                />
                                <p className="text-[10px] text-slate-400">Recomendado: 3000-5000</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-slate-400">Límite Destacados (Caracteres)</label>
                                <Input
                                    type="number"
                                    value={settings.highlights_limit}
                                    onChange={(e) => setSettings({ ...settings, highlights_limit: parseInt(e.target.value) })}
                                    className="h-12 border-slate-200 focus-visible:ring-guinda-500 rounded-xl font-bold"
                                />
                                <p className="text-[10px] text-slate-400">Recomendado: 500-1000</p>
                            </div>
                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <label className="text-xs font-black uppercase text-guinda-600 flex items-center gap-2">
                                    <Clock className="h-3 w-3" /> Fecha Límite de Captura
                                </label>
                                <Input
                                    type="date"
                                    value={settings.capture_deadline || "2026-03-15"}
                                    onChange={(e) => setSettings({ ...settings, capture_deadline: e.target.value })}
                                    className="h-12 border-guinda-100 focus-visible:ring-guinda-500 rounded-xl font-bold bg-guinda-50/30"
                                />
                                <p className="text-[10px] text-slate-400">Esta fecha define el conteo regresivo en el Tablero Global.</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notification Settings */}
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-guinda-500" />
                                <CardTitle className="text-lg font-bold">Notificaciones Email</CardTitle>
                            </div>
                            <CardDescription>Ajustes del servidor SMTP para alertas.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-slate-400">Host SMTP</label>
                                    <Input
                                        placeholder="mail.ejemplo.com"
                                        value={settings.smtp?.host || ""}
                                        onChange={(e) => setSettings({ ...settings, smtp: { ...(settings.smtp || { port: 587, user: "", from: "" }), host: e.target.value } })}
                                        className="h-12 border-slate-200 focus-visible:ring-guinda-500 rounded-xl font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-slate-400">Puerto</label>
                                    <Input
                                        type="number"
                                        value={settings.smtp?.port || 0}
                                        onChange={(e) => setSettings({ ...settings, smtp: { ...(settings.smtp || { host: "", user: "", from: "" }), port: parseInt(e.target.value) } })}
                                        className="h-12 border-slate-200 focus-visible:ring-guinda-500 rounded-xl font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-slate-400">Correo Remitente</label>
                                <Input
                                    placeholder="notificaciones@seplan.gob.mx"
                                    value={settings.smtp?.from || ""}
                                    onChange={(e) => setSettings({ ...settings, smtp: { ...(settings.smtp || { host: "", port: 587, user: "" }), from: e.target.value } })}
                                    className="h-12 border-slate-200 focus-visible:ring-guinda-500 rounded-xl font-medium"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Backups & Maintenance */}
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white md:col-span-2">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <Database className="h-5 w-5 text-guinda-500" />
                                    <CardTitle className="text-lg font-bold">Mantenimiento y Seguridad</CardTitle>
                                </div>
                                <CardDescription>Gestiona la integridad de la base de datos.</CardDescription>
                            </div>
                            <div className="text-right">
                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold mb-1">Backup Diario Activo</Badge>
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                                    <Clock className="h-3 w-3" /> Último: {settings.backups?.last_backup || 'Nunca (Manual)'}
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="p-10 bg-slate-50/30">
                            <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
                                <div className="bg-white p-6 rounded-full shadow-lg shadow-indigo-100 relative">
                                    <Server className="h-12 w-12 text-guinda-600" />
                                    <div className="absolute -top-1 -right-1 h-6 w-6 bg-emerald-500 border-4 border-white rounded-full animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Respaldo Integral de Datos</h3>
                                    <p className="text-sm text-slate-500 font-medium">
                                        Genera un archivo JSON con toda la información actual (Universo de Captura, Usuarios, Logs). Recomendamos descargar un respaldo antes de cualquier migración.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleBackup}
                                    disabled={backingUp}
                                    className="h-14 px-10 rounded-2xl border-2 border-guinda-100 hover:border-guinda-200 hover:bg-white text-guinda-600 font-black shadow-sm gap-3 transition-all active:scale-95"
                                >
                                    {backingUp ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                                    Descargar Base de Datos
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Corte Manager (Snapshots) */}
                    <div className="md:col-span-2">
                        <CorteManager />
                    </div>

                    {/* Alerta Informativa */}
                    <div className="md:col-span-2 bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex gap-4">
                        <AlertCircle className="h-6 w-6 text-amber-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-black text-amber-900 mb-1 tracking-tight uppercase">Atención</h4>
                            <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                Los cambios realizados en esta sección afectan a todos los usuarios del sistema de forma inmediata. Asegúrate de que los límites de caracteres sean coherentes con los requerimientos técnicos del Informe Anual.
                            </p>
                        </div>
                    </div>

                </div>
            </main>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification({ ...notification, isOpen: false })}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </div>
    );
}

// Re-using simplified components from previous modules
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
            {children}
        </span>
    );
}
