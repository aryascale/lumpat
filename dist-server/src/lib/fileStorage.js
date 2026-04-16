import fs from 'node:fs';
import path from 'node:path';
const getUploadDir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const getBaseUrl = () => process.env.BASE_URL || 'http://localhost:3001';
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath))
        fs.mkdirSync(dirPath, { recursive: true });
}
function getCsvDir(eventId) {
    return path.join(getUploadDir(), 'events', eventId, 'csv');
}
function getImagesDir(eventId) {
    return path.join(getUploadDir(), 'events', eventId, 'images');
}
function getCsvFilePath(eventId, kind) {
    return path.join(getCsvDir(eventId), `${kind}.csv`);
}
function getCsvMetaPath(eventId) {
    return path.join(getCsvDir(eventId), '_meta.json');
}
function filePathToUrl(filePath) {
    const relativePath = filePath.replace(getUploadDir(), '').replace(/\\/g, '/');
    return `${getBaseUrl()}/uploads${relativePath}`;
}
export async function uploadCsvFile(eventId, kind, text, filename, rows) {
    ensureDir(getCsvDir(eventId));
    const filePath = getCsvFilePath(eventId, kind);
    fs.writeFileSync(filePath, text, 'utf-8');
    const meta = {
        kind,
        filename,
        path: filePath,
        url: filePathToUrl(filePath),
        rows,
        updatedAt: Date.now(),
    };
    await updateCsvMetadata(eventId, kind, meta);
    return meta;
}
async function updateCsvMetadata(eventId, kind, meta) {
    const metaPath = getCsvMetaPath(eventId);
    let allMeta = {};
    try {
        if (fs.existsSync(metaPath)) {
            allMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }
    }
    catch {
        allMeta = {};
    }
    allMeta[kind] = meta;
    fs.writeFileSync(metaPath, JSON.stringify(allMeta, null, 2), 'utf-8');
}
export async function getCsvFileContent(eventId, kind) {
    const filePath = getCsvFilePath(eventId, kind);
    try {
        if (!fs.existsSync(filePath))
            return null;
        const text = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);
        const meta = await getCsvMeta(eventId, kind);
        return {
            text,
            meta: meta || {
                kind,
                filename: `${kind}.csv`,
                path: filePath,
                url: filePathToUrl(filePath),
                rows: text.split('\n').length - 1,
                updatedAt: stats.mtimeMs,
            },
        };
    }
    catch {
        return null;
    }
}
export async function getCsvMeta(eventId, kind) {
    const metaPath = getCsvMetaPath(eventId);
    try {
        if (!fs.existsSync(metaPath))
            return null;
        const allMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        return allMeta[kind] || null;
    }
    catch {
        return null;
    }
}
export async function listCsvMetadata(eventId) {
    const metaPath = getCsvMetaPath(eventId);
    try {
        if (!fs.existsSync(metaPath))
            return [];
        const allMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        return Object.values(allMeta);
    }
    catch {
        return [];
    }
}
export async function deleteCsvFileFromStorage(eventId, kind) {
    const filePath = getCsvFilePath(eventId, kind);
    try {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }
    catch { }
    const metaPath = getCsvMetaPath(eventId);
    try {
        if (fs.existsSync(metaPath)) {
            const allMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            delete allMeta[kind];
            fs.writeFileSync(metaPath, JSON.stringify(allMeta, null, 2), 'utf-8');
        }
    }
    catch { }
}
export async function deleteAllCsvFiles(eventId) {
    const kinds = ['master', 'start', 'finish', 'checkpoint'];
    for (const kind of kinds) {
        await deleteCsvFileFromStorage(eventId, kind).catch(() => { });
    }
}
export async function uploadFile(eventId, fileBuffer, originalFilename, folder) {
    const dir = folder === 'csv' ? getCsvDir(eventId) : getImagesDir(eventId);
    ensureDir(dir);
    const fileExt = path.extname(originalFilename);
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}${fileExt}`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    return { path: filePath, url: filePathToUrl(filePath) };
}
export async function uploadBannerImage(eventId, fileBuffer, originalFilename) {
    return uploadFile(eventId, fileBuffer, originalFilename, 'images');
}
export async function deleteFile(filePath) {
    if (fs.existsSync(filePath))
        fs.unlinkSync(filePath);
}
export async function deleteFileByUrl(fileUrl) {
    const relativePath = fileUrl.replace(`${getBaseUrl()}/uploads`, '');
    const filePath = path.join(getUploadDir(), relativePath);
    if (fs.existsSync(filePath))
        fs.unlinkSync(filePath);
}
export async function listFiles(eventId, folder) {
    const dir = folder === 'csv' ? getCsvDir(eventId) : getImagesDir(eventId);
    try {
        if (!fs.existsSync(dir))
            return [];
        return fs.readdirSync(dir).map(f => path.join(dir, f));
    }
    catch {
        return [];
    }
}
export function getFileUrl(filePath) {
    return filePathToUrl(filePath);
}
export function getStorageConfig() {
    return {
        provider: 'local-filesystem',
        uploadDir: getUploadDir(),
        baseUrl: getBaseUrl(),
    };
}
