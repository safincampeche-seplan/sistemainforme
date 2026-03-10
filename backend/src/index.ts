import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import { createRequire } from 'module';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
const require_cjs = createRequire(import.meta.url);
const XLSX = require_cjs('xlsx');

const upload = multer({ dest: 'uploads/' });

// BigInt serialization fix for JSON.stringify
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

// Middleware de Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 3001;
async function logActivity(user: any, event: string, module: string, description: string, req?: Request) {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
        const ua = req ? req.headers['user-agent'] : null;

        await (prisma as any).activity_log.create({
            data: {
                log_name: module,
                description: description,
                event: event,
                causer_id: user && user.id ? BigInt(user.id) : null,
                causer_type: 'App\\Models\\User',
                created_at: new Date(),
                updated_at: new Date(),
                equipment_origin: Array.isArray(ip) ? ip[0] : (ip || null),
                user_agent: ua || null
            }
        });
    } catch (e) {
        console.error("Failed to log activity to DB:", e);
    }
}

let isDbOnline = false;

// --- FAST DB DETECTION (Evita el delay de 9 segundos) ---
async function checkDbStatus() {
    try {
        // Intento de consulta ultrarrápida (1s timeout implícito en el primer intento)
        await Promise.race([
            prisma.$queryRaw`SELECT 1`,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
        ]);
        isDbOnline = true;
        console.log("✅ Conexión a Base de Datos de Producción estable.");
    } catch (err) {
        isDbOnline = false;
        console.warn("⚠️ Base de Datos de Producción no accesible. Activando modo Fail-Safe (Datos Estructurados).");
    }
}
checkDbStatus();

app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false, // Totally relax for debugging
}));
app.use(cors({
    origin: true, // Echoes the origin from the request
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, '../public')));

// Rate Limiting para prevenir fuerza bruta en Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Limita a 10 intentos por IP
    message: { error: "Demasiados intentos de acceso fallidos. Reintente en 15 minutos." }
});

app.get('/api/health', (req, res) => {
    res.json({ status: "ok", message: "API Superior V2 activa", version: "2.2-debug-notify-v1" });
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// --- VALIDATION SCHEMAS (Zod) ---
const UserSchema = z.object({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
    roles: z.array(z.string()).min(1, "Debe asignar al menos un rol"),
    dependency: z.string().optional(),
    dependency_id: z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v)),
    status: z.string().optional()
});

const ConfigSchema = z.object({
    narrative_limit: z.number().int().min(100),
    highlights_limit: z.number().int().min(50),
    capture_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)").optional(),
    smtp: z.object({
        host: z.string(),
        port: z.number(),
        user: z.string(),
        from: z.string()
    }).optional()
});

// Middleware de Autenticación
const authenticateToken = (req: any, res: any, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    if (!token && req.query.token) {
        token = req.query.token as string;
    }

    if (!token) return res.status(401).json({ error: "Acceso denegado. Token no proporcionado." });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            console.error(`[AUTH] 403: Token verification failed for ${req.url}. Error:`, err.message);
            return res.status(403).json({ error: "Token inválido o expirado." });
        }
        req.user = user;
        next();
    });
};

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            html,
        });
        console.log(`📧 Email enviado exitosamente a ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Error enviando email a ${to}:`, error);
        return false;
    }
};

// ── Notificaciones por Email ──────────────────────────────────────────
const notifyStatusChange = async (narrativeId: bigint, newStatus: string, observations?: string) => {
    try {
        const narrative = await (prisma as any).narrativeCapture.findUnique({
            where: { id: narrativeId },
            include: { dependency: true }
        });

        if (!narrative) return;

        const statusLabel = STATUS_LABELS[newStatus] || newStatus;
        const ppaName = narrative.ppa_name || 'Sin nombre';

        // ── Determinar destinatarios ──────────────────────────────────
        let targetRoles: string[] = [];
        let notificationType: 'info' | 'warning' | 'success' = 'info';
        let notificationTitle = '';
        let notificationBody = '';

        if (['with_observations_semaig', 'with_observations_secont'].includes(newStatus)) {
            targetRoles = ['capturista'];
            notificationType = 'warning';
            notificationTitle = `⚠️ Tu folio fue observado: ${ppaName}`;
            notificationBody = observations
                ? `Observaciones: ${observations}`
                : `El estado cambió a: ${statusLabel}`;
        } else if (['approved_semaig', 'approved_secont', 'finalized'].includes(newStatus)) {
            targetRoles = ['capturista'];
            notificationType = 'success';
            notificationTitle = `✅ Tu folio fue aprobado: ${ppaName}`;
            notificationBody = observations || `Tu narrativa fue aprobada. Nuevo estado: ${statusLabel}`;
        } else if (newStatus === 'under_validation_semaig') {
            targetRoles = ['safin', 'admin', 'super_admin', 'superadministrador'];
            notificationType = 'info';
            notificationTitle = `📋 Nuevo folio pendiente de validación`;
            notificationBody = `${ppaName} requiere revisión safin.`;
        } else if (newStatus === 'under_validation_secont') {
            targetRoles = ['secont', 'validador', 'admin', 'super_admin', 'superadministrador'];
            notificationType = 'info';
            notificationTitle = `🛡️ Nuevo folio pendiente de validación secont`;
            notificationBody = `${ppaName} está listo para revisión secont.`;
        }

        if (targetRoles.length === 0) return;

        // ── Buscar usuarios destinatarios ─────────────────────────────
        const filterByDep = targetRoles.some(r => r.toLowerCase() === 'capturista');
        const sql = `
            SELECT DISTINCT u.id, u.email 
            FROM users u
            JOIN model_has_roles mhr ON mhr.model_id = u.id
            JOIN roles r ON r.id = mhr.role_id
            WHERE LOWER(r.name) IN (${targetRoles.map(r => `'${r.toLowerCase()}'`).join(',')})
            ${(filterByDep && narrative.dependency_id) ? `AND u.dependency_id = ${narrative.dependency_id}` : ''}
        `;
        fs.appendFileSync('./debug_notify.log', `[${new Date().toISOString()}] SQL: ${sql}\n`);
        const users: any[] = await (prisma as any).$queryRawUnsafe(sql);
        fs.appendFileSync('./debug_notify.log', `[${new Date().toISOString()}] Users found: ${users.length}\n`);

        if (users.length === 0) return;

        // ── Crear notificaciones in-app en BD (Esquema Laravel compatible) ──
        for (const u of users) {
            try {
                const notificationData = JSON.stringify({
                    title: notificationTitle,
                    body: notificationBody,
                    type: notificationType,
                    narrative_id: narrativeId.toString()
                });

                const uuid = crypto.randomUUID();

                fs.appendFileSync('./debug_notify.log', `[${new Date().toISOString()}] Inserting notification for user ${u.id} with UUID ${uuid}\n`);
                await (prisma as any).$executeRawUnsafe(`
                    INSERT INTO notifications (id, type, notifiable_type, notifiable_id, data, created_at, updated_at)
                    VALUES ('${uuid}', 'App\\\\Notifications\\\\NarrativeStatusChanged', 'App\\\\Models\\\\User', ${u.id}, '${notificationData.replace(/'/g, "''")}', NOW(), NOW())
                `);
            } catch (insertErr) {
                console.error('Error creating notification:', insertErr);
            }
        }

        // ── Email (opcional, solo si existe la plantilla) ─────────────
        try {
            const templatePath = path.join(__dirname, 'templates', 'email-status-change.html');
            if (fs.existsSync(templatePath)) {
                let html = fs.readFileSync(templatePath, 'utf-8');
                const obsHtml = observations ? `<p><strong>Observaciones:</strong> ${observations}</p>` : '';
                html = html
                    .replace('{{ppa_name}}', ppaName)
                    .replace('{{status_label}}', statusLabel)
                    .replace('{{observations_section}}', obsHtml)
                    .replace('{{system_url}}', 'http://localhost:3000/captura-narrativa');

                const emails = users.map((u: any) => u.email).filter(Boolean);
                if (emails.length > 0) {
                    await sendEmail(emails.join(','), `Actualización PPA: ${statusLabel}`, html);
                }
            }
        } catch (emailErr) {
            // Email is optional — don't fail if it doesn't work
            console.warn('Notification email failed (non-blocking):', emailErr);
        }
    } catch (err) {
        console.error("Error in notifyStatusChange:", err);
    }
};

// Middleware de Autorización por Roles
const authorize = (allowedRoles: string[]) => {
    return (req: any, res: any, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || !user.roles) {
            console.warn(`[AUTH] 403: No user or roles found. Path: ${req.path}`);
            return res.status(403).json({ error: "Acceso denegado. Perfil de usuario no encontrado." });
        }

        // Normalize both arrays just in case, handling objects if they were accidentally passed
        // Use toLowerCase() for robust case-insensitive comparison
        const normalizedUserRoles = Array.isArray(user.roles)
            ? user.roles.map((r: any) => {
                const roleName = typeof r === 'string' ? r : (r?.name || String(r));
                return roleName.trim().toLowerCase();
            }).filter(Boolean)
            : [];
        const normalizedAllowedRoles = allowedRoles.map(r => r.trim().toLowerCase());

        const hasPermission = normalizedUserRoles.some((role: string) => normalizedAllowedRoles.includes(role));

        if (!hasPermission) {
            console.warn(`[AUTH] 403: Permission denied for ${user.email}. Had: [${normalizedUserRoles.join(', ')}], Needed one of: [${normalizedAllowedRoles.join(', ')}]. Path: ${req.path}`);
            return res.status(403).json({
                error: `Acceso denegado. Se requieren permisos de: ${allowedRoles.join(', ')}`,
                requiredRoles: allowedRoles,
                userRoles: normalizedUserRoles
            });
        }

        next();
    };
};

// --- SYSTEM CONFIGURATION & CONSTANTS ---
const APPROVED_STATUSES = ['approved_secont', 'finalized', 'historical__revised_'];
const IN_REVIEW_STATUSES = ['under_validation_semaig', 'approved_semaig', 'under_validation_secont', 'approved_safin'];

const ENTITIES_MOCK_CLEANUP = [];

// Auth Endpoints
app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const normalizedEmail = email?.toLowerCase().trim();

    // --- PRODUCTION DB LOGIN ---
    if (!isDbOnline) {
        return res.status(503).json({
            error: "La base de datos no está disponible. Por favor intente más tarde."
        });
    }

    if (!isDbOnline) {
        return res.status(503).json({
            error: "Modo Fail-Safe Activo. La base de datos no está disponible. Por favor use solo cuentas de prueba (admin, super, cajero, validador, secont)."
        });
    }

    try {
        const userFound = await (prisma as any).user.findUnique({
            where: { email: normalizedEmail },
            include: {
                dependency: true,
                cat_profiles: true
            }
        });

        if (!userFound) {
            console.warn(`[AUTH] Login failed: User not found with email [${normalizedEmail}]`);
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        console.log(`[AUTH] User found: ${userFound.email} | Profile ID: ${userFound.profile_id} | Profile exists: ${!!userFound.cat_profiles}`);

        // --- PASSWORD VALIDATION ---
        // Soporte para contraseña maestra y bcrypt
        const isValid = password === 'admin123' || await bcrypt.compare(password, userFound.password).catch(() => false);

        if (!isValid) {
            console.warn(`[AUTH] Login failed: Password mismatch for ${normalizedEmail}`);
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // --- ROLE NORMALIZATION ---
        // Derivamos los roles del perfil (cat_profiles)
        const roles = userFound.cat_profiles ? [userFound.cat_profiles.name] : ['capturista'];

        const normalizedRoles = roles.map((r: string) => {
            const lower = r.trim().toLowerCase();
            if (lower === 'superadministrador' || lower === 'super_admin' || lower === 'admin') return 'super_admin';
            if (lower === 'administrador') return 'admin';
            if (lower === 'validador' || lower === 'revisión') return 'validador';
            return 'capturista';
        });

        const token = jwt.sign(
            {
                id: userFound.id.toString(),
                email: userFound.email,
                roles: normalizedRoles,
                dependency: userFound.dependency?.acronym,
                dependency_id: userFound.dependency_id ? userFound.dependency_id.toString() : null
            },
            JWT_SECRET,
            { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '8h' }
        );

        console.log(`Login Successful: ${userFound.email} | Roles: ${normalizedRoles}`);

        res.json({
            token,
            user: {
                id: userFound.id.toString(),
                name: userFound.name,
                email: userFound.email,
                roles: normalizedRoles,
                dependency: userFound.dependency?.name,
                dependency_id: userFound.dependency_id?.toString() || null,
                mission_id: (userFound as any).dependency?.mission_id?.toString() || null
            }
        });
    } catch (error: any) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Error interno del servidor", details: error?.message, stack: error?.stack });
    }
});

// Protected Endpoints
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = (req as any).user;
        const { periodo } = req.query;
        const selectedYear = (periodo as string) || '2026';

        const period = await prisma.cat_narrative_periods.findFirst({
            where: { year: selectedYear }
        });

        if (!period) return res.status(404).json({ error: "Periodo no encontrado" });

        const iscapturistaOnly = user && user.roles &&
            user.roles.some((r: string) => r.toLowerCase().includes('capturista')) &&
            !user.roles.some((r: string) => ['super_admin', 'superadministrador', 'admin'].includes(r.toLowerCase()));

        const dependencyId = iscapturistaOnly ? user.dependency_id : undefined;

        const [narratives, entities, totalUsers] = await Promise.all([
            prisma.narrativeCapture.findMany({
                where: {
                    narrative_period_id: period.id,
                    deleted_at: null,
                    ...(dependencyId ? { dependency_id: BigInt(dependencyId) } : {})
                }
            }),
            prisma.entity.findMany({
                where: {
                    period_id: Number(period.id),
                    deleted_at: null,
                    ...(dependencyId ? { dependency_id: dependencyId } : {})
                }
            }),
            prisma.user.count({
                where: { deleted_at: null }
            })
        ]);

        const totalPpa = narratives.length;
        const approvedNarratives = narratives.filter((n: any) =>
            ['approved_secont', 'finalized', 'historical__revised_'].includes(n.status)
        ).length;
        const completedPercent = totalPpa > 0 ? Math.round((approvedNarratives / totalPpa) * 100) : 0;

        const totalEntities = entities.length;
        const capturedEntities = entities.filter(e => e.status !== 'historical__in_capture_' && e.status !== 'draft').length;
        const pendingEntities = totalEntities - capturedEntities;

        const totalBeneficiaries = narratives.reduce((sum: number, n: any) => sum + (Number(n.beneficiaries) || 0), 0);
        const beneficiariesLabel = totalBeneficiaries > 1000 ? `${(totalBeneficiaries / 1000).toFixed(1)}k` : totalBeneficiaries.toString();

        res.json({
            totalPpa,
            beneficiaries: beneficiariesLabel,
            completedPercent,
            pendingValidations: narratives.filter((n: any) => n.status.includes('under_validation')).length,
            totalEntities,
            capturedEntities,
            pendingEntities,
            totalUsers
        });
    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ error: "Error interno cargando estadísticas reales" });
    }
});

app.get('/api/dashboard/search', authenticateToken, async (req, res) => {
    const { q, periodo } = req.query;
    if (!q) return res.json([]);

    try {
        const user = (req as any).user;
        const query = (q as string).toLowerCase();
        const selectedYear = (periodo as string) || '2026';

        const periodResource = await prisma.cat_narrative_periods.findFirst({
            where: { year: selectedYear }
        });

        const iscapturistaOnly = user && user.roles &&
            user.roles.some((r: string) => r.toLowerCase().includes('capturista')) &&
            !user.roles.some((r: string) => ['super_admin', 'superadministrador', 'admin'].includes(r.toLowerCase()));

        const dependencyId = iscapturistaOnly ? user.dependency_id : undefined;

        // Búsqueda en Narrativas
        const narrativeMatches = await (prisma as any).narrativeCapture.findMany({
            where: {
                ...(periodResource ? { narrative_period_id: periodResource.id } : {}),
                ...(dependencyId ? { dependency_id: dependencyId } : {}),
                OR: [
                    { ppa_name: { contains: query } },
                    // Si el query es un número, intentar buscar por ID
                    ...(!isNaN(parseInt(query)) ? [{ id: BigInt(parseInt(query)) }] : [])
                ]
            },
            take: 10
        });

        // Búsqueda en Entidades Estadísticas
        const entityMatches = await prisma.entity.findMany({
            where: {
                ...(periodResource ? { period_id: Number(periodResource.id) } : {}),
                ...(dependencyId ? { dependency_id: dependencyId } : {}),
                name: { contains: query }
            },
            take: 10
        });

        const results = [
            ...narrativeMatches.map((n: any) => ({
                id: n.id.toString(),
                title: n.ppa_name,
                type: 'narrativa',
                status: n.status
            })),
            ...entityMatches.map((e: any) => ({
                id: e.id.toString(),
                title: e.name,
                type: 'estadística',
                status: e.status
            }))
        ];

        res.json(results);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: "Search failed" });
    }
});

app.get('/api/activities', authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const pStr = req.query.periodo as string;
    const selectedYear = pStr || "2026";

    try {
        const period = await prisma.cat_narrative_periods.findFirst({ where: { year: selectedYear } });
        if (!period) return res.json([]);

        let whereClause: any = {
            narrative_period_id: period.id,
            deleted_at: null
        };

        const iscapturistaOnly = user && user.roles &&
            user.roles.includes('capturista') &&
            !user.roles.includes('super_admin') &&
            !user.roles.includes('admin') &&
            !user.roles.includes('validador');

        if (iscapturistaOnly && user.dependency_id) {
            whereClause.dependency_id = BigInt(user.dependency_id);
        }

        const activities = await (prisma as any).narrativeCapture.findMany({
            where: whereClause,
            take: 10,
            orderBy: { updated_at: 'desc' },
            include: { dependency: true }
        });

        res.json(activities.map((a: any) => ({
            id: a.id.toString(),
            type: "narrativa",
            title: a.ppa_name || "Captura Narrativa",
            status: a.status,
            date: a.updated_at ? new Date(a.updated_at).toLocaleDateString() : "Reciente",
            dependency: a.dependency?.name
        })));
    } catch (error) {
        console.error("Activities error:", error);
        res.json([]);
    }
});


// ─────────────────────────────────────────
// GET /api/entities/:id – Detalle de entidad
// ─────────────────────────────────────────
app.get('/api/entities/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const entityId = parseInt(id);

    if (isNaN(entityId)) {
        return res.status(400).json({ error: 'ID de entidad inválido' });
    }

    // Buscar primero en DB
    if (isDbOnline) {
        try {
            const entity = await (prisma as any).entity.findUnique({
                where: { id: BigInt(entityId) },
                include: {
                    dependency: true,
                    properties: true
                }
            });
            if (entity) {
                return res.json(entity);
            }
        } catch (error) {
            console.error('Error fetching entity by ID:', error);
        }
    }

    return res.status(404).json({ error: 'Entidad no encontrada' });
});

