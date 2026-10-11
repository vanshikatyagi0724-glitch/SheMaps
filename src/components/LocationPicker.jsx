

import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
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

export default function LocationPicker({ onLocationSelect }) {
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function selectLocation(coords) {
    if (loading) return;

    setPosition(coords);
    setLoading(true);
    setMessage("Finding the address...");

    onLocationSelect?.(coords);

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(coords.lat),
        lon: String(coords.lng),
        zoom: "18",
        addressdetails: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params}`
      );

      if (!response.ok) {
        throw new Error("Address lookup failed");
      }

      const data = await response.json();
      const address = data.display_name;

      if (address) {
        setPosition({ ...coords, address });
        onLocationSelect?.({ ...coords, address });
        setMessage("Address found and filled into the form.");
      } else {
        setMessage(
          "No address found for this point. Please type the location manually."
        );
      }
    } catch {
      setMessage(
        "Couldn't retrieve the address. Please enter the location manually."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="location-picker">
      <p className="location-picker-help">
        Click the map to pin the issue location.
      </p>

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
