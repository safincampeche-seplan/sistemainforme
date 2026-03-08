import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE1NiIsImVtYWlsIjoic2FsdWRkZW1vQHNlcGxhbi5nb2IubXgiLCJyb2xlcyI6WyJjYXB0dXJpc3RhIl0sImRlcGVuZGVuY3kiOiJTQUxVRCIsImRlcGVuZGVuY3lfaWQiOiIxNSIsImlhdCI6MTc3Mjk4MzQ4MSwiZXhwIjoxNzczMDEyMjgxfQ.Ivd8-ZdICCttsgfDpjV8m73o6GDfiavjcU8wSjEoxPs'; // saluddemo

async function main() {
    const narrativeId = 2483;
    console.log(`--- Starting E2E validation for Narrative ${narrativeId} ---`);

    // 1. Reset
    console.log('1. Resetting to draft...');
    await (prisma as any).narrativeCapture.update({
        where: { id: narrativeId },
        data: { status: 'draft' }
    });

    // 2. Submit
    console.log('2. Submitting to SAFIN...');
    const res = await axios.post(`${API_URL}/narratives/${narrativeId}/submit`, {}, {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log('Submit response:', res.data);

    // 3. Query Notifications
    console.log('3. Querying notifications...');
    const notifications: any = await prisma.$queryRaw`SELECT * FROM notifications WHERE data LIKE '%"narrative_id":"2483"%' ORDER BY created_at DESC LIMIT 5`;
    console.log('Notifications found:', JSON.stringify(notifications, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    if (notifications.length > 0) {
        console.log('✅ SUCCESS: Notification found in DB!');
    } else {
        console.log('❌ FAIL: No notification found.');
    }
}

main()
    .catch(e => {
        console.error('Error in script:', e.response?.data || e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