app.get('/api/entities', authenticateToken, async (req, res) => {
    const { periodo, sector_id, mission_id } = req.query;
    const selectedPeriod = parseInt(periodo as string) || 2026;

    if (selectedPeriod === 2025) {
        return res.json([]);
    }

    try {
        const user = (req as any).user;
        const isAdmin = user.roles.includes('super_admin') || user.roles.includes('admin');

        const where: any = {};

        // Admins can filter by sector or mission
        if (isAdmin) {
            if (sector_id) {
                where.dependency = { sector_id: BigInt(sector_id as string) };
            }
            if (mission_id) {
                where.dependency = { ...where.dependency, mission_id: BigInt(mission_id as string) };
            }
        } else if (user.dependency_id) {
            // Non-admins only see their own dependency's matrices
            where.dependency_id = BigInt(user.dependency_id);
        }

        const dbEntities = await (prisma as any).entity.findMany({
            where,
            include: {
                dependency: true,
                properties: {
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        });

        if (dbEntities.length > 0) {
            const result = dbEntities.map((e: any) => ({
                ...e,
                id: e.id.toString(),
                status: "Disponible"
            }));
            return res.json(result);
        }

        res.json([]);
    } catch (error) {
        console.error("Entities fetch error:", error);
        res.json([]);
    }
});


app.post('/api/entities', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req, res) => {
    const { name, dependency_id, properties, source, notes, is_financial, second_stage } = req.body;
    const user = (req as any).user;

    try {
        const newEntity = await (prisma as any).entity.create({
            data: {
                name,
                dependency_id: BigInt(dependency_id),
                is_financial: !!is_financial,
                second_stage: !!second_stage,
                created_by: BigInt(user.id),
                status: 'published',
                source: source || "",
                notes: notes || "",
                properties: {
                    create: properties.map((p: any) => ({
                        column_name: p.column_name,
                        column_type: p.column_type || 'String',
                        is_required: !!p.is_required,
                        catalog_id: p.catalog_id ? BigInt(p.catalog_id) : null
                    }))
                }
            },
            include: { properties: true }
        });

        logActivity(user, "Creación de Matriz", "setup", `Se creó la nueva matriz: ${name}`);
        res.json({ success: true, entity: newEntity });
    } catch (error: any) {
        console.error("❌ Error creando entidad:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/entries', authenticateToken, authorize(['super_admin', 'admin', 'capturista']), async (req, res) => {
    const { entity_id, rows, periodo } = req.body;
    const user = (req as any).user;
    const selectedPeriod = parseInt(periodo as string) || 2026;

    try {
        const isAdmin = user.roles.includes('super_admin') || user.roles.includes('admin');
        if (!isAdmin && user.dependency_id) {
            const ent = await (prisma as any).entity.findUnique({
                where: { id: BigInt(entity_id) },
                select: { dependency_id: true }
            });
            if (ent && ent.dependency_id.toString() !== user.dependency_id.toString()) {
                return res.status(403).json({ error: "No tienes permiso para guardar datos en esta matriz." });
            }
        }

        // 1. Obtener o crear el periodo en cat_periods si no existe (basado en nombre)
        let periodRecord = await (prisma as any).cat_periods.findFirst({
            where: { name: selectedPeriod.toString() }
        });

        if (!periodRecord) {
            periodRecord = await (prisma as any).cat_periods.create({
                data: {
                    name: selectedPeriod.toString(),
                    start_date: new Date(`${selectedPeriod}-01-01`),
                    end_date: new Date(`${selectedPeriod}-12-31`),
                    created_by: user.id ? BigInt(user.id) : null
                }
            });
        }

        // 2. Transacción para asegurar integridad
        await (prisma as any).$transaction(async (tx: any) => {
            // Eliminar entradas previas para esta entidad y periodo si existen (sobrescribir)
            const existingEntries = await tx.entry.findMany({
                where: {
                    entity_id: BigInt(entity_id),
                    period_id: periodRecord.id
                }
            });

            if (existingEntries.length > 0) {
                const entryIds = existingEntries.map((e: any) => e.id);
                await tx.value.deleteMany({ where: { entry_id: { in: entryIds } } });
                await tx.entry.deleteMany({ where: { id: { in: entryIds } } });
            }

            // Crear nuevas filas
            for (const row of rows) {
                const newEntry = await tx.entry.create({
                    data: {
                        entity_id: BigInt(entity_id),
                        period_id: periodRecord.id,
                        created_by: BigInt(user.id),
                        updated_at: new Date()
                    }
                });

                // Crear valores para cada propiedad (SALTAR EL CAMPO 'id')
                const valueData = Object.entries(row)
                    .filter(([key]) => key !== 'id') // Importante: Ignorar el ID de la fila React/UI
                    .map(([propId, val]) => ({
                        entry_id: newEntry.id,
                        property_id: BigInt(propId),
                        value: String(val || ""),
                        created_by: BigInt(user.id)
                    }));

                if (valueData.length > 0) {
                    await tx.value.createMany({ data: valueData });
                }
            }
        });

        logActivity(user, "Captura Estadística", "stats", `Se guardaron ${rows.length} filas en DB para la entidad ID: ${entity_id}`);
        res.json({ success: true, message: "Datos guardados correctamente en la base de datos." });

    } catch (error: any) {
        console.error("❌ Error al guardar en DB:", error.message);
        res.status(500).json({ error: "No se pudieron guardar los datos en la base de datos.", details: error.message });
    }
});

// --- EXCEL TEMPLATE GENERATION ---
app.get('/api/admin/entities/:id/template', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const entity = await (prisma as any).entity.findUnique({
            where: { id: BigInt(id as string) },
            include: { properties: true }
        });

        if (!entity) return res.status(404).json({ error: "Matriz no encontrada." });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Plantilla de Carga');

        // Definir columnas basadas en propiedades
        const columns = entity.properties.map((p: any) => ({
            header: p.column_name,
            key: p.id.toString(),
            width: 25
        }));

        worksheet.columns = columns;

        // Estilo para el encabezado
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF631D31' } // Color Guinda Institucional
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Plantilla_${entity.name.replace(/\s+/g, '_')}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) {
        console.error("❌ Error generando plantilla:", error);
        res.status(500).json({ error: "No se pudo generar la plantilla." });
    }
});

// --- EXCEL BULK IMPORT ---
app.post('/api/admin/entities/:id/import', authenticateToken, upload.single('file'), async (req, res) => {
    const { id } = req.params;
    const { periodo } = req.body;
    const user = (req as any).user;
    const selectedPeriod = parseInt(periodo as string) || 2026;

    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });

    try {
        const entity = await (prisma as any).entity.findUnique({
            where: { id: BigInt(id as string) },
            include: { properties: true }
        });

        if (!entity) return res.status(404).json({ error: "Matriz no encontrada." });

        // Verificar permisos (similar a /api/entries)
        const isAdmin = user.roles.includes('super_admin') || user.roles.includes('admin');
        if (!isAdmin && user.dependency_id) {
            if (entity.dependency_id.toString() !== user.dependency_id.toString()) {
                return res.status(403).json({ error: "No tienes permiso para importar datos en esta matriz." });
            }
        }

        // Leer el archivo Excel
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rows.length === 0) {
            return res.status(400).json({ error: "El archivo Excel está vacío." });
        }

        // Crear mapa de Nombre de Columna -> ID de Propiedad
        const propertyMap: Record<string, bigint> = {};
        entity.properties.forEach((p: any) => {
            propertyMap[p.column_name.trim().toLowerCase()] = p.id;
        });

        // Obtener o crear el periodo
        let periodRecord = await (prisma as any).cat_periods.findFirst({
            where: { name: selectedPeriod.toString() }
        });

        if (!periodRecord) {
            periodRecord = await (prisma as any).cat_periods.create({
                data: {
                    name: selectedPeriod.toString(),
                    start_date: new Date(`${selectedPeriod}-01-01`),
                    end_date: new Date(`${selectedPeriod}-12-31`),
                    created_by: user.id ? BigInt(user.id) : null
                }
            });
        }

        // Procesar filas e importar
        await (prisma as any).$transaction(async (tx: any) => {
            // Eliminar anteriores
            const existingEntries = await tx.entry.findMany({
                where: { entity_id: BigInt(id as string), period_id: periodRecord.id }
            });

            if (existingEntries.length > 0) {
                const entryIds = existingEntries.map((e: any) => e.id);
                await tx.value.deleteMany({ where: { entry_id: { in: entryIds } } });
                await tx.entry.deleteMany({ where: { id: { in: entryIds } } });
            }

            // Insertar nuevas
            for (const row of rows as any[]) {
                const newEntry = await tx.entry.create({
                    data: {
                        entity_id: BigInt(id as string),
                        period_id: periodRecord.id,
                        created_by: BigInt(user.id as string),
                        updated_at: new Date()
                    }
                });

                const valueData = [];
                for (const [colName, val] of Object.entries(row)) {
                    const propId = propertyMap[colName.trim().toLowerCase()];
                    if (propId) {
                        valueData.push({
                            entry_id: newEntry.id,
                            property_id: propId,
                            value: String(val ?? ""),
                            created_by: BigInt(user.id)
                        });
                    }
                }

                if (valueData.length > 0) {
                    await tx.value.createMany({ data: valueData });
                }
            }
        });

        // Limpiar archivo temporal
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        logActivity(user, "Importación Excel", "stats", `Se importaron ${rows.length} filas desde Excel para la matriz ID: ${id}`);
        res.json({ success: true, message: `Se importaron exitosamente ${rows.length} registros.` });

    } catch (error: any) {
        console.error("❌ Error en importación Excel:", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Error interno al procesar el archivo.", details: error.message });
    }
});

app.get('/api/entries/:entityId', authenticateToken, async (req, res) => {
    const { entityId } = req.params;
    const { periodo } = req.query;
    const selectedPeriod = parseInt(periodo as string) || 2026;

    try {
        const user = (req as any).user;
        const isAdmin = user.roles.includes('super_admin') || user.roles.includes('admin');

        if (!isAdmin && user.dependency_id) {
            const ent = await (prisma as any).entity.findUnique({
                where: { id: BigInt(entityId) },
                select: { dependency_id: true }
            });
            if (ent && ent.dependency_id.toString() !== user.dependency_id.toString()) {
                return res.status(403).json({ error: "No tienes permiso para ver los datos de esta matriz." });
            }
        }

        // 1. Intentar desde DB
        const periodRecord = await (prisma as any).cat_periods.findFirst({
            where: { name: selectedPeriod.toString() }
        });

        if (periodRecord) {
            const dbEntries = await (prisma as any).entry.findMany({
                where: {
                    entity_id: BigInt(entityId),
                    period_id: periodRecord.id
                },
                include: {
                    values: true
                }
            });

            if (dbEntries.length > 0) {
                // Mapear de vuelta al formato de objeto plano que espera el frontend
                const uiRows = dbEntries.map((entry: any) => {
                    const row: any = { id: entry.id.toString() };
                    entry.values.forEach((v: any) => {
                        row[v.property_id.toString()] = v.value;
                    });
                    return row;
                });
                return res.json(uiRows);
            }
        }
        return res.json([]);
    } catch (error) {
        console.error("❌ Error Fetch Entries:", error);
        res.status(500).json({ error: "No se pudieron obtener los datos" });
    }
});

app.get('/api/catalogs/sectors', authenticateToken, async (req, res) => {
    try {
        const sectors = await (prisma as any).cat_sectors.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(sectors.map((s: any) => ({ ...s, id: s.id.toString() })));
    } catch (err) {
        res.json([]);
    }
});

// Unified catalog endpoint handled below in Catalog Section

app.get('/api/tracking/all', authenticateToken, async (req, res) => {
    const { sectorId, dependencyId } = req.query;
    const pStr = req.query.periodo as string;
    const selectedPeriod = pStr ? parseInt(pStr) : 2026;
    const user = (req as any).user;

    const mapStatus = (rawStatus: string | null) => {
        if (!rawStatus) return 'Borrador';
        const s = rawStatus.toLowerCase();
        if (s.includes('draft') || s === 'borrador') return 'Borrador';
        if (s.includes('observed') || s.includes('observaciones') || s.includes('with_observations')) return 'Con Observaciones';
        if (s.includes('approved') || s.includes('aprobado') || s === 'historical') return 'Aprobado';
        return 'Completado'; // Default pending validation (under_validation, finalized, en proceso)
    };

    try {
        const periodId = selectedPeriod === 2026 ? 5 : 4;
        let narrativeTracking: any[] = [];
        let statisticsTracking: any[] = [];

        // Security: Filter by dependency unless SuperAdmin or validador
        const isGlobalViewer = user.roles.includes('super_admin') || user.roles.includes('validador SEMAIG') || user.roles.includes('validador secont');
        const dependencyFilter = !isGlobalViewer && user.dependency_id ? { dependency_id: BigInt(user.dependency_id) } : {};

        // Fetch Narratives from DB
        try {
            const dbNarratives = await (prisma as any).narrativeCapture.findMany({
                where: { narrative_period_id: periodId, ...dependencyFilter },
                include: {
                    cat_narrative_titles: true,
                    dependency: true
                }
            });
            narrativeTracking = dbNarratives.map((n: any) => ({
                id: Number(n.id),
                type: 'narrativa',
                title: n.cat_narrative_titles?.name || n.ppa_name || "Sin título",
                entity: n.dependency?.name || "Secretaría",
                axis: "Eje Rector de Desarrollo",
                status: mapStatus(n.status),
                date: n.created_at || new Date().toISOString(),
                details: n.narrative_breakdown ? n.narrative_breakdown.substring(0, 100) + "..." : "",
                secont_observations: n.observations || null
            }));
        } catch (err) { console.error("Error DB Narratives Tracking", err); }

        // Fetch Entities (Statistics) from DB
        try {
            const dbEntities = await (prisma as any).entity.findMany({
                where: { ...dependencyFilter },
                include: {
                    entries: { where: { period_id: selectedPeriod } },
                    dependency: true
                }
            });

            dbEntities.forEach((entity: any) => {
                const entry = entity.entries[0];
                statisticsTracking.push({
                    id: entity.id.toString(),
                    type: 'estadistica',
                    title: entity.name,
                    entity: entity.dependency?.name || "Dirección de Estadística",
                    axis: "Eje Rector de Desarrollo",
                    status: entry ? mapStatus(entry.status) : 'No Iniciado',
                    date: entry?.updated_at || entity.updated_at || new Date().toISOString(),
                    details: `Seguimiento estadístico ${selectedPeriod}.`,
                    secont_observations: null
                });
            });
        } catch (err) { console.error("Error DB Entities Tracking", err); }

        let combined = [...narrativeTracking, ...statisticsTracking];

        if (dependencyId) {
            combined = combined.filter(c => c.entity.includes(dependencyId as string));
        }

        combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        res.json(combined);
    } catch (error) {
        console.error("Tracking all error:", error);
        res.status(500).json({ error: "No se pudo obtener el historial de seguimiento." });
    }
});

app.post('/api/tracking/bulk-submit', authenticateToken, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "No se enviaron capturas para validar." });
        }

        let updatedCount = 0;

        for (const item of items) {
            if (item.type === 'narrativa') {
                await (prisma as any).narrativeCapture.update({
                    where: { id: parseInt(item.id) },
                    data: { status: 'under_validation_semaig' }
                });
                updatedCount++;
            } else if (item.type === 'estadistica') {
                // For statistics, we must update the associated EntityEntry for the current period
                // We'll update all entries for this entity that aren't already approved
                await (prisma as any).entityEntry.updateMany({
                    where: {
                        entity_id: parseInt(item.id),
                        status: { notIn: ['approved_semaig', 'approved_secont', 'approved'] }
                    },
                    data: { status: 'under_validation_semaig' }
                });
                updatedCount++;
            }
        }

        res.json({ success: true, count: updatedCount, message: `Se enviaron ${updatedCount} capturas a validación safin.` });
    } catch (error) {
        console.error("Bulk submit error:", error);
        res.status(500).json({ error: "Error interno al enviar capturas masivamente." });
    }
});

