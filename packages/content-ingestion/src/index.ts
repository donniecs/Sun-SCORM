/**
 * @file Content Ingestion Service - RUSTICI KILLER
 * @description Handles course upload, parsing, and validation
 * @version 0.1.0
 * @lastUpdated 2025-07-14 14:45
 * 
 * CHANGE LOG - 2025-07-14 14:45
 * =========================
 * WHAT: Updated to implement Phase 4 SCORM course upload with real functionality
 * WHY: Phase 4 requirement for actual SCORM course ingestion
 * IMPACT: Replaces placeholder logic with working upload, unzip, and manifest parsing
 * NOTES FOR CHATGPT: Now includes POST /upload endpoint with real ZIP processing
 * REPLACES: Placeholder /courses endpoint with actual /upload implementation
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import yauzl from 'yauzl';
import xml2js from 'xml2js';
import { v4 as uuidv4 } from 'uuid';

// Import types from local types definition
interface CourseUploadResponse {
  title: string;
  version: string;
  fileCount: number;
  structure: string[];
}

interface CourseUploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface CourseUploadApiResponse {
  success: boolean;
  data?: CourseUploadResponse;
  error?: CourseUploadError;
}

const app = express();
const PORT = process.env.PORT || 3002;

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'tmp', 'uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Only allow ZIP files
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        path.extname(file.originalname).toLowerCase() === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// PHASE 4 IMPLEMENTATION - SCORM COURSE UPLOAD
// =============================================================================

/**
 * POST /upload
 * Upload and process a SCORM course ZIP file
 * Returns parsed metadata from imsmanifest.xml
 */
app.post('/upload', upload.single('course'), async (req, res) => {
  const tempDirs: string[] = [];
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'Course ZIP file is required'
        }
      } as CourseUploadApiResponse);
    }

    console.log('📦 Processing course upload:', req.file.originalname);
    
    // Generate unique course ID for this upload
    const courseId = uuidv4();
    
    // Create temporary extraction directory
    const tempExtractDir = path.join(process.cwd(), 'tmp', 'extract', uuidv4());
    tempDirs.push(tempExtractDir);
    await fs.mkdir(tempExtractDir, { recursive: true });

    // Extract ZIP file to temporary location first
    const extractedFiles = await extractZipFile(req.file.path, tempExtractDir);
    console.log(`📁 Extracted ${extractedFiles.length} files`);

    // Create persistent storage directory for this course
    const persistentDir = path.join(process.cwd(), 'scorm-packages', courseId);
    await fs.mkdir(persistentDir, { recursive: true });

    // Copy extracted files to persistent location
    await copyDirectory(tempExtractDir, persistentDir);
    console.log(`💾 Course ${courseId} stored persistently at: ${persistentDir}`);

    // Find and parse imsmanifest.xml
    const manifestPath = path.join(tempExtractDir, 'imsmanifest.xml');
    let actualManifestPath = manifestPath;
    
    try {
      await fs.access(manifestPath);
    } catch (error) {
      // Try to find manifest in subdirectories
      const foundManifest = await findManifestFile(tempExtractDir);
      if (foundManifest) {
        actualManifestPath = foundManifest;
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MANIFEST_NOT_FOUND',
            message: 'imsmanifest.xml not found in course package'
          }
        } as CourseUploadApiResponse);
      }
    }

    // Parse manifest
    const manifestData = await parseManifest(actualManifestPath);
    
    // Build response
    const response: CourseUploadResponse = {
      title: manifestData.title || req.file.originalname.replace('.zip', ''),
      version: manifestData.version || '1.0',
      fileCount: extractedFiles.length,
      structure: extractedFiles.map(f => path.relative(tempExtractDir, f)).slice(0, 50) // Limit to first 50 files
    };

    console.log('✅ Course processed successfully:', response.title);

    res.json({
      success: true,
      data: {
        ...response,
        courseId: courseId,
        extractedPath: persistentDir
      }
    });

  } catch (error) {
    console.error('❌ Course upload error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'Failed to process course package'
      }
    } as CourseUploadApiResponse);
  } finally {
    // Clean up temporary files
    try {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      
      for (const dir of tempDirs) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract ZIP file to destination directory
 */
async function extractZipFile(zipPath: string, destDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const extractedFiles: string[] = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        return reject(new Error(`Failed to open ZIP file: ${err.message}`));
      }

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        const entryPath = path.join(destDir, entry.fileName);
        
        if (entry.fileName.endsWith('/')) {
          // Directory entry
          fs.mkdir(entryPath, { recursive: true })
            .then(() => zipfile.readEntry())
            .catch(reject);
        } else {
          // File entry
          extractFileEntry(zipfile, entry, entryPath, extractedFiles)
            .then(() => zipfile.readEntry())
            .catch(reject);
        }
      });

      zipfile.on('end', () => {
        resolve(extractedFiles);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract a single file entry from ZIP
 */
async function extractFileEntry(zipfile: any, entry: any, entryPath: string, extractedFiles: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err: any, readStream: any) => {
      if (err) {
        return reject(new Error(`Failed to read entry: ${err.message}`));
      }

      // Ensure directory exists
      fs.mkdir(path.dirname(entryPath), { recursive: true })
        .then(() => {
          const writeStream = require('fs').createWriteStream(entryPath);
          readStream.pipe(writeStream);
          
          writeStream.on('close', () => {
            extractedFiles.push(entryPath);
            resolve();
          });
          
          writeStream.on('error', reject);
        })
        .catch(reject);
    });
  });
}

