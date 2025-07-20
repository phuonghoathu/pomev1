const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

// Đảm bảo thư mục data tồn tại
fs.ensureDirSync('data');

// Đường dẫn đến file database
const dbPath = path.join(__dirname, 'data', 'poems.db');

// Tạo kết nối đến database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Không thể kết nối đến SQLite database', err);
  } else {
    console.log('Đã kết nối đến SQLite database');
    initializeDatabase();
  }
});

// Khởi tạo cấu trúc database
function initializeDatabase() {
  db.serialize(() => {
    // Bảng poems hiện tại
    db.run(`
      CREATE TABLE IF NOT EXISTS poems (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        introduction TEXT NOT NULL,
        passcode TEXT NOT NULL,
        content TEXT NOT NULL,
        backgroundType TEXT DEFAULT 'seasonal',
        backgroundImage TEXT,
        musicFile TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT
      )
    `);
    
    // Thêm bảng comments đơn giản
    db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        poemId TEXT NOT NULL,
        userName TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (poemId) REFERENCES poems (id) ON DELETE CASCADE
      )
    `);
  });
}
module.exports = db;