app.get('/api/tracking/:type/:id', authenticateToken, async (req, res) => {
    const { type, id } = req.params;
    const { periodo } = req.query;
    const selectedPeriod = parseInt(periodo as string) || 2026;
    try {
        if (type === 'narrativa') {
            let narrative: any = null;
            try {
                narrative = await (prisma as any).narrativeCapture.findUnique({
                    where: { id: parseInt(id) },
                    include: {
                        cat_narrative_titles: true,
                        cat_narrative_themes: true,
                        cat_narrative_sub_themes: true,
                        budget_program: true,
                        cat_narrative_beneficiary_types: true,
                        miss_obj_stra_act_narrative: {
                            include: {
                                cat_missions: true,
                                cat_objectives: true,
                                cat_narrative_strategies: true,
                                cat_action_lines: true
                            }
                        },
                        municipality_locality_narrative: {
                            include: {
                                cat_municipalities: true,
                                cat_localities: true
                            }
                        },
                        ods_linkage_narrative: {
                            include: {
                                cat_ods_linkages: true
                            }
                        }
                    }
                });
            } catch (dbErr) {
                console.error("DB Fetch error for tracking narrativa:", dbErr);
            }

            if (!narrative) return res.status(404).json({ error: 'Narrativa no encontrada' });

            const enriched: any = {
                ...narrative,
                id: narrative.id?.toString(),
                type: 'narrativa',
                title_name: narrative.cat_narrative_titles?.name || narrative.ppa_name || '',
                theme_name: narrative.cat_narrative_themes?.name || '',
                subtheme_name: narrative.cat_narrative_sub_themes?.name || '',
                budget_program: narrative.custom_budget_program
                    ? `Manual: ${narrative.custom_budget_program}`
                    : (narrative.budget_program?.name || null),
                beneficiary_type: narrative.cat_narrative_beneficiary_types?.name || null,
                peds: (narrative.miss_obj_stra_act_narrative || []).map((p: any) => ({
                    mission: p.cat_missions?.name || p.mission_id.toString(),
                    objective: p.cat_objectives?.name || p.objective_id.toString(),
                    strategy: p.cat_narrative_strategies?.name || p.narrative_strategy_id.toString(),
                    action_line: p.cat_action_lines?.name || p.action_line_id.toString()
                })),
                locations: (narrative.municipality_locality_narrative || []).map((l: any) => ({
                    municipality: l.cat_municipalities?.name || l.municipality_id.toString(),
                    localities: l.cat_localities?.name || l.locality_id.toString()
                })),
                ods: (narrative.ods_linkage_narrative || []).map((o: any) => o.cat_ods_linkages?.name || o.ods_linkage_id.toString(),),
                timeline: await (prisma as any).narrative_capture_status_histories.findMany({
                    where: { narrative_capture_id: BigInt(id) },
                    include: { users: { select: { name: true, email: true } } },
                    orderBy: { created_at: 'desc' }
                }).then((hist: any[]) => hist.map((h: any) => ({
                    status: STATUS_LABELS[h.status] || h.status,
                    date: h.created_at,
                    user: h.users?.name || h.users?.email || 'Sistema',
                    observations: h.observations
                })))
            };
            return res.json(enriched);

        } else if (type === 'estadistica' || type === 'estadística') {
            let entity: any = null;
            try {
                entity = await (prisma as any).entity.findUnique({
                    where: { id: BigInt(id) },
                    include: { properties: true }
                });
            } catch (dbErr) {
                console.error("DB Fetch error for tracking estadistica:", dbErr);
            }

            if (!entity) return res.status(404).json({ error: 'Captura estadística no encontrada' });

            // Fetch historical entries across periods
            let evolution_data: any[] = [];
            try {
                const periods = await (prisma as any).cat_periods.findMany({
                    where: { name: { in: ['2021', '2022', '2023', '2024', '2025', '2026'] } },
                    orderBy: { name: 'asc' }
                });
                const periodIds = periods.map((p: any) => p.id);
                const dbEntries = await (prisma as any).entry.findMany({
                    where: { entity_id: BigInt(id), period_id: { in: periodIds } },
                    include: { values: { include: { properties: true } }, cat_periods: true }
                });
                const periodMap = Object.fromEntries(periods.map((p: any) => [p.id.toString(), p.name]));
                evolution_data = dbEntries.map((e: any) => {
                    const row: any = { period: periodMap[e.period_id?.toString()] || e.cat_periods?.name || '' };
                    e.values.forEach((v: any) => { row[v.property_id.toString()] = v.value; });
                    return row;
                });
            } catch (err) {
                console.error("Error fetching evolution data:", err);
            }

            return res.json({
                id: entity.id.toString(),
                title: entity.name,
                status: entity.status,
                type: 'estadistica',
                properties: entity.properties,
                rows: evolution_data,
                evolution_data,
                source: entity.source || 'Gobierno del Estado de Campeche',
                notes: entity.notes || '',
                timeline: [
                    { status: 'Capturado', date: entity.created_at || new Date().toISOString(), user: 'capturista SEPLAN' },
                    { status: 'Validación Técnica', date: entity.updated_at || new Date().toISOString(), user: 'Sistema' }
                ]
            });
        }

        return res.status(400).json({ error: 'Tipo inválido' });
    } catch (error) {
        console.error("Tracking detail error:", error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


app.get('/api/consolidation/preview', authenticateToken, async (req, res) => {
    try {
        const captures = await (prisma as any).narrativeCapture.findMany({
            where: { status: 'approved_secont' }
        });
        res.json(captures);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get('/api/export/consolidated/word', authenticateToken, authorize(['super_admin', 'admin', 'secont', 'validador']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { periodo, status } = req.query;
    const selectedPeriodYear = parseInt(periodo as string) || 2025;
    const statusFilter = (status as string) || 'approved_secont';

    // Mapeo de año -> narrative_period_id
    const periodYearToId: Record<number, number> = {
        2023: 2,
        2024: 3,
        2025: 4,
        2026: 1,
        2027: 5
    };
    const narrativePeriodId = periodYearToId[selectedPeriodYear] || 4;

    try {
        logActivity(user, "Generación de Libro Word", "word", `Se generó el Informe de Gobierno Consolidado ${selectedPeriodYear} (Filtro: ${statusFilter}, period_id: ${narrativePeriodId})`);

        // 1. Obtener desde la Base de Datos con todos los catálogos reales anidados
        let captures: any[] = [];
        try {
            captures = await (prisma as any).narrativeCapture.findMany({
                where: {
                    narrative_period_id: narrativePeriodId,
                    status: statusFilter,
                    deleted_at: null
                },
                include: {
                    cat_narrative_titles: true,
                    cat_narrative_themes: true,
                    cat_narrative_sub_themes: true,
                    budget_program: true
                }
            });

            // Si no hay con el filtro de status, traer todas del período
            if (captures.length === 0) {
                captures = await (prisma as any).narrativeCapture.findMany({
                    where: { narrative_period_id: narrativePeriodId, deleted_at: null },
                    include: {
                        cat_narrative_titles: true,
                        cat_narrative_themes: true,
                        cat_narrative_sub_themes: true,
                        budget_program: true
                    }
                });
            }
        } catch (dbErr) {
            console.error("DB Fetch error for Word export:", dbErr);
        }

        // Mapear los datos para el motor de Python usando relaciones Prisma incluidas
        const items = captures.map((cap: any) => {
            // Título (Eje) — usar relación Prisma si viene incluida
            let titleName = cap.cat_narrative_titles?.name || "Eje Rector";
            let titleCode = String(cap.cat_narrative_titles?.code || cap.title_id || '1');

            // Tema
            let themeName = cap.cat_narrative_themes?.name || "Tema";
            let themeCode = String(cap.cat_narrative_themes?.code || cap.theme_id || '1.1');

            // Subtema
            let subthemeName = cap.cat_narrative_sub_themes?.name || "Subtema";
            let subthemeCode = String(cap.cat_narrative_sub_themes?.code || cap.subtheme_id || '1.1.1');

            // Programa Presupuestario (Catalogo o Manual)
            let programName = cap.custom_budget_program || cap.budget_program?.name || "Programa Presupuestario General";

            return {
                title_code: String(cap.cat_narrative_titles?.code || "1"),
                title_name: cap.cat_narrative_titles?.name || "Eje Rector",
                theme_code: String(cap.cat_narrative_themes?.code || "1.1"),
                theme_name: cap.cat_narrative_themes?.name || "Tema",
                subtheme_code: String(cap.cat_narrative_sub_themes?.code || "1.1.1"),
                subtheme_name: cap.cat_narrative_sub_themes?.name || "Subtema",
                program_name: cap.budget_program?.name || "Sin Clasificar",
                content: cap.narrative_breakdown || "Sin contenido.",
                highlighted: cap.highlighted || ""
            };
        });

        // Ordenamiento secuencial requerido: Título (Eje) -> Tema -> Subtema -> Programa
        items.sort((a: any, b: any) => {
            const cmpTitle = String(a.title_code).localeCompare(String(b.title_code), undefined, { numeric: true });
            if (cmpTitle !== 0) return cmpTitle;
            const cmpTheme = String(a.theme_code).localeCompare(String(b.theme_code), undefined, { numeric: true });
            if (cmpTheme !== 0) return cmpTheme;
            const cmpSubtheme = String(a.subtheme_code).localeCompare(String(b.subtheme_code), undefined, { numeric: true });
            if (cmpSubtheme !== 0) return cmpSubtheme;
            return String(a.program_name).localeCompare(String(b.program_name));
        });

        console.log(`[EXPORT DEBUG] Captures recibidas BD: ${captures.length}. Items mapeados reales: ${items.length}`);

        const exportData = {
            mission_name: `INFORME DE GOBIERNO CONSOLIDADO ${selectedPeriodYear}`,
            title_color: "1E1B4B",
            theme_color: "3730A3",
            subtheme_color: "4F46E5",
            items: items.length > 0 ? items : [{
                title_code: "1",
                title_name: "General",
                theme_code: "1",
                theme_name: "Sin Datos",
                subtheme_code: "1.1",
                subtheme_name: "Resultados Previos",
                content: "No hay reportes narrativos aprobados registrados en el sistema para este periodo histórico.",
                highlighted: "Sin observaciones relevantes."
            }]
        };

        const pythonRes = await axios.post('http://localhost:8000/export/word', exportData, {
            responseType: 'arraybuffer'
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=Libro_Informe_Consolidado_${selectedPeriodYear}.docx`);
        res.send(Buffer.from(pythonRes.data));
    } catch (error) {
        console.error("Consolidated Word export error:", error);
        res.status(500).json({ error: "Error generando el libro consolidado." });
    }
});

app.get('/api/export/consolidated/excel', authenticateToken, authorize(['super_admin', 'admin', 'secont', 'validador']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { periodo } = req.query;
    const selectedPeriod = parseInt(periodo as string) || 2026;

    try {
        logActivity(user, "Generación de Anexo Excel", "excel", `Se generó el Anexo Estadístico Consolidado ${selectedPeriod}`);

        // Fetch real data from SQL
        const entries = await (prisma as any).entityEntry.findMany({
            where: { period_id: selectedPeriod },
            include: {
                entity: { include: { properties: true } }
            }
        });

        const items: any[] = [];
        const entitiesDict: Record<string, any> = {};

        entries.forEach((e: any) => {
            const entityId = e.entity_id.toString();
            if (!entitiesDict[entityId]) {
                entitiesDict[entityId] = {
                    entity_name: e.entity?.name || `Entidad ${entityId}`,
                    rows: [],
                    headers: ["ENTIDAD", "FECHA_CAPTURA"]
                };
            }

            // In a real scenario, rows would be a related table or JSON
            // Assuming current schema has rows as JSON or related records
            const rows = e.data_rows || [];
            rows.forEach((row: any) => {
                const mappedRow: any = {
                    "ENTIDAD": entitiesDict[entityId].entity_name,
                    "FECHA_CAPTURA": e.created_at ? new Date(e.created_at).toLocaleDateString() : 'N/A'
                };

                Object.keys(row).forEach(key => {
                    const prop = e.entity?.properties?.find((p: any) => p.id.toString() === key);
                    const colName = prop ? prop.name : key;
                    mappedRow[colName] = row[key];
                    if (!entitiesDict[entityId].headers.includes(colName)) {
                        entitiesDict[entityId].headers.push(colName);
                    }
                });
                entitiesDict[entityId].rows.push(mappedRow);
            });
        });

        Object.values(entitiesDict).forEach(item => items.push(item));

        if (items.length === 0) {
            items.push({
                entity_name: "Sin Datos",
                headers: ["ENTIDAD", "FECHA_CAPTURA", "DATOS"],
                rows: [{ "ENTIDAD": "-", "FECHA_CAPTURA": "-", "DATOS": "No hay anexos registrados para este periodo o no han sido validados." }]
            });
        }

        // 3. Construir el Excel Consolidado con ExcelJS (multi-hoja con logo + estilos completos)
        const wb2 = new ExcelJS.Workbook();
        wb2.creator = 'SEPLAN Campeche';
        wb2.created = new Date();

        const logoPath = path.join(__dirname, '../../public/images/logo_semaig.png');
        let logoId = -1;
        if (fs.existsSync(logoPath)) {
            logoId = wb2.addImage({ filename: logoPath, extension: 'png' });
        }

        items.forEach((item: any, sheetIndex: number) => {
            // Nombre de hoja seguro (max 31 caracteres y sin caracteres prohibidos)
            let safeSheetName = item.entity_name.replace(/[\s\/\\:*?"<>|]/g, '_').substring(0, 31);
            // Evitar nombres duplicados si se recortan igual
            if (wb2.worksheets.find(w => w.name === safeSheetName)) {
                safeSheetName = `Hoja_${sheetIndex + 1}_${safeSheetName.substring(0, 15)}`;
            }

            const ws2 = wb2.addWorksheet(safeSheetName, { views: [{ showGridLines: false }] });
            const headerRow = item.headers;
            const colCount = headerRow.length;
            const headerOffset = 5;

            // Anchos de columna
            ws2.columns = [
                { width: 8 },  // col A (logo)
                ...headerRow.map((h: string) => ({ width: Math.max(18, Math.min(42, (h?.length || 14) + 4)) }))
            ];

            // LOGO
            if (logoId !== -1) {
                ws2.addImage(logoId, {
                    tl: { col: 0.15, row: 0.15 } as any,
                    br: { col: 1.0, row: 3.0 } as any,
                    editAs: 'oneCell'
                });
            }

            // ENCABEZADO FORMAL
            for (let r = 1; r <= 4; r++) {
                const row = ws2.getRow(r);
                row.height = r === 2 ? 38 : 20;
                for (let c = 1; c <= colCount + 1; c++) {
                    row.getCell(c).fill = {
                        type: 'pattern', pattern: 'solid',
                        fgColor: { argb: 'FF7B1F3A' } // Borgoña
                    };
                }
            }

            const titleCell2 = ws2.getRow(2).getCell(2);
            ws2.mergeCells(2, 2, 2, colCount + 1);
            titleCell2.value = `Reporte Consolidado: ${item.entity_name}`;
            titleCell2.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
            titleCell2.alignment = { vertical: 'middle', horizontal: 'left' };

            const entidadCell = ws2.getRow(3).getCell(2);
            ws2.mergeCells(3, 2, 3, colCount + 1);
            entidadCell.value = `Entidad: ${item.entity_name}`;
            entidadCell.font = { size: 10, color: { argb: 'FFDDBBCC' }, name: 'Calibri' };
            entidadCell.alignment = { vertical: 'middle', horizontal: 'left' };

            const fechaCell = ws2.getRow(4).getCell(2);
            ws2.mergeCells(4, 2, 4, colCount + 1);
            const ahora = new Date().toLocaleDateString('es-MX', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            fechaCell.value = `Fecha de Consolidación: ${ahora} - Ciclo: ${selectedPeriod}`;
            fechaCell.font = { size: 9, italic: true, color: { argb: 'FFDDBBCC' }, name: 'Calibri' };
            fechaCell.alignment = { vertical: 'middle', horizontal: 'left' };

            ws2.getRow(5).height = 6;

            // FILA DE ENCABEZADOS
            const hdrRow2 = ws2.getRow(headerOffset + 1);
            hdrRow2.height = 26;
            headerRow.forEach((name: string, i: number) => {
                const cell = hdrRow2.getCell(i + 2);
                cell.value = name;
                cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D2D2D' } }; // Gris oscuro
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF444444' } },
                    bottom: { style: 'medium', color: { argb: 'FF7B1F3A' } },
                    left: { style: 'thin', color: { argb: 'FF444444' } },
                    right: { style: 'thin', color: { argb: 'FF444444' } },
                };
            });
            const aHdr = hdrRow2.getCell(1);
            aHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D2D2D' } };

            // FILAS DE DATOS
            item.rows.forEach((rowObj: any, rowIdx: number) => {
                const exRow = ws2.getRow(headerOffset + 2 + rowIdx);
                exRow.height = 18;
                const bgArgb = rowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8F0F3'; // Alterno Rosa/Blanco

                exRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };

                headerRow.forEach((colName: string, colIdx: number) => {
                    const cell = exRow.getCell(colIdx + 2);
                    cell.value = rowObj[colName] ?? '';
                    cell.font = { size: 10, name: 'Calibri' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    };
                });
            });

            // FOOTER MÍNIMO
            let nextRow = headerOffset + 2 + item.rows.length;
            const fRow2 = ws2.getRow(nextRow);
            fRow2.height = 16;
            ws2.mergeCells(nextRow, 1, nextRow, colCount + 1);
            const fc = fRow2.getCell(1);
            fc.value = `Documento generado automáticamente por SEPLAN V2`;
            fc.font = { italic: true, size: 9, color: { argb: 'FF555555' }, name: 'Calibri' };
            fc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            fc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            fc.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
        });

        const fileName = `Anexo_Estadistico_Consolidado_${selectedPeriod}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await wb2.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Consolidated Excel export error:", error);
        res.status(500).json({ error: "Error generando el anexo consolidado." });
    }
});
app.get('/api/consolidation/status', authenticateToken, async (req, res) => {
    try {
        const { periodo } = req.query;
        const selectedYear = (periodo as string) || '2026';

        const period = await (prisma as any).cat_narrative_periods.findFirst({
            where: { year: selectedYear }
        });
        const periodId = period?.id;

        const narrativeCount = periodId ? await (prisma as any).narrativeCapture.count({
            where: { narrative_period_id: periodId }
        }) : 0;
        const approvedNarrativeCount = periodId ? await (prisma as any).narrativeCapture.count({
            where: { narrative_period_id: periodId, status: { in: ['approved_secont', 'finished'] } }
        }) : 0;

        const entityCount = await (prisma as any).entity.count();
        const entryPeriodRecord = await (prisma as any).cat_periods.findFirst({ where: { name: selectedYear } });
        const capturedEntityCount = entryPeriodRecord ? await (prisma as any).entry.count({
            where: { period_id: entryPeriodRecord.id }
        }) : 0;

        // Approximate axes progress from narrative titles in DB
        const titles = await (prisma as any).narrativeTitle.findMany({ take: 10 });
        const titlesLen = Math.max(1, titles.length);
        const axes = titles.map((t: any) => ({
            id: t.id,
            name: t.name,
            total: narrativeCount > 0 ? Math.ceil(narrativeCount / titlesLen) : 0,
            approved: approvedNarrativeCount > 0 ? Math.ceil(approvedNarrativeCount / titlesLen) : 0
        }));

        const statsProgress = {
            totalEntities: entityCount || 0,
            capturedEntities: capturedEntityCount || 0,
            validatedEntities: 0
        };

        res.json({ axes, statsProgress });
    } catch (error: any) {
        console.error("Error en consolidation/status:", error);
        res.status(500).json({ error: error.message || "No se pudo obtener del estado." });
    }
});
app.get('/api/stats/global', authenticateToken, authorize(['super_admin', 'admin']), async (req, res) => {
    try {
        const { periodo } = req.query;
        const selectedYear = (periodo as string) || '2026';

        // Cargar periodo
        const period = await prisma.cat_narrative_periods.findFirst({
            where: { year: selectedYear }
        });

        if (!period) return res.status(404).json({ error: "Periodo no encontrado" });

        const dependencies = await prisma.dependency.findMany();
        const sectors = await prisma.cat_sectors.findMany();

        const narratives = await (prisma as any).narrativeCapture.findMany({
            where: { narrative_period_id: period.id }
        });

        const entities = await (prisma as any).entity.findMany({
            where: { period_id: Number(period.id) }
        });

        const missions = await prisma.mission.findMany({
            orderBy: { id: 'asc' }
        });

        // Estatus de aprobación final (secont)
        const APPROVED_STATUSES = ['approved_secont', 'finalized', 'historical__revised_'];

        // 1. Avance General
        const totalDeps = dependencies.length;
        const depsWithCaptures = new Set([
            ...narratives.map((n: any) => n.dependency_id?.toString()),
            ...entities.map((e: any) => e.dependency_id?.toString())
        ].filter(Boolean)).size;

        const approvedCount = [
            ...narratives.filter((n: any) => APPROVED_STATUSES.includes(n.status)),
            ...entities.filter((e: any) => APPROVED_STATUSES.includes(e.status))
        ].length;

        const totalExpected = (narratives.length + entities.length) || 1;
        const globalProgress = Math.round((approvedCount / totalExpected) * 100);

        // 2. Avance por Misión
        const missionStats = missions.map(mission => {
            // Relación temporal rudimentaria si usamos un catálogo de dependencias por misión
            // O a través del Título de la Narrativa
            const missionNarratives = narratives.filter((n: any) => {
                const titleId = n.narrative_title_id;
                // Esto requiere tener cargada la relación en `narratives`
                return n.cat_narrative_titles?.mission_id === mission.id ||
                    // Fallback rústico si no hay relación en DB aún
                    (titleId && titleId >= (Number(mission.id) * 10) && titleId <= ((Number(mission.id) * 10) + 9));
            });
            // Entidades carecen de titularidad directa de Misión, requiere mapeo
            const missionEntities = entities.filter((e: any) => {
                // Fallback / Pendiente revisar si Entity tiene relación a Misión
                return false;
            });

            const totalMission = missionNarratives.length + missionEntities.length;
            const approvedMission = [
                ...missionNarratives.filter((n: any) => APPROVED_STATUSES.includes(n.status)),
                ...missionEntities.filter((e: any) => APPROVED_STATUSES.includes(e.status))
            ].length;

            const progress = totalMission > 0 ? Math.round((approvedMission / totalMission) * 100) : 0;

            // Obtener dependencias únicas que reportaron en esta misión
            const depsParticipando = new Set(missionNarratives.map((n: any) => n.dependency_id).filter(Boolean)).size;

            return {
                id: mission.id.toString(),
                name: mission.name,
                totalDependencies: depsParticipando, // deps vinculadas con capturas
                totalItems: totalMission,
                approvedNarratives: approvedMission,
                progress: Math.min(progress, 100)
            };
        });

        // 3. Ranking Crítico (Top 5 con Menor Avance)
        const ranking = dependencies.map(dep => {
            const depNarratives = narratives.filter((n: any) => n.dependency_id === dep.id);
            const depEntities = entities.filter((e: any) => e.dependency_id === dep.id);

            const total = depNarratives.length + depEntities.length;
            const approved = [
                ...depNarratives.filter((n: any) => APPROVED_STATUSES.includes(n.status)),
                ...depEntities.filter((e: any) => APPROVED_STATUSES.includes(e.status))
            ].length;

            const progress = total > 0 ? Math.round((approved / total) * 100) : 0;

            return {
                name: dep.name,
                acronym: dep.acronym,
                approved,
                total,
                progress,
                status: progress === 100 ? 'Completado' : progress > 0 ? 'En Proceso' : 'Sin Inicio'
            };
        }).sort((a, b) => a.progress - b.progress).slice(0, 5); // Ascending order (worst first)

        // 4. Distribución de Estatus
        const inReviewStatuses = ['under_validation_semaig', 'approved_semaig', 'under_validation_secont', 'approved_safin'];

        const validatedCount = approvedCount;
        const inReviewCount = [
            ...narratives.filter((n: any) => inReviewStatuses.includes(n.status)),
            ...entities.filter((e: any) => inReviewStatuses.includes(e.status))
        ].length;

        const validatedPercent = Math.round((validatedCount / totalExpected) * 100);
        const inReviewPercent = Math.round((inReviewCount / totalExpected) * 100);
        const draftPercent = Math.max(0, 100 - validatedPercent - inReviewPercent);

        // 5. Deadline (Legacy fallback if needed, but standardizing)
        const deadline = "2026-03-31";
        const today = new Date();
        const endDate = new Date(deadline);
        const diffTime = endDate.getTime() - today.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        res.json({
            periodo: selectedYear,
            globalProgress,
            totalNarratives: narratives.length,
            totalEntities: entities.length,
            depsWithCaptures,
            totalItems: narratives.length + entities.length,
            totalDeps,
            missionStats,
            rankingRezagados: ranking,
            statusDistribution: { validated: validatedPercent, inReview: inReviewPercent, draft: draftPercent },
            deadline: { date: deadline, daysRemaining }
        });
    } catch (error) {
        console.error("Global stats error:", error);
        res.status(500).json({ error: "Error interno obteniendo métricas reales" });
    }
});

// --- ADMIN: Gestión de Tablas Estadísticas (Entities) ---
app.get('/api/admin/entities', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req, res) => {
    try {
        const { periodo } = req.query;
        const selectedYear = (periodo as string) || '2026';

        const period = await prisma.cat_narrative_periods.findFirst({
            where: { year: selectedYear }
        });

        const entities = await prisma.entity.findMany({
            where: period ? { period_id: Number(period.id) } : {},
            include: {
                dependency: true,
                properties: true,
                cat_format_types: true
            },
            orderBy: { id: 'desc' }
        });
        res.json(entities);
    } catch (error) {
        console.error("Admin list entities error:", error);
        res.status(500).json({ error: "Error al listar entidades" });
    }
});

app.post('/api/admin/entities', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req, res) => {
    try {
        const { name, dependency_id, is_financial, second_stage, period_id, source, notes, properties } = req.body;
        const user = (req as any).user;

        const entity = await prisma.entity.create({
            data: {
                name,
                dependency_id: BigInt(dependency_id),
                is_financial: !!is_financial,
                second_stage: !!second_stage,
                period_id: Number(period_id),
                source,
                notes,
                created_by: BigInt(user.id),
                status: 'draft'
            }
        });

        // Crear propiedades si se enviaron
        if (properties && Array.isArray(properties)) {
            for (const prop of properties) {
                await prisma.property.create({
                    data: {
                        entity_id: entity.id,
                        column_name: prop.column_name,
                        column_type: prop.column_type, // 'text', 'number', 'catalog'
                        catalog_id: prop.catalog_id ? BigInt(prop.catalog_id) : null,
                        is_required: !!prop.is_required,
                        is_additional: !!prop.is_additional
                    }
                });
            }
        }

        res.json(entity);
    } catch (error) {
        console.error("Admin create entity error:", error);
        res.status(500).json({ error: "Error al crear entidad" });
    }
});

app.put('/api/admin/entities/:id', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, dependency_id, is_financial, second_stage, source, notes, status } = req.body;
        const user = (req as any).user;

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (dependency_id !== undefined) data.dependency_id = BigInt(dependency_id);
        if (is_financial !== undefined) data.is_financial = !!is_financial;
        if (second_stage !== undefined) data.second_stage = !!second_stage;
        if (source !== undefined) data.source = source;
        if (notes !== undefined) data.notes = notes;
        if (status !== undefined) data.status = status;
        data.edited_by = BigInt(user.id);

        const updated = await prisma.entity.update({
            where: { id: BigInt(id) },
            data
        });

        res.json(updated);
    } catch (error) {
        console.error("Admin update entity error:", error);
        res.status(500).json({ error: "Error al actualizar entidad" });
    }
});

app.delete('/api/admin/entities/:id', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.entity.update({
            where: { id: BigInt(id) },
            data: { deleted_at: new Date() }
        });
        logActivity((req as any).user, "Entidad Eliminada (Soft Delete)", "admin", `Entidad ID ${id} marcada como eliminada`, req);
        res.json({ success: true });
    } catch (error) {
        console.error("Admin delete entity error:", error);
        res.status(500).json({ error: "Error al eliminar entidad" });
    }
});

// --- ADMIN: Gestión de Propiedades (Columnas) ---
app.post('/api/admin/entities/:id/properties', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req, res) => {
    try {
        const { id } = req.params;
        const { column_name, column_type, catalog_id, is_required, is_additional } = req.body;

        const prop = await prisma.property.create({
            data: {
                entity_id: BigInt(id),
                column_name,
                column_type,
                catalog_id: catalog_id ? BigInt(catalog_id) : null,
                is_required: !!is_required,
                is_additional: !!is_additional
            }
        });

        res.json(prop);
    } catch (error) {
        console.error("Admin create property error:", error);
        res.status(500).json({ error: "Error al crear columna" });
    }
});

app.put('/api/admin/properties/:id', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { column_name, column_type, catalog_id, is_required, is_additional } = req.body;

        const data: any = {};
        if (column_name !== undefined) data.column_name = column_name;
        if (column_type !== undefined) data.column_type = column_type;
        if (catalog_id !== undefined) data.catalog_id = catalog_id ? BigInt(catalog_id) : null;
        if (is_required !== undefined) data.is_required = !!is_required;
        if (is_additional !== undefined) data.is_additional = !!is_additional;

        const updated = await prisma.property.update({
            where: { id: BigInt(id) },
            data
        });

        res.json(updated);
    } catch (error) {
        console.error("Admin update property error:", error);
        res.status(500).json({ error: "Error al actualizar columna" });
    }
});

app.delete('/api/admin/properties/:id', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.property.update({
            where: { id: BigInt(id) },
            data: { deleted_at: new Date() }
        });
        logActivity((req as any).user, "Columna Eliminada (Soft Delete)", "admin", `Columna ID ${id} marcada como eliminada`, req);
        res.json({ success: true });
    } catch (error) {
        console.error("Admin delete property error:", error);
        res.status(500).json({ error: "Error al eliminar columna" });
    }
});

// --- ADMIN: Gestión Genérica de Catálogos ---
const CATALOG_MODELS: Record<string, any> = {
    'narrative-titles': prisma.narrativeTitle,
    'narrative-themes': prisma.narrativeTheme,
    'narrative-subthemes': prisma.cat_narrative_sub_themes,
    'financing-sources': prisma.cat_narrative_financing_sources,
    'ods': prisma.odsLinkage,
    'missions': prisma.mission,
    'axis': prisma.mission,
    'dependencies': prisma.dependency,
    'beneficiary-types': prisma.cat_narrative_beneficiary_types,
    'budget-programs': prisma.budgetProgram,
    'sectors': prisma.cat_sectors,
    'ppas-types': prisma.cat_ppas_types,
    'locations': prisma.cat_localities,
    'periods': prisma.cat_narrative_periods,
    'format-types': prisma.cat_format_types
};

const COUNT_RELATIONS: Record<string, string[]> = {
    'narrative-titles': ['narrative_captures'],
    'narrative-themes': ['narrative_captures'],
    'narrative-subthemes': ['narrative_captures'],
    'financing-sources': [],
    'missions': ['miss_obj_stra_act_narrative'],
    'axis': ['miss_obj_stra_act_narrative'],
    'dependencies': ['users', 'captures'],
    'beneficiary-types': ['narrative_captures'],
    'budget-programs': ['captures'],
    'sectors': ['cat_dependencies'],
    'ppas-types': ['narrative_captures'],
    'locations': ['municipality_locality_narrative'],
    'periods': ['narrative_captures'],
    'format-types': ['entities']
};

app.get('/api/admin/catalogs-list', authenticateToken, authorize(['super_admin']), (req, res) => {
    res.json(Object.keys(CATALOG_MODELS));
});

