// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCCD8T2Kc7rEY2N6S6ZdOIQ2fX-JH3uEns",
    authDomain: "casalink-cfd29.firebaseapp.com",
    projectId: "casalink-cfd29",
    storageBucket: "casalink-cfd29.firebasestorage.app",
    messagingSenderId: "902727382779",
    appId: "1:902727382779:web:c26edb57c051143ed2625e",
    measurementId: "G-9697Y7T4F0"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const chatDb = firebase.database().ref('chat');

let map;
let markers = [];
let currentProperties = [];
const csvUrl = 'e/2PACX-1vSbKRhAL1bydYIVc-GYUiKZCZx8ZDNE90_8sHCfbUsMCw-x39gG_Alsy6ZWEvpkW6mVzeWmXxc4eSBV'; // Replace if using CSV

// Initialize Google Map
function initMap() {
    try {
        console.log("Initializing map...");
        const lusaka = { lat: -15.40669, lng: 28.28713 };
        map = new google.maps.Map(document.getElementById('map'), {
            zoom: 12,
            center: lusaka
        });
        loadProperties();
        loadUserListings();
        loadFavorites();
        listenForChat();
    } catch (error) {
        console.error("Map initialization failed:", error);
    }
}

// Load all properties from Firestore
function loadProperties() {
    db.collection('listings').get()
        .then(snapshot => {
            const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Properties fetched:", properties);
            currentProperties = properties;
            displayProperties(properties);
        })
        .catch(error => console.error('Error fetching Firestore:', error));
}

// Step 7: Display properties with reviews and ratings
function displayProperties(properties) {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    const infoWindow = new google.maps.InfoWindow();
    const propertyList = document.getElementById('property-list');
    propertyList.innerHTML = '';

    properties.forEach((property, index) => {
        const lat = parseFloat(property.Latitude);
        const lng = parseFloat(property.Longitude);
        console.log(`Property ${index}: Lat=${lat}, Lng=${lng}`);
        if (!isNaN(lat) && !isNaN(lng)) {
            const marker = new google.maps.Marker({
                position: { lat: lat, lng: lng },
                map: map,
                title: property.Title
            });
            marker.addListener('click', () => {
                const content = `
                    <h3>${property.Title}</h3>
                    <p>Price: $${property.Price}</p>
                    <p>Bedrooms: ${property.Bedrooms}</p>
                    <p>${property.Description}</p>
                    <button onclick="addToFavorites(${index})">Favorite</button>
                    <div id="comments-${property.id}"></div>
                    <input type="text" id="comment-${property.id}" placeholder="Leave a comment">
                    <button onclick="addComment('${property.id}')">Comment</button>
                    <div>
                        <input type="number" id="rating-${property.id}" min="1" max="5" placeholder="Rating (1-5)">
                        <textarea id="review-${property.id}" placeholder="Your review"></textarea>
                        <button onclick="submitReview('${property.id}')">Submit Review</button>
                    </div>
                    <div id="reviews-${property.id}"></div>
                `;
                infoWindow.setContent(content);
                infoWindow.open(map, marker);
                loadComments(property.id);
                loadReviews(property.id); // Step 7: Load reviews
            });
            markers.push(marker);

            const listItem = document.createElement('div');
            listItem.className = 'property-item';
            listItem.innerHTML = `
                <h3>${property.Title}</h3>
                <p>Price: $${property.Price}</p>
                <p>Bedrooms: ${property.Bedrooms}</p>
                <p>${property.Description}</p>
                <button onclick="addToFavorites(${index})">Favorite</button>
                <div>
                    <input type="number" id="rating-${property.id}" min="1" max="5" placeholder="Rating (1-5)">
                    <textarea id="review-${property.id}" placeholder="Your review"></textarea>
                    <button onclick="submitReview('${property.id}')">Submit Review</button>
                </div>
                <div id="reviews-${property.id}"></div>
            `;
            propertyList.appendChild(listItem);
            loadReviews(property.id); // Step 7: Load reviews
        }
    });
}

// Step 2: Filter properties with location
function filterProperties() {
    const maxPrice = parseFloat(document.getElementById('price').value) || Infinity;
    const minBedrooms = parseInt(document.getElementById('bedrooms').value) || 0;
    const location = document.getElementById('location').value.trim();
    let query = db.collection('listings');
    if (maxPrice !== Infinity) query = query.where('Price', '<=', maxPrice);
    if (minBedrooms !== 0) query = query.where('Bedrooms', '>=', minBedrooms);
    if (location) query = query.where('Location', '==', location);
    query.get()
        .then(snapshot => {
            const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayProperties(properties);
        })
        .catch(error => console.error('Error filtering properties:', error));
}

// Authentication functions with Step 1 profile loading
function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            document.getElementById('user-status').textContent = `Logged in as: ${userCredential.user.email}`;
            loadUserListings();
            loadFavorites();
            loadProfile(); // Step 1: Load profile on login
        })
        .catch(error => alert('Error: ' + error.message));
}

