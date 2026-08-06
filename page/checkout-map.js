// ===== Leaflet Map Initialization =====
(function () {
  var mapContainer = document.getElementById("mapContainer");
  var mapOverlay = document.getElementById("mapOverlay");
  var mapLatInput = document.getElementById("mapLat");
  var mapLngInput = document.getElementById("mapLng");
  var mapCoords = document.getElementById("mapCoords");
  var coordsText = document.getElementById("coordsText");
  var locateBtn = document.getElementById("mapLocateBtn");

  if (!mapContainer) return;

  var map = L.map("checkoutMap", {
    center: [40.7128, -74.006],
    zoom: 13,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  var markerIcon = L.divIcon({
    className: "custom-map-marker",
    html: '<svg width="28" height="28" viewBox="0 0 24 24" fill="#2563eb" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

  var marker = null;

  function hideOverlay() {
    if (mapOverlay && mapOverlay.style.display !== "none") {
      mapOverlay.style.opacity = "0";
      mapOverlay.style.pointerEvents = "none";
      setTimeout(function () {
        mapOverlay.style.display = "none";
      }, 300);
    }
  }

  function placeMarker(latlng) {
    var lat = latlng.lat;
    var lng = latlng.lng;

    if (marker) {
      marker.setLatLng(latlng);
    } else {
      marker = L.marker(latlng, { icon: markerIcon }).addTo(map);
    }

    mapLatInput.value = lat.toFixed(6);
    mapLngInput.value = lng.toFixed(6);

    coordsText.textContent = lat.toFixed(6) + ", " + lng.toFixed(6);
    mapCoords.style.display = "flex";

    mapContainer.style.borderColor = "";
    mapContainer.style.boxShadow = "";
  }

  // Click on map to place marker
  map.on("click", function (e) {
    hideOverlay();
    placeMarker(e.latlng);
  });

  // Click on overlay -> hide it AND drop a pin at map center
  if (mapOverlay) {
    mapOverlay.addEventListener("click", function () {
      hideOverlay();
      placeMarker(map.getCenter());
    });
  }

  // ===== Current Location Button =====
  if (locateBtn) {
    locateBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      if (!navigator.geolocation) {
        locateBtn.classList.add("error");
        locateBtn.querySelector("span").textContent = "Not Supported";
        setTimeout(function () {
          locateBtn.classList.remove("error");
          locateBtn.querySelector("span").textContent = "My Location";
        }, 2000);
        return;
      }

      locateBtn.classList.add("loading");
      locateBtn.querySelector("span").textContent = "Locating...";

      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = position.coords.latitude;
          var lng = position.coords.longitude;
          var latlng = L.latLng(lat, lng);

          hideOverlay();
          map.setView(latlng, 16);
          placeMarker(latlng);

          locateBtn.classList.remove("loading");
          locateBtn.classList.add("success");
          locateBtn.querySelector("span").textContent = "Located!";
          setTimeout(function () {
            locateBtn.classList.remove("success");
            locateBtn.querySelector("span").textContent = "My Location";
          }, 2000);
        },
        function (error) {
          locateBtn.classList.remove("loading");
          locateBtn.classList.add("error");

          var msg = "Denied";
          if (error.code === 2) msg = "Unavailable";
          if (error.code === 3) msg = "Timeout";

          locateBtn.querySelector("span").textContent = msg;
          setTimeout(function () {
            locateBtn.classList.remove("error");
            locateBtn.querySelector("span").textContent = "My Location";
          }, 2500);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }

  setTimeout(function () {
    map.invalidateSize();
  }, 500);
})();
