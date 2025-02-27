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

// Display properties on map and list
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
                `;
                infoWindow.setContent(content);
                infoWindow.open(map, marker);
                loadComments(property.id);
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
            `;
            propertyList.appendChild(listItem);
        }
    });
}

// Filter properties
function filterProperties() {
    const maxPrice = parseFloat(document.getElementById('price').value) || Infinity;
    const minBedrooms = parseInt(document.getElementById('bedrooms').value) || 0;
    let query = db.collection('listings');
    if (maxPrice !== Infinity) query = query.where('Price', '<=', maxPrice);
    if (minBedrooms !== 0) query = query.where('Bedrooms', '>=', minBedrooms);
    query.get()
        .then(snapshot => {
            const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayProperties(properties);
        })
        .catch(error => console.error('Error filtering properties:', error));
}

// Authentication functions
function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            document.getElementById('user-status').textContent = `Logged in as: ${userCredential.user.email}`;
            loadUserListings();
            loadFavorites();
        })
        .catch(error => alert('Error: ' + error.message));
}

function signOut() {
    firebase.auth().signOut()
        .then(() => {
            document.getElementById('user-status').textContent = 'Not logged in';
            document.getElementById('user-listings').innerHTML = '';
            document.getElementById('favorites-list').innerHTML = '';
        })
        .catch(error => alert('Error: ' + error.message));
}

// Listing functions
function addListing() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to add a listing.');
        return;
    }
    const listing = {
        Title: document.getElementById('new-title').value,
        Price: document.getElementById('new-price').value,
        Bedrooms: document.getElementById('new-bedrooms').value,
        Latitude: document.getElementById('new-lat').value,
        Longitude: document.getElementById('new-lng').value,
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
                `;
                userListingsDiv.appendChild(listItem);
            });
        })
        .catch(error => console.error('Error loading listings:', error));
}

// Favorites functions
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

// Comment functions
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

// Chat functions
function listenForChat() {
    chatDb.on('child_added', (snapshot) => {
        const message = snapshot.val();
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('p');
        messageElement.textContent = `${message.user}: ${message.text}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function sendMessage() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to chat.');
        return;
    }
    const message = document.getElementById('chat-input').value;
    chatDb.push({
        user: user.email,
        text: message
    });
    document.getElementById('chat-input').value = '';
}