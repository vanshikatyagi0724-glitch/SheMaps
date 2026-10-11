import "dotenv/config";
import { db } from "./db.js";

export function seedData() {
  const rowCount = db.prepare("SELECT COUNT(*) AS count FROM issues").get();
  if (rowCount && rowCount.count > 0) {
    console.log(`ℹ️ Table 'issues' already contains ${rowCount.count} records. Skipping seed.`);
    return;
  }

  const samples = [
    {
      title: "Broken streetlight near bus stop",
      description: "Streetlight not functioning; the street is completely dark after 7 PM.",
      category: "Streetlight",
      location: "Sector 14, Gurugram",
      severity: "High",
      status: "Pending",
      latitude: 28.4720,
      longitude: 77.0425,
      support_count: 12,
    },
    {
      title: "Damaged footpath near market",
      description: "Broken pavement slabs and exposed wiring near market entrance.",
      category: "Footpath",
      location: "Sector 15, Gurugram",
      severity: "Medium",
      status: "In Progress",
      latitude: 28.4682,
      longitude: 77.0489,
      support_count: 8,
    },
    {
      title: "Bus stop needs better lighting",
      description: "Bus shelter has no active overhead bulb. Commuters waiting in the dark.",
      category: "Public Transport",
      location: "Huda City Centre",
      severity: "High",
      status: "Pending",
      latitude: 28.4595,
      longitude: 77.0726,
      support_count: 17,
    },
    {
      title: "Streetlight repaired",
      description: "Municipal staff repaired the lamp post near the community park.",
      category: "Streetlight",
      location: "Sector 31, Gurugram",
      severity: "Low",
      status: "Resolved",
      latitude: 28.4528,
      longitude: 77.0543,
      support_count: 5,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO issues (title, description, category, location, severity, status, latitude, longitude, support_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedTx = db.transaction(() => {
    for (const item of samples) {
      insert.run(
        item.title,
        item.description,
        item.category,
        item.location,
        item.severity,
        item.status,
        item.latitude,
        item.longitude,
        item.support_count
      );
    }
  });

  seedTx();
  console.log("✅ Successfully seeded 4 geolocated Gurugram issues into the database.");
}

// Run immediately if executed via 'npm run seed'
if (process.argv[1]?.endsWith("seed.js")) {
  seedData();
}
