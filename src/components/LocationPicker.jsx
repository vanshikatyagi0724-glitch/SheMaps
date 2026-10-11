import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { reverseGeocode } from "../api";

const markerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function MapCenterController({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && position.lat && position.lng) {
      map.setView([position.lat, position.lng], 15);
    }
  }, [position, map]);

  return null;
}

export default function LocationPicker({ initialPosition = null, onLocationSelect }) {
  const [customPosition, setCustomPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState("");

  const position = customPosition || initialPosition;

  async function selectLocation(coords) {
    if (loading) return;

    setCustomPosition(coords);
    setLoading(true);
    setManualMessage("Finding the address...");

    onLocationSelect?.(coords);

    const address = await reverseGeocode(coords.lat, coords.lng);

    if (address) {
      setCustomPosition({ ...coords, address });
      onLocationSelect?.({ ...coords, address });
      setManualMessage("Address found and filled into the form.");
    } else {
      setManualMessage(
        "No address found for this point. Please type the location manually."
      );
    }
    setLoading(false);
  }

  const message = loading
    ? "Finding the address..."
    : manualMessage || (position?.address ? "Address filled from pinned location." : "");

  return (
    <div className="location-picker">
      <p className="location-picker-help">
        Click the map to pin the issue location.
      </p>

      <MapContainer
        center={position ? [position.lat, position.lng] : [28.4595, 77.0266]}
        zoom={position ? 15 : 13}
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

        <MapCenterController position={position} />
        <MapClickHandler onSelect={selectLocation} />

        {position && (
          <Marker
            position={[position.lat, position.lng]}
            icon={markerIcon}
          />
        )}
      </MapContainer>

      <div className="selected-location">
        {position ? (
          <>
            <strong>Selected coordinates</strong>
            <p>Latitude: {position.lat}</p>
            <p>Longitude: {position.lng}</p>
            {position.address && <p>{position.address}</p>}
          </>
        ) : (
          <p>No location selected yet.</p>
        )}
      </div>

      {message && (
        <p role="status" aria-live="polite">
          {loading ? "⏳ " : "📍 "}
          {message}
        </p>
      )}
    </div>
  );
}
