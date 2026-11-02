import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Pure WebView OpenStreetMap Implementation.
 * Eliminates all Android native map crash issues completely.
 *
 * NOTE: this does NOT use react-native-maps, so it can't render
 * react-native-maps <Marker> children (they were previously accepted as
 * a `children` prop but never actually rendered anywhere — pins from
 * screens like TrackingScreen / PartyDashboardScreen were silently
 * dropped). Pass plain data via the `markers` prop instead:
 *   markers={[{ id, latitude, longitude, label, color }]}
 */
export default function AppMap({ style, region, initialRegion, markers = [] }) {
    // Current coordinate selection fallback
    const lat = region?.latitude || initialRegion?.latitude || 28.6139;
    const lng = region?.longitude || initialRegion?.longitude || 77.2090;

    const points = markers
        .filter(m => m && typeof m.latitude === 'number' && typeof m.longitude === 'number')
        .map(m => ({
            lat: m.latitude,
            lng: m.longitude,
            label: (m.label || '').replace(/'/g, "\\'"),
            color: m.color || '#10b981',
        }));

    // Leaflet HTML code for OpenStreetMap rendering
    const mapHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #f8fafc; }
          .leaflet-control-attribution { display: none !important; }
          .nxco-pin {
            width: 30px; height: 30px; border-radius: 15px; background: #fff;
            border: 2px solid rgba(0,0,0,0.15); display: flex; align-items: center;
            justify-content: center; font-size: 15px; box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var pts = ${JSON.stringify(points)};
          var startLat = pts.length ? pts[0].lat : ${lat};
          var startLng = pts.length ? pts[0].lng : ${lng};
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 13);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
          }).addTo(map);

          if (pts.length === 0) {
            // Fallback: no data yet, just show the initial region.
            L.marker([${lat}, ${lng}]).addTo(map);
          } else {
            var group = [];
            pts.forEach(function (p) {
              var icon = L.divIcon({
                className: '',
                html: '<div class="nxco-pin" style="border-color:' + p.color + '">' + (p.label ? p.label.charAt(0).toUpperCase() : '\\ud83d\\udccd') + '</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              });
              var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
              if (p.label) m.bindPopup(p.label);
              group.push([p.lat, p.lng]);
            });
            if (group.length > 1) {
              map.fitBounds(group, { padding: [30, 30] });
            } else {
              map.setView(group[0], 14);
            }
          }
        </script>
      </body>
      </html>
    `;

    return (
        <View style={[styles.container, style]}>
            <WebView
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.map}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    map: {
        flex: 1,
    },
});