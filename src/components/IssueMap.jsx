import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function hasValidCoordinates(issue) {
  return (
    Number.isFinite(Number(issue.latitude)) &&
    Number.isFinite(Number(issue.longitude)) &&
    issue.latitude !== null &&
    issue.latitude !== "" &&
    issue.longitude !== null &&
    issue.longitude !== "" &&
    Math.abs(Number(issue.latitude)) <= 90 &&
    Math.abs(Number(issue.longitude)) <= 180
  );
}

export default function IssueMap({ issues = [] }) {
  const locatedIssues = issues.filter(hasValidCoordinates);

  return (
    <div className="issue-map-container">
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

        {locatedIssues.map((issue) => (
          <Marker
            key={issue.id}
            position={[
              Number(issue.latitude),
              Number(issue.longitude),
            ]}
            icon={markerIcon}
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

      <p className="issue-map-count">
        Showing {locatedIssues.length} located issue
        {locatedIssues.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}