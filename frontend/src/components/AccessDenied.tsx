"use client";

import { ShieldAlert, ArrowLeft, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export function AccessDenied() {
    const { user } = useAuth();
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-red-100 rounded-full scale-150 animate-pulse opacity-20"></div>
                <div className="relative bg-white p-6 rounded-full shadow-2xl shadow-red-100 border border-red-50">
                    <ShieldAlert className="h-16 w-16 text-red-500" />
                </div>
            </div>

            <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Acceso Restringido</h1>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">
                Lo sentimos, no tienes los permisos necesarios para acceder a este módulo.
                Si crees que esto es un error, contacta al administrador del sistema.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/">
                    <Button variant="outline" className="border-slate-200 text-slate-600 px-8 h-12 rounded-xl font-bold gap-2">
                        <ArrowLeft className="h-5 w-5" />
                        Volver al Inicio
                    </Button>
                </Link>

                <Button
                    onClick={() => {
                        localStorage.clear();
                        window.location.href = '/login';
                    }}
                    className="bg-guinda-600 hover:bg-guinda-700 text-white px-8 h-12 rounded-xl font-bold gap-2 shadow-lg shadow-guinda-100"
                >
                    <RefreshCw className="h-5 w-5" />
                    Sincronizar Permisos
                </Button>
            </div>

            {/* Debug Info */}
            {user && (
                <div className="mt-12 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left max-w-sm w-full opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                        <Info className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Depuración de Permisos</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1"><strong>Email:</strong> {user.email}</p>
                    <p className="text-[10px] text-slate-500"><strong>Roles Detectados:</strong> {JSON.stringify(user.roles || [])}</p>
                </div>
            )}
        </div>
    );
}
