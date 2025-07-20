// API Configuration
const API_BASE = 'http://localhost:3000/api';

// Global variables
let poems = [];
let currentPoem = null;
let currentPoemData = null;
let backgroundMusic = null;
let isPlaying = false;

// DOM elements
const modal = document.getElementById('passcodeModal');
const poemDisplay = document.getElementById('poemDisplay');
const poemList = document.getElementById('poemList');
const loading = document.getElementById('loading');
const passcodeInput = document.getElementById('passcodeInput');
const errorMessage = document.getElementById('errorMessage');
const poemTitle = document.getElementById('poemTitle');
const poemText = document.getElementById('poemText');
const customBackground = document.getElementById('customBackground');
const musicToggle = document.getElementById('musicToggle');

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    updateSeasonalBackground();
    loadPoems();
    setupEventListeners();

    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'poem' && pathParts[2]) {
        const poemId = pathParts[2];
        
        // Show loading
        showLoading(true);
        
        // Load all poems first
        loadPoems().then(() => {
            // Find the poem in the loaded list
            const poem = poems.find(p => p.id === poemId);
            
            if (poem) {
                // Show passcode modal for the poem
                currentPoem = poem;
                showPasscodeModal();
            }
        });
    }
    // Comment submit button
    // Comment submit button
    document.getElementById('submitComment').addEventListener('click', function() {
        const userName = document.getElementById('commentName').value.trim();
        const commentText = document.getElementById('commentText').value.trim();
        const commentError = document.getElementById('commentError');
        
        // Validate inputs
        if (!userName) {
            commentError.textContent = 'Vui lòng nhập tên của bạn';
            return;
        }
        
        if (!commentText) {
            commentError.textContent = 'Vui lòng nhập nội dung bình luận';
            return;
        }
        
        if (userName.length > 50) {
            commentError.textContent = 'Tên không được vượt quá 50 ký tự';
            return;
        }
        
        if (commentText.length > 500) {
            commentError.textContent = 'Bình luận không được vượt quá 500 ký tự';
            return;
        }
        
        if (currentPoemData) {
            submitComment(currentPoemData.id, userName, commentText);
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    // Modal close events
    document.querySelector('.close').addEventListener('click', hideModal);
    document.getElementById('submitPasscode').addEventListener('click', checkPasscode);

    // Back button
    document.getElementById('backBtn').addEventListener('click', showPoemList);

    // Enter key for passcode
    passcodeInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            checkPasscode();
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', function (e) {
        if (e.target === modal) {
            hideModal();
        }
    });

    // Music control
    musicToggle.addEventListener('click', toggleMusic);
}

// Show/Hide loading
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    poemList.style.display = show ? 'none' : 'grid';
}

// Show error
function showError(message) {
    poemList.innerHTML = `
        <div class="error-state">
            <p>${message}</p>
            <button class="retry-btn" onclick="loadPoems()">Thử lại</button>
        </div>
    `;
}