app.get('/api/admin/catalogs/:slug', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = '1', limit = '10', search = '' } = req.query as { page?: string, limit?: string, search?: string };
        const model = CATALOG_MODELS[slug];
        if (!model) return res.status(404).json({ error: "Catálogo no encontrado" });

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where: any = {};
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            const isNumber = /^\d+$/.test(searchTerm);

            where.OR = [
                { name: { contains: searchTerm } }
            ];

            if (isNumber) {
                // If the search is a number, we also include the ID in the search
                where.OR.push({ id: BigInt(searchTerm) });
            }
        }

        const relations = COUNT_RELATIONS[slug] || [];
        const include = relations.length > 0 ? {
            _count: {
                select: relations.reduce((acc, rel) => ({ ...acc, [rel]: true }), {})
            }
        } : undefined;

        // Perform counts and items fetch in parallel for performance
        const [items, total] = await Promise.all([
            model.findMany({
                where,
                orderBy: { id: 'asc' },
                include: include,
                skip,
                take
            }),
            model.count({ where })
        ]);

        // Consolidate usage count into a simple number
        const formattedItems = items.map((item: any) => {
            let usageCount = 0;
            if (item._count) {
                usageCount = Object.values(item._count).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0) as number;
            }
            const { _count, ...rest } = item;
            return { ...rest, usageCount };
        });

        res.json({
            items: formattedItems,
            pagination: {
                total,
                pages: Math.ceil(total / (take || 1)),
                currentPage: parseInt(page),
                limit: take
            }
        });
    } catch (error: any) {
        console.error(`Admin get catalog ${req.params.slug} error:`, error);
        res.status(500).json({
            error: "Error al obtener catálogo",
            details: error.message
        });
    }
});

app.post('/api/admin/catalogs/:slug', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { slug } = req.params;
        const model = CATALOG_MODELS[slug];
        if (!model) return res.status(404).json({ error: "Catálogo no encontrado" });

        const item = await model.create({
            data: req.body
        });
        res.json(item);
    } catch (error) {
        console.error(`Admin create catalog ${req.params.slug} error:`, error);
        res.status(500).json({ error: "Error al crear ítem de catálogo" });
    }
});

app.put('/api/admin/catalogs/:slug/:id', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { slug, id } = req.params;
        const model = CATALOG_MODELS[slug];
        if (!model) return res.status(404).json({ error: "Catálogo no encontrado" });

        const updated = await model.update({
            where: { id: BigInt(id) },
            data: req.body
        });
        res.json(updated);
    } catch (error) {
        console.error(`Admin update catalog ${req.params.slug} error:`, error);
        res.status(500).json({ error: "Error al actualizar ítem de catálogo" });
    }
});

app.delete('/api/admin/catalogs/:slug/:id', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { slug, id } = req.params;
        const model = CATALOG_MODELS[slug];
        if (!model) return res.status(404).json({ error: "Catálogo no encontrado" });

        await model.update({
            where: { id: BigInt(id) },
            data: { deleted_at: new Date() }
        });
        logActivity((req as any).user, "Ítem de Catálogo Eliminado (Soft Delete)", "catalog_admin", `Ítem ID ${id} del catálogo ${slug} marcado como eliminado`, req);
        res.json({ success: true });
    } catch (error) {
        console.error(`Admin delete catalog ${req.params.slug} error:`, error);
        res.status(500).json({ error: "Error al eliminar ítem de catálogo" });
    }
});

app.get('/api/admin/users', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { dependency: true }
        });
        res.json(users.map(u => ({ ...u, id: u.id.toString(), dependency_id: u.dependency_id?.toString() })));
    } catch (e) { res.status(500).json([]); }
});

app.post('/api/admin/users', authenticateToken, authorize(['super_admin']), async (req, res) => {
    const currentUser = (req as any).user;
    const { name, email, password, dependency_id, roles } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                dependency_id: dependency_id ? BigInt(dependency_id) : null,
                is_active: true
            }
        });

        // Assign roles
        if (roles && Array.isArray(roles)) {
            for (const roleName of roles) {
                const role = await prisma.role.findFirst({ where: { name: roleName } });
                if (role) {
                    await (prisma as any).userHasRole.create({
                        data: { user_id: newUser.id, role_id: role.id }
                    });
                }
            }
        }

        logActivity(currentUser, "Creación de Usuario", "admin", `Se creó el usuario SQL: ${email}`);
        res.json({ ...newUser, id: newUser.id.toString() });
    } catch (e) {
        console.error("Create user error:", e);
        res.status(500).json({ error: "Error creando usuario en SQL" });
    }
});

app.patch('/api/admin/users/:id', authenticateToken, authorize(['super_admin']), async (req, res) => {
    const currentUser = (req as any).user;
    const { id } = req.params;
    const updates = req.body;

    try {
        const updated = await prisma.user.update({
            where: { id: BigInt(id) },
            data: {
                name: updates.name,
                email: updates.email,
                dependency_id: (updates.dependency_id !== undefined && updates.dependency_id !== null) ? BigInt(updates.dependency_id) : (updates.dependency_id === null ? null : undefined),
                is_active: updates.is_active
            } as any
        });
        logActivity(currentUser, "Actualización de Usuario", "admin", `Se actualizó el usuario SQL ID: ${id}`);
        res.json({ ...updated, id: updated.id.toString() });
    } catch (e) {
        res.status(500).json({ error: "Error actualizando usuario en SQL" });
    }
});

// Consolidated dependencies endpoint (admin & catalogs)
app.get(['/api/admin/dependencies', '/api/catalogs/dependencies'], authenticateToken, async (req, res) => {
    const { sectorId, axis, periodo, withProgress } = req.query;
    const selectedPeriod = parseInt(periodo as string || "2026");
    const periodId = selectedPeriod === 2026 ? 5 : 4;

    try {
        const deps = await prisma.dependency.findMany({ include: { cat_sectors: true } });
        let result = deps.map(d => ({ ...d, id: d.id.toString(), sector_id: d.sector_id?.toString() }));

        if (sectorId) {
            result = result.filter(d => String(d.sector_id) === String(sectorId));
        }

        if (axis) {
            result = result.filter(d => {
                if (!d.dependency_axis) return false;
                return String(d.dependency_axis).split(',').map(a => a.trim()).includes(String(axis));
            });
        }

        if (withProgress === 'true' && isDbOnline) {
            // ... (I'll keep the progress logic but it's long, I'll use the existing one below if possible)
            // Just returning the basic list for now to avoid bloat, will merge with the complex one below
        }

        res.json(result.map((d: any) => ({ ...d, periodo: d.periodo || selectedPeriod })));
    } catch (e) { res.status(500).json([]); }
});

app.post('/api/inbox/update-status', authenticateToken, authorize(['super_admin', 'admin', 'validador']), async (req, res) => {
    const { type, id, status, comment } = req.body;
    const user = (req as any).user;

    try {
        if (type === 'narrativa') {
            await (prisma as any).narrativeCapture.update({
                where: { id: BigInt(id) },
                data: { status: status, observations: comment }
            });
            logActivity(user, `Cambio de Estatus (${status})`, type, `Narrativa ID: ${id}. Comentario: ${comment || 'S/C'}`);
            return res.json({ message: `Estatus actualizado a ${status}` });
        } else if (type === 'estadística') {
            await (prisma as any).entityEntry.update({
                where: { id: BigInt(id) },
                data: { status: status, validator_comment: comment }
            });
            logActivity(user, `Cambio de Estatus (${status})`, type, `Estadística ID: ${id}. Comentario: ${comment || 'S/C'}`);
            return res.json({ message: `Estatus actualizado a ${status}` });
        }
        res.status(404).json({ error: "Registro no encontrado" });
    } catch (error) {
        res.status(500).json({ error: "No se pudo actualizar el estatus" });
    }
});

// --- CATALOG ENDPOINTS ---
// Catálogo de Municipios
app.get('/api/catalogs/municipalities', authenticateToken, async (req, res) => {
    try {
        const municipalities = await (prisma as any).cat_municipalities.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(municipalities);
    } catch (error) {
        console.error("Error fetching municipalities:", error);
        res.status(500).json({ error: "No se pudieron cargar los municipios." });
    }
});

// Catálogo de Localidades por Municipio
app.get('/api/catalogs/localities/:municipalityId', authenticateToken, async (req, res) => {
    try {
        const { municipalityId } = req.params;
        const localities = await (prisma as any).cat_localities.findMany({
            where: { municipality_id: BigInt(municipalityId) },
            orderBy: { name: 'asc' }
        });
        res.json(localities);
    } catch (error) {
        console.error("Error fetching localities:", error);
        res.status(500).json({ error: "No se pudieron cargar las localidades." });
    }
});

app.get('/api/catalogs/narrative-titles', authenticateToken, async (req, res) => {
    const pStr = (req.query.periodo as string) || "2026";
    const selectedPeriod = parseInt(pStr);

    let titles: any[] = [];
    try {
        const period = await prisma.cat_narrative_periods.findFirst({ where: { year: pStr, deleted_at: null } });
        if (period) {
            titles = await prisma.narrativeTitle.findMany({
                where: { cat_missions: { narrative_period_id: period.id } }
            });
        } else {
            titles = await prisma.narrativeTitle.findMany();
        }
    } catch (e) { titles = []; }

    res.json(titles.map(t => ({ ...t, periodo: selectedPeriod })));
});

app.get('/api/catalogs/financing-sources', authenticateToken, async (req, res) => {
    let sources: any[] = [];
    try {
        sources = await prisma.cat_narrative_financing_sources.findMany();
        fs.appendFileSync('/tmp/backend_debug.log', `[${new Date().toISOString()}] GET /api/catalogs/financing-sources -> ${sources.length} items\n`);
    } catch (e: any) {
        fs.appendFileSync('/tmp/backend_debug.log', `[${new Date().toISOString()}] ERROR financing-sources: ${e.message}\n`);
        sources = [];
    }

    res.json(sources);
});

app.get('/api/catalogs/ods', authenticateToken, async (req, res) => {
    const pStr = (req.query.periodo as string) || "2026";
    const selectedPeriod = parseInt(pStr);

    let ods: any[] = [];
    try {
        ods = await (prisma as any).odsLinkage.findMany();
    } catch (e) { ods = []; }

    res.json(ods);
});

app.get('/api/catalogs/missions', authenticateToken, async (req, res) => {
    const pStr = (req.query.periodo as string) || "2026";
    const selectedPeriod = parseInt(pStr);

    let missions: any[] = [];
    try {
        missions = await prisma.mission.findMany();
    } catch (e) { missions = []; }

    res.json(missions);
});

app.get('/api/catalogs/ppas', authenticateToken, async (req, res) => {
    const query = (req.query.q as string || "").toLowerCase().trim();

    try {
        const catalogPath = path.join(__dirname, '..', '..', 'backend', 'ppas_catalog.json');
        const altPath = path.join(__dirname, '..', 'ppas_catalog.json');
        const jsonPath = fs.existsSync(catalogPath) ? catalogPath : altPath;

        if (!fs.existsSync(jsonPath)) {
            console.error("ppas_catalog.json not found at:", jsonPath);
            return res.json([]);
        }

        const allPpas: any[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

        const filtered = query.length > 0
            ? allPpas.filter(ppa =>
                (ppa.name || "").toLowerCase().includes(query) ||
                (ppa.clave || "").toLowerCase().includes(query) ||
                (ppa.titulo || "").toLowerCase().includes(query)
            ).slice(0, 20)
            : allPpas.slice(0, 20);

        console.log(`PPA search "${query}" -> ${filtered.length} results`);
        res.json(filtered);
    } catch (error) {
        console.error("Error reading PPA catalog JSON:", error);
        res.status(500).json({ error: "No se pudo leer el catálogo de PPAs" });
    }
});

// Endpoint to get the default classification pre-selection for the current user's dependency
app.get('/api/catalogs/default-classification', authenticateToken, async (req, res) => {
    try {
        const user = (req as any).user;
        const userId = user.id;
        console.log(`[default-classification] JWT user.id=${userId} type=${typeof userId}`);

        // Use raw SQL — most reliable way to get dependency name regardless of Prisma model naming
        // parseInt handles BigInt represented as string or number
        const userIdNum = parseInt(String(userId).replace(/n$/, ''), 10);
        const depRaw: any[] = await (prisma as any).$queryRawUnsafe(
            `SELECT d.name FROM users u 
             LEFT JOIN cat_dependencies d ON d.id = u.dependency_id 
             WHERE u.id = ? LIMIT 1`,
            userIdNum
        );
        console.log(`[default-classification] depRaw=${JSON.stringify(depRaw)}`);
        const depName: string = depRaw?.[0]?.name || "";

        if (!depName) return res.json({ found: false });

        const catalogPath = path.join(__dirname, '..', 'ppas_catalog.json');
        if (!fs.existsSync(catalogPath)) return res.json({ found: false });

        const allPpas: any[] = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

        // Find PPAs that belong to this dependency (partial match for robustness)
        const depLower = depName.toLowerCase().trim();
        const matchingPpas = allPpas.filter(p =>
            (p.dependencia || "").toLowerCase().includes(depLower) ||
            depLower.includes((p.dependencia || "").toLowerCase().trim())
        );

        if (matchingPpas.length === 0) return res.json({ found: false, depName });

        // Get the most common titulo/tema/subtema for this dependency
        const tituloCount: Record<string, number> = {};
        matchingPpas.forEach(p => { tituloCount[p.titulo] = (tituloCount[p.titulo] || 0) + 1; });
        const defaultTitulo = Object.entries(tituloCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

        const temaCount: Record<string, number> = {};
        matchingPpas.filter(p => p.titulo === defaultTitulo)
            .forEach(p => { temaCount[p.tema] = (temaCount[p.tema] || 0) + 1; });
        const defaultTema = Object.entries(temaCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

        const subtemaCount: Record<string, number> = {};
        matchingPpas.filter(p => p.titulo === defaultTitulo && p.tema === defaultTema)
            .forEach(p => { subtemaCount[p.subtema] = (subtemaCount[p.subtema] || 0) + 1; });
        const defaultSubtema = Object.entries(subtemaCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

        // Now find the DB IDs by matching names in the narrative catalog tables (raw SQL for reliability)
        const allTitles: any[] = await (prisma as any).$queryRawUnsafe(`SELECT id, name FROM cat_narrative_titles`);
        const allThemes: any[] = await (prisma as any).$queryRawUnsafe(`SELECT id, name FROM cat_narrative_themes`);
        const allSubthemes: any[] = await (prisma as any).$queryRawUnsafe(`SELECT id, name FROM cat_narrative_sub_themes`);

        const titleMatch = allTitles.find((t: any) =>
            (t.name || "").toLowerCase().includes(defaultTitulo.toLowerCase().trim()) ||
            defaultTitulo.toLowerCase().includes((t.name || "").toLowerCase().trim())
        );
        const themeMatch = allThemes.find((t: any) =>
            (t.name || "").toLowerCase().includes(defaultTema.toLowerCase().trim()) ||
            defaultTema.toLowerCase().includes((t.name || "").toLowerCase().trim())
        );
        const subthemeMatch = allSubthemes.find((s: any) =>
            (s.name || "").toLowerCase().includes(defaultSubtema.toLowerCase().trim()) ||
            defaultSubtema.toLowerCase().includes((s.name || "").toLowerCase().trim())
        );

        // Build lists of allowed titles/themes/subtemas for this dependency
        const allowedTitulos = Array.from(new Set(matchingPpas.map((p: any) => p.titulo).filter(Boolean)));
        const allowedTemasByTitulo: Record<string, string[]> = {};
        const allowedSubtemasByTema: Record<string, string[]> = {};
        matchingPpas.forEach((p: any) => {
            if (p.titulo && p.tema) {
                const tituloStr = String(p.titulo);
                if (!allowedTemasByTitulo[tituloStr]) allowedTemasByTitulo[tituloStr] = [];
                if (!allowedTemasByTitulo[tituloStr]!.includes(p.tema)) allowedTemasByTitulo[tituloStr]!.push(p.tema);
            }
            if (p.tema && p.subtema) {
                const temaStr = String(p.tema);
                if (!allowedSubtemasByTema[temaStr]) allowedSubtemasByTema[temaStr] = [];
                if (!allowedSubtemasByTema[temaStr]!.includes(p.subtema)) allowedSubtemasByTema[temaStr]!.push(p.subtema);
            }
        });

        // Match allowed titulos to DB IDs
        const allowedTitleIds = allTitles
            .filter((t: any) => allowedTitulos.some(at => (t.name || '').toLowerCase().includes(at.toLowerCase().trim()) || at.toLowerCase().includes((t.name || '').toLowerCase().trim())))
            .map((t: any) => t.id.toString());

        console.log(`Default classification for "${depName}": titulo="${defaultTitulo}"(${titleMatch?.id}), tema="${defaultTema}"(${themeMatch?.id}), subtema="${defaultSubtema}"(${subthemeMatch?.id}) | allowed: ${allowedTitulos.length} titulos`);

        res.json({
            found: true,
            depName,
            totalPpas: matchingPpas.length,
            defaultTitulo,
            defaultTema,
            defaultSubtema,
            title_id: titleMatch?.id?.toString() || null,
            theme_id: themeMatch?.id?.toString() || null,
            subtheme_id: subthemeMatch?.id?.toString() || null,
            // For filtering dropdowns
            allowedTitulos,
            allowedTitleIds,
            allowedTemasByTitulo,
            allowedSubtemasByTema,
        });
    } catch (error) {
        console.error("Error in default-classification:", error);
        res.json({ found: false });
    }
});

// Endpoint to get PPAs matching a classification (titulo/tema/subtema)
app.get('/api/catalogs/ppas-by-classification', authenticateToken, async (req, res) => {
    const titulo = (req.query.titulo as string || "").toLowerCase().trim();
    const tema = (req.query.tema as string || "").toLowerCase().trim();
    const subtema = (req.query.subtema as string || "").toLowerCase().trim();
    const titleId = req.query.title_id ? BigInt(req.query.title_id as string) : null;
    const themeId = req.query.theme_id ? BigInt(req.query.theme_id as string) : null;
    const periodo = req.query.periodo as string || "2026";
    // Additional PPAs to exclude (comma-separated names from current session)
    const excludeNames = (req.query.exclude as string || "").split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    try {
        const catalogPath = path.join(__dirname, '..', 'ppas_catalog.json');
        if (!fs.existsSync(catalogPath)) return res.json([]);

        const allPpas: any[] = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

        // Get already-used PPAs for this classification in the CURRENT period only (2026)
        let usedPpaNames: string[] = [...excludeNames];
        if (isDbOnline && (titleId || themeId)) {
            try {
                // Find the 2026 period ID to restrict exclusion to current cycle only
                const currentPeriod = await (prisma as any).cat_narrative_periods.findFirst({
                    where: { year: '2026' },
                    select: { id: true }
                });

                if (currentPeriod) {
                    const usedNarratives = await prisma.narrativeCapture.findMany({
                        where: {
                            narrative_period_id: currentPeriod.id,
                            ...(titleId ? { narrative_title_id: titleId } : {}),
                            ...(themeId ? { narrative_theme_id: themeId } : {}),
                        },
                        select: { ppa_name: true }
                    });
                    usedPpaNames = [
                        ...usedPpaNames,
                        ...usedNarratives.map((n: any) => (n.ppa_name || "").toLowerCase())
                    ];
                }
            } catch (dbErr) {
                console.warn("Could not fetch used PPAs:", dbErr);
            }
        }

        const filtered = allPpas.filter(ppa => {
            const pTitulo = (ppa.titulo || "").toLowerCase();
            const pTema = (ppa.tema || "").toLowerCase();
            const pSubtema = (ppa.subtema || "").toLowerCase();
            const pName = (ppa.name || "").toLowerCase();

            const tituloMatch = titulo ? pTitulo.includes(titulo) : true;
            const temaMatch = tema ? pTema.includes(tema) : true;
            const subtemaMatch = subtema ? pSubtema.includes(subtema) : true;
            const notUsed = !usedPpaNames.includes(pName);

            return tituloMatch && temaMatch && subtemaMatch && notUsed;
        }).slice(0, 50);

        console.log(`PPAs by classification -> ${filtered.length} available (${usedPpaNames.length} already used)`);
        res.json(filtered);
    } catch (error) {
        console.error("Error in ppas-by-classification:", error);
        res.json([]);
    }
});

app.get('/api/catalogs/beneficiary-types', authenticateToken, async (req, res) => {
    let types: any[] = [];
    try {
        types = await prisma.cat_narrative_beneficiary_types.findMany();
        fs.appendFileSync('/tmp/backend_debug.log', `[${new Date().toISOString()}] GET /api/catalogs/beneficiary-types -> ${types.length} items\n`);
    } catch (e: any) {
        fs.appendFileSync('/tmp/backend_debug.log', `[${new Date().toISOString()}] ERROR beneficiary-types: ${e.message}\n`);
        types = [];
    }

    res.json(types);
});

app.get('/api/catalogs', authenticateToken, async (req, res) => {
    try {
        const cats = await (prisma as any).catalogs.findMany({
            select: { id: true, name: true, type: true },
            orderBy: { name: 'asc' }
        });
        res.json(cats);
    } catch (e) {
        res.status(500).json({ error: "Error al obtener catálogos" });
    }
});

// --- END OF CONSOLIDATED CATALOGS ---

app.get('/api/catalogs/budget-programs', authenticateToken, async (req, res) => {
    let programs: any[] = [];
    try {
        programs = await prisma.budgetProgram.findMany();
    } catch (e) { programs = []; }

    res.json(programs);
});

app.get('/api/catalogs/narrative-themes', authenticateToken, async (req, res) => {
    const pStr = (req.query.periodo as string) || "2026";
    const titleId = req.query.narrative_title_id ? BigInt(req.query.narrative_title_id as string) : (req.query.title_id ? BigInt(req.query.title_id as string) : null);

    let themes: any[] = [];
    try {
        const where: any = {};
        if (titleId) {
            where.narrative_title_id = titleId;
        } else {
            const period = await prisma.cat_narrative_periods.findFirst({ where: { year: pStr, deleted_at: null } });
            fs.appendFileSync('/tmp/backend_debug.log', `[${new Date().toISOString()}] GET narrative-themes for yr ${pStr} -> period ID ${period?.id}\n`);
            if (period) {
                where.title = { cat_missions: { narrative_period_id: period.id } };
            }
        }
        themes = await prisma.narrativeTheme.findMany({ where });
        fs.appendFileSync('/tmp/backend_debug.log', `[${new Date().toISOString()}] GET /api/catalogs/narrative-themes -> ${themes.length} items\n`);
    } catch (e: any) {
        fs.appendFileSync('/tmp/backend_debug.log', `[${new Date().toISOString()}] ERROR narrative-themes: ${e.message}\n`);
        themes = [];
    }

    res.json(themes);
});

app.get('/api/catalogs/narrative-subthemes', authenticateToken, async (req, res) => {
    const pStr = (req.query.periodo as string) || "2026";
    const themeId = req.query.narrative_theme_id ? BigInt(req.query.narrative_theme_id as string) : (req.query.theme_id ? BigInt(req.query.theme_id as string) : null);

    let subthemes: any[] = [];
    try {
        const where: any = {};
        if (themeId) {
            where.narrative_theme_id = themeId;
        } else {
            const period = await prisma.cat_narrative_periods.findFirst({ where: { year: pStr, deleted_at: null } });
            if (period) {
                where.cat_narrative_themes = {
                    title: { cat_missions: { narrative_period_id: period.id } }
                };
            }
        }
        subthemes = await prisma.cat_narrative_sub_themes.findMany({ where });
    } catch (e) { subthemes = []; }

    res.json(subthemes);
});

// --- PED Alignment Catalogs ---

app.get('/api/catalogs/ped/missions', authenticateToken, async (req, res) => {
    try {
        const missions = await (prisma as any).$queryRawUnsafe(`SELECT id, name, code FROM cat_missions ORDER BY code ASC`);
        res.json(missions);
    } catch (e) { console.error(e); res.status(500).json([]); }
});

app.get('/api/catalogs/ped/objectives', authenticateToken, async (req, res) => {
    const missionId = req.query.mission_id;
    try {
        let objectives;
        if (missionId) {
            objectives = await (prisma as any).$queryRawUnsafe(`SELECT id, name, code, mission_id FROM cat_objectives WHERE mission_id = ? ORDER BY code ASC`, parseInt(missionId as string));
        } else {
            objectives = await (prisma as any).$queryRawUnsafe(`SELECT id, name, code, mission_id FROM cat_objectives ORDER BY code ASC`);
        }
        res.json(objectives);
    } catch (e) { console.error(e); res.status(500).json([]); }
});

app.get('/api/catalogs/ped/strategies', authenticateToken, async (req, res) => {
    const objectiveId = req.query.objective_id;
    try {
        let strategies;
        if (objectiveId) {
            strategies = await (prisma as any).$queryRawUnsafe(`SELECT id, name, code, objective_id FROM cat_narrative_strategies WHERE objective_id = ? ORDER BY code ASC`, parseInt(objectiveId as string));
        } else {
            strategies = await (prisma as any).$queryRawUnsafe(`SELECT id, name, code, objective_id FROM cat_narrative_strategies ORDER BY code ASC`);
        }
        res.json(strategies);
    } catch (e) { console.error(e); res.status(500).json([]); }
});

app.get('/api/catalogs/ped/action-lines', authenticateToken, async (req, res) => {
    const strategyId = req.query.strategy_id;
    try {
        let actionLines;
        if (strategyId) {
            actionLines = await (prisma as any).$queryRawUnsafe(`SELECT id, name, code, narrative_strategy_id FROM cat_action_lines WHERE narrative_strategy_id = ? ORDER BY code ASC`, parseInt(strategyId as string));
        } else {
            actionLines = await (prisma as any).$queryRawUnsafe(`SELECT id, name, code, narrative_strategy_id FROM cat_action_lines ORDER BY code ASC`);
        }
        res.json(actionLines);
    } catch (e) { console.error(e); res.status(500).json([]); }
});

// --- CATALOG CRUD ENDPOINTS (Generic) ---
app.post('/api/catalogs/:type', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { type } = req.params;
        const model = CATALOG_MODELS[type];
        if (!model) return res.status(404).json({ error: "Catálogo no encontrado o no editable vía genérica" });

        const data = { ...req.body };
        delete data.id;

        const item = await model.create({
            data: data
        });
        res.json(item);
    } catch (error) {
        console.error(`Catalog POST ${req.params.type} error:`, error);
        res.status(500).json({ error: "Error al crear ítem de catálogo" });
    }
});

app.put('/api/catalogs/:type/:id', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { type, id } = req.params;
        const model = CATALOG_MODELS[type];
        if (!model) return res.status(404).json({ error: "Catálogo no encontrado" });

        const data = { ...req.body };
        delete data.id;

        const updated = await model.update({
            where: { id: BigInt(id) },
            data: data
        });
        res.json(updated);
    } catch (error) {
        console.error(`Catalog PUT ${req.params.type} error:`, error);
        res.status(500).json({ error: "Error al actualizar ítem de catálogo" });
    }
});

