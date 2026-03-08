import { useAuth } from "@/context/AuthContext";
import { ChevronDown, History, AlertTriangle } from "lucide-react";
import { useState } from "react";
import NotificationBell from "./NotificationBell";

export function TopHeader({ title }: { title: string }) {
    const { selectedPeriod, setPeriod } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const periods = [2026, 2025];

    return (
        <>
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/80 px-6 backdrop-blur dark:bg-slate-900/80 transition-all">
                <div className="flex flex-1 items-center gap-4">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
                </div>
                <div className="flex items-center gap-6">
                    {/* Notification Bell */}
                    <NotificationBell />

                    {/* Period Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all active:scale-95 ${selectedPeriod === 2026
                                ? 'bg-guinda-50 border-guinda-100 text-guinda-600 shadow-sm'
                                : 'bg-amber-50 border-amber-100 text-amber-600 shadow-sm'}`}
                        >
                            <History className="h-4 w-4" />
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Ciclo Informe</span>
                                <span className="text-sm font-black">{selectedPeriod}</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-2 space-y-1">
                                    {periods.map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => {
                                                setPeriod(p);
                                                setIsMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-colors ${selectedPeriod === p
                                                ? 'bg-guinda-600 text-white shadow-lg'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-guinda-600'}`}
                                        >
                                            {p}
                                            {selectedPeriod === p && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-8 w-8 rounded-full bg-guinda-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm">
                        SE
                    </div>
                </div>
            </header>

            {/* Archive Notification Bar */}
            {selectedPeriod < 2026 && (
                <div className="bg-amber-500 text-white px-6 py-2 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500 sticky top-16 z-20 shadow-lg">
                    <AlertTriangle className="h-4 w-4 animate-bounce" />
                    <span className="text-xs font-black uppercase tracking-[0.1em]">Visión de Auditoría: Estás en modo de Solo Lectura para el ciclo {selectedPeriod}</span>
                </div>
            )}
        </>
    );
}
