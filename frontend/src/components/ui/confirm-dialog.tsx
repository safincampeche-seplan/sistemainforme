"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Info, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    isPrompt?: boolean;
    promptPlaceholder?: string;
    onConfirm: (value?: string) => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "danger",
    isPrompt = false,
    promptPlaceholder = "Escriba aquí...",
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const [inputValue, setInputValue] = useState("");

    useEffect(() => {
        if (isOpen) {
            setInputValue("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const iconConfig = {
        danger: {
            icon: <Trash2 className="w-6 h-6 text-white" />,
            iconBg: "bg-red-500",
            confirmClass: "bg-guinda-700 hover:bg-guinda-800 text-white",
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6 text-white" />,
            iconBg: "bg-amber-500",
            confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
        },
        info: {
            icon: <Info className="w-6 h-6 text-white" />,
            iconBg: "bg-guinda-600",
            confirmClass: "bg-guinda-600 hover:bg-guinda-700 text-white",
        },
    }[variant];

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Dialog */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Top accent bar */}
                <div className={`h-1 w-full ${variant === "danger" ? "bg-guinda-700" : variant === "warning" ? "bg-amber-500" : "bg-guinda-600"}`} />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-5">
                        <div className={`shrink-0 w-12 h-12 rounded-full ${iconConfig.iconBg} flex items-center justify-center shadow-md`}>
                            {iconConfig.icon}
                        </div>
                        <div className="flex-1 pt-1">
                            <h3 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h3>
                            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{message}</p>
                        </div>
                        <button
                            onClick={onCancel}
                            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {isPrompt && (
                        <div className="mb-5 px-1">
                            <Input
                                autoFocus
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={promptPlaceholder}
                                className="w-full h-11 border-gray-300 focus-visible:ring-guinda-500 rounded-xl"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && inputValue.trim()) {
                                        onConfirm(inputValue);
                                    }
                                }}
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="outline"
                            onClick={onCancel}
                            className="px-5 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            onClick={() => onConfirm(isPrompt ? inputValue : undefined)}
                            disabled={isPrompt && !inputValue.trim()}
                            className={`px-5 rounded-lg font-medium shadow-sm ${iconConfig.confirmClass}`}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Hook helper ──────────────────────────────────────────────────────────────
// Permite disparar un confirm moderno sin manejar estado manual:
//   const { confirmEl, askConfirm } = useConfirmDialog();
//   await askConfirm({ title, message }) => returns true/false

export function useConfirmDialog() {
    const [dialogState, setDialogState] = React.useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        variant?: "danger" | "warning" | "info";
        isPrompt?: boolean;
        promptPlaceholder?: string;
        resolve?: (v: any) => void;
    }>({ isOpen: false, title: "", message: "" });

    const askConfirm = React.useCallback(
        (opts: { title: string; message: string; confirmLabel?: string; variant?: "danger" | "warning" | "info"; isPrompt?: boolean; promptPlaceholder?: string; }) =>
            new Promise<any>((resolve) => {
                setDialogState({ ...opts, isOpen: true, resolve });
            }),
        []
    );

    const handleConfirm = (val?: string) => {
        dialogState.resolve?.(dialogState.isPrompt ? val : true);
        setDialogState((s) => ({ ...s, isOpen: false }));
    };

    const handleCancel = () => {
        dialogState.resolve?.(dialogState.isPrompt ? null : false);
        setDialogState((s) => ({ ...s, isOpen: false }));
    };

    const confirmEl = (
        <ConfirmDialog
            isOpen={dialogState.isOpen}
            title={dialogState.title}
            message={dialogState.message}
            confirmLabel={dialogState.confirmLabel}
            variant={dialogState.variant}
            isPrompt={dialogState.isPrompt}
            promptPlaceholder={dialogState.promptPlaceholder}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );

    return { confirmEl, askConfirm };
}
