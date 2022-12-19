import firebase from "firebase/app";
import "firebase/firestore";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtLBSZwO0Q0zf-XP9ZilXJV_eWD_6iXjs",
  authDomain: "flueratecar.firebaseapp.com",
  projectId: "flueratecar",
  storageBucket: "flueratecar.appspot.com",
  messagingSenderId: "320634448284",
  appId: "1:320634448284:web:91d894a795038745c24059"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

export default firebase.firestore();
