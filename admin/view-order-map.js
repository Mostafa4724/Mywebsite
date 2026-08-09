(function () {
  "use strict";

  /* ── Delivery location data ── */
  var deliveryLocation = {
    lat: 39.7817,
    lng: -89.6501,
    name: "John Doe",
    address: "742 Evergreen Terrace, Apt 4B",
    city: "Springfield, IL 62704",
    country: "United States",
    fullAddress:
      "742 Evergreen Terrace, Apt 4B, Springfield, IL 62704, United States"
  };

  /* ── Custom marker icon ── */
  var markerIcon = L.divIcon({
    className: "vo-custom-marker",
    html:
      '<div class="vo-marker-pin">'
      +   '<svg viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">'
      +     '<path d="M19 0C8.507 0 0 8.507 0 19c0 13.25 19 27 19 27s19-13.75 19-27C38 8.507 29.493 0 19 0z" fill="#2563eb"/>'
      +     '<circle cx="19" cy="18" r="8" fill="#fff"/>'
      +     '<circle cx="19" cy="18" r="4" fill="#2563eb"/>'
      +   '</svg>'
      + '</div>'
      + '<div class="vo-marker-pulse"></div>',
    iconSize: [38, 46],
    iconAnchor: [19, 46],
    popupAnchor: [0, -48]
  });

  /* ── Popup HTML builder ── */
  function buildPopupContent(loc) {
    return (
      '<div class="vo-popup-inner">'
      + '<div class="vo-popup-label"><span class="vo-popup-label-dot"></span>Delivery Address</div>'
      + '<p class="vo-popup-title">' + loc.name + '</p>'
      + '<p class="vo-popup-address">' + loc.address + '<br>' + loc.city + '<br>' + loc.country + '</p>'
      + '<div class="vo-popup-divider"></div>'
      + '<p class="vo-popup-coords">' + loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4) + '</p>'
      + '</div>'
    );
  }

  /* ── Tile layer (CartoDB Voyager – clean, modern) ── */
  var tileUrl =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  var tileAttrib =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    + ' &copy; <a href="https://carto.com/">CARTO</a>';

  /* ── Inline compact map ── */
  var inlineMap = L.map("deliveryMap", {
    center: [deliveryLocation.lat, deliveryLocation.lng],
    zoom: 15,
    zoomControl: true,
    attributionControl: true,
    dragging: true,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: true
  });

  L.tileLayer(tileUrl, { attribution: tileAttrib, maxZoom: 19 }).addTo(
    inlineMap
  );

  var inlineMarker = L.marker(
    [deliveryLocation.lat, deliveryLocation.lng],
    { icon: markerIcon }
  )
    .addTo(inlineMap)
    .bindPopup(buildPopupContent(deliveryLocation), {
      className: "vo-map-popup",
      maxWidth: 260,
      closeButton: true,
      autoPan: true
    });

  /* Open popup after the drop animation finishes */
  setTimeout(function () {
    inlineMarker.openPopup();
  }, 600);

  /* ── Expanded overlay map (lazy-init) ── */
  var expandedMap = null;
  var expandedMarker = null;

  function initExpandedMap() {
    if (expandedMap) {
      expandedMap.invalidateSize();
      expandedMap.setView([deliveryLocation.lat, deliveryLocation.lng], 16);
      return;
    }

    expandedMap = L.map("deliveryMapExpanded", {
      center: [deliveryLocation.lat, deliveryLocation.lng],
      zoom: 16,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer(tileUrl, { attribution: tileAttrib, maxZoom: 19 }).addTo(
      expandedMap
    );

    expandedMarker = L.marker(
      [deliveryLocation.lat, deliveryLocation.lng],
      { icon: markerIcon }
    )
      .addTo(expandedMap)
      .bindPopup(buildPopupContent(deliveryLocation), {
        className: "vo-map-popup",
        maxWidth: 260,
        closeButton: true
      });

    /* Let the container settle before opening the popup */
    setTimeout(function () {
      expandedMap.invalidateSize();
      expandedMarker.openPopup();
    }, 350);
  }

  /* ── Overlay open / close ── */
  var mapOverlay = document.getElementById("mapOverlay");
  var mapExpandBtn = document.getElementById("mapExpandBtn");
  var mapOverlayClose = document.getElementById("mapOverlayClose");

  mapExpandBtn.addEventListener("click", function () {
    mapOverlay.classList.add("show");
    setTimeout(initExpandedMap, 50);
  });

  mapOverlayClose.addEventListener("click", function () {
    mapOverlay.classList.remove("show");
  });

  mapOverlay.addEventListener("click", function (e) {
    if (e.target === mapOverlay) {
      mapOverlay.classList.remove("show");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mapOverlay.classList.contains("show")) {
      mapOverlay.classList.remove("show");
    }
  });

  /* ── "Open in Google Maps" link ── */
  var openInMaps = document.getElementById("openInMaps");
  openInMaps.href =
    "https://www.google.com/maps?q="
    + encodeURIComponent(deliveryLocation.fullAddress);

  /* ── Keep maps in sync on resize ── */
  window.addEventListener("resize", function () {
    inlineMap.invalidateSize();
    if (expandedMap && mapOverlay.classList.contains("show")) {
      expandedMap.invalidateSize();
    }
  });
})();