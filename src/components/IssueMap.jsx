
import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function createSeverityIcon(severity) {
  const colors = {
    High: "#DC3545",
    Medium: "#F59E0B",
    Low: "#198754",
  };

  const color = colors[severity] || "#6B7280";

  return L.divIcon({
    className: "severity-marker-wrapper",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      "></div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

function hasValidCoordinates(issue) {
  return (
    issue.latitude !== null &&
    issue.latitude !== "" &&
    issue.longitude !== null &&
    issue.longitude !== "" &&
    Number.isFinite(Number(issue.latitude)) &&
    Number.isFinite(Number(issue.longitude)) &&
    Math.abs(Number(issue.latitude)) <= 90 &&
    Math.abs(Number(issue.longitude)) <= 180
  );
}

export default function IssueMap({ issues = [] }) {
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const categories = [
    ...new Set(
      issues
        .map((issue) => issue.category)
        .filter(Boolean)
    ),
  ];

  const locatedIssues = issues.filter(hasValidCoordinates);

  const filteredIssues = locatedIssues.filter((issue) => {
    const matchesSeverity =
      severityFilter === "All" ||
      issue.severity === severityFilter;

    const matchesStatus =
      statusFilter === "All" ||
      issue.status === statusFilter;

    const matchesCategory =
      categoryFilter === "All" ||
      issue.category === categoryFilter;

    return (
      matchesSeverity &&
      matchesStatus &&
      matchesCategory
    );
  });

  return (
    <div className="issue-map-container">
      <div className="map-filters">
        <label>
          Severity
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="All">All severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>

        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
        </label>

        <label>
          Category
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setSeverityFilter("All");
            setStatusFilter("All");
            setCategoryFilter("All");
          }}
        >
          Reset filters
        </button>
      </div>

      <MapContainer
        center={[28.4595, 77.0266]}
        zoom={13}
        style={{
          height: "350px",
          width: "100%",
          borderRadius: "12px",
        }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {filteredIssues.map((issue) => (
          <Marker
            key={issue.id}
            position={[
              Number(issue.latitude),
              Number(issue.longitude),
            ]}
            icon={createSeverityIcon(issue.severity)}
          >
            <Popup>
              <div>
                <strong>{issue.title}</strong>
                <p>Category: {issue.category}</p>
                <p>Location: {issue.location}</p>
                <p>Severity: {issue.severity}</p>
                <p>Status: {issue.status}</p>
                <p>Community reports: {issue.reports}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="map-severity-legend">
        <span><i className="severity-dot high" />High</span>
        <span><i className="severity-dot medium" />Medium</span>
        <span><i className="severity-dot low" />Low</span>
      </div>

      <p className="issue-map-count">
        Showing {filteredIssues.length} of {locatedIssues.length} located issues
      </p>
    </div>
  );
}
