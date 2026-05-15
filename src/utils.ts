import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const addAppNotification = async (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  try {
    await addDoc(collection(db, 'app_notifications'), {
      title,
      message,
      type,
      createdAt: serverTimestamp(),
      readBy: []
    });
  } catch(error) {
    console.error("Failed to add notification", error);
  }
};
