"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Loader2, Sparkles, History, X, ChevronRight, CheckCircle2 } from "lucide-react";
import changelogData from "@/lib/changelog.json";

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showChangelog, setShowChangelog] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                login(data.token, data.user);
            } else {
                setError(data.error || "Acceso denegado");
            }
        } catch (err) {
            setError("Error de conexión con el servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 ease-out"
                style={{
                    backgroundImage: "url('/assets/images/login-bg.jpg')",
                    transform: "scale(1.02)"
                }}
            >
                <div className="absolute inset-0 bg-slate-950/40 backdrop-grayscale-[0.1]" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20" />
            </div>

            <div
                className="relative z-10 w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-400"
                style={{ animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
                <div className="text-center space-y-2">
                    <div className="inline-flex p-3 rounded-2xl bg-guinda-600 shadow-xl shadow-indigo-200 mb-6">
                        <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">SEPLAN V2</h1>
                    <p className="text-white/90 font-medium drop-shadow-sm">Entorno Superior de Gestión Pública</p>
                </div>

                <Card className="border-white/20 shadow-2xl bg-white/10 dark:bg-slate-900/40 backdrop-blur-2xl overflow-hidden border">
                    <CardHeader className="space-y-1 pb-2 text-center">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-tight">Bienvenido</CardTitle>
                        <CardDescription className="text-slate-200 font-medium">Ingresa tus credenciales oficiales para continuar</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4 pt-4">
                            {error && (
                                <div className="p-3 text-xs font-bold bg-red-50 text-red-600 rounded-lg border border-red-100 animate-in slide-in-from-top-2">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white font-bold text-xs uppercase tracking-widest">Correo Electrónico</Label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-white transition-colors" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="usuario@seplan.gob.mx"
                                        className="pl-10 h-12 bg-white/10 border-white/10 text-white placeholder:text-slate-400 focus-visible:ring-guinda-500 backdrop-blur-md"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-white font-bold text-xs uppercase tracking-widest">Contraseña</Label>
                                    <Button variant="link" className="px-0 font-bold text-guinda-300 hover:text-white text-[10px] h-auto py-0 uppercase tracking-tighter transition-colors">¿Olvidaste tu contraseña?</Button>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-white transition-colors" />
                                    <Input
                                        id="password"
                                        type="password"
                                        className="pl-10 h-12 bg-white/10 border-white/10 text-white focus-visible:ring-guinda-500 backdrop-blur-md"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-6 pb-8">
                            <Button
                                type="submit"
                                className="w-full h-12 bg-guinda-600 hover:bg-guinda-700 font-bold transition-all active:scale-95 shadow-lg shadow-indigo-100"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Iniciar Sesión"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <div className="flex flex-col items-center gap-4">
                    <p className="text-center text-[10px] text-white/60 font-black uppercase tracking-[0.3em] drop-shadow-md">
                        Poder Ejecutivo del Estado de Campeche
                    </p>
                    <button
                        onClick={() => setShowChangelog(true)}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 border border-slate-200 shadow-sm hover:border-guinda-200 hover:bg-white transition-all transition-transform active:scale-95"
                    >
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-guinda-600 transition-colors uppercase tracking-widest">v{changelogData.currentVersion}</span>
                        <div className="h-1 w-1 rounded-full bg-slate-300 group-hover:bg-guinda-400" />
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-guinda-600 transition-colors uppercase tracking-widest flex items-center gap-1">
                            Novedades <ChevronRight className="h-3 w-3" />
                        </span>
                    </button>
                </div>
            </div>

            {/* Changelog Modal */}
            <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-500 ${showChangelog ? 'opacity-100 backdrop-blur-xl' : 'opacity-0 backdrop-blur-0 pointer-events-none'}`}>
                <div className={`fixed inset-0 bg-slate-900/60 transition-opacity duration-500 ${showChangelog ? 'opacity-100' : 'opacity-0'}`} onClick={() => setShowChangelog(false)} />

                <div className={`bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden border border-slate-100 dark:border-slate-800 transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) transform ${showChangelog ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-12 opacity-0'}`}>
                    <div className="relative p-1">
                        <button
                            onClick={() => setShowChangelog(false)}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors z-10"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="p-8">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-12 w-12 rounded-2xl bg-guinda-50 dark:bg-guinda-900/20 text-guinda-600 flex items-center justify-center shadow-inner">
                                    <History className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Historial de Cambios</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{changelogData.project}</p>
                                </div>
                            </div>

                            <div className="space-y-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                {changelogData.history.map((release, idx) => (
                                    <div key={idx} className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 last:border-l-0 pb-2">
                                        <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-white dark:bg-slate-900 border-2 border-guinda-500 shadow-sm" />
                                        <div className="mb-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-guinda-600 text-white">v{release.version}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{release.date}</span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{release.title}</h4>
                                        </div>
                                        <ul className="space-y-2">
                                            {release.changes.map((change, cIdx) => (
                                                <li key={cIdx} className="flex gap-2 text-xs text-slate-500 font-medium leading-relaxed">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-guinda-400 flex-shrink-0 mt-0.5" />
                                                    {change}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={() => setShowChangelog(false)}
                                className="w-full mt-8 h-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-black"
                            >
                                Entendido
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