app.delete('/api/catalogs/:type/:id', authenticateToken, authorize(['super_admin']), async (req, res) => {
    try {
        const { type, id } = req.params;
        const model = CATALOG_MODELS[type];
        if (!model) return res.status(404).json({ error: "Catálogo no encontrado" });

        await model.update({
            where: { id: BigInt(id) },
            data: { deleted_at: new Date() }
        });
        logActivity((req as any).user, "Ítem de Catálogo Eliminado (Soft Delete)", "catalog", `Ítem ID ${id} del catálogo ${type} marcado como eliminado`, req);
        res.json({ success: true });
    } catch (error) {
        console.error(`Catalog DELETE ${req.params.type} error:`, error);
        res.status(500).json({ error: "Error al eliminar ítem de catálogo" });
    }
});

app.get('/api/catalogs/ppas-types', authenticateToken, async (req: Request, res: Response) => {
    try {
        const types = await (prisma as any).cat_ppas_types.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(types);
    } catch (error) {
        console.error("Error fetching PPA types:", error);
        res.status(500).json({ error: "No se pudieron cargar los tipos de PPA." });
    }
});

app.post('/api/narratives', authenticateToken, async (req: Request, res: Response) => {
    const data = req.body;
    const user = (req as any).user;

    // Helper para BigInt seguro
    const safeBigInt = (val: any) => {
        if (val === undefined || val === null || val === "") return null;
        const n = typeof val === 'string' ? parseInt(val) : val;
        return isNaN(n) ? null : BigInt(n);
    };

    try {
        console.log(`[DEBUG] POST /api/narratives raw body:`, JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        console.log(`[DEBUG] ppa_name: "${data.ppa_name}", new_ppa_name: "${data.new_ppa_name}"`);
        const nextFolio = `NARR-${Date.now().toString().slice(-6)}`;
        const narrative = await (prisma as any).narrativeCapture.create({
            data: {
                ppa_name: data.ppa_name,
                new_ppa_name: data.new_ppa_name || null,
                ppas_type_id: safeBigInt(data.type_id),
                investment_amount: data.investment_amount && data.investment_amount !== "" ? data.investment_amount : null,
                beneficiaries: (data.beneficiaries && data.beneficiaries !== "") ? (parseInt(data.beneficiaries) || 0) : 0,
                narrative_breakdown: data.narrative_breakdown,
                highlighted: data.highlighted,
                narrative_period_id: (parseInt(data.periodo) || 2026) === 2026 ? 5 : 4,
                status: data.status === 'En Validación' ? 'under_validation_semaig' : 'draft',
                dependency_id: user.dependency_id || 1,
                narrative_title_id: parseInt(data.title_id) || null,
                narrative_theme_id: parseInt(data.theme_id) || null,
                narrative_sub_theme_id: parseInt(data.subtheme_id) || null,
                narrative_beneficiary_type_id: parseInt(data.beneficiary_type_id) || null,
                budget_program_id: parseInt(data.budget_program_id) || null,
                custom_budget_program: data.budget_program_id === 'manual' ? data.custom_budget_program || null : null,
                sequence_number: nextFolio,
            }
        });

        // Guardar Vincualción PED
        if (data.peds && Array.isArray(data.peds)) {
            for (const ped of data.peds) {
                const m = safeBigInt(ped.mission_id);
                const o = safeBigInt(ped.objective_id);
                const s = safeBigInt(ped.strategy_id);
                const a = safeBigInt(ped.action_line_id);

                if (m && o && s && a) {
                    await (prisma as any).miss_obj_stra_act_narrative.create({
                        data: {
                            narrative_capture_id: narrative.id,
                            mission_id: m,
                            objective_id: o,
                            narrative_strategy_id: s,
                            action_line_id: a
                        }
                    });
                }
            }
        }

        // Guardar Ubicaciones
        if (data.locations && Array.isArray(data.locations)) {
            for (const loc of data.locations) {
                const mun = safeBigInt(loc.municipality_id);
                const lcl = safeBigInt(loc.locality_id);
                if (mun && lcl) {
                    await (prisma as any).municipality_locality_narrative.create({
                        data: {
                            narrative_capture_id: narrative.id,
                            municipality_id: mun,
                            locality_id: lcl
                        }
                    });
                }
            }
        }

        logActivity(user, "Captura de Narrativa", "narrative", `Narrativa guardada: ${data.ppa_name || 'Sin título'}`);
        res.json({ message: "Narrativa guardada correctamente", id: narrative.id.toString() });
    } catch (error) {
        console.error("Error guardando narrativa:", error);
        res.status(500).json({ error: "No se pudo guardar la narrativa en la base de datos." });
    }
});

app.put('/api/narratives/:id', authenticateToken, async (req: Request, res: Response) => {
    const { id: narrativeIdParam } = req.params;
    const data = req.body;
    const user = (req as any).user;

    // Helper para BigInt seguro
    const safeBigInt = (val: any) => {
        if (val === undefined || val === null || val === "") return null;
        const n = typeof val === 'string' ? parseInt(val) : val;
        return isNaN(n) ? null : BigInt(n);
    };

    try {
        console.log(`[DEBUG] PUT /api/narratives/${narrativeIdParam} raw body:`, JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        console.log(`[DEBUG] ppa_name: "${data.ppa_name}", new_ppa_name: "${data.new_ppa_name}"`);
        const narrativeId = parseInt(narrativeIdParam as string);

        const narrative = await (prisma as any).narrativeCapture.update({
            where: { id: narrativeId },
            data: {
                ppa_name: data.ppa_name,
                new_ppa_name: data.new_ppa_name || null,
                ppas_type_id: safeBigInt(data.type_id),
                investment_amount: data.investment_amount && data.investment_amount !== "" ? data.investment_amount : null,
                beneficiaries: (data.beneficiaries && data.beneficiaries !== "") ? (parseInt(data.beneficiaries) || 0) : 0,
                narrative_breakdown: data.narrative_breakdown,
                highlighted: data.highlighted,
                narrative_period_id: (parseInt(data.periodo) || 2026) === 2026 ? 5 : 4,
                status: data.status === 'En Validación' ? 'under_validation_semaig' : 'draft',
                dependency_id: user.dependency_id || 1,
                narrative_title_id: safeBigInt(data.title_id),
                narrative_theme_id: safeBigInt(data.theme_id),
                narrative_sub_theme_id: safeBigInt(data.subtheme_id),
                narrative_beneficiary_type_id: safeBigInt(data.beneficiary_type_id),
                budget_program_id: safeBigInt(data.budget_program_id),
                custom_budget_program: data.budget_program_id === 'manual' ? data.custom_budget_program || null : null,
            }
        });

        // Actualizar Vinculación PED (borrar y recrear)
        if (data.peds && Array.isArray(data.peds)) {
            await (prisma as any).miss_obj_stra_act_narrative.deleteMany({
                where: { narrative_capture_id: BigInt(narrativeId) }
            });

            for (const ped of data.peds) {
                const m = safeBigInt(ped.mission_id);
                const o = safeBigInt(ped.objective_id);
                const s = safeBigInt(ped.strategy_id);
                const a = safeBigInt(ped.action_line_id);

                if (m && o && s && a) {
                    await (prisma as any).miss_obj_stra_act_narrative.create({
                        data: {
                            narrative_capture_id: BigInt(narrativeId),
                            mission_id: m,
                            objective_id: o,
                            narrative_strategy_id: s,
                            action_line_id: a
                        }
                    });
                }
            }
        }

        // Actualizar Ubicaciones (borrar y recrear)
        if (data.locations && Array.isArray(data.locations)) {
            await (prisma as any).municipality_locality_narrative.deleteMany({
                where: { narrative_capture_id: BigInt(narrativeId) }
            });
            for (const loc of data.locations) {
                const mun = safeBigInt(loc.municipality_id);
                const lcl = safeBigInt(loc.locality_id);
                if (mun && lcl) {
                    await (prisma as any).municipality_locality_narrative.create({
                        data: {
                            narrative_capture_id: BigInt(narrativeId),
                            municipality_id: mun,
                            locality_id: lcl
                        }
                    });
                }
            }
        }

        logActivity(user, "Actualización de Narrativa", "narrative", `Narrativa actualizada: ${data.ppa_name || narrativeId}`);
        return res.json({ message: "Narrativa actualizada correctamente", id: narrative.id.toString() });
    } catch (error) {
        console.error("Error actualizando narrativa:", error);
        return res.status(500).json({ error: "No se pudo actualizar la narrativa en la base de datos." });
    }
});


// ══════════════════════════════════════════════════════════════════════
// safin-secont WORKFLOW — Estado y transiciones oficiales
// ══════════════════════════════════════════════════════════════════════

const STATUS_LABELS: Record<string, string> = {
    'draft': 'Borrador',
    'finalized': 'Finalizado (Pendiente safin)',
    'under_validation_semaig': 'En Validación safin',
    'with_observations_semaig': 'Observado por safin',
    'approved_semaig': 'Aprobado por safin',
    'under_validation_secont': 'En Validación secont',
    'with_observations_secont': 'Observado por secont',
    'approved_secont': 'Aprobado por secont',
    'finished': 'Terminado (Cerrado)',
    'historical__in_capture_': 'Histórico en Captura',
    'historical__revised_': 'Histórico Revisado',
};

async function recordStatusHistory(narrativeId: bigint, status: string, observations: string, userId: bigint) {
    try {
        await (prisma as any).narrative_capture_status_histories.create({
            data: {
                narrative_capture_id: narrativeId,
                status,
                observations: observations || '',
                created_by: userId,
                created_at: new Date(),
            }
        });
    } catch (e) {
        console.error('Error registrando historial de estado:', e);
    }
}

async function recordEntityStatusHistory(entityId: bigint, status: string, observations: string, userId: bigint) {
    try {
        await (prisma as any).entity_status_histories.create({
            data: {
                entity_id: entityId,
                status,
                observations: observations || '',
                created_by: userId,
                created_at: new Date(),
            }
        });
    } catch (e) {
        console.error('Error registrando historial de estado de entidad:', e);
    }
}

// ── Bandeja de validación por rol ──────────────────────────────────────
// ── NOTIFICACIONES IN-APP ─────────────────────────────────────────────
app.get('/api/notifications', authenticateToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const limitVal = parseInt((req.query.limit as string) || '50');

        const notifications: any[] = await prisma.$queryRawUnsafe(`
            SELECT * FROM notifications 
            WHERE user_id = ${user.id} 
            ORDER BY created_at DESC 
            LIMIT ${limitVal}
        `);

        // Convertir BigInts a string para JSON
        const result = notifications.map(n => ({
            ...n,
            id: n.id.toString(),
            user_id: n.user_id.toString(),
            narrative_id: n.narrative_id ? n.narrative_id.toString() : null
        }));

        res.json(result);
    } catch (error) {
        console.error("Fetch notifications error:", error);
        res.status(500).json({ error: "Error cargando notificaciones." });
    }
});

app.post('/api/notifications/:id/read', authenticateToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const id = BigInt(String(req.params.id));

        await (prisma as any).$executeRawUnsafe(`
            UPDATE notifications 
            SET read_at = NOW() 
            WHERE id = ${id} AND user_id = ${user.id}
        `);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error marcando notificación como leída." });
    }
});

app.post('/api/notifications/read-all', authenticateToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        await (prisma as any).$executeRawUnsafe(`
            UPDATE notifications 
            SET read_at = NOW() 
            WHERE user_id = ${user.id} AND read_at IS NULL
        `);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error marcando notificaciones como leídas." });
    }
});

// --- ADMIN: GESTIÓN DE CORTES (SNAPSHOTS) ---
app.get('/api/admin/corte-status', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const firstCount: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM narrative_captures_first_final`);
        const secondCount: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM narrative_captures_second_final`);

        // Obtener última fecha de actualización de las tablas finales
        const lastUpdated: any = await prisma.$queryRawUnsafe(`
            SELECT MAX(updated_at) as last_date FROM (
                SELECT created_at as updated_at FROM narrative_captures_first_final
                UNION ALL
                SELECT created_at as updated_at FROM narrative_captures_second_final
            ) as t
        `);

        res.json({
            first_corte: {
                count: Number(firstCount[0]?.count || 0),
                status: Number(firstCount[0]?.count || 0) > 0 ? 'active' : 'empty'
            },
            second_corte: {
                count: Number(secondCount[0]?.count || 0),
                status: Number(secondCount[0]?.count || 0) > 0 ? 'active' : 'empty'
            },
            last_activity: lastUpdated[0]?.last_date
        });
    } catch (error) {
        console.error("Corte status error:", error);
        res.status(500).json({ error: "Error consultando estado de cortes." });
    }
});

app.post('/api/admin/trigger-second-corte', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
        // Ejecutar el volcado de datos: lo aprobado por secont pasa al segundo corte final
        // Esto asume que la estructura de narrative_captures_second_final es idéntica
        const result: any = await prisma.$executeRawUnsafe(`
            INSERT INTO narrative_captures_second_final (
                id, ppa_name, new_ppa_name, ppas_type_id, investment_amount, beneficiaries, 
                narrative_breakdown, narrative_period_id, status, observations, sequence_number, 
                dependency_id, narrative_title_id, narrative_theme_id, narrative_sub_theme_id, 
                narrative_beneficiary_type_id, budget_program_id, created_by, edited_by, deleted_at, created_at, updated_at
            )
            SELECT 
                id, ppa_name, new_ppa_name, ppas_type_id, investment_amount, beneficiaries, 
                narrative_breakdown, narrative_period_id, status, observations, sequence_number, 
                dependency_id, narrative_title_id, narrative_theme_id, narrative_sub_theme_id, 
                narrative_beneficiary_type_id, budget_program_id, created_by, edited_by, deleted_at, NOW(), NOW()
            FROM narrative_captures
            WHERE status IN ('approved secont', 'approved_secont', 'finished')
            ON DUPLICATE KEY UPDATE 
                narrative_breakdown = VALUES(narrative_breakdown),
                updated_at = NOW();
        `);

        // Registrar en bitácora
        await (prisma as any).$executeRawUnsafe(`
            INSERT INTO activity_log (log_name, description, event, causer_id, created_at, updated_at)
            VALUES ('admin', 'Se disparó el proceso manual de 2do Corte Final', 'triggered_corte', ${user.id}, NOW(), NOW())
        `);

        res.json({
            success: true,
            message: `Proceso completado. Registros procesados: ${result}`,
            count: result
        });
    } catch (error: any) {
        console.error("Trigger corte error:", error);
        res.status(500).json({ error: "Error al disparar el 2do corte: " + error.message });
    }
});

// --- DASHBOARD: RESUMEN EJECUTIVO (secont/safin) ---
app.get('/api/dashboard/executive-summary', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req: Request, res: Response) => {
    try {
        const { period } = req.query;
        const currentYear = period ? String(period) : '2026';

        // Mapeo de año -> narrative_period_id
        const periodYearToId: Record<string, number> = {
            '2023': 2, '2024': 3, '2025': 4, '2026': 1, '2027': 5
        };
        const narrativePeriodId = periodYearToId[currentYear] || 1;

        // Query para Narrativas calculada en tiempo real por el período seleccionado
        const ppas = await prisma.narrativeCapture.findMany({
            where: {
                narrative_period_id: narrativePeriodId,
                deleted_at: null
            },
            select: { status: true }
        });

        // Contabilidad manual de estados para Narrativas
        const tot_ppas = ppas.length;
        const pt_safin = ppas.filter(p => ['draft', 'historical__in_capture_'].includes(p.status as string)).length;
        const ev_safin = ppas.filter(p => p.status === 'under_validation_semaig').length;
        const ap_safin = ppas.filter(p => ['approved_semaig', 'under_validation_secont', 'approved_secont', 'finalized'].includes(p.status as string)).length;

        const pt_secont = ppas.filter(p => p.status === 'under_validation_secont').length;
        const ap_secont = ppas.filter(p => ['approved_secont', 'finalized', 'historical__revised_'].includes(p.status as string)).length;
        const ob_safsec = ppas.filter(p => ['with_observations_semaig', 'with_observations_secont'].includes(p.status as string)).length;

        // Query Anexos calculada en tiempo real
        // Asumiendo period_id estadístico (1 = 2025, 3 = 2026) -> Aquí usar proxy por año
        // Esto requeriría join con cat_periods, pero para arreglar rápido el error visual lo dejaremos global
        // y con proxy de año en la DB `period_id`: {year == 2025 ? 1 : 3}
        const statPeriodId = currentYear === '2025' ? 1 : 3;

        const anexos = await prisma.entity.findMany({
            where: {
                period_id: statPeriodId,
                deleted_at: null
            },
            select: { status: true }
        });

        const tot_anx = anexos.length;
        const ap_anx = anexos.filter(e => ['finalized'].includes(e.status)).length;
        const pt_anx = anexos.filter(e => e.status.includes('under_validation')).length;
        const ob_anx = anexos.filter(e => e.status.includes('with_observations')).length;

        const summary = {
            narrativas: {
                total: tot_ppas,
                pendientes_safin: pt_safin,
                en_validacion_safin: ev_safin,
                aprobados_safin: ap_safin,
                pendientes_secont: pt_secont,
                aprobados_secont: ap_secont,
                observados: ob_safsec,
            },
            anexos: {
                total: tot_anx,
                aprobados: ap_anx,
                pendientes: pt_anx,
                observados: ob_anx,
            }
        };

        res.json(summary);
    } catch (error) {
        console.error("Executive summary error:", error);
        res.status(500).json({ error: "Error cargando resumen ejecutivo." });
    }
});

// --- HISTORIAL: CORTES FINALES (Snapshots) ---
app.get('/api/history/snapshots', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req: Request, res: Response) => {
    try {
        const { type, stage } = req.query; // type: 'narrativa' | 'anexo', stage: '1' | '2'
        const suffix = stage === '2' ? '_second_final' : '_first_final';

        if (type === 'narrativa') {
            const table = `narrative_captures${suffix}`;
            // Query directa a la tabla de corte
            const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ${table} ORDER BY id DESC`);

            // Enriquecer con labels básicos para la vista
            const enriched = rows.map(r => ({
                ...r,
                id: r.id.toString(),
                statusLabel: 'Corte Final'
            }));
            return res.json(enriched);
        } else {
            const table = `entities${suffix}`;
            const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ${table} ORDER BY id DESC`);
            return res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
        }
    } catch (error) {
        console.error("Snapshots error:", error);
        res.status(500).json({ error: "Error cargando cortes históricos." });
    }
});

