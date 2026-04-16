import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3069;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PROJECT_ROOT = IS_PRODUCTION ? path.resolve(__dirname, '..') : __dirname;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(PROJECT_ROOT, 'uploads');
app.use(cors());
app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            req.rawBody = Buffer.concat(chunks);
            next();
        });
    }
    else {
        next();
    }
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(PROJECT_ROOT, 'dist')));
app.use('/uploads', express.static(UPLOAD_DIR));
const apiHandler = async (req, res) => {
    const url = new URL(req.originalUrl, `http://${req.headers.host}`);
    let apiPath = url.pathname.replace('/api/', '').replace(/\//g, '-');
    const ext = IS_PRODUCTION ? '.js' : '.ts';
    const apiDir = IS_PRODUCTION ? path.join(__dirname, 'api') : path.join(PROJECT_ROOT, 'api');
    const apiFilePath = path.join(apiDir, `${apiPath}${ext}`);
    try {
        const apiModule = await import(apiFilePath);
        const handler = apiModule.default;
        if (!handler)
            throw new Error(`No default export found in ${apiFilePath}`);
        const contentType = req.headers['content-type'] || '';
        let body = null;
        let isBase64Encoded = false;
        if (contentType.includes('multipart/form-data') && req.rawBody) {
            body = req.rawBody.toString('binary');
        }
        else if (req.body && Object.keys(req.body).length > 0) {
            body = JSON.stringify(req.body);
        }
        const result = await handler({
            httpMethod: req.method,
            headers: req.headers,
            queryStringParameters: Object.fromEntries(url.searchParams),
            body,
            isBase64Encoded,
        });
        res.status(result.statusCode);
        Object.entries(result.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
        res.send(result.body);
    }
    catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
app.use('/api', apiHandler);
app.use((_req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'dist', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Upload directory: ${UPLOAD_DIR}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
