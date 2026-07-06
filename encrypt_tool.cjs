const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');

const sourceJsonPath = path.resolve(__dirname, '../IPAS ESG/quiz-app/questions.json');
const destEncPath = path.resolve(__dirname, './public/questions.enc');
const SECRET_KEY = 'IpasNetZeroSecret2026';

function main() {
  if (!fs.existsSync(sourceJsonPath)) {
    console.error(`Source questions.json not found at ${sourceJsonPath}`);
    process.exit(1);
  }

  console.log('Reading source questions.json...');
  const rawData = JSON.parse(fs.readFileSync(sourceJsonPath, 'utf8'));

  // Flatten the subjects questions
  const flatQuestions = [];
  
  if (rawData['1']) {
    rawData['1'].forEach(q => {
      flatQuestions.push({
        id: `1-${q.id}`, // Unique ID across subjects
        originalId: q.id,
        subject: 1,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        tags: q.tags || []
      });
    });
  }

  if (rawData['2']) {
    rawData['2'].forEach(q => {
      flatQuestions.push({
        id: `2-${q.id}`, // Unique ID across subjects
        originalId: q.id,
        subject: 2,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        tags: q.tags || []
      });
    });
  }

  console.log(`Loaded ${flatQuestions.length} questions in total. Encrypting...`);

  // Encrypt JSON array using AES-256
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(flatQuestions), SECRET_KEY).toString();

  // Create public dir if it doesn't exist
  const publicDir = path.dirname(destEncPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Write to questions.enc
  fs.writeFileSync(destEncPath, encrypted);
  console.log(`Success! Encrypted file created at: ${destEncPath}`);
}

main();
