"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, FileText, Settings, LogOut, Download, Loader2, Database, Inbox, BookOpen, ShieldCheck, Clock, Building2, Calendar, AlertCircle, History, ClipboardCheck, ArchiveRestore } from "lucide-react";
import { hasPermission } from "@/lib/permissions";

import Link from "next/link";
import { useState, useEffect } from "react";
import changelogData from "@/lib/changelog.json";

export function Sidebar() {
    const pathname = usePathname();
    const { user, token, selectedPeriod, logout } = useAuth();
    const isSuperAdmin = user?.roles?.includes('SuperAdministrador');
    const [observationsCount, setObservationsCount] = useState(0);

    const navItems = [
        { href: "/", label: "Dashboard Personal", icon: BarChart3 },
        { href: "/admin/dashboard", label: "Tablero Global", icon: BarChart3, roles: ["SuperAdministrador"] },
        { href: "/captura-narrativa", label: "Captura Narrativa", icon: FileText, roles: ["Capturista"] },
        { href: "/captura-narrativa/historial", label: "Mis Capturas", icon: History, roles: ["Capturista"] },
        { href: "/observaciones-secont", label: "Observaciones SECONT", icon: AlertCircle, count: observationsCount > 0 ? observationsCount : undefined, roles: ["Capturista"] },
        { href: "/captura-estadistica", label: "Anexo Estadístico", icon: Database, roles: ["Capturista", "Administrador", "SuperAdministrador", "SAFIN", "SECONT"] },
        { href: "/inbox", label: "Buzón de Control", icon: Inbox, roles: ["Capturista"] },
        { href: "/inbox/safin", label: "Bandeja SAFIN", icon: ClipboardCheck, roles: ["SAFIN", "Administrador", "SuperAdministrador"] },
        { href: "/inbox/secont", label: "Bandeja SECONT", icon: ShieldCheck, roles: ["SECONT", "Validador", "SuperAdministrador"] },
        { href: "/revision/sector/I", label: "Revisión Sectorial", icon: ShieldCheck, roles: ["Validador", "Administrador", "SuperAdministrador"] },
        { href: "/publicacion", label: "Publicación", icon: BookOpen, roles: ["Administrador", "Validador"] },
        { href: "/admin/usuarios", label: "Gestión Usuarios", icon: Users, roles: ["SuperAdministrador"] },
        { href: "/admin/dependencias", label: "Dependencias", icon: Building2, roles: ["SuperAdministrador"] },
        { href: "/admin/configuracion/periodos", label: "Periodos y Etapas", icon: Calendar, roles: ["SuperAdministrador"] },
        { href: "/admin/bitacora", label: "Bitácora Auditoría", icon: ShieldCheck, roles: ["SuperAdministrador"] },
        { href: "/admin/papelera", label: "Papelera de Reciclaje", icon: ArchiveRestore, roles: ["SuperAdministrador"] },
        { href: "/admin/configuracion", label: "Configuración General", icon: Settings, roles: ["SuperAdministrador"] },
    ];

    const filteredItems = navItems.filter(item =>
        !item.roles || (user?.roles && item.roles.some(role => user.roles.includes(role)))
    );

    useEffect(() => {
        if (token && user?.roles?.includes('Capturista')) {
            const fetchObservationsCount = async () => {
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');
                    const res = await fetch(`${baseUrl}/api/tracking/observations/count?periodo=${selectedPeriod}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setObservationsCount(data.count || 0);
                    }
                } catch (error) {
                    console.error("Failed to fetch observations count", error);
                }
            };
            fetchObservationsCount();
        }
    }, [token, user?.roles, selectedPeriod]);

    return (
        <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-white dark:bg-slate-900 sm:flex">
            <div className="flex h-16 items-center border-b px-6">
                <FileText className="h-6 w-6 text-guinda-600 dark:text-guinda-400" />
                <span className="ml-3 font-semibold text-lg text-slate-900 dark:text-white">Captura Informe V2</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none hover:scrollbar-thin scrollbar-thumb-slate-200">
                <nav className="flex flex-col gap-2 p-4 text-sm font-medium">
                    {filteredItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center justify-between rounded-xl px-4 py-3 transition-all ${isActive
                                    ? "bg-guinda-50 text-guinda-600 shadow-sm shadow-indigo-100/50"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`h-5 w-5 ${isActive ? "text-guinda-600" : "text-slate-400"}`} />
                                    <span className={isActive ? "font-bold" : "font-medium"}>{item.label}</span>
                                </div>
                                {item.count !== undefined && item.count > 0 && (
                                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black text-white shadow-sm ${item.href === '/observaciones-secont' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
                                        {item.count}
                                    </span>
                                )}
                            </Link>
                        );
                    })}

                    {/* Administration Menu */}
                    {(hasPermission(user?.roles, "ADMIN") || hasPermission(user?.roles, "GESTION_MATRICES")) && (
                        <div className="pt-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-3">
                                Sistema
                            </div>
                            {hasPermission(user?.roles, "ADMIN") && (
                                <Link
                                    href="/admin/catalogos"
                                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all ${pathname === "/admin/catalogos"
                                        ? "bg-guinda-50 text-guinda-600 shadow-sm shadow-indigo-100/50"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                >
                                    <Database className={`h-5 w-5 ${pathname === "/admin/catalogos" ? "text-guinda-600" : "text-slate-400"}`} />
                                    <span className={pathname === "/admin/catalogos" ? "font-bold" : "font-medium"}>Gestión Paramétrica</span>
                                </Link>
                            )}
                            {hasPermission(user?.roles, "GESTION_MATRICES") && (
                                <Link
                                    href="/admin/entidades"
                                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all ${pathname === "/admin/entidades"
                                        ? "bg-guinda-50 text-guinda-600 shadow-sm shadow-indigo-100/50"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                >
                                    <Database className={`h-5 w-5 ${pathname === "/admin/entidades" ? "text-guinda-600" : "text-slate-400"}`} />
                                    <span className={pathname === "/admin/entidades" ? "font-bold" : "font-medium"}>Gestión de Matrices</span>
                                </Link>
                            )}
                        </div>
                    )}
                </nav>
            </div>
            <div className="mt-auto border-t p-4 space-y-3 bg-white dark:bg-slate-900">

                {user && (
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usuario</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-guinda-600 dark:text-guinda-400 font-bold">{user.dependency || "SEPLAN"}</p>
                    </div>
                )}
                <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors text-slate-500" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                </Button>

                <div className="flex items-center justify-center pt-2">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v{changelogData.currentVersion}</span>
                </div>
            </div>
        </aside>
    );
}