function signOut() {
    firebase.auth().signOut()
        .then(() => {
            document.getElementById('user-status').textContent = 'Not logged in';
            document.getElementById('user-listings').innerHTML = '';
            document.getElementById('favorites-list').innerHTML = '';
            document.getElementById('profile-section').style.display = 'none'; // Step 1: Hide profile
        })
        .catch(error => alert('Error: ' + error.message));
}

// Step 1: Save profile
function saveProfile() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to save your profile.');
        return;
    }
    const profileData = {
        name: document.getElementById('profile-name').value,
        age: parseInt(document.getElementById('profile-age').value) || 0,
        preferences: document.getElementById('profile-preferences').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('users').doc(user.uid).set(profileData, { merge: true })
        .then(() => alert('Profile saved!'))
        .catch(error => alert('Error saving profile: ' + error.message));
}

// Step 1: Load profile
function loadProfile() {
    const user = firebase.auth().currentUser;
    const profileSection = document.getElementById('profile-section');
    if (!user) {
        profileSection.style.display = 'none';
        return;
    }
    profileSection.style.display = 'block';
    db.collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('profile-name').value = data.name || '';
                document.getElementById('profile-age').value = data.age || '';
                document.getElementById('profile-preferences').value = data.preferences || '';
            }
        })
        .catch(error => console.error('Error loading profile:', error));
}

// Step 2: Add listing with location
function addListing() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to add a listing.');
        return;
    }
    const listing = {
        Title: document.getElementById('new-title').value,
        Price: parseFloat(document.getElementById('new-price').value),
        Bedrooms: parseInt(document.getElementById('new-bedrooms').value),
        Location: document.getElementById('new-location').value, // Step 2: Added location
        Latitude: parseFloat(document.getElementById('new-lat').value),
        Longitude: parseFloat(document.getElementById('new-lng').value),
        Description: document.getElementById('new-desc').value,
        userId: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('listings').add(listing)
        .then(() => {
            alert('Listing added!');
            loadUserListings();
            loadProperties();
        })
        .catch(error => alert('Error adding listing: ' + error.message));
}

// Step 3: Load user listings with edit and delete options
function loadUserListings() {
    const user = firebase.auth().currentUser;
    const userListingsDiv = document.getElementById('user-listings');
    userListingsDiv.innerHTML = '';
    if (!user) {
        userListingsDiv.textContent = 'Log in to see your listings.';
        return;
    }
    db.collection('listings')
        .where('userId', '==', user.uid)
        .get()
        .then(querySnapshot => {
            querySnapshot.forEach(doc => {
                const property = doc.data();
                const listItem = document.createElement('div');
                listItem.className = 'property-item';
                listItem.innerHTML = `
                    <h3>${property.Title}</h3>
                    <p>Price: $${property.Price}</p>
                    <p>Bedrooms: ${property.Bedrooms}</p>
                    <p>${property.Description}</p>
                    <button onclick="editListing('${doc.id}')">Edit</button>
                    <button onclick="deleteListing('${doc.id}')">Delete</button>
                `;
                userListingsDiv.appendChild(listItem);
            });
        })
        .catch(error => console.error('Error loading listings:', error));
}

// Step 3: Delete listing
function deleteListing(listingId) {
    if (confirm('Are you sure you want to delete this listing?')) {
        db.collection('listings').doc(listingId).delete()
            .then(() => {
                alert('Listing deleted!');
                loadUserListings();
                loadProperties();
            })
            .catch(error => alert('Error deleting listing: ' + error.message));
    }
}

// Step 3: Edit listing (basic implementation)
function editListing(listingId) {
    const newTitle = prompt('Enter new title:');
    if (newTitle) {
        db.collection('listings').doc(listingId).update({ Title: newTitle })
            .then(() => {
                alert('Listing updated!');
                loadUserListings();
                loadProperties();
            })
            .catch(error => alert('Error updating listing: ' + error.message));
    }
}

// Favorites functions (unchanged from base)
function addToFavorites(index) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to favorite a listing.');
        return;
    }
    const property = currentProperties[index];
    db.collection('favorites')
        .doc(`${user.uid}_${property.Title}`)
        .set({ ...property, userId: user.uid })
        .then(() => {
            alert(`${property.Title} added to favorites!`);
            loadFavorites();
        })
        .catch(error => alert('Error favoriting: ' + error.message));
}

function loadFavorites() {
    const user = firebase.auth().currentUser;
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = '';
    if (!user) {
        favoritesList.textContent = 'Log in to see your favorites.';
        return;
    }
    db.collection('favorites')
        .where('userId', '==', user.uid)
        .get()
        .then(querySnapshot => {
            querySnapshot.forEach(doc => {
                const property = doc.data();
                const listItem = document.createElement('div');
                listItem.className = 'property-item';
                listItem.innerHTML = `
                    <h3>${property.Title}</h3>
                    <p>Price: $${property.Price}</p>
                    <p>Bedrooms: ${property.Bedrooms}</p>
                    <p>${property.Description}</p>
                `;
                favoritesList.appendChild(listItem);
            });
        })
        .catch(error => console.error('Error loading favorites:', error));
}