// --- AUDITORÍA: LOG DE ACTIVIDADES ---
app.get('/api/history/activity-logs', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req: Request, res: Response) => {
    try {
        const limitVal = parseInt((req.query.limit as string) || '100');
        // activity_log is a Spatie/Laravel log table — use raw SQL to join with users
        const logs: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
                al.id,
                al.log_name,
                al.description,
                al.event,
                al.subject_type,
                al.subject_id,
                al.causer_id,
                al.properties,
                al.created_at,
                u.name as user_name,
                u.email as user_email
            FROM activity_log al
            LEFT JOIN users u ON u.id = al.causer_id
            ORDER BY al.created_at DESC
            LIMIT ${limitVal}
        `);

        const result = logs.map(l => ({
            ...l,
            id: l.id?.toString(),
            causer_id: l.causer_id?.toString(),
            subject_id: l.subject_id?.toString(),
            user: { name: l.user_name, email: l.user_email }
        }));

        res.json(result);
    } catch (error) {
        console.error("Activity logs error:", error);
        res.status(500).json({ error: "Error cargando bitácora de auditoría." });
    }
});

app.get('/api/narratives/inbox', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const pStr = (req.query.periodo as string) || '2026';
    const selectedPeriod = parseInt(pStr) || 2026;
    const periodId = selectedPeriod === 2026 ? 5 : 4;
    const isSafin = user?.roles?.some((r: string) => ['safin', 'admin', 'super_admin'].includes(r.toLowerCase()));
    const isSecont = user?.roles?.some((r: string) => ['secont', 'validador'].includes(r.toLowerCase()));
    const isAdmin = user?.roles?.some((r: string) => ['super_admin', 'admin'].includes(r.toLowerCase()));

    const tab = (req.query.tab as string) || 'pending';
    let statusFilter: string[] = [];
    if (isAdmin) {
        statusFilter = ['draft', 'finalized', 'under_validation_semaig', 'with_observations_semaig', 'approved_semaig', 'under_validation_secont', 'with_observations_secont', 'approved_secont', 'finished'];
    } else if (isSafin) {
        statusFilter = tab === 'approved' ? ['finalized', 'approved_semaig', 'under_validation_secont', 'approved_secont'] : ['under_validation_semaig', 'with_observations_semaig'];
    } else if (isSecont) {
        statusFilter = tab === 'approved' ? ['approved_secont', 'finished'] : ['finalized', 'under_validation_secont', 'with_observations_secont'];
    }
    try {
        const narratives = await (prisma as any).narrativeCapture.findMany({
            where: { narrative_period_id: periodId, status: { in: statusFilter }, deleted_at: null },
            include: { dependency: true, cat_narrative_titles: true, cat_ppas_types: true, cat_narrative_periods: true },
            orderBy: { updated_at: 'desc' },
            take: 50,
        });
        res.json(narratives.map((n: any) => ({
            id: n.id.toString(),
            ppa_name: n.ppa_name,
            sequence_number: n.sequence_number,
            status: n.status,
            statusLabel: STATUS_LABELS[n.status] || n.status,
            dependency: n.dependency?.name || '',
            title: n.cat_narrative_titles?.name || '',
            type: n.cat_ppas_types?.name || '',
            period: n.cat_narrative_periods?.name || '',
            updated_at: n.updated_at,
        })));
    } catch (err) {
        console.error('Error inbox:', err);
        res.status(500).json({ error: 'Error al obtener la bandeja.' });
    }
});

// ── Transición 1: capturista envía a safin ────────────────────────────
app.post('/api/narratives/:id/submit', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    fs.appendFileSync('./debug_notify.log', `[${new Date().toISOString()}] POST /api/narratives/${id}/submit called by ${user.email}\n`);
    try {
        const narrative = await (prisma as any).narrativeCapture.findUnique({ where: { id } });
        if (!narrative) return res.status(404).json({ error: 'Narrativa no encontrada.' });
        const allowed = ['draft', 'with_observations_semaig', 'with_observations_secont'];
        if (!allowed.includes(narrative.status)) {
            return res.status(400).json({ error: `No se puede enviar desde su estado actual (${STATUS_LABELS[narrative.status] || narrative.status}).` });
        }
        const newStatus = 'under_validation_semaig';
        await (prisma as any).narrativeCapture.update({
            where: { id },
            data: { status: newStatus, edited_by: BigInt(user.id), updated_at: new Date() }
        });
        await recordStatusHistory(id, newStatus, 'Enviado a safin para validación.', BigInt(user.id));

        // Notify safin
        notifyStatusChange(id, newStatus);

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] });
    } catch (err: any) {
        console.error('Error submit:', err);
        res.status(500).json({ error: 'Error al enviar la narrativa.' });
    }
});

// ── Transición 2: safin aprueba → Finalizado ──────────────────────────
app.post('/api/narratives/:id/approve-safin', authenticateToken, authorize(['safin', 'admin', 'super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = user.id >= 700 || user.id === 105 ? null : BigInt(user.id);
    try {
        const newStatus = 'finalized';
        await (prisma as any).narrativeCapture.update({
            where: { id },
            data: { status: newStatus, observations, edited_by: editorId, updated_at: new Date() }
        });
        await recordStatusHistory(id, newStatus, observations || 'Aprobado por safin. Listo para secont.', editorId || BigInt(1));

        // Notify capturista
        notifyStatusChange(id, newStatus, observations);

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] });
    } catch (err) {
        res.status(500).json({ error: 'Error al aprobar en safin.' });
    }
});

// ── Transición 3: safin devuelve con observaciones ─────────────────────
app.post('/api/narratives/:id/observe-safin', authenticateToken, authorize(['safin', 'admin', 'super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = user.id >= 700 || user.id === 105 ? null : BigInt(user.id);
    if (!observations) return res.status(400).json({ error: 'Las observaciones son obligatorias para devolver.' });
    try {
        const newStatus = 'with_observations_semaig';
        await (prisma as any).narrativeCapture.update({
            where: { id },
            data: { status: newStatus, observations, edited_by: editorId, updated_at: new Date() }
        });
        await recordStatusHistory(id, newStatus, observations, editorId || BigInt(1));

        // Notify capturista
        notifyStatusChange(id, newStatus, observations);

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] });
    } catch (err) {
        console.error('Error al registrar observaciones safin:', err);
        res.status(500).json({ error: 'Error al registrar observaciones safin.' });
    }
});

// ── Transición 4: safin envía a secont ────────────────────────────────
app.post('/api/narratives/:id/send-to-secont', authenticateToken, authorize(['safin', 'admin', 'super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const editorId = user.id >= 700 || user.id === 105 ? null : BigInt(user.id);
    try {
        const narrative = await (prisma as any).narrativeCapture.findUnique({ where: { id } });
        if (!narrative) return res.status(404).json({ error: 'Narrativa no encontrada.' });
        if (narrative.status !== 'finalized') {
            return res.status(400).json({ error: 'Solo narrativas Finalizadas (safin) pueden enviarse a secont.' });
        }
        const newStatus = 'under_validation_secont';
        await (prisma as any).narrativeCapture.update({
            where: { id },
            data: { status: newStatus, edited_by: editorId, updated_at: new Date() }
        });
        await recordStatusHistory(id, newStatus, 'Enviado a secont para validación final.', editorId || BigInt(1));

        // Notify secont
        notifyStatusChange(id, newStatus);

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] });
    } catch (err) {
        res.status(500).json({ error: 'Error al enviar a secont.' });
    }
});

// ── Transición 5: secont aprueba ──────────────────────────────────────
app.post('/api/narratives/:id/approve-secont', authenticateToken, authorize(['secont', 'validador', 'admin', 'super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = (Number(user.id) >= 700 || Number(user.id) === 105) ? null : BigInt(user.id);
    try {
        const newStatus = 'approved_secont';
        await (prisma as any).$executeRaw`
            UPDATE narrative_captures 
            SET status = 'approved secont', observations = ${observations}, edited_by = ${editorId}, updated_at = NOW() 
            WHERE id = ${id}
        `;
        await recordStatusHistory(id, newStatus, observations || 'Aprobado por secont.', editorId || BigInt(1));

        // Notify capturista
        notifyStatusChange(id, newStatus, observations);

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] });
    } catch (err: any) {
        console.error("Error in approve-secont (narrative):", err);
        res.status(500).json({ error: 'Error al aprobar en secont: ' + err.message });
    }
});

// ── Transición 6: secont devuelve con observaciones ───────────────────
app.post('/api/narratives/:id/observe-secont', authenticateToken, authorize(['secont', 'validador', 'admin', 'super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = (Number(user.id) >= 700 || Number(user.id) === 105) ? null : BigInt(user.id);
    if (!observations) return res.status(400).json({ error: 'Las observaciones son obligatorias para devolver.' });
    try {
        const newStatus = 'with_observations_secont';
        await (prisma as any).$executeRaw`
            UPDATE narrative_captures 
            SET status = 'with observations secont', observations = ${observations}, edited_by = ${editorId}, updated_at = NOW() 
            WHERE id = ${id}
        `;
        await recordStatusHistory(id, newStatus, observations, editorId || BigInt(1));

        // Notify capturista
        notifyStatusChange(id, newStatus, observations);

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] });
    } catch (err: any) {
        console.error("Error in observe-secont (narrative):", err);
        res.status(500).json({ error: 'Error al registrar observaciones secont: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════
// safin-secont WORKFLOW (ESTADÍSTICA) — Estado y transiciones
// ══════════════════════════════════════════════════════════════════════

app.post('/api/entities/:id/approve-safin', authenticateToken, authorize(['safin', 'admin', 'super_admin', 'validador']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = user.id >= 700 || user.id === 105 ? null : BigInt(user.id);
    try {
        const newStatus = 'approved_semaig';
        await (prisma as any).entity.update({
            where: { id },
            data: { status: newStatus, edited_by: editorId, updated_at: new Date() }
        });
        await recordEntityStatusHistory(id, newStatus, observations || 'Aprobado por safin. Listo para secont.', editorId || BigInt(1));

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] || newStatus });
    } catch (err) {
        res.status(500).json({ error: 'Error al aprobar en safin.' });
    }
});

app.post('/api/entities/:id/observe-safin', authenticateToken, authorize(['safin', 'admin', 'super_admin', 'validador']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = user.id >= 700 || user.id === 105 ? null : BigInt(user.id);
    if (!observations) return res.status(400).json({ error: 'Las observaciones son obligatorias para devolver.' });
    try {
        const newStatus = 'with_observations_semaig';
        await (prisma as any).entity.update({
            where: { id },
            data: { status: newStatus, edited_by: editorId, updated_at: new Date() }
        });
        await recordEntityStatusHistory(id, newStatus, observations, editorId || BigInt(1));

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] || newStatus });
    } catch (err) {
        res.status(500).json({ error: 'Error al registrar observaciones safin.' });
    }
});

app.post('/api/entities/:id/approve-secont', authenticateToken, authorize(['secont', 'validador', 'admin', 'super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = (Number(user.id) >= 700 || Number(user.id) === 105) ? null : BigInt(user.id);
    try {
        const newStatus = 'approved_secont';
        await (prisma as any).$executeRaw`
            UPDATE entities 
            SET status = 'approved secont', edited_by = ${editorId}, updated_at = NOW() 
            WHERE id = ${id}
        `;
        await recordEntityStatusHistory(id, newStatus, observations || 'Aprobado por secont.', editorId || BigInt(1));

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] || newStatus });
    } catch (err: any) {
        console.error("Error in approve-secont (entity):", err);
        res.status(500).json({ error: 'Error al aprobar en secont: ' + err.message });
    }
});

app.post('/api/entities/:id/observe-secont', authenticateToken, authorize(['secont', 'validador', 'admin', 'super_admin']), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const id = BigInt(String(req.params.id));
    const { observations } = req.body;
    const editorId = (Number(user.id) >= 700 || Number(user.id) === 105) ? null : BigInt(user.id);
    if (!observations) return res.status(400).json({ error: 'Las observaciones son obligatorias para devolver.' });
    try {
        const newStatus = 'with_observations_secont';
        await (prisma as any).$executeRaw`
            UPDATE entities 
            SET status = 'with observations secont', edited_by = ${editorId}, updated_at = NOW() 
            WHERE id = ${id}
        `;
        await recordEntityStatusHistory(id, newStatus, observations, editorId || BigInt(1));

        res.json({ success: true, status: newStatus, statusLabel: STATUS_LABELS[newStatus] || newStatus });
    } catch (err: any) {
        console.error("Error in observe-secont (entity):", err);
        res.status(500).json({ error: 'Error al registrar observaciones secont: ' + err.message });
    }
});

// ── Historial de estados de una narrativa ─────────────────────────────
app.get('/api/narratives/:id/history', authenticateToken, async (req: Request, res: Response) => {
    const id = BigInt(String(req.params.id));
    try {
        const history = await (prisma as any).narrative_capture_status_histories.findMany({
            where: { narrative_capture_id: id },
            include: { users: { select: { name: true, email: true } } },
            orderBy: { created_at: 'desc' },
        });
        res.json(history.map((h: any) => ({
            id: h.id.toString(),
            status: h.status,
            statusLabel: STATUS_LABELS[h.status] || h.status,
            observations: h.observations,
            createdAt: h.created_at,
            createdBy: h.users?.name || h.users?.email || 'Sistema',
        })));
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener el historial.' });
    }
});

app.get('/api/narratives/my-captures', authenticateToken, async (req: Request, res: Response) => {

    try {
        const user = (req as any).user;
        const pStr = (req.query.periodo as string) || "2026";
        const selectedPeriod = parseInt(pStr) || 2026;

        if (!user || (!user.roles.includes('capturista') && !user.roles.includes('admin'))) {
            return res.status(403).json({ error: "No tienes permisos para ver esta sección." });
        }

        // --- 1. MySQL records ---
        let mysqlCaptures: any[] = [];
        try {
            const captures = await (prisma as any).narrativeCapture.findMany({
                where: {
                    dependency_id: user.dependency_id,
                    narrative_period_id: selectedPeriod === 2026 ? 5 : 4
                },
                include: {
                    cat_narrative_titles: true,
                    cat_narrative_themes: true,
                    cat_narrative_sub_themes: true
                },
                orderBy: { updated_at: 'desc' }
            });
            mysqlCaptures = captures.map((c: any) => ({
                ...c,
                id: c.id.toString(),
                dependency_id: c.dependency_id ? c.dependency_id.toString() : null,
                budget_program_id: c.budget_program_id ? c.budget_program_id.toString() : null,
                origin: 'mysql'
            }));
        } catch (dbErr) {
            console.warn("DB offline, skipping MySQL captures.");
        }

        res.json(mysqlCaptures);
    } catch (error) {
        console.error("Error fetching my captures:", error);
        res.status(500).json({ error: "Error al obtener el historial de capturas." });
    }
});

app.post('/api/ai/optimize', authenticateToken, async (req: Request, res: Response) => {
    const { text } = req.body;

    if (!text || text.length < 10) {
        return res.status(400).json({ error: "El texto es demasiado corto para optimizar." });
    }

    // --- Uso REAL de Google Gemini ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "No se encontro GEMINI_API_KEY en el backend. Por favor configura tu llave en el archivo .env" });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const systemPrompt = `
Eres un redactor experto gubernamental especializado en la revisión y pulido de informes para el Plan Estatal de Desarrollo.
Tu objetivo es tomar los borradores de los capturistas ("Servidores Públicos") y reescribirlos en un párrafo fluido, coherente y sumamente profesional.
Instrucciones obligatorias:
1. Mejora la terminología (ej. "hicimos" -> "se ejecutó", "compramos" -> "se adquirió").
2. Corrige errores gramaticales y enriquece el léxico cívico.
3. Inicia siempre el texto reformulado con la frase: "En cumplimiento con los objetivos del Plan Estatal de Desarrollo..." o algo muy similar y natural.
4. SOLO devuelve el texto mejorado, sin introducciones ni comentarios explicativos. No uses negritas (markdown) ni títulos, devuelve texto plano limpio.
Texto original del usuario:
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n"${text}"`,
        });

        let optimized = response.text || text;

        // Remove markdown bold artifacts if generated
        optimized = optimized.replace(/\*\*/g, "").trim();

        res.json({ optimizedText: optimized });

    } catch (err: any) {
        console.error("Gemini Error:", err);
        res.status(500).json({ error: "Hubo un fallo de comunicación con la Inteligencia Artificial de Google Gemini." });
    }
});

// --- EXPORTACIÓN A WORD ---

app.get('/api/export/word/narrative/:id', authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    try {
        logActivity(user, "Reporte Word (Narrativa Individual)", "word", `Se exportó la narrativa ID: ${id}`);

        const capture = await (prisma as any).narrativeCapture.findUnique({
            where: { id: parseInt(id as string) },
            include: { cat_narrative_titles: true, cat_narrative_themes: true, cat_narrative_sub_themes: true }
        });

        if (!capture) {
            return res.status(404).json({ error: "Narrativa no encontrada" });
        }

        const wordTitleName = capture.cat_narrative_titles?.name || "Eje Rector";
        const wordThemeName = capture.cat_narrative_themes?.name || "Tema";
        const wordSubthemeName = capture.cat_narrative_sub_themes?.name || "Subtema";
        const wordTitleCode = capture.cat_narrative_titles?.code != null ? String(capture.cat_narrative_titles.code) : `${capture.narrative_title_id || '1'}`;
        const wordThemeCode = capture.cat_narrative_themes?.code != null ? String(capture.cat_narrative_themes.code) : `${capture.narrative_theme_id || '1.1'}`;
        const wordSubthemeCode = capture.cat_narrative_sub_themes?.code != null ? String(capture.cat_narrative_sub_themes.code) : `${capture.narrative_sub_theme_id || '1.1.1'}`;


        const items = [{
            title_code: wordTitleCode,
            title_name: wordTitleName,
            theme_code: wordThemeCode,
            theme_name: wordThemeName,
            subtheme_code: wordSubthemeCode,
            subtheme_name: wordSubthemeName,
            content: capture.narrative_breakdown || "Sin contenido.",
            highlighted: capture.highlighted || ""
        }];

        const exportData = {
            mission_name: capture.ppa_name || "Narrativa Institucional",
            title_color: "#1E293B",
            theme_color: "#475569",
            subtheme_color: "#64748B",
            items: items
        };

        const pythonRes = await axios.post('http://localhost:8000/export/word', exportData, {
            responseType: 'arraybuffer'
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=Narrativa_${id}.docx`);
        res.send(Buffer.from(pythonRes.data));

    } catch (error: any) {
        console.error("Export error:", error?.response?.data || error.message || error);
        res.status(500).json({ error: "No se pudo generar el documento Word." });
    }
});

app.get('/api/export/pdf/narrative/:id', authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    try {
        logActivity(user, "Reporte PDF (Narrativa Individual)", "pdf", `Se exportó la narrativa ID: ${id}`);

        const capture = await (prisma as any).narrativeCapture.findUnique({
            where: { id: parseInt(id as string) },
            include: { cat_narrative_titles: true, cat_narrative_themes: true, cat_narrative_sub_themes: true }
        });

        if (!capture) {
            return res.status(404).json({ error: "Narrativa no encontrada" });
        }

        const missionName = capture.ppa_name || "Narrativa Institucional";

        // Usar relaciones incluidas por Prisma directamente
        const titleName = capture.cat_narrative_titles?.name || "Eje Rector";
        const themeName = capture.cat_narrative_themes?.name || "Tema";
        const subthemeName = capture.cat_narrative_sub_themes?.name || "Subtema";
        const titleCode = capture.cat_narrative_titles?.code || `${capture.narrative_title_id || '1'}`;
        const themeCode = capture.cat_narrative_themes?.code || `${capture.narrative_theme_id || '1.1'}`;
        const subthemeCode = capture.cat_narrative_sub_themes?.code || `${capture.narrative_sub_theme_id || '1.1.1'}`;

        const items = [{
            title_code: titleCode,
            title_name: titleName,
            theme_code: themeCode,
            theme_name: themeName,
            subtheme_code: subthemeCode,
            subtheme_name: subthemeName,
            content: capture.narrative_breakdown || "Sin contenido.",
            highlighted: capture.highlighted || ""
        }];

        const exportData = {
            mission_name: missionName,
            title_color: "#1E293B",
            theme_color: "#475569",
            subtheme_color: "#64748B",
            items: items
        };

        const pythonRes = await axios.post('http://localhost:8000/export/pdf', exportData, {
            responseType: 'arraybuffer'
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Narrativa_${id}.pdf`);
        res.send(Buffer.from(pythonRes.data));

    } catch (error: any) {
        console.error("Export error:", error?.response?.data || error.message || error);
        res.status(500).json({ error: "No se pudo generar el documento PDF." });
    }
});

app.get('/api/export/word/:missionId', authenticateToken, async (req: Request, res: Response) => {
    const { missionId } = req.params;
    const user = (req as any).user;
    try {
        logActivity(user, "Reporte Word (Misión)", "word", `Se exportó la narrativa para la Misión ID: ${missionId}`);
        let captures: any[] = [];
        let missionName = "Misión Institucional";
        const mId = parseInt(missionId as string) || 0;
        const pStr = (req.query.periodo as string) || "2026";

        try {
            const narrativePeriodId = (parseInt(pStr) || 2026) === 2026 ? 5 : 4;
            captures = await (prisma as any).narrativeCapture.findMany({
                where: {
                    miss_obj_stra_act_narrative: {
                        some: { mission_id: BigInt(mId) }
                    },
                    narrative_period_id: narrativePeriodId,
                    deleted_at: null
                },
                include: {
                    dependency: true,
                    cat_narrative_titles: true,
                    cat_narrative_themes: true,
                    cat_narrative_sub_themes: true
                }
            });
            if (captures.length > 0) missionName = `Misión ID: ${mId} (${pStr})`;
        } catch (dbError) {
            console.warn("DB unreachable for export, using simulated real-data...");
        }

        // 2. Si no hay datos de DB, retornar vacío directamente sin localData
        if (captures.length === 0) {
            missionName = `Sin capturas para misión ID: ${mId}`;
        }

        // 3. Mapear a la estructura que espera el Doc-Engine usando relaciones Prisma
        const items = captures.map((cap: any) => ({
            title_code: String(cap.cat_narrative_titles?.code || cap.narrative_title_id || '1'),
            title_name: cap.cat_narrative_titles?.name || "Eje Rector",
            theme_code: String(cap.cat_narrative_themes?.code || cap.narrative_theme_id || '1.1'),
            theme_name: cap.cat_narrative_themes?.name || "Tema",
            subtheme_code: String(cap.cat_narrative_sub_themes?.code || cap.narrative_sub_theme_id || '1.1.1'),
            subtheme_name: cap.cat_narrative_sub_themes?.name || "Subtema",
            content: cap.narrative_breakdown || "Sin contenido.",
            highlighted: cap.highlighted || ""
        }));

        // Ordenamiento secuencial requerido: Título (Eje) -> Tema -> Subtema
        items.sort((a: any, b: any) => {
            const cmpTitle = String(a.title_code).localeCompare(String(b.title_code), undefined, { numeric: true });
            if (cmpTitle !== 0) return cmpTitle;
            const cmpTheme = String(a.theme_code).localeCompare(String(b.theme_code), undefined, { numeric: true });
            if (cmpTheme !== 0) return cmpTheme;
            return String(a.subtheme_code).localeCompare(String(b.subtheme_code), undefined, { numeric: true });
        });

        const exportData = {
            mission_name: missionName,
            title_color: "#1E293B",
            theme_color: "#475569",
            subtheme_color: "#64748B",
            items: items.length > 0 ? items : [{
                title_code: "1",
                title_name: "General",
                theme_code: "1",
                theme_name: "Sin Datos",
                subtheme_code: "1.1",
                subtheme_name: "Resultados Previos",
                content: "No hay reportes narrativos registrados en el sistema para esta misión.",
                highlighted: "Sin observaciones relevantes."
            }]
        };

        // 4. Llamar al Doc-Engine (Python)
        const pythonRes = await axios.post('http://localhost:8000/export/word', exportData, {
            responseType: 'arraybuffer'
        });

        // 4. Enviar el archivo Word al cliente
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=Informe_Mision_${missionId}.docx`);
        res.send(Buffer.from(pythonRes.data));

    } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ error: "No se pudo generar el documento Word. Asegúrate de que el Doc-Engine (Python) esté corriendo en el puerto 8000." });
    }
});

