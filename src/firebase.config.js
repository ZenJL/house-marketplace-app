// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import { getFirestore } from 'firebase/firestore';


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCoim628tIGPhQbmSzkGBhhp4dRybcIt-c",
  authDomain: "house-marketplace-app-682f0.firebaseapp.com",
  projectId: "house-marketplace-app-682f0",
  storageBucket: "house-marketplace-app-682f0.appspot.com",
  messagingSenderId: "797339332867",
  appId: "1:797339332867:web:f401ab37432f5286a2f936"
};

// Initialize Firebase
//// can delete the "const app =", just need to call the initialize

initializeApp(firebaseConfig);
// const app = initializeApp(firebaseConfig);

export const db = getFirestore();
