//  Firebase and App Logic

// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    GithubAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCyMgv5Xk7ttiO-k4EoN_ZFNLTh17ROrw",
  authDomain: "aura-sanjjevani.firebaseapp.com",
  projectId: "aura-sanjjevani",
  storageBucket: "aura-sanjjevani.firebasestorage.app",
  messagingSenderId: "875164383070",
  appId: "1:875164383070:web:aba024a0e8635cbad101cf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase
// const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainContent = document.getElementById('main-content');
const userGreeting = document.getElementById('user-greeting');
const userIdDisplay = document.getElementById('user-id-display');

const moodSelector = document.getElementById('mood-selector');
const moodConfirmation = document.getElementById('mood-confirmation');

const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const loadingIndicator = document.getElementById('loading-indicator');

let moodChart = null;
let currentUserId = null;

// --- Moods ---
const moods = [
    { name: 'Happy', emoji: '😊', color: '#4ade80' },
    { name: 'Calm', emoji: '😌', color: '#60a5fa' },
    { name: 'Okay', emoji: '😐', color: '#fbbf24' },
    { name: 'Sad', emoji: '😢', color: '#f87171' },
    { name: 'Anxious', emoji: '😟', color: '#c084fc' },
];

// --- Authentication ---
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const facebookProvider = new FacebookAuthProvider();

document.getElementById('google-login').addEventListener('click', () => signInWithProvider(googleProvider));
document.getElementById('github-login').addEventListener('click', () => signInWithProvider(githubProvider));
document.getElementById('facebook-login').addEventListener('click', () => signInWithProvider(facebookProvider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

async function signInWithProvider(provider) {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Authentication Error:", error);
        alert("Failed to sign in. Please try again.");
    }
}

onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in
        currentUserId = user.uid;
        loginScreen.classList.add('hidden');
        mainContent.classList.remove('hidden');
        userGreeting.textContent = `Hello, ${user.displayName.split(' ')[0]}!`;
        userIdDisplay.textContent = user.uid;
        initializeAppFeatures(user.uid);
    } else {
        // User is signed out
        currentUserId = null;
        loginScreen.classList.remove('hidden');
        mainContent.classList.add('hidden');
    }
});

// --- App Initialization ---
function initializeAppFeatures(userId) {
    populateMoodSelector();
    setupMoodChart();
    fetchMoodData(userId);
    loadChatHistory(userId);
}

// --- Mood Tracking ---
function populateMoodSelector() {
    moodSelector.innerHTML = '';
    moods.forEach(mood => {
        const button = document.createElement('button');
        button.className = 'mood-btn text-5xl p-3 rounded-full transition-transform transform hover:scale-110';
        button.textContent = mood.emoji;
        button.dataset.mood = mood.name;
        button.title = mood.name;
        button.addEventListener('click', () => handleMoodSelection(mood, button));
        moodSelector.appendChild(button);
    });
}

async function handleMoodSelection(mood, button) {
    if (!currentUserId) return;

    // Visual feedback
    document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');

    try {
        await addDoc(collection(db, 'users', currentUserId, 'moods'), {
            mood: mood.name,
            timestamp: serverTimestamp()
        });
        moodConfirmation.textContent = `Mood recorded: ${mood.name}. Thank you for sharing!`;
        setTimeout(() => {
            moodConfirmation.textContent = '';
            button.classList.remove('selected');
        }, 3000);
    } catch (error) {
        console.error("Error adding mood document: ", error);
        moodConfirmation.textContent = 'Could not save mood. Please try again.';
    }
}

// --- Dashboard Chart ---
function setupMoodChart() {
    const ctx = document.getElementById('mood-chart').getContext('2d');
    if (moodChart) {
        moodChart.destroy();
    }
    moodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Your Mood',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value, index, values) {
                            // Map numeric value back to mood name for display
                            const moodNames = moods.map(m => m.name);
                            return moodNames[value] || '';
                        }
                    },
                    max: moods.length - 1
                }
            }
        }
    });
}

function fetchMoodData(userId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const q = query(
        collection(db, 'users', userId, 'moods'),
        where('timestamp', '>=', sevenDaysAgo),
        orderBy('timestamp', 'desc')
    );

    onSnapshot(q, (snapshot) => {
        const moodData = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })).reverse(); // reverse to get chronological order

        updateChart(moodData);
    });
}

function updateChart(moodData) {
    if (!moodChart) return;

    const labels = moodData.map(d => d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleDateString() : 'N/A');
    const moodMap = new Map(moods.map((mood, index) => [mood.name, index]));
    const data = moodData.map(d => moodMap.get(d.mood));

    moodChart.data.labels = labels;
    moodChart.data.datasets[0].data = data;
    moodChart.update();
}

// --- AI Chat ---
sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
});

async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message || !currentUserId) return;

    addMessageToUI(message, 'user');
    chatInput.value = '';
    loadingIndicator.classList.remove('hidden');

    // Save user message to Firestore
    await addDoc(collection(db, 'users', currentUserId, 'chats'), {
        role: 'user',
        text: message,
        timestamp: serverTimestamp()
    });

    // Call Generative AI
    const aiResponse = await getAIResponse(message);

    loadingIndicator.classList.add('hidden');
    addMessageToUI(aiResponse, 'ai');

    // Save AI response to Firestore
    await addDoc(collection(db, 'users', currentUserId, 'chats'), {
        role: 'ai',
        text: aiResponse,
        timestamp: serverTimestamp()
    });
}

function addMessageToUI(text, role) {
    const bubble = document.createElement('div');
    bubble.classList.add('p-3', 'rounded-lg', 'max-w-xs', 'md:max-w-md');
    if (role === 'user') {
        bubble.classList.add('chat-bubble-user', 'self-end');
    } else {
        bubble.classList.add('chat-bubble-ai', 'self-start');
    }
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function loadChatHistory(userId) {
    const q = query(
        collection(db, 'users', userId, 'chats'),
        orderBy('timestamp', 'asc'),
        limit(50)
    );

    onSnapshot(q, (snapshot) => {
        chatWindow.innerHTML = ''; // Clear existing messages
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            addMessageToUI(data.text, data.role);
        });
    });
}

// --- Gemini API Call ---
async function getAIResponse(prompt) {
    // NOTE: In a real production app, this API key should be handled on a secure backend server, not in the client-side code.
    // For this self-contained example, we'll use it here.
    const apiKey = ""; // Leave empty to use the environment's key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    // A prompt engineered for empathetic, supportive responses for youth mental wellness
    const fullPrompt = `You are Aura, a friendly, empathetic, and supportive AI companion for youth mental wellness. Your role is to be a non-judgmental, confidential listener. You are not a therapist and must not give medical advice. If the user mentions self-harm, suicide, or abuse, you must gently provide resources like a helpline number (e.g., "In India, you can reach out to Vandrevala Foundation at 9999666555 or AASRA at 9820466726. Please know that help is available.") and encourage them to speak to a trusted adult or professional. For general stress, sadness, or anxiety, offer supportive and encouraging words. Keep your responses concise, warm, and easy to understand.
            
            User says: "${prompt}"
            
            Aura responds:`;

    try {
        const payload = {
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }]
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            return "I'm here to listen, but I'm having a little trouble forming my thoughts right now. Could you try saying that a different way?";
        }
    } catch (error) {
        console.error("Error fetching AI response:", error);
        return "I'm having trouble connecting right now. Please check your connection and try again.";
    }
}
