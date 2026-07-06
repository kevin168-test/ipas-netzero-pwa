import Dexie from 'dexie';

// Create Dexie.js offline database
export const db = new Dexie('IpasNetZeroDB');

// Define database tables
db.version(1).stores({
  // id: Question ID
  // subject: Subject ID (1 or 2)
  // *tags: Multi-valued index for tags (e.g., L11101, CBAM)
  questions: 'id, subject, *tags',
  
  // Progress tracker table
  // id: Linked question ID
  // correctCount: Number of correct attempts
  // wrongCount: Number of incorrect attempts
  // isBookmarked: Boolean status
  // lastPracticed: Timestamp
  progress: 'id, correctCount, wrongCount, isBookmarked, lastPracticed'
});
