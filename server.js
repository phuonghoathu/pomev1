const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const db = require('./db'); // Import database module

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Ensure uploads directory exists
fs.ensureDirSync('uploads/music');
fs.ensureDirSync('uploads/backgrounds');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'musicFile') {
      cb(null, 'uploads/music/');
    } else if (file.fieldname === 'backgroundImage') {
      cb(null, 'uploads/backgrounds/');
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.fieldname === 'musicFile') {
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed!'), false);
      }
    } else if (file.fieldname === 'backgroundImage') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Helper function to generate ID
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Routes

// Get all poems (public info only)
app.get('/api/poems', (req, res) => {
  db.all(`
    SELECT id, title, introduction, backgroundType, backgroundImage, musicFile, createdAt 
    FROM poems 
    ORDER BY createdAt DESC
  `, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch poems' });
    }
    res.json(rows);
  });
});

// Get specific poem content (requires passcode)
app.post('/api/poems/:id/unlock', (req, res) => {
  const { id } = req.params;
  const { passcode } = req.body;
  
  db.get('SELECT * FROM poems WHERE id = ?', [id], (err, poem) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to unlock poem' });
    }
    
    if (!poem) {
      return res.status(404).json({ error: 'Poem not found' });
    }
    
    if (poem.passcode !== passcode) {
      return res.status(401).json({ error: 'Invalid passcode' });
    }
    
    res.json({
      id: poem.id,
      title: poem.title,
      content: poem.content,
      backgroundType: poem.backgroundType,
      backgroundImage: poem.backgroundImage,
      musicFile: poem.musicFile
    });
  });
});