// Load poems from API
async function loadPoems() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/poems`);

        if (!response.ok) {
            throw new Error('Failed to fetch poems');
        }

        poems = await response.json();
        displayPoems();
        showLoading(false);
    } catch (error) {
        console.error('Error loading poems:', error);
        showError('Không thể tải danh sách bài thơ. Vui lòng thử lại.');
        showLoading(false);
    }
}

// Display poems
// Sửa đổi hàm displayPoems để không cắt ngắn intro
// Sửa đổi hàm displayPoems để xử lý nội dung HTML đúng cách
function displayPoems() {
    if (poems.length === 0) {
        poemList.innerHTML = '<div class="error-state"><p>Chưa có bài thơ nào.</p></div>';
        return;
    }

    // Tạo một phần tử tạm để xử lý HTML
    const tempDiv = document.createElement('div');

    poemList.innerHTML = poems.map(poem => {
        // Xử lý nội dung giới thiệu có thể chứa HTML
        tempDiv.innerHTML = poem.introduction;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        const shortIntro = plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;

        return `
        <div class="poem-card" data-poem="${poem.id}">
            <h3>${poem.title}</h3>
            <p class="poem-intro">${shortIntro}</p>
            <div class="poem-meta">
                ${poem.musicFile ? '<span class="meta-tag">🎵 Có nhạc</span>' : ''}
                ${poem.backgroundImage ? '<span class="meta-tag">🖼️ Ảnh nền</span>' : ''}
            </div>
            <button class="read-btn" onclick="requestPoem('${poem.id}')">Đọc Thơ</button>
        </div>
        `;
    }).join('');

    // Add animation to cards
    document.querySelectorAll('.poem-card').forEach((card, index) => {
        card.style.animationDelay = `${index * 0.2}s`;
    });
}

// Sự kiện đóng modal khi click bên ngoài
window.addEventListener('click', function (e) {
    const introModal = document.getElementById('introModal');
    if (introModal && e.target === introModal) {
        hideIntroModal();
    }
});

// Sửa đổi hàm showIntroModal để tự động phát nhạc
function showIntroModal(poem) {
    // Tạo modal nếu chưa có
    let introModal = document.getElementById('introModal');
    if (!introModal) {
        introModal = document.createElement('div');
        introModal.id = 'introModal';
        introModal.className = 'modal intro-modal';
        introModal.innerHTML = `
            <div class="modal-content intro-modal-content">
                <span class="close" onclick="hideIntroModal()">×</span>
                <h2 id="introModalTitle"></h2>
                <div class="intro-text" id="introModalText"></div>
                <div class="modal-footer">
                    <button class="read-btn" id="continueReadBtn">Đọc Thơ</button>
                </div>
            </div>
        `;
        document.body.appendChild(introModal);

        // Thêm event listener cho nút "Đọc Thơ"
        document.getElementById('continueReadBtn').addEventListener('click', function () {
            hideIntroModal();
            showPasscodeModal();
        });
    }

    // Cập nhật nội dung modal
    document.getElementById('introModalTitle').textContent = poem.title;
    document.getElementById('introModalText').innerHTML = poem.introduction;

    // Hiển thị modal
    introModal.style.display = 'block';

    // Cài đặt nhạc và tự động phát nếu có
    if (poem.musicFile) {
        // Nếu đã có nhạc đang phát
        if (backgroundMusic) {
            // Nếu là file nhạc khác, dừng nhạc cũ và phát nhạc mới
            const newMusicPath = `${API_BASE.replace('/api', '')}${poem.musicFile}`;
            if (backgroundMusic.src !== newMusicPath) {
                backgroundMusic.pause();
                backgroundMusic = new Audio(newMusicPath);
                backgroundMusic.loop = true;
                backgroundMusic.volume = 0.3;
                backgroundMusic.play().catch(e => console.log('Cannot play audio:', e));
            }
        } else {
            // Nếu chưa có nhạc nào, tạo mới và phát
            backgroundMusic = new Audio(`${API_BASE.replace('/api', '')}${poem.musicFile}`);
            backgroundMusic.loop = true;
            backgroundMusic.volume = 0.3;
            backgroundMusic.play().catch(e => console.log('Cannot play audio:', e));
        }

        // Cập nhật trạng thái nút điều khiển
        musicToggle.style.display = 'block';
        musicToggle.textContent = '⏸️';
        musicToggle.classList.add('playing');
        isPlaying = true;
    }
}
// Thêm hàm ẩn modal intro
// Sửa đổi hàm hideIntroModal để không dừng nhạc
function hideIntroModal() {
    const introModal = document.getElementById('introModal');
    if (introModal) {
        introModal.style.display = 'none';
    }
    // Không dừng nhạc khi đóng modal
}


// Thêm hàm hiển thị modal nhập mật khẩu
function showPasscodeModal() {
    currentPoem = poems.find(p => p.id === selectedPoemId);
    if (currentPoem) {
        modal.style.display = 'block';
        passcodeInput.value = '';
        errorMessage.textContent = '';
        setTimeout(() => passcodeInput.focus(), 300);
    }
}

// Thêm sự kiện đóng modal khi click bên ngoài
window.addEventListener('click', function (e) {
    const introModal = document.getElementById('introModal');
    if (introModal && e.target === introModal) {
        hideIntroModal();
    }
});
// Global variables (thêm vào phần đầu file)
let selectedPoemId = null;
// Sửa đổi hàm requestPoem
function requestPoem(poemId) {
    selectedPoemId = poemId;
    const poem = poems.find(p => p.id === poemId);
    if (poem) {
        showIntroModal(poem);
    }
}

// Show modal
function showModal() {
    modal.style.display = 'block';
    passcodeInput.value = '';
    errorMessage.textContent = '';
    setTimeout(() => passcodeInput.focus(), 300);
}

// Hide modal
function hideModal() {
    modal.style.display = 'none';
}

// Check passcode and unlock poem
async function checkPasscode() {
    const enteredCode = passcodeInput.value.trim();

    if (!enteredCode) {
        errorMessage.textContent = 'Vui lòng nhập mật khẩu';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/poems/${currentPoem.id}/unlock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ passcode: enteredCode })
        });

        const result = await response.json();

        if (response.ok) {
            hideModal();
            showPoem(result);
        } else {
            errorMessage.textContent = result.error || 'Mật khẩu không đúng';
            passcodeInput.value = '';
            passcodeInput.focus();

            // Add shake animation
            passcodeInput.style.animation = 'shake 0.5s ease';
            setTimeout(() => {
                passcodeInput.style.animation = '';
            }, 500);
        }
    } catch (error) {
        console.error('Error checking passcode:', error);
        errorMessage.textContent = 'Lỗi kết nối. Vui lòng thử lại.';
    }
}


// Set custom background
function setCustomBackground(poemData) {
    if (poemData.backgroundImage) {
        customBackground.style.backgroundImage = `url(${API_BASE.replace('/api', '')}${poemData.backgroundImage})`;
        customBackground.classList.add('active');
    } else {
        customBackground.classList.remove('active');
    }
}

// Set background music
function setBackgroundMusic(poemData) {
    // Nếu bài thơ mới không có nhạc, giữ nguyên nhạc hiện tại (nếu có)
    if (!poemData.musicFile) {
        // Hiển thị nút điều khiển nhạc nếu đang có nhạc phát
        if (backgroundMusic) {
            musicToggle.style.display = 'block';
        } else {
            musicToggle.style.display = 'none';
        }
        return;
    }

    // Nếu bài thơ mới có nhạc khác với nhạc hiện tại
    const newMusicPath = `${API_BASE.replace('/api', '')}${poemData.musicFile}`;

    // Nếu đã có nhạc đang phát
    if (backgroundMusic) {
        // Nếu là cùng một file nhạc, giữ nguyên trạng thái phát/dừng
        if (backgroundMusic.src === newMusicPath) {
            musicToggle.style.display = 'block';
            return;
        }

        // Nếu là file nhạc khác, dừng nhạc cũ và phát nhạc mới
        backgroundMusic.pause();
        backgroundMusic = new Audio(newMusicPath);
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.3;

        // Nếu trước đó đang phát nhạc, tự động phát nhạc mới
        if (isPlaying) {
            backgroundMusic.play().catch(e => console.log('Cannot play audio:', e));
            musicToggle.textContent = '⏸️';
            musicToggle.classList.add('playing');
        } else {
            musicToggle.textContent = '🎵';
            musicToggle.classList.remove('playing');
        }
    } else {
        // Nếu chưa có nhạc nào, tạo mới và phát
        backgroundMusic = new Audio(newMusicPath);
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.3;

        // Mặc định không tự phát nhạc khi mới vào
        musicToggle.textContent = '🎵';
        musicToggle.classList.remove('playing');
        isPlaying = false;
    }

    musicToggle.style.display = 'block';
}

// Toggle music
function toggleMusic() {
    if (!backgroundMusic) return;

    if (isPlaying) {
        backgroundMusic.pause();
        musicToggle.textContent = '🎵';
        musicToggle.classList.remove('playing');
        isPlaying = false;
    } else {
        backgroundMusic.play().catch(e => console.log('Cannot play audio:', e));
        musicToggle.textContent = '⏸️';
        musicToggle.classList.add('playing');
        isPlaying = true;
    }
}

// Show poem list
function showPoemList() {
    poemDisplay.style.display = 'none';
    poemList.style.display = 'grid';

    // Reset background nhưng không dừng nhạc
    customBackground.classList.remove('active');

    // Vẫn hiển thị nút điều khiển nhạc nếu có nhạc đang phát
    if (backgroundMusic) {
        musicToggle.style.display = 'block';
    } else {
        musicToggle.style.display = 'none';
    }
}

// Seasonal background functions (từ code cũ)
function updateSeasonalBackground() {
    const month = new Date().getMonth() + 1;
    const background = document.querySelector('.background-container');

    background.classList.remove('spring-bg', 'summer-bg', 'autumn-bg', 'winter-bg');

    if (month >= 3 && month <= 5) {
        background.classList.add('spring-bg');
        createFloatingElements('🌸', '🌺', '🦋');
    } else if (month >= 6 && month <= 8) {
        background.classList.add('summer-bg');
        createFloatingElements('☀️', '🌻', '🌿');
    } else if (month >= 9 && month <= 11) {
        background.classList.add('autumn-bg');
        createFloatingElements('🍂', '🍁', '🌾');
    } else {
        background.classList.add('winter-bg');
        createFloatingElements('❄️', '⭐', '🌙');
    }
}

function createFloatingElements(...elements) {
    const container = document.querySelector('.floating-elements');
    container.innerHTML = '';

    elements.forEach((element, index) => {
        for (let i = 0; i < 3; i++) {
            const floatingEl = document.createElement('div');
            floatingEl.innerHTML = element;
            floatingEl.style.cssText = `
                position: absolute;
                font-size: 2rem;
                opacity: 0.3;
                animation: floatElement ${15 + Math.random() * 10}s infinite ease-in-out;
                animation-delay: ${index * 2 + i}s;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                pointer-events: none;
            `;
            container.appendChild(floatingEl);
        }
    });
}

// Add CSS for meta tags
const metaStyle = document.createElement('style');
metaStyle.textContent = `
    .poem-meta {
        margin: 15px 0;
    }
    
    .meta-tag {
        display: inline-block;
        background: rgba(255,107,157,0.1);
        color: #c44569;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        margin-right: 8px;
        border: 1px solid rgba(255,107,157,0.2);
    }
    
    @keyframes floatElement {
        0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); opacity: 0.3; }
        25% { transform: translateY(-50px) translateX(30px) rotate(90deg); opacity: 0.6; }
        50% { transform: translateY(-20px) translateX(-20px) rotate(180deg); opacity: 0.4; }
        75% { transform: translateY(30px) translateX(40px) rotate(270deg); opacity: 0.5; }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(metaStyle);
