// script.js

let map;
let searchBox;
let markers = [];
let watchId; // To store the ID of the geolocation watch
let isUserMoving = false; // Flag to check if the user is currently moving
const movementThreshold = 50; // in meters

function initMap() {
  // Create the search box and link it to the UI element.
  const input = document.getElementById('pac-input');
  searchBox = new google.maps.places.SearchBox(input);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

  // Bias the SearchBox results towards the map's viewport.
  map.addListener('bounds_changed', function () {
    searchBox.setBounds(map.getBounds());
  });

  searchBox.addListener('places_changed', function () {
    const places = searchBox.getPlaces();

    if (places.length === 0) {
      return;
    }

    // Clear out the old markers.
    markers.forEach(marker => {
      marker.setMap(null);
    });
    markers = [];

    // For each place, get the icon, name, and location.
    const bounds = new google.maps.LatLngBounds();
    places.forEach(place => {
      if (!place.geometry) {
        console.log("Returned place contains no geometry");
        return;
      }

      // Create a marker for each place.
      markers.push(new google.maps.Marker({
        map: map,
        title: place.name,
        position: place.geometry.location,
      }));

      if (place.geometry.viewport) {
        // Only geocodes have a viewport.
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });

    // Set the map center and fit the bounds to the selected location(s).
    map.setCenter(bounds.getCenter());
    map.fitBounds(bounds);

    // Recommend eating spots based on user's eating time at the current location
    recommendEatingSpots(bounds.getCenter(), getCurrentEatingTime());
  });

  // Notify the user of the eating time at the current location
  notifyEatingTime();
}

function notifyEatingTime() {
  // Get the current time
  const currentTime = new Date();
  const currentHour = currentTime.getHours();

  // Check the time and notify the user
  if (currentHour >= 7 && currentHour < 12) {
    alert("Good morning! It's breakfast time. Here are some places for breakfast near you.");
  } else if (currentHour >= 12 && currentHour < 18) {
    alert("Hello! It's lunchtime. Check out these lunch spots around you.");
  } else {
    alert("Good evening! It's dinner time. Explore these dinner options near you.");
  }
}

function getCurrentEatingTime() {
  const currentTime = new Date();
  const currentHour = currentTime.getHours();

  if (currentHour >= 7 && currentHour < 12) {
    return 'breakfast';
  } else if (currentHour >= 12 && currentHour < 18) {
    return 'lunch';
  } else {
    return 'dinner';
  }
}

function recommendEatingSpots(location, eatingTime) {
  // Request nearby places using the Places API
  const placesService = new google.maps.places.PlacesService(map);

  const request = {
    location: location,
    radius: 500,  // Search radius in meters
    types: ['restaurant', 'bar', 'cafe'],  // Specify types like 'bar', 'cafe', etc.
  };

  placesService.nearbySearch(request, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      // Filter places based on the user's eating time
      const recommendedSpots = filterByEatingTime(results, eatingTime);

      // Display markers for the recommended spots
      recommendedSpots.forEach(place => {
        const marker = new google.maps.Marker({
          position: place.geometry.location,
          map: map,
          title: place.name,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png', // Example: blue marker
          },
        });

        // Add click event listener to show place details
        marker.addListener('click', function () {
          showPlaceDetails(place.place_id);
        });

        markers.push(marker);
      });
    }
  });
}

function filterByEatingTime(places, eatingTime) {
  // Example: Filter places based on the user's eating time
  switch (eatingTime) {
    case 'breakfast':
      return places.filter(place => place.types.includes('restaurant') || place.types.includes('cafe'));
    case 'lunch':
      return places.filter(place => place.types.includes('restaurant') || place.types.includes('cafe') || place.types.includes('bar'));
    case 'dinner':
      return places.filter(place => place.types.includes('restaurant') || place.types.includes('bar'));
    default:
      return places;
  }
}

function watchUserLocation() {
  // Check if the browser supports geolocation
  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      function (position) {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // Check if the user has moved beyond the threshold
        if (isUserMoving && calculateDistance(userLocation, markers[markers.length - 1].getPosition()) > movementThreshold) {
          // User has moved to a new location, recommend eating spots
          recommendEatingSpots(userLocation, getCurrentEatingTime());
        }

        // Store the user's location accuracy
        const userLocationAccuracy = position.coords.accuracy;

        console.log('User Location:', userLocation); // Log user location

        // Update the map center and recommend eating spots based on user's eating time
        map.setCenter(userLocation);

        // Remove previous user marker and accuracy circle (if any)
        markers.forEach(marker => {
          marker.setMap(null);
        });

        // Create a new marker for the user's location
        const userMarker = new google.maps.Marker({
          position: userLocation,
          map: map,
          title: 'Your Location',
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png', // Custom marker for user's location
        });

        // Create a circle for the user's location accuracy
        const accuracyCircle = new google.maps.Circle({
          map: map,
          center: userLocation,
          radius: userLocationAccuracy, // Set the radius to the user's location accuracy
          strokeColor: '#2196F3', // Blue color
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#2196F3',
          fillOpacity: 0.35,
        });

        // Add the user marker and accuracy circle to the markers array
        markers.push(userMarker);
        markers.push(accuracyCircle);

        // Update the flag to indicate the user is currently moving
        isUserMoving = true;
      },
      function (error) {
        console.error('Error getting user location:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,  // Maximum age of a cached position in milliseconds
        timeout: 10000  // Maximum time allowed for obtaining a position in milliseconds
      }
    );
  } else {
    console.error('Geolocation is not supported by this browser.');
  }
}

