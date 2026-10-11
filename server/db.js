import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve database path from environment
const rawDbPath = process.env.DB_PATH || "./data/shemaps.db";
const dbPath = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(__dirname, rawDbPath);

// Ensure the target directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite
export const db = new Database(dbPath);

// Enable WAL mode & foreign keys
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Run schema.sql on startup
const schemaPath = path.resolve(__dirname, "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf-8");
db.exec(schemaSql);

/**
 * SINGLE HELPER FUNCTION: Maps database snake_case row to frontend camelCase JSON
 * Easily customize response field names here if needed.
 */
export function toCamelCaseIssue(row, isSupported = false) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    category: row.category,
    location: row.location,
    severity: row.severity,
    status: row.status,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
    supportCount: Number(row.support_count),
    supported: Boolean(isSupported),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// DAO (Data Access Object) Layer
export const issueDao = {
  getAll({ status, category, severity, supporterId } = {}) {
    let sql;
    const params = [];

    if (supporterId) {
      sql = `
        SELECT i.*, CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_supported
        FROM issues i
        LEFT JOIN issue_supports s ON i.id = s.issue_id AND s.supporter_id = ?
        WHERE 1=1
      `;
      params.push(supporterId);
    } else {
      sql = `SELECT *, 0 AS is_supported FROM issues WHERE 1=1`;
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (severity) {
      sql += ` AND severity = ?`;
      params.push(severity);
    }

    sql += ` ORDER BY created_at DESC, id DESC`;

    const rows = db.prepare(sql).all(...params);
    return rows.map((row) => toCamelCaseIssue(row, Boolean(row.is_supported)));
  },

  getById(id, supporterId = null) {
    let row;
    if (supporterId) {
      row = db.prepare(`
        SELECT i.*, CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_supported
        FROM issues i
        LEFT JOIN issue_supports s ON i.id = s.issue_id AND s.supporter_id = ?
        WHERE i.id = ?
      `).get(supporterId, id);
    } else {
      row = db.prepare(`SELECT *, 0 AS is_supported FROM issues WHERE id = ?`).get(id);
    }

    if (!row) return null;
    return toCamelCaseIssue(row, Boolean(row.is_supported));
  },

  create({ title, description, category, location, severity, latitude, longitude }) {
    const stmt = db.prepare(`
      INSERT INTO issues (title, description, category, location, severity, status, latitude, longitude, support_count)
      VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, 1)
    `);

    const result = stmt.run(
      title,
      description || null,
      category,
      location,
      severity,
      latitude,
      longitude
    );

    return this.getById(result.lastInsertRowid);
  },

  updateStatus(id, newStatus, note = null) {
    const updateTx = db.transaction(() => {
      const existing = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);
      if (!existing) return null;

      // 1. Record transition in history
      db.prepare(`
        INSERT INTO issue_status_history (issue_id, old_status, new_status, note)
        VALUES (?, ?, ?, ?)
      `).run(id, existing.status, newStatus, note || null);

      // 2. Update issue
      db.prepare(`
        UPDATE issues
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newStatus, id);

      return db.prepare("SELECT *, 0 AS is_supported FROM issues WHERE id = ?").get(id);
    });

    const updatedRow = updateTx();
    if (!updatedRow) return null;
    return toCamelCaseIssue(updatedRow, false);
  },

  support(id, supporterId) {
    const supportTx = db.transaction(() => {
      const existing = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);
      if (!existing) {
        return { notFound: true };
      }

      // Check duplicate
      const alreadySupported = db.prepare(`
        SELECT id FROM issue_supports WHERE issue_id = ? AND supporter_id = ?
      `).get(id, supporterId);

      if (alreadySupported) {
        return { duplicate: true, issue: toCamelCaseIssue(existing, true) };
      }

      // 1. Insert support record
      db.prepare(`
        INSERT INTO issue_supports (issue_id, supporter_id)
        VALUES (?, ?)
      `).run(id, supporterId);

      // 2. Increment support_count
      db.prepare(`
        UPDATE issues
        SET support_count = support_count + 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(id);

      const updated = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);
      return { success: true, issue: toCamelCaseIssue(updated, true) };
    });

    return supportTx();
  },
};