// Google Sign-In variables
let isSignedIn = false;
let currentUser = null;

// Google Sign-In callback
function onSignIn(googleUser) {
    const profile = googleUser.getBasicProfile();
    currentUser = {
        id: profile.getId(),
        name: profile.getName(),
        email: profile.getEmail(),
        photo: profile.getImageUrl()
    };

    isSignedIn = true;

    // Update UI
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('commentForm').style.display = 'block';
    document.getElementById('userPhoto').src = currentUser.photo;
    document.getElementById('userName').textContent = currentUser.name;

    // Load comments if we're viewing a poem
    if (currentPoemData) {
        loadComments(currentPoemData.id);
    }
}

// Sign out
function signOut() {
    const auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(() => {
        isSignedIn = false;
        currentUser = null;

        // Update UI
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('commentForm').style.display = 'none';
    });
}

// Load comments
async function loadComments(poemId) {
    try {
        const response = await fetch(`${API_BASE}/poems/${poemId}/comments`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch comments');
        }
        
        const comments = await response.json();
        displayComments(comments);
    } catch (error) {
        console.error('Error loading comments:', error);
        document.getElementById('commentsList').innerHTML = '<p class="error-message">Không thể tải bình luận. Vui lòng thử lại sau.</p>';
    }
}

// Display comments
function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    
    if (comments.length === 0) {
        commentsList.innerHTML = '<p class="no-comments">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</p>';
        return;
    }
    
    commentsList.innerHTML = comments.map(comment => {
        const date = new Date(comment.createdAt).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="comment-item" data-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.userName)}</span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
            </div>
        `;
    }).join('');
}

// Submit comment
async function submitComment(poemId, userName, content) {
    try {
        const response = await fetch(`${API_BASE}/poems/${poemId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userName: userName,
                content: content
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to submit comment');
        }
        
        // Reload comments to show the new one
        loadComments(poemId);
        
        // Clear comment form
        document.getElementById('commentName').value = '';
        document.getElementById('commentText').value = '';
        document.getElementById('commentError').textContent = '';
        
    } catch (error) {
        console.error('Error submitting comment:', error);
        document.getElementById('commentError').textContent = error.message || 'Không thể gửi bình luận. Vui lòng thử lại.';
    }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "\"")
        .replace(/'/g, "'");
}

