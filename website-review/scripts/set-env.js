const fs = require('fs');
const path = require('path');

// Load .env.local if it exists so developers don't need to export vars manually
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const targetPath = path.resolve(__dirname, '../src/environments/environment.ts');

const content = `export const environment = {
  appUrl: '${process.env.APP_URL || 'https://review.kalenyoung.co.uk'}',
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',
    databaseURL: '${process.env.FIREBASE_DATABASE_URL}',
    projectId: '${process.env.FIREBASE_PROJECT_ID}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${process.env.FIREBASE_APP_ID}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID}',
  },
};
`;

fs.writeFileSync(targetPath, content);
console.log(`Environment file generated at ${targetPath}`);

// Generate review-widget.js from template
const widgetTemplatePath = path.resolve(__dirname, './review-widget.template.js');
const widgetOutputPath = path.resolve(__dirname, '../public/review-widget.js');

if (fs.existsSync(widgetTemplatePath)) {
  let widgetContent = fs.readFileSync(widgetTemplatePath, 'utf8');
  widgetContent = widgetContent
    .replace(/__FIREBASE_API_KEY__/g, process.env.FIREBASE_API_KEY || '')
    .replace(/__FIREBASE_AUTH_DOMAIN__/g, process.env.FIREBASE_AUTH_DOMAIN || '')
    .replace(/__FIREBASE_PROJECT_ID__/g, process.env.FIREBASE_PROJECT_ID || '')
    .replace(/__FIREBASE_STORAGE_BUCKET__/g, process.env.FIREBASE_STORAGE_BUCKET || '')
    .replace(/__FIREBASE_MESSAGING_SENDER_ID__/g, process.env.FIREBASE_MESSAGING_SENDER_ID || '')
    .replace(/__FIREBASE_APP_ID__/g, process.env.FIREBASE_APP_ID || '');
  fs.writeFileSync(widgetOutputPath, widgetContent);
  console.log(`Widget file generated at ${widgetOutputPath}`);
}
