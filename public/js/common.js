// Shared helper functions

// Store logged in user data
let currentUser = {
    id: null,
    username: null,
    type: null // 'student' or 'admin'
};

// Save to sessionStorage
function saveSession(user) {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
}

// Load session
function loadSession() {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        return currentUser;
    }
    return null;
}

// Clear session
function clearSession() {
    sessionStorage.removeItem('currentUser');
    currentUser = { id: null, username: null, type: null };
}

// Check if logged in
function isLoggedIn() {
    return currentUser.id !== null;
}

// API call helper
async function apiCall(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    return await response.json();
}

// Show toast message
function showToast(message, duration = 5000) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1a3a6a;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        max-width: 300px;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// Student login handler (to be used on student page)
async function studentLogin(username, password) {
    const result = await apiCall('/api/student/login', 'POST', { username, password });
    
    if (result.success) {
        currentUser = {
            id: result.studentId,
            username: result.username,
            type: 'student'
        };
        saveSession(currentUser);
        window.location.href = '/student.html';
    } else {
        const errorDiv = document.getElementById('studentError');
        if (errorDiv) errorDiv.textContent = result.message;
    }
}

// Admin login handler
async function adminLogin(password) {
    const result = await apiCall('/api/admin/login', 'POST', { password });
    
    if (result.success) {
        currentUser = {
            id: 'admin',
            username: 'Admin',
            type: 'admin'
        };
        saveSession(currentUser);
        window.location.href = '/admin.html';
    } else {
        const errorDiv = document.getElementById('adminError');
        if (errorDiv) errorDiv.textContent = result.message;
    }
}

// Logout
function logout() {
    clearSession();
    window.location.href = '/';
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleString();
}