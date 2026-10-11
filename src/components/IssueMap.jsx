import { useState, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLiveLocation } from "../hooks/useLiveLocation";
import "../LiveLocation.css";

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

const userLiveLocationIcon = L.divIcon({
  className: "live-user-marker",
  html: `
    <div class="user-pulse-ring"></div>
    <div class="user-dot"></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

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

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function MapFollowController({ position, isFollowing, onUserDrag }) {
  const map = useMap();

  useMapEvents({
    dragstart() {
      onUserDrag();
    },
  });

  useEffect(() => {
    if (position && isFollowing) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.8 });
    }
  }, [position, isFollowing, map]);

  return null;
}

export default function IssueMap({ issues = [], onReportHere }) {
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const { position, status, start, stop } = useLiveLocation();
  const [isFollowing, setIsFollowing] = useState(true);

  // Compute nearby unresolved issues within 150m (client-side, Haversine)
  const nearbyIssues = useMemo(() => {
    if (status !== "tracking" || !position) {
      return [];
    }

    const unresolved = issues.filter(
      (issue) => issue.status !== "Resolved" && hasValidCoordinates(issue)
    );

    const withinRange = unresolved
      .map((issue) => ({
        ...issue,
        distanceMeters: Math.round(
          haversineDistanceMeters(
            position.lat,
            position.lng,
            Number(issue.latitude),
            Number(issue.longitude)
          )
        ),
      }))
      .filter((item) => item.distanceMeters <= 150);

    // Sort by priorityScore descending
    withinRange.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    return withinRange;
  }, [position, status, issues]);

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
      {/* Live Location Controls */}
      <div className="live-location-toolbar">
        {status === "tracking" ? (
          <button
            type="button"
            className="live-toggle-btn active"
            onClick={stop}
            aria-label="Stop live location tracking"
          >
            ⏹ Stop tracking
          </button>
        ) : (
          <button
            type="button"
            className="live-toggle-btn"
            onClick={() => {
              setIsFollowing(true);
              start();
            }}
            disabled={status === "requesting"}
            aria-label="Locate me on map"
          >
            {status === "requesting" ? "⏳ Locating..." : "📍 Locate me"}
          </button>
        )}

        {status === "tracking" && !isFollowing && (
          <button
            type="button"
            className="recentre-btn"
            onClick={() => setIsFollowing(true)}
            title="Re-centre map on your live location"
          >
            🎯 Re-centre
          </button>
        )}

        {status === "tracking" && position && onReportHere && (
          <button
            type="button"
            className="report-here-btn"
            onClick={() => onReportHere(position)}
            title="Open report form at current GPS coordinates"
          >
            ＋ Report here
          </button>
        )}
      </div>

      {/* Friendly State Messages */}
      {status === "denied" && (
        <div className="location-status-banner denied" role="status">
          <span>📍 Location access was denied. Please allow location permissions in your browser to view your live position.</span>
        </div>
      )}

      {status === "unavailable" && (
        <div className="location-status-banner unavailable" role="status">
          <span>⚠️ Location is currently unavailable. Please check your device GPS or connection.</span>
        </div>
      )}

      {status === "insecure" && (
        <div className="location-status-banner insecure" role="status">
          <span>🔒 Location tracking requires HTTPS or localhost. Live tracking is disabled on plain HTTP.</span>
        </div>
      )}

      {/* Map Filters */}
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

        <MapFollowController
          position={position}
          isFollowing={isFollowing}
          onUserDrag={() => setIsFollowing(false)}
        />

        {/* Live location blue dot and accuracy circle */}
        {position && (
          <>
            <Circle
              center={[position.lat, position.lng]}
              radius={Math.max(position.accuracy || 20, 15)}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#3b82f6",
                fillOpacity: 0.15,
                weight: 1.5,
              }}
            />
            <Marker
              position={[position.lat, position.lng]}
              icon={userLiveLocationIcon}
            >
              <Popup>
                <div className="live-location-popup">
                  <strong>You are here</strong>
                  <p>±{Math.round(position.accuracy)}m accuracy</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Reported Issue Markers */}
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

      {/* Nearby Awareness Non-blocking Banner */}
      {status === "tracking" && nearbyIssues.length > 0 && (
        <div className="nearby-issues-banner" role="status" aria-live="polite">
          <div className="nearby-banner-header">
            <span className="nearby-pulse-indicator" />
            <strong>
              {nearbyIssues.length} reported {nearbyIssues.length === 1 ? "issue" : "issues"} within 150 m
            </strong>
          </div>
          <div className="nearby-issues-list">
            {nearbyIssues.slice(0, 3).map((item) => (
              <div key={item.id} className="nearby-issue-pill">
                <span className="nearby-issue-category">{item.category}</span>
                <span className="nearby-issue-title" title={item.title}>
                  {item.title}
                </span>
                <span className={"nearby-issue-severity " + String(item.severity).toLowerCase()}>
                  {item.severity}
                </span>
                <span className="nearby-issue-dist">{item.distanceMeters}m away</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
