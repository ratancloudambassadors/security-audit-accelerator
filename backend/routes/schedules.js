const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-local-key-for-jwt';

// Middleware to protect routes and extract user
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Create or update a schedule
router.post('/', authenticateToken, async (req, res) => {
    const { projectId, provider, credentials, frequency, time, daysOfWeek, dayOfMonth } = req.body;
    
    if (!frequency || !time) {
        return res.status(400).json({ error: 'Frequency and time are required.' });
    }

    try {
        const computeNextRun = (freq, t, days, mDay) => {
            const now = new Date();
            const [hours, minutes] = t.split(':').map(Number);
            let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

            if (next <= now) {
                if (freq === 'daily') next.setDate(next.getDate() + 1);
                else if (freq === 'weekly') {
                    // Placeholder for actual weekly logic - for now just +7 days if strictly same day or find next
                    next.setDate(next.getDate() + 1);
                } else if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
            }

            // More complex weekly logic
            if (freq === 'weekly' && days && days.length > 0) {
                const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
                const dayIndices = days.map(d => dayMap[d]);
                
                // Find next day in the selected set
                let foundNext = false;
                for(let i=0; i<8; i++) {
                    const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hours, minutes, 0);
                    if (checkDate > now && dayIndices.includes(checkDate.getDay())) {
                         return checkDate;
                    }
                }
            }

            if (freq === 'monthly' && mDay) {
                const nextMonth = new Date(now.getFullYear(), now.getMonth(), mDay, hours, minutes, 0);
                if (nextMonth <= now) nextMonth.setMonth(nextMonth.getMonth() + 1);
                return nextMonth;
            }

            return next;
        };

        const nextRun = computeNextRun(frequency, time, daysOfWeek, dayOfMonth);
        let finalProjectId = projectId;

        // If no project ID provided, we create a new project for this automation
        if (!finalProjectId) {
            let projectName = 'Automated ' + (provider || 'GCP') + ' Project';
            // Try to extract project id from GCP json if possible
            if (provider === 'gcp' && credentials) {
                try {
                    const parsed = JSON.parse(credentials);
                    if (parsed.project_id) projectName = parsed.project_id;
                } catch (e) {}
            }
            
            const newProj = await prisma.project.create({
                data: {
                    name: projectName,
                    provider: provider || 'gcp',
                    credentials: credentials,
                    userId: req.user.userId
                }
            });
            finalProjectId = newProj.id;
        }

        const schedule = await prisma.auditSchedule.create({
            data: {
                frequency,
                time,
                daysOfWeek,
                dayOfMonth,
                credentials, 
                nextRun,
                userId: req.user.userId,
                projectId: finalProjectId
            }
        });

        res.json(schedule);
    } catch (err) {
        console.error('[Schedules] Create error:', err);
        res.status(500).json({ error: 'Failed to save schedule.' });
    }
});

// Get user's schedules
router.get('/', authenticateToken, async (req, res) => {
    try {
        const schedules = await prisma.auditSchedule.findMany({
            where: { userId: req.user.userId },
            include: { project: true }
        });
        res.json(schedules);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch schedules.' });
    }
});

// Toggle a schedule (Active/Inactive)
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const schedule = await prisma.auditSchedule.findUnique({
            where: { id: req.params.id }
        });

        if (!schedule || schedule.userId !== req.user.userId) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }

        const updated = await prisma.auditSchedule.update({
            where: { id: schedule.id },
            data: { isActive: !schedule.isActive }
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle schedule.' });
    }
});

// Delete a schedule
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const schedule = await prisma.auditSchedule.findUnique({
            where: { id: req.params.id }
        });

        if (!schedule || schedule.userId !== req.user.userId) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }

        await prisma.auditSchedule.delete({
            where: { id: schedule.id }
        });

        res.json({ message: 'Schedule deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete schedule.' });
    }
});

module.exports = router;
