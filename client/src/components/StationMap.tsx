import type { Station } from "@ev/shared";
import { Button, Tag, Typography } from "antd";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

const DUBLIN_CENTER: [number, number] = [53.3498, -6.2603];

// Keeps the map from panning off somewhere that isn't Dublin.
const DUBLIN_BOUNDS: L.LatLngBoundsExpression = [
  [53.2, -6.55],
  [53.45, -6.05],
];

// Custom SVG pin icons instead of Leaflet's default marker images, which
// need bundler-specific path fixes to load correctly under Vite.
function createPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "station-marker",
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14z" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
      <circle cx="14" cy="14" r="5.5" fill="#fff"/>
    </svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}

const AVAILABLE_ICON = createPinIcon("#1677ff");
const OCCUPIED_ICON = createPinIcon("#bfbfbf");

export function StationMap({
  stations,
  onStart,
  pendingStationIds,
}: {
  stations: Station[];
  onStart: (stationId: string) => void;
  pendingStationIds: Set<string>;
}) {
  return (
    <MapContainer
      center={DUBLIN_CENTER}
      zoom={12}
      minZoom={11}
      maxBounds={DUBLIN_BOUNDS}
      maxBoundsViscosity={1.0}
      style={{ height: 480, width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stations.map((station) => (
        <Marker
          key={station.id}
          position={[station.lat, station.lng]}
          icon={station.status === "available" ? AVAILABLE_ICON : OCCUPIED_ICON}
        >
          <Popup>
            <Typography.Text strong>{station.name}</Typography.Text>
            <br />
            <Typography.Text type="secondary">{station.location}</Typography.Text>
            <br />
            {station.chargingSpeedKw} kW
            <div style={{ margin: "6px 0" }}>
              <Tag color={station.status === "available" ? "success" : "warning"}>{station.status}</Tag>
            </div>
            <Button
              type="primary"
              size="small"
              disabled={station.status !== "available"}
              loading={pendingStationIds.has(station.id)}
              onClick={() => onStart(station.id)}
            >
              Start Session
            </Button>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