// Add new poem
app.post('/api/poems', upload.fields([
  { name: 'musicFile', maxCount: 1 },
  { name: 'backgroundImage', maxCount: 1 }
]), (req, res) => {
  try {
    const { title, introduction, passcode, content, backgroundType } = req.body;
    
    if (!title || !introduction || !passcode || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = generateId();
    const now = new Date().toISOString();
    
    const newPoem = {
      id,
      title,
      introduction,
      passcode,
      content,
      backgroundType: backgroundType || 'seasonal',
      backgroundImage: req.files.backgroundImage ? `/uploads/backgrounds/${req.files.backgroundImage[0].filename}` : null,
      musicFile: req.files.musicFile ? `/uploads/music/${req.files.musicFile[0].filename}` : null,
      createdAt: now,
      updatedAt: now
    };
    
    db.run(`
      INSERT INTO poems (id, title, introduction, passcode, content, backgroundType, backgroundImage, musicFile, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newPoem.id,
      newPoem.title,
      newPoem.introduction,
      newPoem.passcode,
      newPoem.content,
      newPoem.backgroundType,
      newPoem.backgroundImage,
      newPoem.musicFile,
      newPoem.createdAt,
      newPoem.updatedAt
    ], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to add poem' });
      }
      
      res.status(201).json({ message: 'Poem added successfully', id: newPoem.id });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add poem' });
  }
});

// Update poem
app.put('/api/poems/:id', upload.fields([
  { name: 'musicFile', maxCount: 1 },
  { name: 'backgroundImage', maxCount: 1 }
]), (req, res) => {
  try {
    const { id } = req.params;
    const { title, introduction, passcode, content, backgroundType } = req.body;
    
    // Kiểm tra poem có tồn tại không
    db.get('SELECT * FROM poems WHERE id = ?', [id], (err, poem) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to update poem' });
      }
      
      if (!poem) {
        return res.status(404).json({ error: 'Poem not found' });
      }
      
      // Cập nhật thông tin poem
      const updates = [];
      const params = [];
      
      if (title) {
        updates.push('title = ?');
        params.push(title);
      }
      
      if (introduction) {
        updates.push('introduction = ?');
        params.push(introduction);
      }
      
      if (passcode) {
        updates.push('passcode = ?');
        params.push(passcode);
      }
      
      if (content) {
        updates.push('content = ?');
        params.push(content);
      }
      
      if (backgroundType) {
        updates.push('backgroundType = ?');
        params.push(backgroundType);
      }
      
      if (req.files.backgroundImage) {
        updates.push('backgroundImage = ?');
        params.push(`/uploads/backgrounds/${req.files.backgroundImage[0].filename}`);
        
        // Xóa file ảnh cũ nếu có
        if (poem.backgroundImage) {
          const oldImagePath = path.join(__dirname, poem.backgroundImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }
      
      if (req.files.musicFile) {
        updates.push('musicFile = ?');
        params.push(`/uploads/music/${req.files.musicFile[0].filename}`);
        
        // Xóa file nhạc cũ nếu có
        if (poem.musicFile) {
          const oldMusicPath = path.join(__dirname, poem.musicFile);
          if (fs.existsSync(oldMusicPath)) {
            fs.unlinkSync(oldMusicPath);
          }
        }
      }
      
      updates.push('updatedAt = ?');
      params.push(new Date().toISOString());
      
      // Thêm id vào cuối mảng params
      params.push(id);
      
      // Thực hiện cập nhật
      db.run(`
        UPDATE poems 
        SET ${updates.join(', ')} 
        WHERE id = ?
      `, params, function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to update poem' });
        }
        
        res.json({ message: 'Poem updated successfully' });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update poem' });
  }
});

// Delete poem
app.delete('/api/poems/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Lấy thông tin poem trước khi xóa
    db.get('SELECT * FROM poems WHERE id = ?', [id], (err, poem) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to delete poem' });
      }
      
      if (!poem) {
        return res.status(404).json({ error: 'Poem not found' });
      }
      
      // Xóa các file liên quan
      if (poem.musicFile) {
        const musicPath = path.join(__dirname, poem.musicFile);
        if (fs.existsSync(musicPath)) {
          fs.unlinkSync(musicPath);
        }
      }
      
      if (poem.backgroundImage) {
        const imagePath = path.join(__dirname, poem.backgroundImage);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      // Xóa poem từ database
      db.run('DELETE FROM poems WHERE id = ?', [id], function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to delete poem' });
        }
        
        res.json({ message: 'Poem deleted successfully' });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete poem' });
  }
});

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/poems/:id/admin', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM poems WHERE id = ?', [id], (err, poem) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch poem details' });
    }
    
    if (!poem) {
      return res.status(404).json({ error: 'Poem not found' });
    }
    
    // Kiểm tra xem content có phải là JSON string không
    let poemContent;
    try {
      // Thử parse content như JSON
      poemContent = JSON.parse(poem.content);
    } catch (e) {
      // Nếu không phải JSON, sử dụng nguyên content
      poemContent = poem.content;
    }
    
    // Trả về đầy đủ thông tin bài thơ
    res.json({
      id: poem.id,
      title: poem.title,
      introduction: poem.introduction,
      passcode: poem.passcode,
      content: poemContent,
      backgroundType: poem.backgroundType,
      backgroundImage: poem.backgroundImage,
      musicFile: poem.musicFile,
      createdAt: poem.createdAt,
      updatedAt: poem.updatedAt
    });
  });
});

// Get comments for a poem
app.get('/api/poems/:id/comments', (req, res) => {
  const { id } = req.params;
  
  db.all('SELECT * FROM comments WHERE poemId = ? ORDER BY createdAt DESC LIMIT 20', [id], (err, comments) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
    
    res.json(comments);
  });
});

// Add a comment
// Add a comment
app.post('/api/poems/:id/comments', (req, res) => {
  const { id } = req.params;
  const { userName, content } = req.body;
  
  if (!userName || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Kiểm tra số lượng bình luận hiện tại
  db.get('SELECT COUNT(*) as commentCount FROM comments WHERE poemId = ?', [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to check comment count' });
    }
    
    // Nếu đã đạt giới hạn 20 bình luận
    if (result.commentCount >= 20) {
      return res.status(400).json({ error: 'Maximum comment limit reached (20 comments)' });
    }
    
    // Thêm bình luận mới
    const commentId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    
    db.run(
      'INSERT INTO comments (id, poemId, userName, content, createdAt) VALUES (?, ?, ?, ?, ?)',
      [commentId, id, userName, content, now],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to add comment' });
        }
        
        res.status(201).json({
          id: commentId,
          poemId: id,
          userName,
          content,
          createdAt: now
        });
      }
    );
  });
});

// Delete a comment (optional - for user to delete their own comments)
app.delete('/api/comments/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  db.get('SELECT userId FROM comments WHERE id = ?', [id], (err, comment) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch comment' });
    }
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    
    db.run('DELETE FROM comments WHERE id = ?', [id], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to delete comment' });
      }
      
      res.json({ message: 'Comment deleted successfully' });
    });
  });
});

// Route for direct poem sharing
app.get('/poem/:id', (req, res) => {
  const { id } = req.params;
  
  // Kiểm tra xem poem có tồn tại không
  db.get('SELECT title, introduction FROM poems WHERE id = ?', [id], (err, poem) => {
    if (err || !poem) {
      return res.redirect('/');
    }
    
    // Chuyển hướng đến trang chính với ID bài thơ
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// API endpoint để lấy thông tin meta của bài thơ (cho SEO)
app.get('/api/poems/:id/meta', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT title, introduction FROM poems WHERE id = ?', [id], (err, poem) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch poem metadata' });
    }
    
    if (!poem) {
      return res.status(404).json({ error: 'Poem not found' });
    }
    
    // Trả về thông tin meta
    res.json({
      title: poem.title,
      description: poem.introduction
    });
  });
});


// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
