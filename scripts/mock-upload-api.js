/**
 * Mock API for post attachment upload flow (uploadAndProcessPostAttachment).
 *
 * Implements:
 *   POST /api/v1/attachments/upload-chunk  — receive chunk (multipart)
 *   POST /api/v1/attachments/merge-chunks   — merge chunks, return merged_path etc.
 *   POST /api/v1/attachments/process-upload — process merged file, return attachmentID etc.
 *
 * Run: node scripts/mock-upload-api.js
 * Then point your app's api baseURL to http://YOUR_IP:3333/api/v1 (e.g. in api.client.ts)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.MOCK_UPLOAD_PORT) || 3333;
const UPLOADS_DIR = path.join(__dirname, "..", "uploads-mock");

// In-memory store: file_id -> { chunks: Map<chunk_index, Buffer>, original_name, total_chunks }
const uploads = new Map();

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log("[mock] Created", UPLOADS_DIR);
  }
}

function parseMultipart(buffer, boundary) {
  if (!boundary || !buffer.length) return null;
  const parts = [];
  const b = Buffer.from(`--${boundary}`);
  const bEnd = Buffer.from(`--${boundary}--`);
  let start = buffer.indexOf(b) + b.length;
  if (start < b.length) return null;
  while (start < buffer.length) {
    let end = buffer.indexOf(b, start);
    if (end === -1) end = buffer.indexOf(bEnd, start);
    if (end === -1) end = buffer.length;
    const block = buffer.subarray(start, end);
    const headerEnd = block.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) {
      start = end + (buffer[end] === 45 ? bEnd.length : b.length);
      continue;
    }
    const headers = block.subarray(0, headerEnd).toString("utf8");
    const body = block.subarray(headerEnd + 4);
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : null;
    const filename = filenameMatch ? filenameMatch[1] : null;
    parts.push({ name, filename, body });
    start = end + (buffer.subarray(end, end + 3).toString() === "--" ? bEnd.length : b.length);
  }
  return parts;
}

function parseReq(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const routes = {
  "POST /api/v1/attachments/upload-chunk": async (req, body, res) => {
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/);
    const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : null;
    const parts = parseMultipart(body, boundary);
    if (!parts) {
      send(res, 400, { success: false, message: "Invalid multipart" });
      return;
    }
    const fields = {};
    for (const p of parts) {
      if (p.filename !== undefined && p.filename !== null) {
        fields[p.name] = { filename: p.filename, body: p.body };
      } else if (p.name) {
        fields[p.name] = p.body.toString("utf8");
      }
    }
    const fileId = fields.file_id;
    const chunkIndex = fields.chunk_index;
    const totalChunks = parseInt(fields.total_chunks, 10);
    const originalName = fields.original_name;
    const filePart = fields.file;
    if (!fileId || !chunkIndex || !totalChunks || !originalName || !filePart || !filePart.body) {
      send(res, 400, { success: false, message: "Missing file_id, chunk_index, total_chunks, original_name or file" });
      return;
    }
    if (!uploads.has(fileId)) {
      uploads.set(fileId, { chunks: new Map(), original_name: originalName, total_chunks: totalChunks });
    }
    const rec = uploads.get(fileId);
    rec.chunks.set(parseInt(chunkIndex, 10), filePart.body);
    console.log("[mock] Chunk", chunkIndex, "/", totalChunks, "for", fileId);
    send(res, 200, { success: true, chunk: parseInt(chunkIndex, 10), total_chunks: totalChunks });
  },

  "POST /api/v1/attachments/merge-chunks": async (req, body, res) => {
    let json;
    try {
      json = JSON.parse(body.toString());
    } catch {
      send(res, 400, { success: false, message: "Invalid JSON" });
      return;
    }
    const { file_id, original_name, total_chunks } = json;
    if (!file_id || !original_name || total_chunks == null) {
      send(res, 400, { success: false, message: "Missing file_id, original_name or total_chunks" });
      return;
    }
    const rec = uploads.get(file_id);
    if (!rec || rec.chunks.size !== total_chunks) {
      send(res, 400, {
        success: false,
        message: `Chunks missing: have ${rec ? rec.chunks.size : 0}, need ${total_chunks}`,
      });
      return;
    }
    ensureUploadsDir();
    const chunks = [];
    for (let i = 1; i <= total_chunks; i++) {
      chunks.push(rec.chunks.get(i));
    }
    const merged = Buffer.concat(chunks);
    const ext = path.extname(original_name) || "";
    const base = path.basename(original_name, ext) || "merged";
    const mergedName = `${base}_${file_id}${ext}`;
    const mergedPath = path.join(UPLOADS_DIR, mergedName);
    fs.writeFileSync(mergedPath, merged);
    uploads.delete(file_id);
    console.log("[mock] Merged", total_chunks, "chunks ->", mergedPath);
    send(res, 200, {
      success: true,
      merged_path: mergedPath,
      file_id,
      original_name,
    });
  },

  "POST /api/v1/attachments/process-upload": async (req, body, res) => {
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/);
    const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : null;
    const parts = parseMultipart(body, boundary);
    if (!parts) {
      send(res, 400, { success: false, message: "Invalid multipart" });
      return;
    }
    const fields = {};
    for (const p of parts) {
      if (p.filename !== undefined && p.filename !== null) {
        fields[p.name] = { filename: p.filename, body: p.body };
      } else if (p.name) {
        fields[p.name] = p.body.toString("utf8");
      }
    }
    const fileId = fields.file_id;
    const originalName = fields.original_name;
    const type = fields.type || "post";
    if (!fileId || !originalName) {
      send(res, 400, { success: false, message: "Missing file_id or original_name" });
      return;
    }
    const attachmentID = `att_mock_${randomUUID().slice(0, 8)}`;
    const ext = path.extname(originalName);
    const isVideo = /\.(mp4|mov|webm|mkv|avi)$/i.test(originalName);
    console.log("[mock] process-upload", fileId, "-> attachmentID", attachmentID);
    send(res, 200, {
      success: true,
      isVideo,
      attachmentID,
      path: `/uploads/${attachmentID}${ext}`,
      type,
      thumbnail: isVideo ? `/uploads/${attachmentID}_thumb.jpg` : undefined,
      preview_url: isVideo ? `/uploads/${attachmentID}_preview.mp4` : undefined,
    });
  },
};

const server = http.createServer(async (req, res) => {
  const key = `${req.method} ${req.url.split("?")[0]}`;
  const handler = routes[key];
  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", path: key }));
    return;
  }
  const body = await parseReq(req);
  try {
    await handler(req, body, res);
  } catch (e) {
    console.error("[mock]", e);
    send(res, 500, { success: false, message: String(e.message) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("[mock] Upload API at http://localhost:" + PORT + "/api/v1");
  console.log("[mock] Set app baseURL to http://YOUR_IP:" + PORT + "/api/v1 to hit this server.");
  console.log("[mock] Merged files will be written to:", UPLOADS_DIR);
});
