import "dotenv/config";
import { db } from "./db.js";

export function seedData() {
  const rowCount = db.prepare("SELECT COUNT(*) AS count FROM issues").get();
  if (rowCount && rowCount.count > 0) {
    console.log(`ℹ️ Table 'issues' already contains ${rowCount.count} records. Skipping seed.`);
    return;
  }

  const samples = [
    // --- Cluster 1: Sector 14 Market, Gurugram (3 unresolved issues grouped around 28.472, 77.043) ---
    {
      title: "Broken streetlight near main market gate",
      description: "Streetlight fixture completely unpowered; shoppers and pedestrians walk in darkness.",
      category: "Streetlight",
      location: "Sector 14 Market, Gurugram",
      severity: "High",
      status: "Pending",
      latitude: 28.4721,
      longitude: 77.0428,
      support_count: 14,
      daysAgo: "-2 days",
    },
    {
      title: "Cracked footpath slabs outside grocery lane",
      description: "Several paver blocks have caved in creating tripping hazards for elderly residents.",
      category: "Footpath",
      location: "Sector 14 Market, Gurugram",
      severity: "Medium",
      status: "Pending",
      latitude: 28.4724,
      longitude: 77.0431,
      support_count: 9,
      daysAgo: "-4 days",
    },
    {
      title: "Deep pothole near market parking entrance",
      description: "Asphalt collapsed near the vehicle entry; municipal barrier tape needed.",
      category: "Road Damage",
      location: "Sector 14 Market, Gurugram",
      severity: "Medium",
      status: "In Progress",
      latitude: 28.4719,
      longitude: 77.0433,
      support_count: 11,
      daysAgo: "-7 days",
    },

    // --- Cluster 2: HUDA City Centre Metro, Gurugram (3 unresolved issues grouped around 28.459, 77.073) ---
    {
      title: "Bus stop shelter lacks overhead illumination",
      description: "Commuters waiting for late-night buses report zero active lighting beneath the canopy.",
      category: "Public Transport",
      location: "HUDA City Centre Metro, Gurugram",
      severity: "High",
      status: "Pending",
      latitude: 28.4592,
      longitude: 77.0728,
      support_count: 15,
      daysAgo: "-3 days",
    },
    {
      title: "Wheelchair ramp blocked by unpaved curb",
      description: "Accessible ramp slope terminates into rough dirt embankment with no smooth transition.",
      category: "Accessibility",
      location: "HUDA City Centre Metro, Gurugram",
      severity: "Medium",
      status: "Pending",
      latitude: 28.4594,
      longitude: 77.0732,
      support_count: 8,
      daysAgo: "-6 days",
    },
    {
      title: "Overflowing municipal waste bin near auto stand",
      description: "Waste bin has tipped over onto pedestrian walkway, attracting stray animals.",
      category: "Other",
      location: "HUDA City Centre Metro, Gurugram",
      severity: "Low",
      status: "Pending",
      latitude: 28.4589,
      longitude: 77.0734,
      support_count: 4,
      daysAgo: "-10 days",
    },

    // --- Distributed Issues across Gurugram ---
    {
      title: "Missing tactile paving on pedestrian crossing",
      description: "Footpath descent toward metro gate lacks tactile guiding tiles for visually impaired commuters.",
      category: "Footpath",
      location: "Sikanderpur Metro Station, Gurugram",
      severity: "High",
      status: "Pending",
      latitude: 28.4818,
      longitude: 77.0927,
      support_count: 13,
      daysAgo: "-1 days",
    },
    {
      title: "Flickering high-mast light outside office hub",
      description: "High-mast pole intermittently blinks off leaving service lane dark.",
      category: "Streetlight",
      location: "Cyber City, DLF Phase 2, Gurugram",
      severity: "High",
      status: "Pending",
      latitude: 28.4952,
      longitude: 77.0891,
      support_count: 7,
      daysAgo: "-8 days",
    },
    {
      title: "Broken handrail on pedestrian overpass",
      description: "Steel handrail section is detached and loose on the stairs.",
      category: "Accessibility",
      location: "Sector 29 Leisure Valley, Gurugram",
      severity: "Medium",
      status: "In Progress",
      latitude: 28.4682,
      longitude: 77.0621,
      support_count: 6,
      daysAgo: "-12 days",
    },

    // --- Resolved Issues ---
    {
      title: "New LED streetlight pole installed and verified",
      description: "Municipal electrical authority replaced burnt ballast and installed bright LED fixture.",
      category: "Streetlight",
      location: "Sector 56 Rapid Metro, Gurugram",
      severity: "Low",
      status: "Resolved",
      latitude: 28.4231,
      longitude: 77.1018,
      support_count: 12,
      daysAgo: "-15 days",
    },
    {
      title: "Repaired speed bump and fresh reflective paint",
      description: "Damaged speed breaker re-leveled with asphalt and painted with yellow caution stripes.",
      category: "Road Damage",
      location: "Galleria Market, DLF Phase 4, Gurugram",
      severity: "Medium",
      status: "Resolved",
      latitude: 28.4674,
      longitude: 77.0812,
      support_count: 5,
      daysAgo: "-18 days",
    },
    {
      title: "Feeder bus timetable display board fixed",
      description: "Digital bus arrival screen serviced and showing live route schedules.",
      category: "Public Transport",
      location: "Old Railway Road, Sector 4, Gurugram",
      severity: "Low",
      status: "Resolved",
      latitude: 28.4789,
      longitude: 77.0185,
      support_count: 2,
      daysAgo: "-20 days",
    },
  ];

  const insert = db.prepare(`
    INSERT INTO issues (
      title, description, category, location, severity, status,
      latitude, longitude, support_count, is_sample, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', ?), datetime('now', ?))
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
        item.support_count,
        item.daysAgo,
        item.daysAgo
      );
    }
  });

  seedTx();
  console.log("✅ Successfully seeded 12 geolocated Gurugram issues with realistic clusters and isSample=1.");
}

// Run immediately if executed via 'npm run seed'
if (process.argv[1]?.endsWith("seed.js")) {
  seedData();
}