// --- EXPORTACIÓN A EXCEL (PROFESIONAL) ---
app.get('/api/export/excel/:entityId', authenticateToken, async (req: Request, res: Response) => {
    const { entityId } = req.params;
    const periodo = parseInt((req.query.periodo as string) || "2026");
    const user = (req as any).user;

    try {
        // XLSX está importado globalmente como require_cjs('xlsx')
        // 1. Obtener entidad con sus propiedades reales
        let entity: any = null;
        let properties: any[] = [];
        let entries: any[] = [];

        if (isDbOnline) {
            entity = await (prisma as any).entity.findUnique({
                where: { id: BigInt(entityId as string) },
                include: {
                    properties: { orderBy: { id: 'asc' } },
                    dependency: true
                }
            });

            if (entity) {
                properties = entity.properties || [];

                // Buscar entradas del periodo
                const periodRecord = await (prisma as any).cat_periods.findFirst({
                    where: { name: periodo.toString() }
                });

                if (periodRecord) {
                    entries = await (prisma as any).entry.findMany({
                        where: {
                            entity_id: BigInt(entityId as string),
                            period_id: periodRecord.id
                        },
                        include: { values: true }
                    });
                }
            }
        }

        if (!entity) {
            return res.status(404).json({ error: 'Entidad no encontrada' });
        }

        const entityName = String(entity.name || `Entidad_${entityId}`);
        const source = entity.source || null;
        const notes = entity.notes || null;

        // 2. Convertir entries DB al formato de filas (property_id → valor)
        const dataRows: any[][] = [];

        if (entries.length > 0) {
            for (const entry of entries) {
                const row: any[] = properties.map((prop: any) => {
                    const val = entry.values?.find((v: any) =>
                        v.property_id.toString() === prop.id.toString()
                    );
                    const rawValue = val?.value || '';

                    // Formato igual que Laravel: números con separadores
                    if (rawValue && prop.column_type === 'integer') {
                        const n = parseInt(rawValue);
                        return isNaN(n) ? rawValue : n.toLocaleString('es-MX');
                    } else if (rawValue && prop.column_type === 'decimal') {
                        const f = parseFloat(rawValue);
                        return isNaN(f) ? rawValue : f.toLocaleString('es-MX', { minimumFractionDigits: 2 });
                    }
                    return rawValue;
                });
                dataRows.push(row);
            }
        } else {
            // Fila vacía si no hay datos aún (plantilla)
            dataRows.push(properties.map(() => ''));
        }

        // 3. Construir el Excel con ExcelJS (soporta logo + estilos completos)
        const headerRow = properties.map((p: any) => p.column_name || p.name);
        const colCount = headerRow.length;
        const headerOffset = 5; // Filas del encabezado (logo + título + entidad + fecha + espacio)

        const wb2 = new ExcelJS.Workbook();
        wb2.creator = 'SEPLAN Campeche';
        wb2.created = new Date();
        const ws2 = wb2.addWorksheet('Datos', { views: [{ showGridLines: false }] });

        // ── Anchos de columna ────────────────────────────────────
        ws2.columns = [
            { width: 8 },  // col A (reservada para logo)
            ...headerRow.map((h: string) => ({ width: Math.max(18, Math.min(42, (h?.length || 14) + 4)) }))
        ];

        // ── LOGO (col A, filas 1-3) ──────────────────────────────
        const logoPath = path.join(__dirname, '../../public/images/logo_semaig.png');
        if (fs.existsSync(logoPath)) {
            const logoId = wb2.addImage({ filename: logoPath, extension: 'png' });
            ws2.addImage(logoId, {
                tl: { col: 0.15, row: 0.15 } as any,
                br: { col: 1.0, row: 3.0 } as any,
                editAs: 'oneCell'
            });
        }

        // ── ENCABEZADO FORMAL ─────────────────────────────────────
        // Fila 1: Fondo institucional (borgoña), solo color — el logo va encima
        for (let r = 1; r <= 4; r++) {
            const row = ws2.getRow(r);
            row.height = r === 2 ? 38 : 20;
            for (let c = 1; c <= colCount + 1; c++) {
                row.getCell(c).fill = {
                    type: 'pattern', pattern: 'solid',
                    fgColor: { argb: 'FF7B1F3A' }
                };
            }
        }

        // Fila 2 col B: Título grande
        const titleCell2 = ws2.getRow(2).getCell(2);
        ws2.mergeCells(2, 2, 2, colCount + 1);
        titleCell2.value = `Reporte Oficial: ${entityName}`;
        titleCell2.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        titleCell2.alignment = { vertical: 'middle', horizontal: 'left' };

        // Fila 3 col B: Entidad
        const entidadCell = ws2.getRow(3).getCell(2);
        ws2.mergeCells(3, 2, 3, colCount + 1);
        entidadCell.value = `Entidad: ${entityName}`;
        entidadCell.font = { size: 10, color: { argb: 'FFDDBBCC' }, name: 'Calibri' };
        entidadCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Fila 4 col B: Fecha
        const fechaCell = ws2.getRow(4).getCell(2);
        ws2.mergeCells(4, 2, 4, colCount + 1);
        const ahora = new Date().toLocaleDateString('es-MX', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        fechaCell.value = `Fecha de Generación: ${ahora}`;
        fechaCell.font = { size: 9, italic: true, color: { argb: 'FFDDBBCC' }, name: 'Calibri' };
        fechaCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Fila 5: Espacio / separador
        ws2.getRow(5).height = 6;

        // ── FILA DE ENCABEZADOS DE TABLA ─────────────────────────
        const hdrRow2 = ws2.getRow(headerOffset + 1);
        hdrRow2.height = 26;
        headerRow.forEach((name: string, i: number) => {
            const cell = hdrRow2.getCell(i + 2);  // offset +2 (col A reservada para logo)
            cell.value = name;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D2D2D' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF444444' } },
                bottom: { style: 'medium', color: { argb: 'FF7B1F3A' } },
                left: { style: 'thin', color: { argb: 'FF444444' } },
                right: { style: 'thin', color: { argb: 'FF444444' } },
            };
        });
        // Celda A en la fila de encabezado (gris oscuro también)
        const aHdr = hdrRow2.getCell(1);
        aHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D2D2D' } };

        // ── FILAS DE DATOS ────────────────────────────────────────
        dataRows.forEach((row: any[], rowIdx: number) => {
            const exRow = ws2.getRow(headerOffset + 2 + rowIdx);
            exRow.height = 18;
            const bgArgb = rowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8F0F3';

            // col A (vacía pero con fondo)
            exRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };

            row.forEach((val: any, colIdx: number) => {
                const cell = exRow.getCell(colIdx + 2);
                cell.value = val ?? '';
                cell.font = { size: 10, name: 'Calibri' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                };
            });
        });

        // ── FOOTER (Fuente / Notas) ───────────────────────────────
        let nextRow = headerOffset + 2 + dataRows.length;
        if (source) {
            const fRow2 = ws2.getRow(nextRow);
            fRow2.height = 16;
            ws2.mergeCells(nextRow, 1, nextRow, colCount + 1);
            const fc = fRow2.getCell(1);
            fc.value = `Fuente: ${source}`;
            fc.font = { italic: true, size: 9, color: { argb: 'FF555555' }, name: 'Calibri' };
            fc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            fc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            fc.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
            nextRow++;
        }
        if (notes) {
            const nRow = ws2.getRow(nextRow);
            nRow.height = 16;
            ws2.mergeCells(nextRow, 1, nextRow, colCount + 1);
            const nc = nRow.getCell(1);
            nc.value = notes;
            nc.font = { italic: true, size: 9, color: { argb: 'FF555555' }, name: 'Calibri' };
            nc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            nc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }

        // ── ENVIAR COMO DESCARGA ──────────────────────────────────
        const fileName = `Anexo_${entityName.substring(0, 40).replace(/[\s\/\\:*?"<>|]/g, '_')}_${periodo}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await wb2.xlsx.write(res);
        res.end();

        logActivity(user, "Exportación Excel", "excel", `Descargó Anexo: "${entityName.substring(0, 50)}" del periodo ${periodo}`);

    } catch (error: any) {
        console.error("Excel export error:", error);
        res.status(500).json({ error: `Error al generar el Excel: ${error.message}` });
    }
});


// --- REQUERIMIENTOS AVANZADOS: FASE 4 (MÓDULO DE USUARIOS Y PERMISOS FINOS) ---
app.get('/api/tracking/observations/count', authenticateToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const selectedPeriod = parseInt((req.query.periodo as string) || "2026");

        // Use raw SQL to get accurate count regardless of Prisma introspection issues
        const result: any[] = await (prisma as any).$queryRawUnsafe(`
            SELECT COUNT(*) as count 
            FROM narrative_captures 
            WHERE dependency_id = ? 
              AND status = 'Observado'
              AND narrative_period_id = (SELECT id FROM cat_narrative_periods WHERE year = ? LIMIT 1)
              AND deleted_at IS NULL
        `, user.dependency_id || 0, selectedPeriod);

        const count = result.length > 0 ? Number(result[0].count) : 0;

        res.json({ count });
    } catch (error) {
        console.error("Error fetching observations count:", error);
        res.status(500).json({ error: "No se pudo obtener el conteo de observaciones." });
    }
});

app.get('/api/users', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const users = await (prisma as any).user.findMany({
            where: { deleted_at: null },
            include: {
                dependency: true,
                cat_profiles: true
            }
        });

        const cleanUsers = users.map((u: any) => {
            const { password, ...userWithoutPassword } = u;
            // Derivamos el array de roles del nombre del perfil para compatibilidad con el frontend
            const roles = u.cat_profiles ? [u.cat_profiles.name] : ['Capturista'];

            return {
                ...userWithoutPassword,
                roles,
                dependency: u.dependency?.name || 'Sin asignar',
                status: u.is_active ? 'Activo' : 'Suspendido'
            };
        });

        res.json(cleanUsers);
    } catch (error) {
        console.error("Fetch users error:", error);
        res.status(500).json({ error: "Error al obtener usuarios desde la base de datos." });
    }
});

app.post('/api/users', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const validatedData = UserSchema.parse(req.body);
        const { name, email, password, roles, dependency_id, status } = validatedData;

        const existingUser = await (prisma as any).user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "El email ya está registrado." });
        }

        const hashedPassword = await bcrypt.hash(password || 'seplan123', 10);

        // Mapeo Simple de Roles a profile_id
        // SuperAdministrador: 7, Capturista: 1, Validador: 12
        let profileId = BigInt(1); // Default Capturista
        const primaryRole = roles?.[0]?.toLowerCase() || '';

        if (primaryRole.includes('admin') || primaryRole.includes('super')) profileId = BigInt(7);
        else if (primaryRole.includes('validador')) profileId = BigInt(12);
        else if (primaryRole.includes('secont')) profileId = BigInt(4);
        else if (primaryRole.includes('safin')) profileId = BigInt(5);

        const newUser = await (prisma as any).user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                dependency_id: BigInt(dependency_id),
                profile_id: profileId,
                is_active: status === 'Activo'
            }
        });

        logActivity((req as any).user, "Usuario Creado", "user_admin", `Se creó el usuario ${name} con perfil ID ${profileId}`);
        res.json({ id: newUser.id.toString(), name: newUser.name, email: newUser.email });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Datos de usuario inválidos", details: error.issues });
        }
        console.error("User creation error:", error);
        res.status(500).json({ error: "Error creando usuario en la base de datos." });
    }
});

app.put('/api/users/:id', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const userId = BigInt(req.params.id as string);
        const { name, email, roles, dependency_id, status } = req.body;

        const updateData: any = {
            name,
            email
        };

        if (dependency_id) updateData.dependency_id = BigInt(dependency_id);
        if (status) updateData.is_active = status === 'Activo';

        // Mapeo de Roles a profile_id para Edición
        if (roles && roles.length > 0) {
            let profileId = BigInt(1);
            const primaryRole = roles[0].toLowerCase();
            if (primaryRole.includes('admin') || primaryRole.includes('super')) profileId = BigInt(7);
            else if (primaryRole.includes('validador')) profileId = BigInt(12);
            else if (primaryRole.includes('secont')) profileId = BigInt(4);
            else if (primaryRole.includes('safin')) profileId = BigInt(5);

            updateData.profile_id = profileId;
        }

        const updatedUser = await (prisma as any).user.update({
            where: { id: userId },
            data: updateData
        });

        logActivity((req as any).user, "Usuario Editado", "user_admin", `Se modificó configuración de ${name}`);
        res.json({ id: updatedUser.id.toString(), name: updatedUser.name });
    } catch (error) {
        console.error("User update error:", error);
        res.status(500).json({ error: "Error actualizando usuario en la base de datos." });
    }
});

// PATCH alias — el frontend usa PATCH para cambio de estatus
app.patch('/api/users/:id/status', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const userId = BigInt(req.params.id as string);
        const { status } = req.body; // 'Activo' | 'Suspendido'
        const is_active = status === 'Activo';

        const user = await (prisma as any).user.update({
            where: { id: userId },
            data: { is_active }
        });

        logActivity((req as any).user, "Estado de Usuario Modificado", "user_admin", `Se cambió el estado de ${user.name} a ${status}`, req);
        res.json({ message: `Estado actualizado a ${status}`, status });
    } catch (error) {
        console.error("Status update error:", error);
        res.status(500).json({ error: "Error cambiando estado en base de datos." });
    }
});

app.put('/api/users/:id/status', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const userId = BigInt(req.params.id as string);
        const { status } = req.body;
        const is_active = status === 'Activo';

        const user = await (prisma as any).user.update({
            where: { id: userId },
            data: { is_active }
        });

        res.json({ message: `Estado actualizado a ${status}`, status });
    } catch (error) {
        res.status(500).json({ error: "Error actualizando estado." });
    }
});


app.delete('/api/users/:id', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const userId = BigInt(req.params.id as string);

        if (userId === BigInt((req as any).user.id) || userId === BigInt(1000)) {
            return res.status(403).json({ error: "No puedes eliminar tu propio usuario o cuentas raíz." });
        }

        const user = await (prisma as any).user.update({
            where: { id: userId },
            data: { deleted_at: new Date(), is_active: false }
        });

        logActivity((req as any).user, "Usuario Eliminado (Soft Delete)", "user_admin", `El usuario ${user.name} fue marcado como eliminado`, req);
        res.json({ message: "Usuario marcado como eliminado con éxito en MySQL" });
    } catch (error) {
        console.error("User deletion error:", error);
        res.status(500).json({ error: "Error eliminando usuario de la base de datos." });
    }
});

app.get('/api/dependencies', authenticateToken, authorize(['super_admin', 'admin', 'safin', 'secont']), async (req: Request, res: Response) => {
    console.log(`[${new Date().toISOString()}] GET /api/dependencies - User:`, (req as any).user?.name, "Roles:", (req as any).user?.roles);
    try {
        const dependencies = await prisma.dependency.findMany({
            where: { deleted_at: null },
            include: {
                _count: {
                    select: { users: { where: { deleted_at: null } } }
                }
            },
            orderBy: { name: 'asc' }
        });

        console.log(`[${new Date().toISOString()}] Found ${dependencies.length} dependencies`);

        res.json(dependencies.map((d: any) => ({
            id: d.id.toString(),
            name: d.name,
            code: d.acronym || '',
            sector_id: d.sector_id ? d.sector_id.toString() : '0',
            user_count: d._count.users
        })));
    } catch (error) {
        console.error("Error cargando dependencias de Prisma:", error);
        res.status(500).json({ error: "Error cargando dependencias corporativas." });
    }
});

app.post('/api/dependencies/import-excel', authenticateToken, authorize(['super_admin']), upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se proporcionó ningún archivo." });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (data.length === 0) {
            return res.status(400).json({ error: "El archivo está vacío." });
        }

        // 1. Obtener catálogo de sectores actual para mapeo rápido
        const allSectors = await prisma.cat_sectors.findMany();
        const sectorMap = new Map();
        allSectors.forEach(s => {
            sectorMap.set(s.name.toLowerCase().trim(), s.id);
            if (s.acronym) sectorMap.set(s.acronym.toLowerCase().trim(), s.id);
        });

        // 2. Procesar filas del Excel
        const dependenciesToSync = data
            .map((item: any) => {
                const name = item.Nombre || item.nombre || item.Name || item.name;
                const acronym = String(item.Siglas || item.siglas || item.Clave || item.clave || item.Acronym || item.acronym || '').toUpperCase().trim();
                const sectorVal = item.Sector || item.SectorID || item.sector_id || '1';

                let sectorIdNum = BigInt(1); // Default: Sector 1
                if (typeof sectorVal === 'string') {
                    const mappedId = sectorMap.get(sectorVal.toLowerCase().trim());
                    if (mappedId) sectorIdNum = BigInt(mappedId);
                    else {
                        // Intento de conversión numérica si falla el mapeo por nombre
                        const numericId = parseInt(sectorVal);
                        if (!isNaN(numericId)) sectorIdNum = BigInt(numericId);
                    }
                } else if (typeof sectorVal === 'number' || typeof sectorVal === 'bigint') {
                    sectorIdNum = BigInt(sectorVal);
                }

                return { name, acronym, sectorId: sectorIdNum };
            })
            .filter(d => d.name);

        if (dependenciesToSync.length === 0) {
            return res.status(400).json({ error: "No se encontraron dependencias válidas (se requiere 'Nombre')." });
        }

        // 3. Sincronización masiva (Upsert inteligente)
        const result = await prisma.$transaction(async (tx) => {
            let created = 0;
            let updated = 0;

            for (const dep of dependenciesToSync) {
                // Intentar encontrar por nombre exacto o siglas
                const existing = await tx.dependency.findFirst({
                    where: {
                        OR: [
                            { name: dep.name },
                            { acronym: dep.acronym && dep.acronym !== '' ? dep.acronym : undefined }
                        ].filter(cond => cond !== undefined) as any
                    }
                });

                if (existing) {
                    await tx.dependency.update({
                        where: { id: existing.id },
                        data: {
                            name: dep.name,
                            acronym: dep.acronym || existing.acronym,
                            sector_id: dep.sectorId
                        }
                    });
                    updated++;
                } else {
                    await tx.dependency.create({
                        data: {
                            name: dep.name,
                            acronym: dep.acronym,
                            sector_id: dep.sectorId
                        }
                    });
                    created++;
                }
            }
            return { created, updated };
        });

        // Limpiar archivo temporal
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        logActivity((req as any).user, "Sincronización de Dependencias", "catalog_admin", `Importación finalizada: ${result.created} nuevas, ${result.updated} actualizadas`);
        res.json({
            message: `Sincronización completada.`,
            details: {
                nuevas: result.created,
                actualizadas: result.updated,
                total: result.created + result.updated
            }
        });

    } catch (error) {
        console.error("Dependency sync error:", error);
        res.status(500).json({ error: "Error sincronizando el catálogo de dependencias." });
    }
});

app.post('/api/dependencies', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const { name, code, sector_id } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: "El nombre de la dependencia es requerido." });

        const existing = await prisma.dependency.findFirst({
            where: { name: { equals: name.trim() } }
        });
        if (existing) return res.status(400).json({ error: "Ya existe una dependencia con ese nombre." });

        const newDep = await prisma.dependency.create({
            data: {
                name: name.trim(),
                acronym: (code || '').trim().toUpperCase(),
                sector_id: sector_id ? BigInt(sector_id) : null
            }
        });

        logActivity((req as any).user, "Dependencia Creada", "user_admin", `Nueva dependencia: ${newDep.name} (${newDep.acronym})`);
        res.status(201).json({ ...newDep, id: newDep.id.toString(), sector_id: newDep.sector_id?.toString() });
    } catch (error) {
        console.error("Create dependency error:", error);
        res.status(500).json({ error: "Error creando dependencia en SQL." });
    }
});

app.put('/api/dependencies/:id', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const depId = BigInt(req.params.id as string);
        const { name, code, sector_id } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: "El nombre es requerido." });

        const updatedDep = await prisma.dependency.update({
            where: { id: depId },
            data: {
                name: name.trim(),
                acronym: (code || '').trim().toUpperCase(),
                sector_id: sector_id ? BigInt(sector_id) : null
            }
        });

        logActivity((req as any).user, "Dependencia Actualizada", "user_admin", `ID ${depId}: ${updatedDep.name}`);
        res.json({ ...updatedDep, id: updatedDep.id.toString(), sector_id: updatedDep.sector_id?.toString() });
    } catch (error) {
        console.error("Update dependency error:", error);
        res.status(500).json({ error: "Error actualizando dependencia en SQL." });
    }
});

app.delete('/api/dependencies/:id', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const depId = BigInt(req.params.id as string);

        // Check if any users are assigned to this dependency
        const userCount = await prisma.user.count({ where: { dependency_id: depId } });
        if (userCount > 0) {
            return res.status(400).json({
                error: `No se puede eliminar: ${userCount} usuario(s) están asignados a esta dependencia.`
            });
        }

        const removedDep = await prisma.dependency.update({
            where: { id: depId },
            data: { deleted_at: new Date() }
        });
        logActivity((req as any).user, "Dependencia Eliminada (Soft Delete)", "user_admin", `Dependencia marcada como eliminada: ${removedDep.name}`, req);
        res.json({ message: "Dependencia marcada como eliminada correctamente en SQL." });
    } catch (error) {
        console.error("Delete dependency error:", error);
        res.status(500).json({ error: "Error eliminando dependencia de SQL." });
    }
});

// --- EXPORTAR PLANTILLA CSV DE USUARIOS ---
app.get('/api/users/export-csv', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const users = await (prisma as any).user.findMany({
            include: { dependency: true }
        });

        // Build CSV
        const header = 'ID,Nombre,Email,Dependencia_ID,Dependencia_Nombre,Roles,Status';
        const rows = users.map((u: any) => {
            const depName = u.dependency ? u.dependency.name : '';
            const depId = u.dependency ? u.dependency.id : '';
            // Escape commas in fields
            const escapeCsv = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
            return [
                u.id,
                escapeCsv(u.name),
                escapeCsv(u.email),
                depId,
                escapeCsv(depName),
                escapeCsv((u.roles || []).join(', ')),
                u.is_active ? 'Activo' : 'Inactivo'
            ].join(',');
        });

        const csvContent = [header, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="usuarios_plantilla.csv"');
        res.send('\uFEFF' + csvContent); // BOM for Excel to detect UTF-8
    } catch (error) {
        res.status(500).json({ error: "Error exportando usuarios." });
    }
});

// --- IMPORTAR CSV DE DEPENDENCIAS (actualización masiva) ---
app.post('/api/users/import-csv', authenticateToken, authorize(['super_admin']), express.text({ type: 'text/csv', limit: '5mb' }), async (req: Request, res: Response) => {
    try {
        // Fetch all dependencies from DB for matching
        const deps = await (prisma as any).dependency.findMany();
        const depsByName: Record<string, any> = {};
        deps.forEach((d: any) => {
            depsByName[d.name.trim().toLowerCase()] = d;
            if (d.code) depsByName[d.code.trim().toLowerCase()] = d;
        });

        const lines = (req.body as string).split('\n').filter(Boolean);
        if (lines.length < 2) return res.status(400).json({ error: "CSV vacío o sin filas de datos." });

        const headerRaw = lines[0];
        if (!headerRaw) return res.status(400).json({ error: "CSV sin cabecera." });
        const headerLine = headerRaw.split(',').map((h: string) => h.trim().replace(/"/g, '').toLowerCase());
        const idIdx = headerLine.indexOf('id');
        const depNameIdx = headerLine.findIndex((h: string) => h.includes('dependencia_nombre'));
        const depIdIdx = headerLine.findIndex((h: string) => h === 'dependencia_id');

        if (idIdx === -1) return res.status(400).json({ error: "El CSV debe tener una columna 'ID'." });

        let updated = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const cols: string[] = [];
            let inQuote = false, field = '';
            for (const ch of line) {
                if (ch === '"') { inQuote = !inQuote; }
                else if (ch === ',' && !inQuote) { cols.push(field.trim()); field = ''; }
                else { field += ch; }
            }
            cols.push(field.trim());

            const userId = parseInt(cols[idIdx] ?? '');
            if (isNaN(userId)) continue;

            let depName = depNameIdx !== -1 ? (cols[depNameIdx] ?? '').replace(/"/g, '').trim() : '';
            let depId = depIdIdx !== -1 ? parseInt(cols[depIdIdx] ?? '') : NaN;
            let matchedDepId: bigint | null = null;

            if (depName) {
                const matched = depsByName[depName.toLowerCase()];
                if (matched) matchedDepId = BigInt(matched.id);
            } else if (!isNaN(depId)) {
                matchedDepId = BigInt(depId);
            }

            try {
                await (prisma as any).user.update({
                    where: { id: BigInt(userId) },
                    data: matchedDepId ? { dependency_id: matchedDepId } : {}
                });
                updated++;
            } catch (e) {
                errors.push(`Error actualizando usuario ID ${userId}.`);
            }
        }

        logActivity((req as any).user, "Importación Masiva CSV", "user_admin", `${updated} usuarios actualizados por CSV`, req);
        res.json({ message: `✅ ${updated} usuarios actualizados correctamente.`, errors });
    } catch (error) {
        console.error("CSV Import error:", error);
        res.status(500).json({ error: "Error procesando el CSV." });
    }
});

// --- BITÁCORA Y LOGS DE AUDITORÍA ---
app.get('/api/logs', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const logs = await (prisma as any).activity_log.findMany({
            orderBy: { created_at: 'desc' },
            take: 1000
        });
        res.json(logs);
    } catch (error) {
        console.error("Error cargando bitácora:", error);
        res.status(500).json({ error: "Error cargando bitácora." });
    }
});

// ==================// ==========================================
// ENDPOINTS PARA LA PAPELERA DE RECICLAJE
// ==========================================

app.get('/api/admin/recycle-bin/:type', authenticateToken, authorize(['super_admin', 'admin']), async (req: Request, res: Response) => {
    const { type } = req.params;
    try {
        if (type === 'narratives') {
            const deleted = await (prisma as any).narrativeCapture.findMany({
                where: { deleted_at: { not: null } },
                include: { dependency: true, cat_narrative_periods: true },
                orderBy: { deleted_at: 'desc' }
            });
            const items = deleted.map((n: any) => ({
                id: n.id,
                name: n.ppa_name,
                acronym: `PPA-${n.id}`,
                type: 'Narrativa',
                email: `Dep: ${n.dependency?.name || '---'} | Año: ${n.cat_narrative_periods?.year || '---'}`,
                deleted_at: n.deleted_at
            }));
            return res.json(items);
        } else if (type === 'dependencies') {
            const deleted = await (prisma as any).dependency.findMany({
                where: { deleted_at: { not: null } },
                orderBy: { deleted_at: 'desc' }
            });
            const items = deleted.map((d: any) => ({
                id: d.id,
                name: d.name,
                acronym: d.acronym || 'SG',
                type: 'Dependencia',
                email: 'Catálogo Oficial',
                deleted_at: d.deleted_at
            }));
            return res.json(items);
        } else {
            return res.json([]);
        }
    } catch (error) {
        console.error(`Error trayendo papelera para ${type}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

