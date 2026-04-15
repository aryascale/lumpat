import fs from 'node:fs';
import path from 'node:path';
import type { CsvKind } from './config';

// Get upload directory from environment or use default
const getUploadDir = (): string => {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
};

const getBaseUrl = (): string => {
  return process.env.BASE_URL || 'http://localhost:3001';
};

export type StoredCsvMeta = {
  kind: CsvKind;
  filename: string;
  path: string;
  url: string;
  rows: number;
  updatedAt: number;
};

// Ensure directory exists
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Get CSV directory path for an event
function getCsvDir(eventId: string): string {
  return path.join(getUploadDir(), 'events', eventId, 'csv');
}

// Get images directory path for an event
function getImagesDir(eventId: string): string {
  return path.join(getUploadDir(), 'events', eventId, 'images');
}

// Get CSV file path
function getCsvFilePath(eventId: string, kind: CsvKind): string {
  return path.join(getCsvDir(eventId), `${kind}.csv`);
}

// Get CSV meta file path
function getCsvMetaPath(eventId: string): string {
  return path.join(getCsvDir(eventId), '_meta.json');
}

// Convert file path to public URL
function filePathToUrl(filePath: string): string {
  const uploadDir = getUploadDir();
  const relativePath = filePath.replace(uploadDir, '').replace(/\\/g, '/');
  return `${getBaseUrl()}/uploads${relativePath}`;
}

// Upload CSV file to local filesystem
export async function uploadCsvFile(
  eventId: string,
  kind: CsvKind,
  text: string,
  filename: string,
  rows: number
): Promise<StoredCsvMeta> {
  const csvDir = getCsvDir(eventId);
  ensureDir(csvDir);

  const filePath = getCsvFilePath(eventId, kind);
  fs.writeFileSync(filePath, text, 'utf-8');

  const meta: StoredCsvMeta = {
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

// Update CSV metadata file
async function updateCsvMetadata(
  eventId: string,
  kind: CsvKind,
  meta: StoredCsvMeta
): Promise<void> {
  const metaPath = getCsvMetaPath(eventId);
  let allMeta: Record<string, StoredCsvMeta> = {};

  try {
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf-8');
      allMeta = JSON.parse(content);
    }
  } catch {
    allMeta = {};
  }

  allMeta[kind] = meta;
  fs.writeFileSync(metaPath, JSON.stringify(allMeta, null, 2), 'utf-8');
}

// Get CSV file content
export async function getCsvFileContent(
  eventId: string,
  kind: CsvKind
): Promise<{ text: string; meta: StoredCsvMeta } | null> {
  const filePath = getCsvFilePath(eventId, kind);

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

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
  } catch (error: any) {
    console.error(`Error getting CSV ${kind}:`, error);
    return null;
  }
}

// Get metadata for a specific CSV file
export async function getCsvMeta(
  eventId: string,
  kind: CsvKind
): Promise<StoredCsvMeta | null> {
  const metaPath = getCsvMetaPath(eventId);

  try {
    if (!fs.existsSync(metaPath)) {
      return null;
    }

    const content = fs.readFileSync(metaPath, 'utf-8');
    const allMeta = JSON.parse(content) as Record<string, StoredCsvMeta>;
    return allMeta[kind] || null;
  } catch {
    return null;
  }
}

// List all CSV metadata for an event
export async function listCsvMetadata(eventId: string): Promise<StoredCsvMeta[]> {
  const metaPath = getCsvMetaPath(eventId);

  try {
    if (!fs.existsSync(metaPath)) {
      return [];
    }

    const content = fs.readFileSync(metaPath, 'utf-8');
    const allMeta = JSON.parse(content) as Record<string, StoredCsvMeta>;
    return Object.values(allMeta);
  } catch {
    return [];
  }
}

// Delete CSV file from storage
export async function deleteCsvFileFromStorage(
  eventId: string,
  kind: CsvKind
): Promise<void> {
  const filePath = getCsvFilePath(eventId, kind);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Error deleting CSV ${kind}:`, error);
  }

  // Update metadata
  const metaPath = getCsvMetaPath(eventId);
  try {
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf-8');
      const allMeta = JSON.parse(content) as Record<string, StoredCsvMeta>;
      delete allMeta[kind];
      fs.writeFileSync(metaPath, JSON.stringify(allMeta, null, 2), 'utf-8');
    }
  } catch {
    // Ignore metadata update errors
  }
}

// Delete all CSV files for an event
export async function deleteAllCsvFiles(eventId: string): Promise<void> {
  const kinds: CsvKind[] = ['master', 'start', 'finish', 'checkpoint'];
  for (const kind of kinds) {
    await deleteCsvFileFromStorage(eventId, kind).catch(() => {});
  }
}

// Upload a file (generic)
export async function uploadFile(
  eventId: string,
  fileBuffer: Buffer,
  originalFilename: string,
  folder: 'csv' | 'images'
): Promise<{ path: string; url: string }> {
  const dir = folder === 'csv' ? getCsvDir(eventId) : getImagesDir(eventId);
  ensureDir(dir);

  const fileExt = path.extname(originalFilename);
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}${fileExt}`;
  const filePath = path.join(dir, fileName);

  fs.writeFileSync(filePath, fileBuffer);

  return {
    path: filePath,
    url: filePathToUrl(filePath),
  };
}

// Upload banner image
export async function uploadBannerImage(
  eventId: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ path: string; url: string }> {
  return uploadFile(eventId, fileBuffer, originalFilename, 'images');
}

// Delete a file by path
export async function deleteFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

// Delete a file by URL
export async function deleteFileByUrl(fileUrl: string): Promise<void> {
  try {
    const baseUrl = getBaseUrl();
    const uploadDir = getUploadDir();
    
    // Convert URL to file path
    const relativePath = fileUrl.replace(`${baseUrl}/uploads`, '');
    const filePath = path.join(uploadDir, relativePath);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file by URL:', error);
    throw error;
  }
}

// List files in a folder
export async function listFiles(eventId: string, folder: 'csv' | 'images'): Promise<string[]> {
  const dir = folder === 'csv' ? getCsvDir(eventId) : getImagesDir(eventId);

  try {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    return files.map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

// Get file URL from path
export function getFileUrl(filePath: string): string {
  return filePathToUrl(filePath);
}

// Get storage configuration info
export function getStorageConfig() {
  return {
    provider: 'local-filesystem',
    uploadDir: getUploadDir(),
    baseUrl: getBaseUrl(),
  };
}
