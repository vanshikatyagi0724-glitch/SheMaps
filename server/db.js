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
 * Computes priority score and days pending for an issue.
 * Formula: priorityScore = (severityWeight * 10) + (supportCount * 2) + daysPending
 * Weights: High = 3, Medium = 2, Low = 1
 * daysPending: Whole days elapsed since created_at (minimum 0)
 */
export function calculatePriority(severity, supportCount, createdAt) {
  const severityWeights = { High: 3, Medium: 2, Low: 1 };
  const weight = severityWeights[severity] || 1;
  const count = Number(supportCount) || 1;

  let daysPending = 0;
  if (createdAt) {
    const createdDate = new Date(
      createdAt.replace(" ", "T") + (createdAt.includes("Z") ? "" : "Z")
    );
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    if (diffMs > 0) {
      daysPending = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  const priorityScore = weight * 10 + count * 2 + daysPending;
  return { priorityScore, daysPending };
}

/**
 * SINGLE HELPER FUNCTION: Maps database snake_case row to frontend camelCase JSON
 * Easily customize response field names here if needed.
 */
export function toCamelCaseIssue(row, isSupported = false) {
  if (!row) return null;

  const { priorityScore, daysPending } = calculatePriority(
    row.severity,
    row.support_count,
    row.created_at
  );

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
    isSample: Boolean(row.is_sample),
    daysPending,
    priorityScore,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// DAO (Data Access Object) Layer
export const issueDao = {
  getAll({ status, category, severity, supporterId, sort } = {}) {
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
    const mapped = rows.map((row) => toCamelCaseIssue(row, Boolean(row.is_supported)));

    if (sort === "priority") {
      mapped.sort((a, b) => b.priorityScore - a.priorityScore);
    }

    return mapped;
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

  create({ title, description, category, location, severity, latitude, longitude, supporterId = null }) {
    const createTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO issues (title, description, category, location, severity, status, latitude, longitude, support_count, is_sample)
        VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, 1, 0)
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

      const issueId = result.lastInsertRowid;

      if (supporterId) {
        db.prepare(`
          INSERT INTO issue_supports (issue_id, supporter_id)
          VALUES (?, ?)
        `).run(issueId, supporterId);
      }

      return issueId;
    });

    const issueId = createTx();
    return this.getById(issueId, supporterId);
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

  getDashboardData() {
    // 1. Totals
    const totalRow = db.prepare("SELECT COUNT(*) AS count FROM issues").get();
    const pendingRow = db.prepare("SELECT COUNT(*) AS count FROM issues WHERE status = 'Pending'").get();
    const inProgressRow = db.prepare("SELECT COUNT(*) AS count FROM issues WHERE status = 'In Progress'").get();
    const resolvedRow = db.prepare("SELECT COUNT(*) AS count FROM issues WHERE status = 'Resolved'").get();

    const totals = {
      total: totalRow ? totalRow.count : 0,
      pending: pendingRow ? pendingRow.count : 0,
      inProgress: inProgressRow ? inProgressRow.count : 0,
      resolved: resolvedRow ? resolvedRow.count : 0,
    };

    // 2. By Category (all 6 categories, including zeros)
    const ALL_CATEGORIES = [
      "Streetlight",
      "Footpath",
      "Public Transport",
      "Road Damage",
      "Accessibility",
      "Other",
    ];
    const categoryRows = db.prepare(`
      SELECT category, COUNT(*) as count FROM issues GROUP BY category
    `).all();
    const byCategory = {};
    for (const cat of ALL_CATEGORIES) {
      byCategory[cat] = 0;
    }
    for (const r of categoryRows) {
      if (byCategory[r.category] !== undefined) {
        byCategory[r.category] = r.count;
      }
    }

    // 3. By Severity (High, Medium, Low, including zeros)
    const ALL_SEVERITIES = ["High", "Medium", "Low"];
    const severityRows = db.prepare(`
      SELECT severity, COUNT(*) as count FROM issues GROUP BY severity
    `).all();
    const bySeverity = {};
    for (const sev of ALL_SEVERITIES) {
      bySeverity[sev] = 0;
    }
    for (const r of severityRows) {
      if (bySeverity[r.severity] !== undefined) {
        bySeverity[r.severity] = r.count;
      }
    }

    // 4. Hotspots: top 5 areas with most unresolved issues, rounded to 3 decimals, ignore null coords
    const unresolvedWithCoords = db.prepare(`
      SELECT ROUND(latitude, 3) AS lat, ROUND(longitude, 3) AS lng, category, location
      FROM issues
      WHERE status != 'Resolved' AND latitude IS NOT NULL AND longitude IS NOT NULL
    `).all();

    const clusterMap = {};
    for (const row of unresolvedWithCoords) {
      const key = `${row.lat},${row.lng}`;
      if (!clusterMap[key]) {
        clusterMap[key] = {
          latitude: Number(row.lat),
          longitude: Number(row.lng),
          count: 0,
          categories: {},
          locations: {},
        };
      }
      clusterMap[key].count++;
      clusterMap[key].categories[row.category] =
        (clusterMap[key].categories[row.category] || 0) + 1;
      const locText = (row.location || "").trim();
      if (locText) {
        clusterMap[key].locations[locText] =
          (clusterMap[key].locations[locText] || 0) + 1;
      }
    }

    const hotspots = Object.values(clusterMap)
      .map((cluster) => {
        let topCategory = "";
        let maxCount = 0;
        for (const [cat, cnt] of Object.entries(cluster.categories)) {
          if (cnt > maxCount) {
            maxCount = cnt;
            topCategory = cat;
          }
        }

        let label = "";
        let maxLocCount = 0;
        for (const [loc, cnt] of Object.entries(cluster.locations)) {
          if (cnt > maxLocCount) {
            maxLocCount = cnt;
            label = loc;
          }
        }
        if (!label) {
          label = `${cluster.latitude.toFixed(3)}° N, ${cluster.longitude.toFixed(3)}° E`;
        }

        return {
          label,
          latitude: cluster.latitude,
          longitude: cluster.longitude,
          count: cluster.count,
          topCategory,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 5. Ranked: top 10 unresolved issues sorted by priorityScore descending
    const unresolvedRows = db.prepare(`
      SELECT * FROM issues WHERE status != 'Resolved'
    `).all();

    const unresolvedIssues = unresolvedRows.map((row) => toCamelCaseIssue(row, false));
    unresolvedIssues.sort((a, b) => b.priorityScore - a.priorityScore);

    const ranked = unresolvedIssues.slice(0, 10).map((i) => ({
      id: i.id,
      title: i.title,
      category: i.category,
      severity: i.severity,
      status: i.status,
      location: i.location,
      supportCount: i.supportCount,
      daysPending: i.daysPending,
      priorityScore: i.priorityScore,
    }));

    return {
      totals,
      byCategory,
      bySeverity,
      hotspots,
      ranked,
    };
  },
};