// Delete comment
async function deleteComment(commentId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;

    try {
        const response = await fetch(`${API_BASE}/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id
            })
        });

        if (!response.ok) {
            throw new Error('Failed to delete comment');
        }

        // Remove comment from UI
        const commentElement = document.querySelector(`.comment-item[data-id="${commentId}"]`);
        if (commentElement) {
            commentElement.remove();
        }

        // Check if there are no more comments
        const commentsList = document.getElementById('commentsList');
        if (commentsList.children.length === 0) {
            commentsList.innerHTML = '<p class="no-comments">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</p>';
        }

    } catch (error) {
        console.error('Error deleting comment:', error);
        showMessage('Không thể xóa bình luận. Vui lòng thử lại.', 'error');
    }
}

// Cập nhật hàm showPoem để hiển thị phần bình luận
function showPoem(poemData) {
    currentPoemData = poemData;

    // Set background
    setCustomBackground(poemData);

    // Set music
    setBackgroundMusic(poemData);

    // Display poem content
    poemTitle.textContent = poemData.title;

    // Hide poem list and show poem display
    poemList.style.display = 'none';
    poemDisplay.style.display = 'block';

    // Xóa nội dung cũ
    poemText.innerHTML = '';

    // Kiểm tra xem nội dung là HTML hay mảng các dòng
    if (Array.isArray(poemData.content)) {
        // Nếu là mảng các dòng (định dạng cũ)
        poemData.content.forEach((line, index) => {
            setTimeout(() => {
                const lineElement = document.createElement('div');
                lineElement.className = 'poem-line';
                lineElement.textContent = line;
                lineElement.style.animationDelay = `${index * 0.3}s`;
                poemText.appendChild(lineElement);
            }, index * 200);
        });
    } else {
        // Nếu là HTML (định dạng mới)
        poemText.innerHTML = poemData.content;

        // Thêm animation cho các phần tử trong nội dung thơ
        const poemElements = poemText.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
        poemElements.forEach((element, index) => {
            element.classList.add('poem-line');
            element.style.animationDelay = `${index * 0.3}s`;
        });
    }

    // Load comments
    loadComments(poemData.id);

    // Update sharing links
    updateSharingLinks(poemData);

    // Update comment form visibility based on sign-in status
    if (isSignedIn && currentUser) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('commentForm').style.display = 'block';
    } else {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('commentForm').style.display = 'none';
    }
}

// Update sharing links
function updateSharingLinks(poemData) {
    const poemUrl = `${window.location.origin}/poem/${poemData.id}`;
    const poemTitle = poemData.title;
    
    // Facebook share
    document.getElementById('shareFacebook').addEventListener('click', function() {
        const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(poemUrl)}&quote=${encodeURIComponent(poemTitle)}`;
        window.open(fbShareUrl, 'facebook-share', 'width=580,height=520');
    });
    
    // Twitter share
    document.getElementById('shareTwitter').addEventListener('click', function() {
        const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(poemTitle)}&url=${encodeURIComponent(poemUrl)}`;
        window.open(twitterShareUrl, 'twitter-share', 'width=550,height=420');
    });
    
    // Copy link
    document.getElementById('copyLink').addEventListener('click', function() {
        navigator.clipboard.writeText(poemUrl).then(() => {
            const originalText = this.textContent;
            this.textContent = 'Đã sao chép!';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-link"></i> Sao chép liên kết';
            }, 2000);
        }).catch(err => {
            console.error('Không thể sao chép: ', err);
        });
    });
}

// Cập nhật hàm showPoem để hiển thị phần bình luận
function showPoem(poemData) {
    currentPoemData = poemData;
    
    // Set background
    setCustomBackground(poemData);
    
    // Set music
    setBackgroundMusic(poemData);
    
    // Display poem content
    poemTitle.textContent = poemData.title;
    
    // Hide poem list and show poem display
    poemList.style.display = 'none';
    poemDisplay.style.display = 'block';
    
    // Xóa nội dung cũ
    poemText.innerHTML = '';
    
    // Kiểm tra xem nội dung là HTML hay mảng các dòng
    if (Array.isArray(poemData.content)) {
        // Nếu là mảng các dòng (định dạng cũ)
        poemData.content.forEach((line, index) => {
            setTimeout(() => {
                const lineElement = document.createElement('div');
                lineElement.className = 'poem-line';
                lineElement.textContent = line;
                lineElement.style.animationDelay = `${index * 0.3}s`;
                poemText.appendChild(lineElement);
            }, index * 200);
        });
    } else {
        // Nếu là HTML (định dạng mới)
        poemText.innerHTML = poemData.content;
        
        // Thêm animation cho các phần tử trong nội dung thơ
        const poemElements = poemText.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
        poemElements.forEach((element, index) => {
            element.classList.add('poem-line');
            element.style.animationDelay = `${index * 0.3}s`;
        });
    }
    
    // Load comments
    loadComments(poemData.id);
    
    // Update sharing links
    updateSharingLinks(poemData);
}
