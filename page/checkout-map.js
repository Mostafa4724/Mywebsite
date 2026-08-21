// ===== Leaflet Map Initialization =====
(function () {
  "use strict";

  var mapContainer = document.getElementById("mapContainer");
  var mapOverlay = document.getElementById("mapOverlay");
  var mapLatInput = document.getElementById("mapLat");
  var mapLngInput = document.getElementById("mapLng");
  var mapCoords = document.getElementById("mapCoords");
  var coordsText = document.getElementById("coordsText");
  var locateBtn = document.getElementById("mapLocateBtn");

  if (!mapContainer) return;

  // ============================================================
  // MAP
  // ============================================================

  var map = L.map("checkoutMap", {
    center: [30.0521, 31.3422],
    zoom: 12,
    zoomControl: true,
    attributionControl: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  // ============================================================
  // MARKER
  // ============================================================

  var markerIcon = L.divIcon({
    className: "custom-map-marker",
    html:
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="#2563eb" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/>' +
      '<circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/>' +
      "</svg>",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });

  var marker = null;

  // ============================================================
  // SHIPPING AREA
  // ============================================================

  var shippingBoundary = null;
  var shippingLayer = null;

  /*
   * IMPORTANT:
   *
   * Put the real Nasr City GeoJSON file at:
   *
   *     /data/nasr-city.geojson
   *
   * The GeoJSON should contain the actual Nasr City polygon.
   */

  fetch("../data/nasr-city.geojson")
    .then(function (response) {
      if (!response.ok) {
        throw new Error(
          "HTTP " + response.status + " - Nasr City boundary file could not be loaded."
        );
      }

      return response.text();
    })
    .then(function (text) {
      console.log("GeoJSON response length:", text.length);
      console.log("GeoJSON response:", text);

      if (!text.trim()) {
        throw new Error("Nasr City GeoJSON file is empty.");
      }

      var geojson;

      try {
        geojson = JSON.parse(text);
      } catch (error) {
        throw new Error(
          "Nasr City GeoJSON contains invalid JSON: " + error.message
        );
      }

      if (!geojson) {
        throw new Error("Nasr City GeoJSON is empty.");
      }

      shippingLayer = L.geoJSON(geojson, {
        style: {
          color: "#2563eb",
          weight: 2,
          opacity: 0.9,
          fillColor: "#2563eb",
          fillOpacity: 0.10
        },
        interactive: false
      }).addTo(map);

      var bounds = shippingLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [20, 20]
        });
      }

      map.invalidateSize();

      console.log("Nasr City boundary loaded successfully.");
    })
    .catch(function (error) {
      console.error("Nasr City boundary error:", error);

      showMapError(
        "Delivery area could not be loaded. Check the nasr-city.geojson file."
      );
    });

  // ============================================================
  // ERROR
  // ============================================================

  function showMapError(message) {
    var mapError = document.getElementById("mapError");

    if (mapError) {
      mapError.textContent = message;
      mapError.classList.add("visible");
    }

    mapContainer.style.borderColor = "#ef4444";
    mapContainer.style.boxShadow =
      "0 0 0 2px rgba(239, 68, 68, 0.15)";
  }

  function clearMapError() {
    var mapError = document.getElementById("mapError");

    if (mapError) {
      mapError.classList.remove("visible");
    }

    mapContainer.style.borderColor = "";
    mapContainer.style.boxShadow = "";
  }

  // ============================================================
  // HIDE OVERLAY
  // ============================================================

  function hideOverlay() {
    if (mapOverlay && mapOverlay.style.display !== "none") {
      mapOverlay.style.opacity = "0";
      mapOverlay.style.pointerEvents = "none";

      setTimeout(function () {
        mapOverlay.style.display = "none";
      }, 300);
    }
  }

  // ============================================================
  // POINT-IN-POLYGON
  // ============================================================
  //
  // Leaflet's GeoJSON layer does not provide a direct
  // "contains point" method, so we perform a real polygon
  // point-in-polygon test.
  //
  // This is different from getBounds().contains().
  //
  // getBounds() would incorrectly allow locations inside the
  // rectangle surrounding Nasr City but outside its actual border.
  // ============================================================

  function pointInPolygon(point, polygon) {
    var x = point[0];
    var y = point[1];

    var inside = false;

    for (
      var i = 0, j = polygon.length - 1;
      i < polygon.length;
      j = i++
    ) {
      var xi = polygon[i][0];
      var yi = polygon[i][1];

      var xj = polygon[j][0];
      var yj = polygon[j][1];

      var intersects =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  // ============================================================
  // GEOJSON LOCATION CHECK
  // ============================================================

  function coordinateInsideGeometry(lat, lng, geometry) {
    if (!geometry) return false;

    var coordinates = geometry.coordinates;

    if (geometry.type === "Polygon") {
      var outerRing = coordinates[0];

      var polygon = outerRing.map(function (coord) {
        return [coord[0], coord[1]];
      });

      return pointInPolygon([lng, lat], polygon);
    }

    if (geometry.type === "MultiPolygon") {
      for (var p = 0; p < coordinates.length; p++) {
        var polygonCoords = coordinates[p];

        if (!polygonCoords || !polygonCoords[0]) {
          continue;
        }

        var polygon = polygonCoords[0].map(function (coord) {
          return [coord[0], coord[1]];
        });

        if (pointInPolygon([lng, lat], polygon)) {
          return true;
        }
      }
    }

    return false;
  }

  function isInsideShippingArea(latlng) {
    if (!shippingLayer || !shippingLayer.getLayers) {
      return false;
    }

    var layers = shippingLayer.getLayers();

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];

      if (!layer.feature || !layer.feature.geometry) {
        continue;
      }

      var geometry = layer.feature.geometry;

      if (
        geometry.type === "FeatureCollection" &&
        geometry.features
      ) {
        for (var j = 0; j < geometry.features.length; j++) {
          if (
            coordinateInsideGeometry(
              latlng.lat,
              latlng.lng,
              geometry.features[j].geometry
            )
          ) {
            return true;
          }
        }
      } else if (
        coordinateInsideGeometry(
          latlng.lat,
          latlng.lng,
          geometry
        )
      ) {
        return true;
      }
    }

    return false;
  }

  // ============================================================
  // PLACE MARKER
  // ============================================================

  function placeMarker(latlng) {
    if (!latlng) {
      return false;
    }

    if (!isInsideShippingArea(latlng)) {
      showMapError(
        "Sorry, we only deliver inside Nasr City. Please select a location inside the highlighted area."
      );

      return false;
    }

    var lat = latlng.lat;
    var lng = latlng.lng;

    if (marker) {
      marker.setLatLng(latlng);
    } else {
      marker = L.marker(latlng, {
        icon: markerIcon
      }).addTo(map);
    }

    if (mapLatInput) {
      mapLatInput.value = lat.toFixed(6);
    }

    if (mapLngInput) {
      mapLngInput.value = lng.toFixed(6);
    }

    if (coordsText) {
      coordsText.textContent =
        lat.toFixed(6) + ", " + lng.toFixed(6);
    }

    if (mapCoords) {
      mapCoords.style.display = "flex";
    }

    clearMapError();

    return true;
  }

  // ============================================================
  // MAP CLICK
  // ============================================================

  map.on("click", function (e) {
    if (!shippingLayer) {
      showMapError(
        "Please wait while the delivery area is loading."
      );
      return;
    }

    if (!isInsideShippingArea(e.latlng)) {
      showMapError(
        "This location is outside our delivery area. Please select a location inside Nasr City."
      );

      return;
    }

    hideOverlay();
    placeMarker(e.latlng);
  });

  // ============================================================
  // OVERLAY
  // ============================================================

  if (mapOverlay) {
    mapOverlay.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!shippingLayer) {
        showMapError(
          "Please wait while the delivery area is loading."
        );
        return;
      }

      var center = map.getCenter();

      if (!isInsideShippingArea(center)) {
        showMapError(
          "Please select a location inside the highlighted Nasr City delivery area."
        );
        return;
      }

      hideOverlay();
      placeMarker(center);
    });
  }

  // ============================================================
  // CURRENT LOCATION
  // ============================================================

  if (locateBtn) {
    locateBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!navigator.geolocation) {
        locateBtn.classList.add("error");

        var unsupportedText = locateBtn.querySelector("span");

        if (unsupportedText) {
          unsupportedText.textContent = "Not Supported";
        }

        showMapError(
          "Your browser does not support location detection."
        );

        setTimeout(function () {
          locateBtn.classList.remove("error");

          if (unsupportedText) {
            unsupportedText.textContent = "My Location";
          }
        }, 2000);

        return;
      }

      locateBtn.classList.add("loading");

      var locateText = locateBtn.querySelector("span");

      if (locateText) {
        locateText.textContent = "Locating...";
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = position.coords.latitude;
          var lng = position.coords.longitude;

          var latlng = L.latLng(lat, lng);

          if (!shippingLayer) {
            locateBtn.classList.remove("loading");

            if (locateText) {
              locateText.textContent = "My Location";
            }

            showMapError(
              "Please wait until the delivery area finishes loading."
            );

            return;
          }

          if (!isInsideShippingArea(latlng)) {
            locateBtn.classList.remove("loading");
            locateBtn.classList.add("error");

            if (locateText) {
              locateText.textContent = "Outside Area";
            }

            showMapError(
              "Your current location is outside our Nasr City delivery area."
            );

            setTimeout(function () {
              locateBtn.classList.remove("error");

              if (locateText) {
                locateText.textContent = "My Location";
              }
            }, 3000);

            return;
          }

          hideOverlay();

          map.setView(latlng, 16);

          placeMarker(latlng);

          locateBtn.classList.remove("loading");
          locateBtn.classList.add("success");

          if (locateText) {
            locateText.textContent = "Located!";
          }

          setTimeout(function () {
            locateBtn.classList.remove("success");

            if (locateText) {
              locateText.textContent = "My Location";
            }
          }, 2000);
        },

        function (error) {
          locateBtn.classList.remove("loading");
          locateBtn.classList.add("error");

          var locateText = locateBtn.querySelector("span");

          var msg = "Denied";

          if (error.code === 2) {
            msg = "Unavailable";
          }

          if (error.code === 3) {
            msg = "Timeout";
          }

          if (locateText) {
            locateText.textContent = msg;
          }

          var errorMessage =
            "Unable to determine your current location.";

          if (error.code === 1) {
            errorMessage =
              "Location permission was denied. Please allow location access or select your location manually.";
          }

          if (error.code === 2) {
            errorMessage =
              "Your location is currently unavailable. Please select your location manually.";
          }

          if (error.code === 3) {
            errorMessage =
              "Location detection timed out. Please try again.";
          }

          showMapError(errorMessage);

          setTimeout(function () {
            locateBtn.classList.remove("error");

            if (locateText) {
              locateText.textContent = "My Location";
            }
          }, 2500);
        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  // ============================================================
  // CHECKOUT VALIDATION
  // ============================================================

  window.isCheckoutLocationValid = function () {
    if (!mapLatInput || !mapLngInput) {
      return false;
    }

    if (!shippingLayer) {
      showMapError(
        "The delivery area is still loading. Please wait."
      );

      return false;
    }

    var lat = parseFloat(mapLatInput.value);
    var lng = parseFloat(mapLngInput.value);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      showMapError(
        "Please select your delivery location on the map."
      );

      return false;
    }

    var latlng = L.latLng(lat, lng);

    if (!isInsideShippingArea(latlng)) {
      showMapError(
        "Your selected delivery location is outside our Nasr City delivery area."
      );

      return false;
    }

    clearMapError();

    return true;
  };

  // ============================================================
  // MAP SIZE FIX
  // ============================================================

  setTimeout(function () {
    map.invalidateSize();

    if (shippingLayer) {
      var bounds = shippingLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [20, 20]
        });
      }
    }
  }, 500);

})();