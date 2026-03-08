"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { Button } from "./button";

type NotificationType = "success" | "error" | "info";

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: NotificationType;
}

export function NotificationModal({ isOpen, onClose, title, message, type = "success" }: NotificationModalProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    const config = {
        success: {
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-50/50",
            border: "border-emerald-100",
            btn: "bg-emerald-600 hover:bg-emerald-700"
        },
        error: {
            icon: AlertCircle,
            color: "text-red-500",
            bg: "bg-red-50/50",
            border: "border-red-100",
            btn: "bg-red-600 hover:bg-red-700"
        },
        info: {
            icon: Info,
            color: "text-guinda-500",
            bg: "bg-guinda-50/50",
            border: "border-guinda-100",
            btn: "bg-guinda-600 hover:bg-guinda-700"
        }
    };

    const style = config[type];
    const Icon = style.icon;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-500 ${isOpen ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div className={`fixed inset-0 bg-slate-900/40 transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`} />

            <div
                className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl w-full max-w-sm rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden border ${style.border} transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) transform ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-10 flex flex-col items-center text-center space-y-8 ${style.bg}`}>
                    <div className={`h-24 w-24 rounded-[2rem] ${style.bg} flex items-center justify-center border-8 border-white dark:border-slate-800 shadow-2xl transform transition-transform duration-1000 ${isOpen ? 'rotate-0 scale-100' : 'rotate-12 scale-75'}`}>
                        <Icon className={`h-12 w-12 ${style.color}`} />
                    </div>

                    <div className="space-y-3 px-4">
                        <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">{title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed tracking-tight">
                            {message}
                        </p>
                    </div>

                    <Button
                        onClick={onClose}
                        className={`w-full h-16 rounded-[1.5rem] text-xl font-black shadow-2xl transition-all active:scale-95 border-b-4 active:border-b-0 translate-y-0 active:translate-y-1 ${style.btn}`}
                    >
                        Entendido
                    </Button>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 p-2 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-400 transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
}