/**
 * Find imsmanifest.xml in directory tree
 */
async function findManifestFile(dir: string): Promise<string | null> {
  try {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile() && file.toLowerCase() === 'imsmanifest.xml') {
        return fullPath;
      }
      
      if (stat.isDirectory()) {
        const found = await findManifestFile(fullPath);
        if (found) return found;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching for manifest file:', error);
    return null;
  }
}

/**
 * Parse imsmanifest.xml and extract metadata
 */
async function parseManifest(manifestPath: string): Promise<{ title: string; version: string; }> {
  try {
    const xmlContent = await fs.readFile(manifestPath, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlContent);
    
    // Extract title from manifest
    let title = 'Untitled Course';
    
    // Try to get title from LOM metadata
    const lomTitle = result.manifest?.metadata?.lom?.general?.title?.langstring;
    if (lomTitle) {
      title = typeof lomTitle === 'string' ? lomTitle : lomTitle._ || title;
    }
    
    // Try alternative title locations
    if (title === 'Untitled Course') {
      const orgTitle = result.manifest?.organizations?.organization?.title;
      if (orgTitle) {
        title = orgTitle;
      }
    }
    
    // Extract version
    const version = result.manifest?.metadata?.schemaversion || '1.0';
    
    return { title, version };
    
  } catch (error) {
    console.error('Manifest parsing error:', error);
    throw new Error('Failed to parse manifest file');
  }
}

/**
 * Copy directory recursively from source to destination
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    console.error('Error copying directory:', error);
    throw new Error(`Failed to copy directory from ${src} to ${dest}`);
  }
}

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// COURSE MANAGEMENT ENDPOINTS
// =============================================================================

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'content-ingestion',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: process.uptime()
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Handle multer errors
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Course package exceeds maximum file size limit'
        }
      });
    }
  }
  
  if (error.message === 'Only ZIP files are allowed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Only ZIP files are allowed'
      }
    });
  }
  
  next(error);
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Content Ingestion endpoint not found'
    }
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Content Ingestion Service error:', err);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Content Ingestion Service error'
    }
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`📦 Content Ingestion Service listening on port ${PORT}`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    console.log(`📁 Upload endpoint: http://localhost:${PORT}/upload`);
  });
}

export { app };
