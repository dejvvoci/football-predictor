// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyVvVO4SKdJ6FG0l3b-7kEQCw774T9L6Q",
  authDomain: "lloto-website.firebaseapp.com",
  projectId: "lloto-website",
  storageBucket: "lloto-website.firebasestorage.app",
  messagingSenderId: "638964867599",
  appId: "1:638964867599:web:9558aa6516b6c54ea4b97a",
  measurementId: "G-MBKPXTBRXC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);