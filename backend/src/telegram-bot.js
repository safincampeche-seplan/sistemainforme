import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as path from 'path';
const STORAGE_PATH = path.join(__dirname, '../../data-backup.json');
function getData() {
    return JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8'));
}
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
let bot = null;
// ─────────────────── HELPER: Auth check ───────────────────
function isAuthorized(chatId) {
    return ALLOWED_CHAT_IDS.includes(String(chatId));
}
// ─────────────────── HELPER: Format date ───────────────────
function fmtDate(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
// ─────────────────── STATUS REPORT ───────────────────────
function buildStatusReport() {
    const d = getData();
    const activePeriod = (d.periods || []).find((p) => p.isActive);
    const openStages = activePeriod
        ? (activePeriod.stages || []).filter((s) => s.isOpen).map((s) => s.name).join(', ')
        : '—';
    const totalUsers = (d.users || []).length;
    const activeUsers = (d.users || []).filter((u) => u.status !== 'Suspendido').length;
    const narratives = (d.narratives || []).length;
    const pending = (d.narratives || []).filter((n) => ['submitted', 'pendiente', 'enviado'].includes((n.status || '').toLowerCase())).length;
    const totalLogs = (d.logs || []).length;
    return [
        `📊 *ESTADO DEL SISTEMA — ${new Date().toLocaleString('es-MX')}*`,
        ``,
        `📅 *Periodo Activo:* ${activePeriod ? activePeriod.name : 'Ninguno'}`,
        `🔓 *Etapas Abiertas:* ${openStages || 'Ninguna'}`,
        ``,
        `👥 *Usuarios:* ${activeUsers} activos / ${totalUsers} total`,
        `📝 *Narrativas:* ${narratives} total · ${pending} pendientes de validación`,
        `📋 *Eventos en bitácora:* ${totalLogs}`,
    ].join('\n');
}
// ─────────────────── PENDING REPORT ──────────────────────
function buildPendingReport() {
    const d = getData();
    const pending = (d.narratives || []).filter((n) => ['submitted', 'pendiente', 'enviado'].includes((n.status || '').toLowerCase()));
    if (pending.length === 0)
        return '✅ *No hay narrativas pendientes de validación.*';
    const lines = pending.slice(0, 15).map((n, i) => `${i + 1}. *${n.dependency || n.sector || 'Sin dep.'}* — ${n.title || 'Sin título'}`);
    return [
        `⏳ *NARRATIVAS PENDIENTES (${pending.length})*`,
        ``,
        ...lines,
        pending.length > 15 ? `\n_...y ${pending.length - 15} más_` : ''
    ].join('\n');
}
// ─────────────────── USERS REPORT ────────────────────────
function buildUsersReport() {
    const d = getData();
    const users = d.users || [];
    const active = users.filter((u) => u.status !== 'Suspendido').length;
    const suspended = users.filter((u) => u.status === 'Suspendido').length;
    const byRole = {};
    users.forEach((u) => {
        const role = (u.roles || ['Sin rol'])[0];
        byRole[role] = (byRole[role] || 0) + 1;
    });
    const roleLines = Object.entries(byRole)
        .sort((a, b) => b[1] - a[1])
        .map(([r, c]) => `  • ${r}: ${c}`).join('\n');
    return [
        `👥 *USUARIOS DEL SISTEMA*`,
        ``,
        `✅ Activos: *${active}*`,
        `🚫 Suspendidos: *${suspended}*`,
        `📊 Total: *${users.length}*`,
        ``,
        `*Por rol:*`,
        roleLines
    ].join('\n');
}
// ─────────────────── LOGS REPORT ─────────────────────────
function buildLogsReport() {
    const d = getData();
    const logs = [...(d.logs || [])]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8);
    if (logs.length === 0)
        return '📋 *No hay eventos registrados.*';
    const lines = logs.map((l) => {
        const emojiMap = { login: '🔑', logout: '🚪', create: '➕', update: '✏️', delete: '🗑️', export: '📤', user_admin: '🛡️' };
        const e = emojiMap[l.type || ''] || '📌';
        return `${e} *${l.action || 'Evento'}*\n   👤 ${l.user_name || 'Sistema'} · ${fmtDate(l.timestamp)}`;
    });
    return [`📋 *ÚLTIMOS 8 EVENTOS*`, ``, ...lines].join('\n');
}
// ─────────────────── DEPENDENCIES REPORT ─────────────────
function buildDepsReport() {
    const d = getData();
    const deps = d.dependencies || [];
    const narratives = d.narratives || [];
    const activePeriod = (d.periods || []).find((p) => p.isActive);
    const withNarrative = new Set(narratives
        .filter((n) => n.status && n.status !== 'draft')
        .map((n) => n.dependency_id || n.dependency));
    const missing = deps.filter((dep) => !withNarrative.has(dep.id) && !withNarrative.has(dep.name));
    if (missing.length === 0)
        return '✅ *Todas las dependencias han enviado su narrativa.*';
    const lines = missing.slice(0, 20).map((d, i) => `${i + 1}. ${d.name}${d.code ? ` _(${d.code})_` : ''}`);
    return [
        `🏛️ *DEPENDENCIAS SIN NARRATIVA (${missing.length})*`,
        activePeriod ? `Periodo: ${activePeriod.name}` : '',
        ``,
        ...lines,
        missing.length > 20 ? `_...y ${missing.length - 20} más_` : ''
    ].filter(Boolean).join('\n');
}
// ─────────────────── BOT INIT ────────────────────────────
export function initTelegramBot() {
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TOKEN) {
        console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado. Bot desactivado.');
        return null;
    }
    try {
        bot = new TelegramBot(TOKEN, { polling: true });
        console.log('🤖 Bot de Telegram iniciado correctamente.');
        const guard = (chatId, cb) => {
            if (!isAuthorized(chatId)) {
                bot.sendMessage(chatId, '🚫 No estás autorizado para usar este bot.');
                return;
            }
            cb();
        };
        // /start
        bot.onText(/\/start/, (msg) => {
            guard(msg.chat.id, () => {
                bot.sendMessage(msg.chat.id, `👋 *Bienvenido al Bot de SEPLAN Captura Informe V2*\n\n` +
                    `Comandos disponibles:\n` +
                    `/status — Estado general del sistema\n` +
                    `/pendientes — Narrativas en espera de validación\n` +
                    `/usuarios — Resumen de usuarios\n` +
                    `/dependencias — Dependencias sin narrativa\n` +
                    `/logs — Últimos 8 eventos del sistema\n` +
                    `/ayuda — Ver esta lista`, { parse_mode: 'Markdown' });
            });
        });
        // /ayuda
        bot.onText(/\/ayuda/, (msg) => {
            guard(msg.chat.id, () => {
                bot.sendMessage(msg.chat.id, `📋 *Comandos del Bot SEPLAN*\n\n` +
                    `🔹 /status — Estado del sistema y periodo activo\n` +
                    `🔹 /pendientes — Narrativas por validar\n` +
                    `🔹 /usuarios — Total y desglose por rol\n` +
                    `🔹 /dependencias — Dependencias sin captura\n` +
                    `🔹 /logs — Últimos eventos registrados`, { parse_mode: 'Markdown' });
            });
        });
        // /status
        bot.onText(/\/status/, (msg) => {
            guard(msg.chat.id, () => {
                bot.sendMessage(msg.chat.id, buildStatusReport(), { parse_mode: 'Markdown' });
            });
        });
        // /pendientes
        bot.onText(/\/pendientes/, (msg) => {
            guard(msg.chat.id, () => {
                bot.sendMessage(msg.chat.id, buildPendingReport(), { parse_mode: 'Markdown' });
            });
        });
        // /usuarios
        bot.onText(/\/usuarios/, (msg) => {
            guard(msg.chat.id, () => {
                bot.sendMessage(msg.chat.id, buildUsersReport(), { parse_mode: 'Markdown' });
            });
        });
        // /dependencias
        bot.onText(/\/dependencias/, (msg) => {
            guard(msg.chat.id, () => {
                bot.sendMessage(msg.chat.id, buildDepsReport(), { parse_mode: 'Markdown' });
            });
        });
        // /logs
        bot.onText(/\/logs/, (msg) => {
            guard(msg.chat.id, () => {
                bot.sendMessage(msg.chat.id, buildLogsReport(), { parse_mode: 'Markdown' });
            });
        });
        // Unknown commands
        bot.on('message', (msg) => {
            if (!msg.text?.startsWith('/'))
                return;
            const known = ['/start', '/ayuda', '/status', '/pendientes', '/usuarios', '/dependencias', '/logs'];
            if (!known.some(cmd => msg.text.startsWith(cmd))) {
                guard(msg.chat.id, () => {
                    bot.sendMessage(msg.chat.id, `❓ Comando no reconocido. Envía /ayuda para ver los disponibles.`);
                });
            }
        });
        bot.on('polling_error', (err) => {
            if (err.code !== 'ETELEGRAM')
                console.error('Bot polling error:', err.message);
        });
        return bot;
    }
    catch (err) {
        console.error('❌ Error iniciando bot de Telegram:', err.message);
        return null;
    }
}
// ─────────────────── PUBLIC NOTIFY ───────────────────────
// Call this to proactively send a message to all admin chats
export function notifyAdmins(message) {
    if (!bot)
        return;
    ALLOWED_CHAT_IDS.forEach(chatId => {
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' }).catch(() => { });
    });
}
//# sourceMappingURL=telegram-bot.js.map