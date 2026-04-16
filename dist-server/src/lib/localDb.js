import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const DATA_DIR = path.join(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const BANNERS_FILE = path.join(DATA_DIR, 'banners.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR))
        fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJson(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath))
            return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return fallback;
    }
}
function writeJson(filePath, data) {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
function uuid() {
    return crypto.randomUUID();
}
function toPrismaEvent(e) {
    return {
        ...e,
        eventDate: new Date(e.eventDate),
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
        categories: e.categories.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt),
        })),
    };
}
function readEvents() {
    return readJson(EVENTS_FILE, []);
}
function writeEvents(events) {
    writeJson(EVENTS_FILE, events);
}
const eventModel = {
    async findMany(args) {
        let events = readEvents();
        if (args?.where) {
            Object.entries(args.where).forEach(([k, v]) => {
                events = events.filter((e) => e[k] === v);
            });
        }
        if (args?.orderBy) {
            const key = Object.keys(args.orderBy)[0];
            const dir = args.orderBy[key];
            events.sort((a, b) => {
                if (dir === 'desc')
                    return a[key] > b[key] ? -1 : 1;
                return a[key] > b[key] ? 1 : -1;
            });
        }
        return events.map(toPrismaEvent);
    },
    async findUnique(args) {
        const events = readEvents();
        const e = events.find(ev => (args.where.id && ev.id === args.where.id) ||
            (args.where.slug && ev.slug === args.where.slug));
        if (!e)
            return null;
        if (args.select) {
            const result = {};
            Object.keys(args.select).forEach(k => {
                result[k] = e[k];
            });
            return result;
        }
        return toPrismaEvent(e);
    },
    async create(args) {
        const events = readEvents();
        const now = new Date().toISOString();
        const id = uuid();
        const cats = [];
        if (args.data.categories?.create) {
            for (const c of args.data.categories.create) {
                cats.push({
                    id: uuid(),
                    name: c.name,
                    eventId: id,
                    order: c.order,
                    createdAt: now,
                });
            }
        }
        const newEvent = {
            id,
            name: args.data.name,
            slug: args.data.slug,
            description: args.data.description || '',
            eventDate: args.data.eventDate instanceof Date ? args.data.eventDate.toISOString() : args.data.eventDate,
            location: args.data.location || '',
            latitude: args.data.latitude ?? null,
            longitude: args.data.longitude ?? null,
            gpxFile: args.data.gpxFile ?? null,
            status: args.data.status || 'upcoming',
            isActive: args.data.isActive !== undefined ? args.data.isActive : true,
            cutoffMs: args.data.cutoffMs ?? null,
            categoryStartTimes: args.data.categoryStartTimes ?? null,
            categories: cats,
            createdAt: now,
            updatedAt: now,
        };
        events.push(newEvent);
        writeEvents(events);
        return toPrismaEvent(newEvent);
    },
    async update(args) {
        const events = readEvents();
        const idx = events.findIndex(e => e.id === args.where.id);
        if (idx < 0)
            throw new Error('Event not found');
        const existing = events[idx];
        const now = new Date().toISOString();
        const updated = {
            ...existing,
            ...Object.fromEntries(Object.entries(args.data).filter(([_, v]) => v !== undefined)),
            categories: existing.categories,
            updatedAt: now,
        };
        if (args.data.eventDate && args.data.eventDate instanceof Date) {
            updated.eventDate = args.data.eventDate.toISOString();
        }
        events[idx] = updated;
        writeEvents(events);
        return toPrismaEvent(updated);
    },
    async delete(args) {
        let events = readEvents();
        events = events.filter(e => e.id !== args.where.id);
        writeEvents(events);
        let banners = readJson(BANNERS_FILE, []);
        banners = banners.filter(b => b.eventId !== args.where.id);
        writeJson(BANNERS_FILE, banners);
    },
};
const categoryModel = {
    async findMany(args) {
        const events = readEvents();
        let cats = [];
        if (args?.where?.eventId) {
            const event = events.find(e => e.id === args.where.eventId);
            cats = event?.categories || [];
        }
        else {
            cats = events.flatMap(e => e.categories);
        }
        if (args?.orderBy) {
            const key = Object.keys(args.orderBy)[0];
            const dir = args.orderBy[key];
            cats.sort((a, b) => {
                if (dir === 'desc')
                    return a[key] > b[key] ? -1 : 1;
                return a[key] > b[key] ? 1 : -1;
            });
        }
        return cats.map(c => ({ ...c, createdAt: new Date(c.createdAt) }));
    },
    async createMany(args) {
        const events = readEvents();
        const now = new Date().toISOString();
        for (const item of args.data) {
            const event = events.find(e => e.id === item.eventId);
            if (event) {
                event.categories.push({
                    id: uuid(),
                    name: item.name,
                    eventId: item.eventId,
                    order: item.order,
                    createdAt: now,
                });
            }
        }
        writeEvents(events);
    },
    async deleteMany(args) {
        if (!args.where.eventId)
            return;
        const events = readEvents();
        const event = events.find(e => e.id === args.where.eventId);
        if (event) {
            event.categories = [];
            writeEvents(events);
        }
    },
};
function readBanners() {
    return readJson(BANNERS_FILE, []);
}
function writeBanners(banners) {
    writeJson(BANNERS_FILE, banners);
}
const bannerModel = {
    async findMany(args) {
        let banners = readBanners();
        if (args?.where) {
            Object.entries(args.where).forEach(([k, v]) => {
                banners = banners.filter((b) => b[k] === v);
            });
        }
        if (args?.orderBy) {
            const key = Object.keys(args.orderBy)[0];
            const dir = args.orderBy[key];
            banners.sort((a, b) => {
                if (dir === 'desc')
                    return a[key] > b[key] ? -1 : 1;
                return a[key] > b[key] ? 1 : -1;
            });
        }
        return banners.map(b => ({ ...b, createdAt: new Date(b.createdAt) }));
    },
    async findUnique(args) {
        const banners = readBanners();
        const b = banners.find(bn => bn.id === args.where.id);
        return b ? { ...b, createdAt: new Date(b.createdAt) } : null;
    },
    async create(args) {
        const banners = readBanners();
        const now = new Date().toISOString();
        const newBanner = {
            id: uuid(),
            eventId: args.data.eventId,
            imageUrl: args.data.imageUrl,
            alt: args.data.alt || '',
            order: args.data.order || 0,
            isActive: args.data.isActive !== undefined ? args.data.isActive : true,
            createdAt: now,
        };
        banners.push(newBanner);
        writeBanners(banners);
        return { ...newBanner, createdAt: new Date(now) };
    },
    async update(args) {
        const banners = readBanners();
        const idx = banners.findIndex(b => b.id === args.where.id);
        if (idx < 0)
            throw new Error('Banner not found');
        banners[idx] = { ...banners[idx], ...args.data };
        writeBanners(banners);
        return { ...banners[idx], createdAt: new Date(banners[idx].createdAt) };
    },
    async delete(args) {
        let banners = readBanners();
        banners = banners.filter(b => b.id !== args.where.id);
        writeBanners(banners);
    },
};
function readUsers() {
    return readJson(USERS_FILE, []);
}
function writeUsers(users) {
    writeJson(USERS_FILE, users);
}
const userModel = {
    async findUnique(args) {
        const users = readUsers();
        return users.find(u => (args.where.id && u.id === args.where.id) ||
            (args.where.email && u.email === args.where.email)) || null;
    },
    async create(args) {
        const users = readUsers();
        const now = new Date().toISOString();
        const newUser = {
            id: uuid(),
            email: args.data.email,
            password: args.data.password,
            name: args.data.name || '',
            role: args.data.role || 'admin',
            createdAt: now,
            updatedAt: now,
        };
        users.push(newUser);
        writeUsers(users);
        return newUser;
    },
};
const localDb = {
    event: eventModel,
    category: categoryModel,
    banner: bannerModel,
    user: userModel,
};
export default localDb;
