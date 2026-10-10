import { useEffect, useState } from "react";

import LocationPicker from "./components/LocationPicker";

import IssueMap from "./components/IssueMap";

import "./App.css";

const initialIssues = [
  {
    id: 1,
    category: "Streetlight",
    title: "Broken streetlight near bus stop",
    location: "Sector 14, Gurugram",
    severity: "High",
    status: "Pending",
    reports: 12,
    icon: "💡",
  },
  {
    id: 2,
    category: "Footpath",
    title: "Damaged footpath near market",
    location: "Sector 15, Gurugram",
    severity: "Medium",
    status: "In Progress",
    reports: 8,
    icon: "🚶",
  },
  {
    id: 3,
    category: "Public Transport",
    title: "Bus stop needs better lighting",
    location: "Huda City Centre",
    severity: "High",
    status: "Pending",
    reports: 17,
    icon: "🚌",
  },
  {
    id: 4,
    category: "Streetlight",
    title: "Streetlight repaired",
    location: "Sector 31, Gurugram",
    severity: "Low",
    status: "Resolved",
    reports: 5,
    icon: "✨",
  },
];

function App() {
  const [issues, setIssues] = useState(() => {
    try {
      const saved = localStorage.getItem("shemaps-issues");

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Could not load saved reports:", error);
    }

    return initialIssues;
  });

  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  
const [selectedCoordinates, setSelectedCoordinates] = useState(null);

  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("shemaps-issues", JSON.stringify(issues));
    } catch (error) {
      console.error("Could not save reports:", error);
      setNotice("Reports could not be saved in this browser.");
    }
  }, [issues]);

  const pendingCount = issues.filter(
    (issue) => issue.status === "Pending"
  ).length;

  const progressCount = issues.filter(
    (issue) => issue.status === "In Progress"
  ).length;

  const resolvedCount = issues.filter(
    (issue) => issue.status === "Resolved"
  ).length;

  const filteredIssues =
    filter === "All"
      ? issues
      : issues.filter((issue) => issue.status === filter);

  function updateStatus(id, newStatus) {
    setIssues((currentIssues) =>
      currentIssues.map((issue) =>
        issue.id === id ? { ...issue, status: newStatus } : issue
      )
    );

    setNotice("Issue status updated successfully.");
  }

  function addIssue(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const category = formData.get("category");
    const title = String(formData.get("title") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const severity = formData.get("severity");

    if (!title || !location) {
      setNotice("Please enter both the issue title and location.");
      return;
    }

    const categoryIcons = {
      Streetlight: "💡",
      Footpath: "🚶",
      "Public Transport": "🚌",
      "Road Damage": "🚧",
      Accessibility: "♿",
      Other: "📍",
    };

    
const newIssue = {
  id: Date.now(),
  category: category,
  title: title,
  location: location,
  latitude: selectedCoordinates?.lat ?? null,
  longitude: selectedCoordinates?.lng ?? null,
  severity: severity,
  status: "Pending",
  reports: 1,
  icon: categoryIcons[category] || "📍",
};


    setIssues((currentIssues) => [newIssue, ...currentIssues]);
    setFilter("All");
    setSelectedCoordinates(null);
    setShowForm(false);
    setNotice("Your issue has been reported successfully!");
    form.reset();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">♡</div>
          <div>
            <h2>SheMaps</h2>
            <span>SMARTER CITIES, TOGETHER</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <button
          className="nav-item active"
          onClick={() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        >
          <span>▦</span> Dashboard
        </button>

        <button
          className="nav-item"
          onClick={() =>
            document.getElementById("issues")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          <span>◎</span> Community Reports
        </button>

        
<button
  className="nav-item"
  onClick={() => {
    setSelectedCoordinates(null);
    setShowForm(true);
  }}
>
  <span>＋</span> Report an Issue
</button>


        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="note-symbol">✳</div>
            <h3>Her city. Her voice.</h3>
            <p>
              Small reports can inspire meaningful changes in the places
              we share.
            </p>
          </div>

          <div className="sidebar-footer">
            <span className="online-dot" />
            Community-powered prototype
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Dashboard</strong>
          </div>

          <div className="topbar-right">
            <span className="city-pill">⌖ Gurugram, India</span>
            <div className="avatar">V</div>
          </div>
        </header>

        <section className="welcome-section">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              COMMUNITY IMPACT DASHBOARD
            </div>

            <h1>
              Her city. Her voice.
              <br />
              <span>Better streets.</span>
            </h1>

            <p className="welcome-description">
              Spot a problem, report it, and help your community
              prioritize better urban spaces for everyone.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => setShowForm(true)}
          >
            <span>＋</span> Report an Issue
          </button>
        </section>

        {notice && (
          <div className="notice-banner" role="status">
            <span>{notice}</span>
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>Total Reports</span>
              <div className="stat-icon purple">▤</div>
            </div>
            <div className="stat-number">{issues.length}</div>
            <div className="stat-caption">Community submissions</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Pending</span>
              <div className="stat-icon coral">◷</div>
            </div>
            <div className="stat-number">{pendingCount}</div>
            <div className="stat-caption">Awaiting action</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>In Progress</span>
              <div className="stat-icon amber">↻</div>
            </div>
            <div className="stat-number">{progressCount}</div>
            <div className="stat-caption">Being addressed</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Resolved</span>
              <div className="stat-icon teal">✓</div>
            </div>
            <div className="stat-number">{resolvedCount}</div>
            <div className="stat-caption">Marked as resolved</div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="reports-panel" id="issues">
            <div className="panel-heading">
              <div>
                <h2>Community Reports</h2>
                <p>Explore reported infrastructure issues.</p>
              </div>
              <span className="report-count">
                {filteredIssues.length} reports
              </span>
            </div>

            <div className="filter-row">
              {["All", "Pending", "In Progress", "Resolved"].map(
                (item) => (
                  <button
                    key={item}
                    className={
                      filter === item
                        ? "filter-button selected"
                        : "filter-button"
                    }
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                )
              )}
            </div>

            <div className="issue-list">
              {filteredIssues.length === 0 ? (
                <div className="empty-state">
                  <div>✳</div>
                  <h3>No reports here yet</h3>
                  <p>Try another filter or report a new issue.</p>
                  <button
                    className="text-button"
                    onClick={() => setShowForm(true)}
                  >
                    + Report an issue
                  </button>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <article className="issue-card" key={issue.id}>
                    <div className="issue-icon">{issue.icon}</div>

                    <div className="issue-main">
                      <div className="issue-category">
                        {issue.category}
                      </div>

                      <h3>{issue.title}</h3>

                      <p className="issue-location">
                        <span>⌖</span> {issue.location}
                      </p>

                      <div className="issue-meta">
                        <span
                          className={
                            "severity " +
                            String(issue.severity).toLowerCase()
                          }
                        >
                          {issue.severity} priority
                        </span>

                        <span className="reporters">
                          {issue.reports} community reports
                        </span>
                      </div>
                    </div>

                    <div className="issue-actions">
                      <span
                        className={
                          "status-badge " +
                          String(issue.status)
                            .toLowerCase()
                            .replace(" ", "-")
                        }
                      >
                        {issue.status}
                      </span>

                      <select
                        aria-label={"Update status for " + issue.title}
                        value={issue.status}
                        onChange={(event) =>
                          updateStatus(issue.id, event.target.value)
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="sample-note">
              Prototype dashboard · Initial reports are sample data
            </div>
          </div>

          <div className="right-column">
            <section className="map-panel">
              <div className="panel-heading">
                <div>
                  <h2>Issue Overview</h2>
                  <p>Illustrative neighbourhood view</p>
                </div>
                <span className="map-pin-icon">⌖</span>
              </div>

<IssueMap issues={issues} />

<p className="map-disclaimer">
  Markers show reported issue locations selected on the map.
  Map data © OpenStreetMap contributors.
</p>

              <div className="map-legend">
                <span>
                  <i className="legend-dot high-dot" /> High priority
                </span>
                <span>
                  <i className="legend-dot medium-dot" /> Other reports
                </span>
              </div>

              <p className="map-disclaimer">
                This is an illustrative map, not a live or geocoded map.
              </p>
            </section>

            <section className="priority-panel">
              <div className="priority-heading">
                <div className="priority-icon">✳</div>
                <div>
                  <h2>How we prioritize</h2>
                  <p>Transparent, community-focused criteria</p>
                </div>
              </div>

              <div className="priority-item">
                <span className="priority-number">01</span>
                <div>
                  <h3>Issue severity</h3>
                  <p>
                    How urgently the infrastructure needs attention.
                  </p>
                </div>
              </div>

              <div className="priority-item">
                <span className="priority-number">02</span>
                <div>
                  <h3>Community reports</h3>
                  <p>
                    Repeated reports can indicate a wider problem.
                  </p>
                </div>
              </div>

              <div className="priority-item">
                <span className="priority-number">03</span>
                <div>
                  <h3>Pedestrian impact</h3>
                  <p>
                    Consider access, lighting, and walkability needs.
                  </p>
                </div>
              </div>

              <div className="priority-footnote">
                These are proposed criteria, not an official municipal
                ranking.
              </div>
            </section>
          </div>
        </section>

        <footer className="page-footer">
          <span>SheMaps © 2026</span>
          <span>Her City. Her Voice. Better Streets.</span>
        </footer>
      </main>

      {showForm && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <section
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">COMMUNITY REPORT</div>
                <h2 id="modal-title">Make your voice heard.</h2>
                <p>
                  Share an infrastructure issue in your neighbourhood.
                </p>
              </div>

              <button
                className="close-button"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={addIssue}>
              <label htmlFor="category">Issue category</label>
              <select
                id="category"
                name="category"
                required
                defaultValue="Streetlight"
              >
                <option>Streetlight</option>
                <option>Footpath</option>
                <option>Public Transport</option>
                <option>Road Damage</option>
                <option>Accessibility</option>
                <option>Other</option>
              </select>

              <label htmlFor="title">What is the issue?</label>
              <input
                id="title"
                name="title"
                placeholder="e.g. Streetlight not working near bus stop"
                maxLength={120}
                required
              />

              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                placeholder="e.g. Sector 14, Gurugram"
                maxLength={120}
                required
              />

              
              <div className="map-form-section">
              <label>Pin the exact issue location</label>
             <p className="location-map-description">
             Click the map to mark where the infrastructure issue is located.
             </p>

             
<LocationPicker
  onLocationSelect={(coords) => {
    setSelectedCoordinates(coords);

    if (coords.address) {
      const locationInput = document.getElementById("location");

      if (locationInput) {
        locationInput.value = coords.address;
      }
    }
  }}
/>
</div>
              <label htmlFor="severity">Severity</label>
              <select
                id="severity"
                name="severity"
                required
                defaultValue="Medium"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>

              <div className="form-note">
                Please avoid including private or personally identifying
                information.
              </div>

              <button
                className="primary-button submit-button"
                type="submit"
              >
                Submit Report <span>→</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;


