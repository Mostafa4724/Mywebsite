(function () {
  "use strict";

  var DEFAULT_LAT = 40.7128;
  var DEFAULT_LNG = -74.006;

  var inlineMap = null;
  var inlineMarker = null;
  var currentLocation = null;
  var openInMapsEl = document.getElementById("openInMaps");

  function googleMapsUrl(loc) {
    if (
      loc &&
      typeof loc.lat === "number" &&
      typeof loc.lng === "number" &&
      !Number.isNaN(loc.lat) &&
      !Number.isNaN(loc.lng)
    ) {
      return "https://www.google.com/maps?q=" + loc.lat + "," + loc.lng;
    }
    return "https://www.google.com/maps?q=" + encodeURIComponent(
      (loc && loc.fullAddress) || ""
    );
  }

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

  var tileUrl =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  var tileAttrib =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    + ' &copy; <a href="https://carto.com/">CARTO</a>';

  function locationFromOrder(order) {
    if (order) {
      var customerLat = parseFloat(order.customer_lat);
      var customerLng = parseFloat(order.customer_lng);
      var hasCoords =
        !Number.isNaN(customerLat) && !Number.isNaN(customerLng) &&
        customerLat !== 0 && customerLng !== 0;

      var fullName =
        order.username ||
        ((order.customer_name || "") + " " + (order.customer_lastname || "")).trim() ||
        order.customer_email ||
        "Customer";

      var addressParts = [
        order.customer_address,
        order.customer_architecture,
        order.customer_floor ? "Floor " + order.customer_floor : ""
      ].filter(function (p) { return p && String(p).trim(); });

      return {
        lat: hasCoords ? customerLat : DEFAULT_LAT,
        lng: hasCoords ? customerLng : DEFAULT_LNG,
        name: fullName,
        address: addressParts.join(", ") || "Delivery address on file",
        city: "",
        country: "",
        fullAddress: ([fullName].concat(addressParts)).join(", ") || "Delivery address on file"
      };
    }

    return {
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
      name: "Customer",
      address: "Delivery address on file",
      city: "",
      country: "",
      fullAddress: "Delivery address on file"
    };
  }

  function ensureInlineMap() {
    if (inlineMap) return;
    inlineMap = L.map("deliveryMap", {
      center: [currentLocation.lat, currentLocation.lng],
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

    inlineMarker = L.marker(
      [currentLocation.lat, currentLocation.lng],
      { icon: markerIcon }
    )
      .addTo(inlineMap)
      .bindPopup(buildPopupContent(currentLocation), {
        className: "vo-map-popup",
        maxWidth: 260,
        closeButton: true,
        autoPan: true
      });

    setTimeout(function () {
      inlineMarker.openPopup();
    }, 600);
  }

  function updateInlineMap(loc) {
    if (!inlineMap) {
      currentLocation = loc;
      ensureInlineMap();
      return;
    }
    currentLocation = loc;
    inlineMap.setView([loc.lat, loc.lng], 15, { animate: true });
    inlineMarker.setLatLng([loc.lat, loc.lng]);
    inlineMarker.setPopupContent(buildPopupContent(loc));
    inlineMarker.openPopup();
  }

  /* ── Lock / Unlock inline map ── */
  var inlineMapEl = document.getElementById("deliveryMap");

  function lockInlineMap() {
    if (!inlineMap) return;
    inlineMap.dragging.disable();
    inlineMap.touchZoom.disable();
    inlineMap.scrollWheelZoom.disable();
    inlineMap.doubleClickZoom.disable();
    inlineMap.boxZoom.disable();
    inlineMap.keyboard.disable();
    if (inlineMap.tap) inlineMap.tap.disable();
    if (inlineMapEl) inlineMapEl.classList.add("vo-map-locked");
  }

  function unlockInlineMap() {
    if (!inlineMap) return;
    inlineMap.dragging.enable();
    inlineMap.touchZoom.enable();
    inlineMap.scrollWheelZoom.disable();
    inlineMap.doubleClickZoom.disable();
    inlineMap.boxZoom.enable();
    inlineMap.keyboard.enable();
    if (inlineMap.tap) inlineMap.tap.enable();
    if (inlineMapEl) inlineMapEl.classList.remove("vo-map-locked");
  }

  var expandedMap = null;
  var expandedMarker = null;

  function initExpandedMap() {
    if (expandedMap) {
      expandedMap.invalidateSize();
      expandedMap.setView([currentLocation.lat, currentLocation.lng], 16);
      expandedMarker.setLatLng([currentLocation.lat, currentLocation.lng]);
      expandedMarker.setPopupContent(buildPopupContent(currentLocation));
      expandedMarker.openPopup();
      return;
    }

    expandedMap = L.map("deliveryMapExpanded", {
      center: [currentLocation.lat, currentLocation.lng],
      zoom: 16,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer(tileUrl, { attribution: tileAttrib, maxZoom: 19 }).addTo(
      expandedMap
    );

    expandedMarker = L.marker(
      [currentLocation.lat, currentLocation.lng],
      { icon: markerIcon }
    )
      .addTo(expandedMap)
      .bindPopup(buildPopupContent(currentLocation), {
        className: "vo-map-popup",
        maxWidth: 260,
        closeButton: true
      });

    setTimeout(function () {
      expandedMap.invalidateSize();
      expandedMarker.openPopup();
    }, 350);
  }

  function updateOpenInMaps(loc) {
    if (openInMapsEl) {
      openInMapsEl.href = googleMapsUrl(loc);
    }
  }

  var mapOverlay = document.getElementById("mapOverlay");
  var mapExpandBtn = document.getElementById("mapExpandBtn");
  var mapOverlayClose = document.getElementById("mapOverlayClose");

  if (mapExpandBtn) {
    mapExpandBtn.addEventListener("click", function () {
      mapOverlay.classList.add("show");
      lockInlineMap();
      setTimeout(initExpandedMap, 50);
    });
  }

  if (mapOverlayClose) {
    mapOverlayClose.addEventListener("click", function () {
      mapOverlay.classList.remove("show");
      unlockInlineMap();
    });
  }

  if (mapOverlay) {
    mapOverlay.addEventListener("click", function (e) {
      if (e.target === mapOverlay) {
        mapOverlay.classList.remove("show");
        unlockInlineMap();
      }
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mapOverlay && mapOverlay.classList.contains("show")) {
      mapOverlay.classList.remove("show");
      unlockInlineMap();
    }
  });

  window.addEventListener("resize", function () {
    if (inlineMap) inlineMap.invalidateSize();
    if (expandedMap && mapOverlay && mapOverlay.classList.contains("show")) {
      expandedMap.invalidateSize();
    }
  });

  if (window.__orderData) {
    currentLocation = locationFromOrder(window.__orderData);
  } else {
    currentLocation = locationFromOrder(null);
  }

  ensureInlineMap();
  updateOpenInMaps(currentLocation);

  window.addEventListener("order-loaded", function (evt) {
    var loc = locationFromOrder(evt.detail || {});
    updateInlineMap(loc);
    updateOpenInMaps(loc);
  });

  if (window.__orderData) {
    var loc = locationFromOrder(window.__orderData);
    updateInlineMap(loc);
    updateOpenInMaps(loc);
  }
})();