// Function to calculate distance between two points using Haversine formula
function calculateDistance(point1, point2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = toRadians(point1.lat);
  const φ2 = toRadians(point2.lat);
  const Δφ = toRadians(point2.lat - point1.lat);
  const Δλ = toRadians(point2.lng - point1.lng);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Get the user's current location and initialize the map
navigator.geolocation.getCurrentPosition(
  (position) => {
    const {
      latitude,
      longitude
    } = position.coords;
    map = new google.maps.Map(document.getElementById('map'), {
      center: {
        lat: latitude,
        lng: longitude
      },
      zoom: 15,
    });

    // Add a marker at the initial location
    const marker = new google.maps.Marker({
      position: {
        lat: latitude,
        lng: longitude
      },
      map: map,
      title: 'Initial Location',
    });

    // Initialize the map with the current location
    initMap();

    // Update the map center and recommend eating spots based on user's eating time
    const userLocation = {
      lat: latitude,
      lng: longitude
    };
    map.setCenter(userLocation);
    recommendEatingSpots(userLocation, getCurrentEatingTime());
  },
  (error) => {
    console.error('Error getting user location:', error);
  }
);

// Call watchUserLocation to start watching the user's location
watchUserLocation();

// Function to show details of a place, including photos and reviews
function showPlaceDetails(placeId) {
  // Request place details using the Place Details API
  const placesService = new google.maps.places.PlacesService(map);

  const request = {
    placeId: placeId,
    fields: ['name', 'formatted_address', 'photos', 'reviews', 'rating'],
  };

  placesService.getDetails(request, function (place, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      // Create a modal or popup to display place details
      const popupContainer = document.createElement('div');
      popupContainer.style.position = 'fixed';
      popupContainer.style.top = '50%';
      popupContainer.style.left = '50%';
      popupContainer.style.transform = 'translate(-50%, -50%)';
      popupContainer.style.background = '#fff';
      popupContainer.style.padding = '20px';
      popupContainer.style.borderRadius = '10px';
      popupContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
      popupContainer.style.zIndex = '1000';

      // Display a single photo if available
      if (place.photos && place.photos.length > 0) {
        const img = document.createElement('img');
        img.src = place.photos[0].getUrl({ maxWidth: 200, maxHeight: 200 }); // Set maximum width and height
        img.alt = place.name;
        popupContainer.appendChild(img);
      } else {
        console.log('No photos available for this place.');
      }

      // Display up to three reviews if available
      if (place.reviews && place.reviews.length > 0) {
        const reviewsContainer = document.createElement('div');

        // Display a maximum of three reviews
        const maxReviews = Math.min(place.reviews.length, 3);
        for (let i = 0; i < maxReviews; i++) {
          const review = place.reviews[i];
          const reviewElement = document.createElement('div');
          reviewElement.innerHTML = `<strong>${review.author_name}</strong> - ${getRatingStars(review.rating)}<br>${review.text}<br><br>`;
          reviewsContainer.appendChild(reviewElement);
        }

        popupContainer.appendChild(reviewsContainer);
      } else {
        console.log('No reviews available for this place.');
      }

      // Display rating stars if available
      if (place.rating) {
        const ratingElement = document.createElement('div');
        ratingElement.innerHTML = `Rating: ${getRatingStars(place.rating)}`;
        popupContainer.appendChild(ratingElement);
      } else {
        console.log('No rating available for this place.');
      }

      // Display other information
      const infoElement = document.createElement('div');
      infoElement.innerHTML = `<strong>${place.name}</strong><br>${place.formatted_address}`;
      popupContainer.appendChild(infoElement);

      // Create a close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = 'Close';
      closeButton.style.marginTop = '10px';
      closeButton.addEventListener('click', function () {
        // Remove the popup container when the close button is clicked
        document.body.removeChild(popupContainer);
      });

      // Append the close button to the popup container
      popupContainer.appendChild(closeButton);

      // Append the popup container to the body
      document.body.appendChild(popupContainer);
    } else {
      console.error('Error fetching place details:', status, placeId);
      alert(`Error fetching place details. Please check the console for more information.`);
    }
  });
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
}

// Helper function to get HTML for rating stars
function getRatingStars(rating) {
  const roundedRating = Math.round(rating * 2) / 2; // Round to nearest 0.5
  const starCount = 5;

  let starsHtml = '';
  for (let i = 1; i <= starCount; i++) {
    const starClass = i <= roundedRating ? 'filled-star' : 'empty-star';
    starsHtml += `<span class="${starClass}">&#9733;</span>`;
  }

  return starsHtml;
}
