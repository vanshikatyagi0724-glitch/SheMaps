
import { useEffect, useState } from "react";
import LocationPicker from "./components/LocationPicker";
import IssueMap from "./components/IssueMap";
import Dashboard from "./components/Dashboard";
import { fetchIssues, createIssue, supportIssue, updateStatus, reverseGeocode } from "./api";
import "./App.css";
import "./Dashboard.css";

function getAllowedNextStatuses(currentStatus) {
  const transitions = {
    Pending: ["In Progress", "Resolved"],
    "In Progress": ["Resolved"],
    Resolved: ["In Progress"],
  };
  return [currentStatus, ...(transitions[currentStatus] || [])];
}

function App() {
  const [activeView, setActiveView] = useState("community");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");
  const [showForm, setShowForm] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [notice, setNotice] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleRetry() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchIssues();
      setIssues(data);
    } catch (error) {
      console.error("Could not load reports:", error);
      setLoadError("Unable to connect to the SheMaps server. Please check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    fetchIssues()
      .then((data) => {
        if (isMounted) {
          setIssues(data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error("Could not load reports:", error);
          setLoadError("Unable to connect to the SheMaps server. Please check that the backend is running.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const sortedAndFilteredIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === "Highest priority") {
      return (b.priorityScore || 0) - (a.priorityScore || 0);
    }
    if (sortBy === "Most supported") {
      return (b.supportCount || 0) - (a.supportCount || 0);
    }
    // "Newest"
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return Number(b.id) - Number(a.id);
  });

  async function handleUpdateStatus(id, newStatus) {
    const current = issues.find((issue) => String(issue.id) === String(id));
    if (!current || current.status === newStatus) return;

    try {
      const updated = await updateStatus(id, newStatus);
      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          String(issue.id) === String(id) ? updated : issue
        )
      );
      setNotice("Issue status updated successfully.");
    } catch (error) {
      setNotice(error.message || "Failed to update issue status.");
    }
  }

  async function handleSupport(issueId) {
    try {
      const updated = await supportIssue(issueId);
      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          String(issue.id) === String(issueId) ? updated : issue
        )
      );
      setNotice("Thanks! Your support has been recorded.");
    } catch (error) {
      if (error.status === 409) {
        setIssues((currentIssues) =>
          currentIssues.map((issue) =>
            String(issue.id) === String(issueId)
              ? { ...issue, supported: true }
              : issue
          )
        );
      } else {
        setNotice(error.message || "Could not record support.");
      }
    }
  }

  async function addIssue(event) {
    event.preventDefault();
    setFormErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);

    const category = formData.get("category");
    const title = String(formData.get("title") || "").trim();
    let location = String(formData.get("location") || "").trim();
    const severity = formData.get("severity");

    if (!location && selectedCoordinates) {
      location = "Pinned location";
    }

    setSubmitting(true);
    try {
      const created = await createIssue({
        category,
        title,
        location,
        severity,
        latitude: selectedCoordinates?.lat ?? null,
        longitude: selectedCoordinates?.lng ?? null,
      });

      setIssues((currentIssues) => [created, ...currentIssues]);
      setFilter("All");
      setSelectedCoordinates(null);
      setFormErrors({});
      setShowForm(false);
      setNotice("Your issue has been reported successfully!");
      form.reset();
    } catch (error) {
      if (error.details && typeof error.details === "object") {
        setFormErrors(error.details);
      } else {
        setFormErrors({ general: error.message || "Failed to create report." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReportHere(liveCoords) {
    if (!liveCoords || liveCoords.lat === undefined || liveCoords.lng === undefined) return;
    const coords = {
      lat: Number(Number(liveCoords.lat).toFixed(6)),
      lng: Number(Number(liveCoords.lng).toFixed(6)),
    };
    setSelectedCoordinates(coords);
    setShowForm(true);

    const address = await reverseGeocode(coords.lat, coords.lng);
    if (address) {
      setSelectedCoordinates({ ...coords, address });
      const locationInput = document.getElementById("location");
      if (locationInput) {
        locationInput.value = address;
      }
    }
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
          className={activeView === "community" ? "nav-item active" : "nav-item"}
          onClick={() => {
            setActiveView("community");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span>▦</span> Overview
        </button>

        <button
          className="nav-item"
          onClick={() => {
            setActiveView("community");
            setTimeout(() => {
              document.getElementById("issues")?.scrollIntoView({
                behavior: "smooth",
              });
            }, 50);
          }}
        >
          <span>◎</span> Community Reports
        </button>

        <button
          className="nav-item"
          onClick={() => {
            setActiveView("community");
            setSelectedCoordinates(null);
            setShowForm(true);
          }}
        >
          <span>＋</span> Report an Issue
        </button>

        <button
          className={activeView === "city_dashboard" ? "nav-item active" : "nav-item"}
          onClick={() => {
            setActiveView("city_dashboard");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span>🏛</span> City Dashboard
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
            Workspace <span>/</span> <strong>{activeView === "city_dashboard" ? "City Dashboard" : "Overview"}</strong>
          </div>

          <div className="topbar-right">
            <span className="city-pill">⌖ Gurugram, India</span>
            <div className="avatar">V</div>
          </div>
        </header>

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

        {activeView === "city_dashboard" ? (
          <Dashboard />
        ) : (
          <>
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
                onClick={() => {
                  setSelectedCoordinates(null);
                  setShowForm(true);
                }}
              >
                <span>＋</span> Report an Issue
              </button>
            </section>

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

            <div className="list-controls-row">
              <div className="filter-row" style={{ marginBottom: 0 }}>
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

              <div className="sort-control">
                <label htmlFor="sort-select">Sort by:</label>
                <select
                  id="sort-select"
                  aria-label="Sort issues list"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-dropdown"
                >
                  <option value="Newest">Newest</option>
                  <option value="Most supported">Most supported</option>
                  <option value="Highest priority">Highest priority</option>
                </select>
              </div>
            </div>

            <div className="issue-list">
              {loading ? (
                <div className="empty-state">
                  <div>⏳</div>
                  <h3>Loading reports...</h3>
                  <p>Connecting to SheMaps community database.</p>
                </div>
              ) : loadError ? (
                <div className="empty-state">
                  <div>⚠️</div>
                  <h3>Server connection error</h3>
                  <p>{loadError}</p>
                  <button className="text-button" onClick={handleRetry}>
                    ↻ Retry
                  </button>
                </div>
              ) : sortedAndFilteredIssues.length === 0 ? (
                <div className="empty-state">
                  <div>✳</div>
                  <h3>No reports here yet</h3>
                  <p>Try another filter or report a new issue.</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelectedCoordinates(null);
                      setShowForm(true);
                    }}
                  >
                    + Report an issue
                  </button>
                </div>
              ) : (
                sortedAndFilteredIssues.map((issue) => {
                  const hasSupported = Boolean(issue.supported);

                  return (
                    <article className="issue-card" key={issue.id}>
                      <div className="issue-icon">{issue.icon}</div>

                      <div className="issue-main">
                        <div className="issue-category-row">
                          <span className="issue-category">
                            {issue.category}
                          </span>
                          <span className="priority-badge">
                            Priority {issue.priorityScore ?? 0}
                          </span>
                          {issue.isSample && (
                            <span className="sample-tag">Sample</span>
                          )}
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
                            handleUpdateStatus(issue.id, event.target.value)
                          }
                        >
                          {getAllowedNextStatuses(issue.status).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="support-button"
                          onClick={() => handleSupport(issue.id)}
                          disabled={hasSupported}
                        >
                          {hasSupported
                            ? "✓ Supported"
                            : "♡ I face this too"}
                        </button>
                      </div>
                    </article>
                  );
                })
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

              <IssueMap issues={issues} onReportHere={handleReportHere} />

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
      </>
    )}

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
              {formErrors.general && (
                <div style={{ color: "#dc3545", marginBottom: "10px", fontSize: "13px" }}>
                  {formErrors.general}
                </div>
              )}

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
              {formErrors.category && (
                <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "2px" }}>
                  {formErrors.category}
                </span>
              )}

              <label htmlFor="title">What is the issue?</label>
              <input
                id="title"
                name="title"
                placeholder="e.g. Streetlight not working near bus stop"
                maxLength={120}
                required
              />
              {formErrors.title && (
                <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "2px" }}>
                  {formErrors.title}
                </span>
              )}

              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                placeholder="e.g. Sector 14, Gurugram"
                maxLength={120}
              />
              {formErrors.location && (
                <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "2px" }}>
                  {formErrors.location}
                </span>
              )}

              <div className="map-form-section">
                <label>Pin the exact issue location</label>
                <p className="location-map-description">
                  Click the map to mark where the infrastructure issue is
                  located.
                </p>

                <LocationPicker
                  initialPosition={selectedCoordinates}
                  onLocationSelect={(coords) => {
                    setSelectedCoordinates(coords);

                    if (coords.address) {
                      const locationInput =
                        document.getElementById("location");

                      if (locationInput) {
                        locationInput.value = coords.address;
                      }
                    }
                  }}
                />
                {formErrors.coordinates && (
                  <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "4px" }}>
                    {formErrors.coordinates}
                  </span>
                )}
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
              {formErrors.severity && (
                <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "2px" }}>
                  {formErrors.severity}
                </span>
              )}

              <div className="form-note">
                Please avoid including private or personally identifying
                information.
              </div>

              <button
                className="primary-button submit-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Report"} <span>→</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