// Comment functions (unchanged from base)
function addComment(listingId) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to comment.');
        return;
    }
    const comment = document.getElementById(`comment-${listingId}`).value;
    db.collection('comments').add({
        listingId: listingId,
        userId: user.uid,
        comment: comment,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        loadComments(listingId);
        document.getElementById(`comment-${listingId}`).value = '';
    })
    .catch(error => alert('Error commenting: ' + error.message));
}

function loadComments(listingId) {
    const commentsDiv = document.getElementById(`comments-${listingId}`);
    commentsDiv.innerHTML = '';
    db.collection('comments')
        .where('listingId', '==', listingId)
        .orderBy('timestamp', 'desc')
        .get()
        .then(querySnapshot => {
            querySnapshot.forEach(doc => {
                const comment = doc.data();
                const commentItem = document.createElement('p');
                commentItem.textContent = `${comment.userId}: ${comment.comment}`;
                commentsDiv.appendChild(commentItem);
            });
        })
        .catch(error => console.error('Error loading comments:', error));
}

// Step 4: Updated chat for user-to-user messaging
function sendMessage() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to chat.');
        return;
    }
    const recipientId = document.getElementById('recipient-id').value;
    const message = document.getElementById('chat-input').value;
    if (!recipientId || !message) {
        alert('Please enter a recipient ID and message.');
        return;
    }
    chatDb.push({
        sender: user.uid,
        recipient: recipientId,
        text: message,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    document.getElementById('chat-input').value = '';
}

function listenForChat() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    chatDb.orderByChild('timestamp').on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message.sender === user.uid || message.recipient === user.uid) {
            const chatMessages = document.getElementById('chat-messages');
            const messageElement = document.createElement('p');
            messageElement.textContent = `${message.sender} to ${message.recipient}: ${message.text}`;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

// Step 5: Save search
function saveSearch() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to save searches.');
        return;
    }
    const searchData = {
        maxPrice: parseFloat(document.getElementById('price').value) || Infinity,
        minBedrooms: parseInt(document.getElementById('bedrooms').value) || 0,
        location: document.getElementById('location').value.trim()
    };
    db.collection('savedSearches').add({
        userId: user.uid,
        search: searchData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => alert('Search saved!'))
    .catch(error => alert('Error saving search: ' + error.message));
}

// Step 6: Check for notifications (basic client-side)
function checkForNotifications() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    db.collection('savedSearches')
        .where('userId', '==', user.uid)
        .get()
        .then(querySnapshot => {
            querySnapshot.forEach(doc => {
                const search = doc.data().search;
                let query = db.collection('listings');
                if (search.maxPrice !== Infinity) query = query.where('Price', '<=', search.maxPrice);
                if (search.minBedrooms !== 0) query = query.where('Bedrooms', '>=', search.minBedrooms);
                if (search.location) query = query.where('Location', '==', search.location);
                query.get().then(snapshot => {
                    if (!snapshot.empty) {
                        alert('New listings match your saved search!');
                    }
                });
            });
        });
}

// Step 7: Submit review
function submitReview(listingId) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to submit a review.');
        return;
    }
    const rating = parseInt(document.getElementById(`rating-${listingId}`).value);
    const review = document.getElementById(`review-${listingId}`).value;
    if (!rating || !review) {
        alert('Please provide both a rating and review.');
        return;
    }
    db.collection('reviews').add({
        listingId: listingId,
        userId: user.uid,
        rating: rating,
        review: review,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        loadReviews(listingId);
        document.getElementById(`rating-${listingId}`).value = '';
        document.getElementById(`review-${listingId}`).value = '';
    })
    .catch(error => alert('Error submitting review: ' + error.message));
}

// Step 7: Load reviews
function loadReviews(listingId) {
    const reviewsDiv = document.getElementById(`reviews-${listingId}`);
    reviewsDiv.innerHTML = '';
    db.collection('reviews')
        .where('listingId', '==', listingId)
        .orderBy('timestamp', 'desc')
        .get()
        .then(querySnapshot => {
            querySnapshot.forEach(doc => {
                const review = doc.data();
                const reviewItem = document.createElement('p');
                reviewItem.textContent = `${review.userId}: ${review.review} (Rating: ${review.rating})`;
                reviewsDiv.appendChild(reviewItem);
            });
        })
        .catch(error => console.error('Error loading reviews:', error));
}

// Auth state listener with Step 6 notifications
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        setInterval(checkForNotifications, 60000); // Step 6: Check every minute
    }
});
