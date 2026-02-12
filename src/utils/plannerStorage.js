const PLANNER_KEY = 'upAhead_planner';
const BLACKLIST_KEY = 'upAhead_blacklist';
const API_BASE = '/api';

const plannerStorage = {
    // ========================================
    // SYNC WITH SERVER
    // ========================================
    sync: async () => {
        try {
            // Sync Blacklist
            const blResponse = await fetch(`${API_BASE}/blacklist`);
            if (blResponse.ok) {
                const remoteBlacklist = await blResponse.json();
                // Merge with local? Or overwrite?
                // Overwrite is safer for "single source of truth".
                // But let's Union to be safe against data loss during offline usage.
                const localBlacklist = plannerStorage.getBlacklist();
                const merged = new Set([...localBlacklist, ...remoteBlacklist]);
                localStorage.setItem(BLACKLIST_KEY, JSON.stringify([...merged]));
            }

            // Sync Planner
            const planResponse = await fetch(`${API_BASE}/user_plan`);
            if (planResponse.ok) {
                const remotePlan = await planResponse.json();
                const localPlanRaw = localStorage.getItem(PLANNER_KEY);
                const localPlan = localPlanRaw ? JSON.parse(localPlanRaw) : {};

                // Merge strategies:
                // For now, let's assume remote is master for simplicity, but merge keys.
                const mergedPlan = { ...localPlan, ...remotePlan };
                localStorage.setItem(PLANNER_KEY, JSON.stringify(mergedPlan));
            }
            console.log('[PlannerStorage] Synced with server');
        } catch (e) {
            console.warn('[PlannerStorage] Sync failed', e);
        }
    },

    getUpcomingDays: (days = 14) => {
        try {
            const data = localStorage.getItem(PLANNER_KEY);
            if (!data) return [];

            const parsed = JSON.parse(data);
            const today = new Date().toISOString().split('T')[0];

            // Filter out past days
            const validDays = Object.entries(parsed)
                .filter(([date]) => date >= today)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .slice(0, days)
                .map(([date, items]) => ({
                    date,
                    items
                }));

            return validDays;
        } catch (e) {
            console.error('Failed to read planner storage', e);
            return [];
        }
    },

    addItem: (date, item) => {
        try {
            const data = localStorage.getItem(PLANNER_KEY);
            const parsed = data ? JSON.parse(data) : {};

            if (!parsed[date]) parsed[date] = [];

            // Avoid duplicates
            if (!parsed[date].some(i => i.id === item.id)) {
                parsed[date].push(item);
                localStorage.setItem(PLANNER_KEY, JSON.stringify(parsed));

                // Persist to API
                plannerStorage.savePlanToApi(parsed);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to add item to planner', e);
            return false;
        }
    },

    removeItem: (date, itemId) => {
         try {
            const data = localStorage.getItem(PLANNER_KEY);
            const parsed = data ? JSON.parse(data) : {};

            if (parsed[date]) {
                parsed[date] = parsed[date].filter(i => i.id !== itemId);
                if (parsed[date].length === 0) delete parsed[date];

                localStorage.setItem(PLANNER_KEY, JSON.stringify(parsed));
                plannerStorage.savePlanToApi(parsed);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to remove item', e);
            return false;
        }
    },

    merge: (dates, newItems) => {
        try {
            const data = localStorage.getItem(PLANNER_KEY);
            const parsed = data ? JSON.parse(data) : {};
            let changed = false;

            dates.forEach(date => {
                if (!parsed[date]) parsed[date] = [];
                const existingIds = new Set(parsed[date].map(i => i.id));

                newItems.forEach(item => {
                    if (!existingIds.has(item.id)) {
                        parsed[date].push(item);
                        changed = true;
                    }
                });
            });

            if (changed) {
                localStorage.setItem(PLANNER_KEY, JSON.stringify(parsed));
                plannerStorage.savePlanToApi(parsed);
            }
        } catch (e) {
            console.error('Merge failed', e);
        }
    },

    savePlanToApi: async (planData) => {
        try {
            await fetch(`${API_BASE}/user_plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(planData)
            });
        } catch (e) {
            console.warn('API save plan error:', e);
        }
    },

    // Blacklist Management
    addToBlacklist: (id) => {
        try {
            const list = JSON.parse(localStorage.getItem(BLACKLIST_KEY) || '[]');
            if (!list.includes(id)) {
                list.push(id);
                localStorage.setItem(BLACKLIST_KEY, JSON.stringify(list));

                // Persist to API
                plannerStorage.saveBlacklistToApi(list);
            }
        } catch (e) {
            console.error('Failed to blacklist', e);
        }
    },

    getBlacklist: () => {
        try {
            return new Set(JSON.parse(localStorage.getItem(BLACKLIST_KEY) || '[]'));
        } catch {
            return new Set();
        }
    },

    saveBlacklistToApi: async (list) => {
        try {
             await fetch(`${API_BASE}/blacklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(list)
            });
        } catch (e) {
             console.warn('API save blacklist error:', e);
        }
    }
};

export default plannerStorage;
