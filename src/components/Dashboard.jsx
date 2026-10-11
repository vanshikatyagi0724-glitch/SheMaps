import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchDashboard } from "../api";

function createHotspotIcon(rank) {
  return L.divIcon({
    className: "hotspot-map-marker-container",
    html: `<div class="hotspot-map-marker">${rank}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  function loadInitialData() {
    setLoading(true);
    setError("");
    fetchDashboard()
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard data:", err);
        setError(err.message || "Unable to load dashboard data from backend.");
        setLoading(false);
      });
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const result = await fetchDashboard();
      setData(result);
    } catch (err) {
      console.error("Failed to refresh dashboard data:", err);
      setError(err.message || "Unable to refresh dashboard data from backend.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    fetchDashboard()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load dashboard data:", err);
          setError(err.message || "Unable to load dashboard data from backend.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <div>⏳</div>
        <h3>Loading City Dashboard...</h3>
        <p>Aggregating priority metrics and hotspot clusters.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div>⚠️</div>
        <h3>Failed to load City Dashboard</h3>
        <p>{error}</p>
        <button className="text-button" onClick={loadInitialData}>
          ↻ Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div>✳</div>
        <h3>No dashboard data available</h3>
        <p>No reports currently recorded in the city database.</p>
      </div>
    );
  }

  const { totals, byCategory = {}, ranked = [], hotspots = [] } = data;
  const totalIssues = totals?.total || 0;

  const categoryList = Array.isArray(byCategory)
    ? byCategory
    : Object.entries(byCategory).map(([category, count]) => ({
        category,
        count: Number(count) || 0,
      }));

  return (
    <div className="dashboard-view">
      <div className="dashboard-header-row">
        <div>
          <h1>City Prioritization Dashboard</h1>
          <p className="dashboard-subtitle">
            Transparent municipal decision support powered by community reports, severity weights, and cluster analysis.
          </p>
        </div>
        <div className="dashboard-actions">
          <button
            type="button"
            className="refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <span>↻</span> {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Total Issues</span>
            <div className="stat-icon purple">▤</div>
          </div>
          <div className="stat-number">{totals?.total ?? 0}</div>
          <div className="stat-caption">All recorded issues</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Pending</span>
            <div className="stat-icon coral">◷</div>
          </div>
          <div className="stat-number">{totals?.pending ?? 0}</div>
          <div className="stat-caption">Awaiting municipal action</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>In Progress</span>
            <div className="stat-icon amber">↻</div>
          </div>
          <div className="stat-number">{totals?.inProgress ?? 0}</div>
          <div className="stat-caption">Currently being fixed</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Resolved</span>
            <div className="stat-icon teal">✓</div>
          </div>
          <div className="stat-number">{totals?.resolved ?? 0}</div>
          <div className="stat-caption">Work completed</div>
        </div>
      </section>

      {/* Category Breakdown (CSS Bars) */}
      <section className="category-bars-card">
        <div className="card-title-row">
          <h2>Issues by Category</h2>
          <span className="category-stats">Distribution across all 6 core categories</span>
        </div>

        <div className="category-bar-list">
          {categoryList.map((cat) => {
            const count = cat.count || 0;
            const percentage = totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0;

            return (
              <div className="category-bar-item" key={cat.category}>
                <div className="category-bar-labels">
                  <span className="category-name">{cat.category}</span>
                  <span className="category-stats">
                    <strong>{count}</strong> {count === 1 ? "issue" : "issues"} ({percentage}%)
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${percentage}%` }}
                    title={`${cat.category}: ${count} (${percentage}%)`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Priority Ranked List */}
      <section className="ranked-table-card">
        <div className="card-title-row">
          <h2>Priority-Ranked Issues</h2>
          <span className="category-stats">Top 10 unresolved issues prioritized for municipal action</span>
        </div>

        {ranked.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: "16px 0" }}>No unresolved issues to rank.</p>
        ) : (
          <table className="ranked-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Rank</th>
                <th>Issue Details</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Supports</th>
                <th>Days Pending</th>
                <th style={{ textAlign: "right" }}>Priority Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((issue, idx) => (
                <tr key={issue.id}>
                  <td>
                    <span className={`rank-badge ${idx === 0 ? "rank-top" : ""}`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td>
                    <div className="table-issue-title">{issue.title}</div>
                    <div className="table-issue-location">⌖ {issue.location}</div>
                  </td>
                  <td>
                    <span className="category-name" style={{ fontSize: "12px" }}>
                      {issue.category}
                    </span>
                  </td>
                  <td>
                    <span className={"severity " + String(issue.severity).toLowerCase()}>
                      {issue.severity}
                    </span>
                  </td>
                  <td>
                    <strong>{issue.supportCount}</strong> reports
                  </td>
                  <td>
                    {issue.daysPending} {issue.daysPending === 1 ? "day" : "days"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="table-score-badge">
                      Score {issue.priorityScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="priority-formula-note">
          <strong>Transparent Priority Formula:</strong> Priority Score = Severity Weight (High = 30, Medium = 20, Low = 10) + Community Supports × 2 + Days Pending (whole days since reported).
        </div>
      </section>

      {/* Hotspots Section */}
      <section className="hotspots-grid">
        <div className="hotspots-card">
          <div className="card-title-row">
            <h2>Top Hotspot Clusters</h2>
            <span className="category-stats">Geographic issue density</span>
          </div>
          <p className="dashboard-subtitle">
            Clusters of unresolved issues grouped within 3 decimal places (~110m precision) to identify high-need municipal intervention zones.
          </p>

          <div className="hotspots-list">
            {hotspots.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: "12px 0" }}>No geographic hotspots detected yet.</p>
            ) : (
              hotspots.map((hs, idx) => (
                <div className="hotspot-item" key={`${hs.latitude}-${hs.longitude}-${idx}`}>
                  <div className="hotspot-info">
                    <div className="hotspot-rank">#{idx + 1}</div>
                    <div>
                      <div className="hotspot-title">
                        {hs.label || `${Number(hs.latitude).toFixed(3)}° N, ${Number(hs.longitude).toFixed(3)}° E`}
                      </div>
                      <div className="hotspot-coords">
                        {Number(hs.latitude).toFixed(3)}° N, {Number(hs.longitude).toFixed(3)}° E
                      </div>
                      <div className="hotspot-category-tag">
                        Primary Issue: <strong>{hs.topCategory}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="hotspot-count-pill">
                    {hs.count} {hs.count === 1 ? "issue" : "issues"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hotspots-card">
          <div className="card-title-row">
            <h2>Hotspots Spatial Map</h2>
            <span className="category-stats">Gurugram, Haryana</span>
          </div>

          <MapContainer
            center={[28.4595, 77.0266]}
            zoom={12}
            style={{
              height: "330px",
              width: "100%",
              borderRadius: "12px",
            }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {hotspots.map((hs, idx) => (
              <Marker
                key={`marker-${hs.latitude}-${hs.longitude}-${idx}`}
                position={[Number(hs.latitude), Number(hs.longitude)]}
                icon={createHotspotIcon(idx + 1)}
              >
                <Popup>
                  <div>
                    <strong>{hs.label || `Hotspot Cluster #${idx + 1}`}</strong>
                    <p style={{ margin: "4px 0" }}>
                      <strong>{hs.count}</strong> unresolved {hs.count === 1 ? "issue" : "issues"}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      Top Category: <strong>{hs.topCategory}</strong>
                    </p>
                    <p style={{ margin: "4px 0", fontSize: "11px", color: "#666" }}>
                      Lat: {Number(hs.latitude).toFixed(3)}, Lng: {Number(hs.longitude).toFixed(3)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>
    </div>
  );
}