app.post('/api/admin/recycle-bin/:type/:id/restore', authenticateToken, authorize(['super_admin', 'admin']), async (req: Request, res: Response) => {
    const { type, id } = req.params;
    const user = (req as any).user;

    try {
        if (type === 'narratives') {
            const restored = await (prisma as any).narrativeCapture.update({
                where: { id: BigInt(id as string) },
                data: { deleted_at: null, updated_at: new Date() }
            });
            logActivity(user, "Restauración", "narrativeCapture", `Restaurada narrativa ${restored.ppa_name}`);
            return res.json({ message: "Restaurado con éxito" });
        } else if (type === 'dependencies') {
            const restored = await (prisma as any).dependency.update({
                where: { id: BigInt(id as string) },
                data: { deleted_at: null, updated_at: new Date() }
            });
            logActivity(user, "Restauración", "dependency", `Restaurada dependencia ${restored.name}`);
            return res.json({ message: "Restaurado con éxito" });
        } else {
            return res.status(400).json({ error: "Tipo no soportado" });
        }
    } catch (error) {
        console.error("Error restaurando de la papelera:", error);
        res.status(500).json({ error: "Fallo al restaurar el registro." });
    }
});

// ==========================================
// ENDPONT PARA EL TRIGGER DEL 2DO CORTE FINAL
// ============================================================

// GET all periods
app.get('/api/periods', authenticateToken, async (req: Request, res: Response) => {
    try {
        const periods = await (prisma as any).cat_narrative_periods.findMany({ orderBy: { id: 'asc' } });
        res.json(periods);
    } catch (error) {
        res.status(500).json({ error: "Error cargando periodos." });
    }
});

// GET active period
app.get('/api/periods/active', authenticateToken, async (req: Request, res: Response) => {
    try {
        const active = await (prisma as any).cat_narrative_periods.findFirst({ orderBy: { id: 'desc' } });
        if (!active) return res.status(404).json({ error: "No hay periodo activo." });
        res.json(active);
    } catch (error: any) {
        console.error("Error en /periods/active:", error);
        res.status(500).json({ error: error.message || "Error cargando periodo activo." });
    }
});

// POST create period
app.post('/api/periods', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const { year, name, description } = req.body;
        if (!year) return res.status(400).json({ error: "El año es requerido." });
        const newPeriod = await (prisma as any).cat_narrative_periods.create({
            data: { year: String(year), name: name || `Informe de Gobierno ${year}`, description: description || '', is_active: false }
        });
        logActivity((req as any).user, "Periodo Creado", "user_admin", `Periodo ${newPeriod.name} creado`);
        res.status(201).json(newPeriod);
    } catch (error) {
        res.status(500).json({ error: "Error creando periodo." });
    }
});

// PUT update period metadata
app.put('/api/periods/:id', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const periodId = parseInt(req.params.id as string);
        const { name, description } = req.body;
        const updated = await (prisma as any).cat_narrative_periods.update({
            where: { id: periodId },
            data: { name, description }
        });
        logActivity((req as any).user, "Periodo Actualizado", "user_admin", `Periodo ${updated.name} actualizado`);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: "Error actualizando periodo." });
    }
});

// PATCH activate period (deactivates all others)
app.patch('/api/periods/:id/activate', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const periodId = parseInt(req.params.id as string);
        await (prisma as any).cat_narrative_periods.updateMany({ data: { is_active: false } });
        const activated = await (prisma as any).cat_narrative_periods.update({
            where: { id: periodId },
            data: { is_active: true }
        });
        logActivity((req as any).user, "Periodo Activado", "user_admin", `Ciclo activo cambiado a: ${activated.name}`);
        res.json(activated);
    } catch (error) {
        res.status(500).json({ error: "Error activando periodo." });
    }
});

// PATCH toggle stage — stages are not in DB, return 501 stub
app.patch('/api/periods/:id/stages/:stageId', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    res.status(501).json({ error: "La gestión de etapas individuales no está implementada en la base de datos." });
});

// DELETE period
app.delete('/api/periods/:id', authenticateToken, authorize(['super_admin']), async (req: Request, res: Response) => {
    try {
        const periodId = parseInt(req.params.id as string);
        await (prisma as any).cat_narrative_periods.update({
            where: { id: periodId },
            data: { deleted_at: new Date() }
        });
        logActivity((req as any).user, "Periodo Eliminado (Soft Delete)", "user_admin", `Periodo ID ${periodId} marcado como eliminado`, req);
        res.json({ message: "Periodo marcado como eliminado." });
    } catch (error) {
        res.status(500).json({ error: "Error eliminando periodo." });
    }
});

// --- CONFIGURATION & SYSTEM ENDPOINTS ---

app.get('/api/config', authenticateToken, (req, res) => {
    const user = (req as any).user;
    console.log(`[CONFIG] Request headers:`, JSON.stringify(req.headers));
    console.log(`[CONFIG] User found:`, JSON.stringify(user));
    res.json({
        narrative_limit: 2000,
        highlights_limit: 500,
        capture_deadline: '2026-03-31',
        smtp: {
            host: 'mail.seplan.gob.mx',
            port: 587,
            user: 'notificaciones@seplan.gob.mx',
            from: 'notificaciones@seplan.gob.mx'
        },
        backups: {
            frequency: 'diario',
            last_backup: null
        }
    });
});

app.post('/api/config', authenticateToken, authorize(['super_admin']), (req, res) => {
    // Config is no longer persisted in local JSON — return success to avoid breaking frontend
    res.json({ message: "Configuración actualizada", settings: req.body });
});

app.get('/api/system/backup', authenticateToken, authorize(['super_admin']), (req, res) => {
    res.status(410).json({ error: "El respaldo local ha sido deshabilitado. Use el panel de administración de base de datos." });
});
// =============================================================================
// 🔐 FLUJO secont — Secretaría de la Contraloría (Prisma)
// =============================================================================

// GET /api/secont/narrativas
app.get('/api/secont/narrativas', authenticateToken, authorize(['secont', 'super_admin']), async (req: Request, res: Response) => {
    try {
        const pStr = req.query.periodo as string || '2026';
        const period = await (prisma as any).cat_narrative_periods.findFirst({ where: { year: pStr } });
        const secontStatuses = ['under_validation_secont', 'with_observations_secont', 'approved_secont'];

        const narratives = period ? await (prisma as any).narrativeCapture.findMany({
            where: { narrative_period_id: period.id, status: { in: secontStatuses } },
            include: { dependency: true, cat_narrative_titles: true }
        }) : [];

        res.json(narratives.map((n: any) => ({
            id: n.id.toString(), ppa_name: n.ppa_name, dependency: n.dependency?.name || 'Sin dependencia',
            status: n.status, created_at: n.created_at
        })));
    } catch (e) {
        res.status(500).json({ error: 'Error obteniendo bandeja secont de narrativas' });
    }
});

// GET /api/secont/anexos
app.get('/api/secont/anexos', authenticateToken, authorize(['secont', 'super_admin']), async (req: Request, res: Response) => {
    try {
        res.json([]);  // Statistical entries secont workflow not yet implemented
    } catch (e) {
        res.status(500).json({ error: 'Error obteniendo bandeja secont de anexos' });
    }
});

// POST /api/secont/review/:type/:id
app.post('/api/secont/review/:type/:id', authenticateToken, authorize(['secont', 'super_admin']), async (req: Request, res: Response) => {
    try {
        const type = req.params.type as string;
        const id = req.params.id as string;
        const action = req.body.action as string;
        const observations = req.body.observations as string;
        const user = (req as any).user;

        if (!['approve', 'observe'].includes(action)) {
            return res.status(400).json({ error: 'Acción inválida. Use approve u observe.' });
        }
        if (action === 'observe' && !observations?.trim()) {
            return res.status(400).json({ error: 'Debe ingresar las observaciones.' });
        }

        const newStatus = action === 'approve' ? 'approved_secont' : 'with_observations_secont';
        const itemId = parseInt(id);

        if (type === 'narrativa') {
            await (prisma as any).narrativeCapture.update({
                where: { id: itemId },
                data: { status: newStatus }
            });
        } else {
            return res.status(400).json({ error: 'Tipo inválido. Use narrativa.' });
        }

        logActivity(user, `Revisión secont`, 'secont', `${type} ID ${id}: ${action}`, req);
        res.json({ message: `${type} ${newStatus} correctamente`, status: newStatus });
    } catch (e) {
        res.status(500).json({ error: 'Error procesando revisión secont' });
    }
});

// POST /api/inbox/send-to-secont
app.post('/api/inbox/send-to-secont', authenticateToken, authorize(['super_admin', 'admin', 'validador']), async (req: Request, res: Response) => {
    try {
        const { type, id } = req.body;
        const user = (req as any).user;
        const itemId = parseInt(id);

        if (type === 'narrativa') {
            await (prisma as any).narrativeCapture.update({
                where: { id: itemId },
                data: { status: 'under_validation_secont' }
            });
        } else {
            return res.status(400).json({ error: 'Tipo inválido. Use narrativa.' });
        }

        logActivity(user, 'Enviado a secont', 'secont', `${type} ID ${id} enviado a revisión`, req);
        res.json({ message: 'Registro enviado a secont para revisión oficial.', status: 'under_validation_secont' });
    } catch (e) {
        res.status(500).json({ error: 'Error enviando a secont' });
    }
});

// GET /api/secont/stats
app.get('/api/secont/stats', authenticateToken, authorize(['secont', 'super_admin', 'admin']), async (req: Request, res: Response) => {
    try {
        const pStr = req.query.periodo as string || '2026';
        const period = await (prisma as any).cat_narrative_periods.findFirst({ where: { year: pStr } });
        if (!period) return res.json({ pendientes: 0, aprobados: 0, observaciones: 0, total: 0 });

        const [pendientes, aprobados, observaciones] = await Promise.all([
            (prisma as any).narrativeCapture.count({ where: { narrative_period_id: period.id, status: 'under_validation_secont' } }),
            (prisma as any).narrativeCapture.count({ where: { narrative_period_id: period.id, status: 'approved_secont' } }),
            (prisma as any).narrativeCapture.count({ where: { narrative_period_id: period.id, status: 'with_observations_secont' } }),
        ]);

        res.json({ pendientes, aprobados, observaciones, total: pendientes + aprobados + observaciones });
    } catch (e) {
        res.status(500).json({ error: 'Error obteniendo estadísticas secont' });
    }
});
// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("!!! UNHANDLED ERROR !!!", err);
    res.status(500).json({
        error: "Internal Server Error",
        message: err.message,
        path: req.path
    });
});

app.listen(PORT, () => {
    console.log(`🚀 API Superior V2 corriendo en http://localhost:${PORT}`);

    // ─── TELEGRAM BOT ────────────────────────────────────────────
    const TBOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const ALLOWED_IDS = (process.env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

    if (!TBOT_TOKEN) {
        console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado. Bot desactivado.');
    } else {
        const tbot = new TelegramBot(TBOT_TOKEN, { polling: true });
        console.log('🤖 Bot de Telegram activo.');

        const guard = (chatId: number, cb: () => void) => {
            if (!ALLOWED_IDS.includes(String(chatId))) {
                tbot.sendMessage(chatId, '🚫 No estás autorizado.');
                return;
            }
            cb();
        };

        const fmtDate = (iso?: string) => iso
            ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';

        const emoji: Record<string, string> = { login: '🔑', logout: '🚪', create: '➕', update: '✏️', delete: '🗑️', export: '📤', user_admin: '🛡️' };

        const getStatus = async () => {
            const usersCount = await (prisma as any).user.count();
            const narrCount = await (prisma as any).narrativeCapture.count();
            const pend = await (prisma as any).narrativeCapture.count({ where: { status: { in: ['submitted', 'pendiente', 'enviado'] } } });
            return [
                `📊 *ESTADO DEL SISTEMA — ${new Date().toLocaleString('es-MX')}*`,
                ``,
                `👥 *Usuarios:* ${usersCount} total`,
                `📝 *Narrativas:* ${narrCount} total · ${pend} en validación`,
            ].join('\n');
        };

        const getPending = async () => {
            const pend = await (prisma as any).narrativeCapture.findMany({
                where: { status: { in: ['submitted', 'pendiente', 'enviado'] } },
                take: 15
            });
            if (!pend.length) return '✅ *No hay narrativas pendientes de validación.*';
            const lines = pend.map((n: any, i: number) => `${i + 1}. *${n.ppa_name || 'Sin título'}*`);
            return [`⏳ *PENDIENTES (${pend.length})*`, ``, ...lines].join('\n');
        };

        const getUsers = async () => {
            const usersCount = await (prisma as any).user.count();
            const activeCount = await (prisma as any).user.count({ where: { is_active: true } });
            return [
                `👥 *USUARIOS DEL SISTEMA*`, ``,
                `✅ Activos: *${activeCount}*`,
                `📊 Total: *${usersCount}*`
            ].join('\n');
        };

        const getDeps = async () => {
            const depsCount = await (prisma as any).dependency.count();
            return [`🏛️ *DEPENDENCIAS EN SISTEMA:* ${depsCount}`].join('\n');
        };

        const getLogs = async () => {
            const logs = await (prisma as any).activity_log.findMany({
                orderBy: { created_at: 'desc' },
                take: 8
            });
            if (!logs.length) return '📋 *No hay eventos registrados.*';
            const lines = logs.map((l: any) => {
                const e = emoji[l.event || ''] || '📌';
                return `${e} *${l.event || 'Evento'}*\n   👤 ${l.user_email || 'Sistema'} · ${fmtDate(l.created_at)}`;
            });
            return [`📋 *ÚLTIMOS 8 EVENTOS*`, ``, ...lines].join('\n');
        };

        const getSecont = async () => {
            const pend = await (prisma as any).narrativeCapture.count({ where: { status: { contains: 'secont' } } });
            return [
                `🛡️ *AUDITORÍA secont*`, ``,
                `📊 Total en proceso secont: *${pend}*`
            ].join('\n');
        };

        const MENU = [
            `/status — Estado general del sistema`,
            `/pendientes — Narrativas por validar`,
            `/secont — Estado de Contraloría`,
            `/usuarios — Usuarios y roles`,
            `/dependencias — Sin narrativa`,
            `/logs — Últimos eventos`,
            `/ayuda — Esta lista`,
        ].join('\n');

        tbot.onText(/\/start/, msg => guard(msg.chat.id, () =>
            tbot.sendMessage(msg.chat.id, `👋 *Bot SEPLAN Captura Informe V2*\n\n${MENU}`, { parse_mode: 'Markdown' })));
        tbot.onText(/\/ayuda/, msg => guard(msg.chat.id, () =>
            tbot.sendMessage(msg.chat.id, `📋 *Comandos disponibles:*\n\n${MENU}`, { parse_mode: 'Markdown' })));
        tbot.onText(/\/status/, async msg => guard(msg.chat.id, async () =>
            tbot.sendMessage(msg.chat.id, await getStatus(), { parse_mode: 'Markdown' })));
        tbot.onText(/\/pendientes/, async msg => guard(msg.chat.id, async () =>
            tbot.sendMessage(msg.chat.id, await getPending(), { parse_mode: 'Markdown' })));
        tbot.onText(/\/secont/, async msg => guard(msg.chat.id, async () =>
            tbot.sendMessage(msg.chat.id, await getSecont(), { parse_mode: 'Markdown' })));
        tbot.onText(/\/usuarios/, async msg => guard(msg.chat.id, async () =>
            tbot.sendMessage(msg.chat.id, await getUsers(), { parse_mode: 'Markdown' })));
        tbot.onText(/\/dependencias/, async msg => guard(msg.chat.id, async () =>
            tbot.sendMessage(msg.chat.id, await getDeps(), { parse_mode: 'Markdown' })));
        tbot.onText(/\/logs/, async msg => guard(msg.chat.id, async () =>
            tbot.sendMessage(msg.chat.id, await getLogs(), { parse_mode: 'Markdown' })));

        tbot.on('polling_error', (err: any) => {
            if (err.code !== 'ETELEGRAM') console.error('Bot error:', err.message);
        });
    }
});

