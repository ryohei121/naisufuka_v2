import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Firebaseの設定（Step1でコピーしたもの）
const firebaseConfig = {
  apiKey: "AIzaSyBs4K186QT7MR9MrCC5en4wbErcH6TMHu4",
  authDomain: "naisufuka.firebaseapp.com",
  databaseURL: "https://naisufuka-default-rtdb.firebaseio.com",
  projectId: "naisufuka",
  storageBucket: "naisufuka.appspot.app",
  messagingSenderId: "632446978572",
  appId: "1:632446978572:web:a459e2495d37893dff3c29",
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
