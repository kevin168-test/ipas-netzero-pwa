import CryptoJS from 'crypto-js';
import { db } from '../db/db';

const SECRET_KEY = 'IpasNetZeroSecret2026';

/**
 * Loads, decrypts, and initializes the questions in IndexedDB
 * @returns {Promise<number>} Number of loaded questions
 */
export async function initializeQuestionDatabase() {
  try {
    // 1. Check if database already has questions
    const count = await db.questions.count();
    if (count > 0) {
      console.log('Database already populated with', count, 'questions.');
      return count;
    }

    // 2. Fetch the encrypted questions file
    const response = await fetch(`${import.meta.env.BASE_URL}questions.enc`);
    if (!response.ok) {
      throw new Error(`Failed to fetch encrypted questions: ${response.statusText}`);
    }
    const encryptedData = await response.text();

    // 3. Decrypt the questions using AES
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      throw new Error('Decryption returned empty text. Invalid key or corrupted file.');
    }

    const questionsList = JSON.parse(decryptedText);

    // 4. Import the questions to Dexie db in a single transaction
    await db.transaction('rw', db.questions, async () => {
      await db.questions.bulkAdd(questionsList);
    });

    console.log(`Successfully loaded and stored ${questionsList.length} questions offline.`);
    return questionsList.length;
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}
