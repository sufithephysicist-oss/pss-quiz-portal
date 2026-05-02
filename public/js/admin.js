// Admin Panel Logic

let currentStudents = [];

document.addEventListener('DOMContentLoaded', async () => {
    const session = loadSession();
    if (!session || session.type !== 'admin') {
        window.location.href = '/';
        return;
    }
    
    document.getElementById('adminName').textContent = 'Admin';
    
    await loadStudents();
    await loadCurrentDueDate();
    await loadWrongAnswers();
    await populateStudentSelect();
    
    generateQuestionForms();
    setupEventListeners();
    await loadExistingQuestions();
});

function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = logout;
    
    const setDueDateBtn = document.getElementById('setDueDateBtn');
    if (setDueDateBtn) setDueDateBtn.onclick = setDueDate;
    
    const addStudentBtn = document.getElementById('addStudentBtn');
    if (addStudentBtn) addStudentBtn.onclick = addStudent;
    
    const refreshWrongBtn = document.getElementById('refreshWrongBtn');
    if (refreshWrongBtn) refreshWrongBtn.onclick = loadWrongAnswers;
    
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    if (sendMessageBtn) sendMessageBtn.onclick = sendMessage;
    
    const announceBtn = document.getElementById('announceBtn');
    if (announceBtn) announceBtn.onclick = announceResults;
    
    const resetOverallBtn = document.getElementById('resetOverallBtn');
    if (resetOverallBtn) resetOverallBtn.onclick = resetOverallProgress;
    
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) uploadForm.onsubmit = uploadQuestions;
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        };
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    
    if (tabId === 'students') {
        loadStudents();
    } else if (tabId === 'wrong') {
        loadWrongAnswers();
    } else if (tabId === 'message') {
        populateStudentSelect();
    }
}

function generateQuestionForms() {
    const categories = [
        { id: 'physics', name: 'Physics', container: 'physics-questions' },
        { id: 'chemistry', name: 'Chemistry', container: 'chemistry-questions' },
        { id: 'biology', name: 'Biology', container: 'biology-questions' },
        { id: 'mathematics', name: 'Mathematics', container: 'math-questions' }
    ];
    
    categories.forEach(cat => {
        const container = document.getElementById(cat.container);
        if (!container) {
            console.log(`Container not found: ${cat.container}`);
            return;
        }
        
        let html = '';
        for (let i = 1; i <= 10; i++) {
            html += `
                <div class="question-row" data-category="${cat.id}" data-qnum="${i}">
                    <strong>Question ${i}:</strong>
                    <input type="text" class="q-text" placeholder="Enter question text" autocomplete="off">
                    <div class="options-row">
                        <input type="text" class="opt-a" placeholder="Option A">
                        <input type="text" class="opt-b" placeholder="Option B">
                        <input type="text" class="opt-c" placeholder="Option C">
                        <input type="text" class="opt-d" placeholder="Option D">
                    </div>
                    <select class="correct-select">
                        <option value="a">Correct: A</option>
                        <option value="b">Correct: B</option>
                        <option value="c">Correct: C</option>
                        <option value="d">Correct: D</option>
                    </select>
                </div>
            `;
        }
        container.innerHTML = html;
    });
}

async function loadExistingQuestions() {
    const questions = await apiCall('/api/admin/questions');
    
    if (questions && questions.length > 0) {
        const categorized = {
            physics: {},
            chemistry: {},
            biology: {},
            mathematics: {}
        };
        
        questions.forEach(q => {
            const cat = q.category;
            const qNum = q.q_num;
            if (categorized[cat]) {
                categorized[cat][qNum] = q;
            }
        });
        
        document.querySelectorAll('.question-row').forEach(row => {
            const category = row.dataset.category;
            const qNum = parseInt(row.dataset.qnum);
            const qData = categorized[category]?.[qNum];
            
            if (qData) {
                const qText = row.querySelector('.q-text');
                const optA = row.querySelector('.opt-a');
                const optB = row.querySelector('.opt-b');
                const optC = row.querySelector('.opt-c');
                const optD = row.querySelector('.opt-d');
                const correctSelect = row.querySelector('.correct-select');
                
                if (qText) qText.value = qData.text || '';
                if (optA) optA.value = qData.opt_a || '';
                if (optB) optB.value = qData.opt_b || '';
                if (optC) optC.value = qData.opt_c || '';
                if (optD) optD.value = qData.opt_d || '';
                if (correctSelect) correctSelect.value = qData.correct || 'a';
            }
        });
    }
}

async function uploadQuestions(event) {
    if (event) event.preventDefault();
    
    const categories = ['physics', 'chemistry', 'biology', 'mathematics'];
    const allQuestions = [];
    
    for (let cat of categories) {
        const rows = document.querySelectorAll(`.question-row[data-category="${cat}"]`);
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const qNum = i + 1;
            const qTextInput = row.querySelector('.q-text');
            const text = qTextInput ? qTextInput.value.trim() : '';
            
            if (!text) {
                continue;
            }
            
            const optAInput = row.querySelector('.opt-a');
            const optBInput = row.querySelector('.opt-b');
            const optCInput = row.querySelector('.opt-c');
            const optDInput = row.querySelector('.opt-d');
            const correctSelect = row.querySelector('.correct-select');
            
            const opt_a = optAInput ? optAInput.value.trim() : '';
            const opt_b = optBInput ? optBInput.value.trim() : '';
            const opt_c = optCInput ? optCInput.value.trim() : '';
            const opt_d = optDInput ? optDInput.value.trim() : '';
            const correct = correctSelect ? correctSelect.value : 'a';
            
            allQuestions.push({
                category: cat,
                q_num: qNum,
                text: text,
                opt_a: opt_a,
                opt_b: opt_b,
                opt_c: opt_c,
                opt_d: opt_d,
                correct: correct
            });
        }
    }
    
    if (allQuestions.length === 0) {
        showMessage('uploadMessage', 'No questions to upload. Please fill at least one question.', 'error');
        return;
    }
    
    const config = await apiCall('/api/config');
    const week_id = config.current_week_id;
    
    const result = await apiCall('/api/admin/questions', 'POST', {
        questions: allQuestions,
        week_id: week_id
    });
    
    if (result.success) {
        showMessage('uploadMessage', `✅ Successfully uploaded ${allQuestions.length} questions for Week ${week_id}!`, 'success');
    } else {
        showMessage('uploadMessage', '❌ Upload failed. Please try again.', 'error');
    }
}

async function setDueDate() {
    const dueDateInput = document.getElementById('dueDateInput');
    const dueDate = dueDateInput ? dueDateInput.value : '';
    
    if (!dueDate) {
        showMessage('dueMessage', 'Please select a date and time', 'error');
        return;
    }
    
    const result = await apiCall('/api/admin/due-date', 'POST', { due_date: dueDate });
    
    if (result.success) {
        showMessage('dueMessage', '✅ Due date set successfully!', 'success');
        loadCurrentDueDate();
    }
}

async function loadCurrentDueDate() {
    const config = await apiCall('/api/config');
    const dueDateDiv = document.getElementById('currentDueDate');
    
    if (dueDateDiv) {
        if (config.due_date) {
            dueDateDiv.innerHTML = `Current due date: ${new Date(config.due_date).toLocaleString()}`;
        } else {
            dueDateDiv.innerHTML = 'No due date set. Quiz is open.';
        }
    }
}

async function loadStudents() {
    const students = await apiCall('/api/admin/students');
    currentStudents = students;
    
    const container = document.getElementById('studentsList');
    
    if (!container) return;
    
    if (!students || students.length === 0) {
        container.innerHTML = '<div class="loading">No students registered</div>';
        return;
    }
    
    let html = '';
    students.forEach(student => {
        html += `
            <div class="student-item" data-id="${student.id}">
                <div class="student-info">${student.username} (Password: ${student.password})</div>
                <button class="delete-student" data-id="${student.id}" data-name="${student.username}">Delete</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    document.querySelectorAll('.delete-student').forEach(btn => {
        btn.onclick = () => deleteStudent(btn.dataset.id, btn.dataset.name);
    });
}

async function addStudent() {
    const usernameInput = document.getElementById('newUsername');
    const passwordInput = document.getElementById('newPassword');
    
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    
    if (!username || !password) {
        showMessage('studentMessage', 'Please enter both username and password', 'error');
        return;
    }
    
    const result = await apiCall('/api/admin/student', 'POST', { username, password });
    
    if (result.success) {
        showMessage('studentMessage', `✅ Student "${username}" added successfully!`, 'success');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        loadStudents();
        populateStudentSelect();
    } else {
        showMessage('studentMessage', `❌ ${result.message}`, 'error');
    }
}

async function deleteStudent(id, name) {
    if (confirm(`Delete student "${name}"? This will also delete all their answers and messages.`)) {
        await apiCall(`/api/admin/student/${id}`, 'DELETE');
        showMessage('studentMessage', `✅ Student "${name}" deleted.`, 'success');
        loadStudents();
        populateStudentSelect();
    }
}

async function loadWrongAnswers() {
    const wrongAnswers = await apiCall('/api/admin/wrong-answers');
    const container = document.getElementById('wrongAnswersList');
    
    if (!container) return;
    
    if (!wrongAnswers || wrongAnswers.length === 0) {
        container.innerHTML = '<div class="loading">No wrong answers this week. Good job students!</div>';
        return;
    }
    
    let html = '';
    wrongAnswers.forEach(item => {
        const categoryName = item.category.charAt(0).toUpperCase() + item.category.slice(1);
        
        let selectedText = '';
        switch(item.selected) {
            case 'a': selectedText = item.opt_a; break;
            case 'b': selectedText = item.opt_b; break;
            case 'c': selectedText = item.opt_c; break;
            case 'd': selectedText = item.opt_d; break;
        }
        
        let correctText = '';
        switch(item.correct) {
            case 'a': correctText = item.opt_a; break;
            case 'b': correctText = item.opt_b; break;
            case 'c': correctText = item.opt_c; break;
            case 'd': correctText = item.opt_d; break;
        }
        
        html += `
            <div class="wrong-item">
                <div class="wrong-student">📖 ${item.username} - ${categoryName}</div>
                <div class="wrong-question"><strong>Q:</strong> ${item.question_text}</div>
                <div class="wrong-details">
                    <span class="wrong-answer">❌ Student answered: ${item.selected.toUpperCase()}) ${selectedText}</span><br>
                    <span class="correct-answer">✅ Correct answer: ${item.correct.toUpperCase()}) ${correctText}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function populateStudentSelect() {
    const students = await apiCall('/api/admin/students');
    const select = document.getElementById('messageStudentId');
    
    if (!select) return;
    
    if (!students || students.length === 0) {
        select.innerHTML = '<option>No students available</option>';
        return;
    }
    
    let html = '';
    students.forEach(student => {
        html += `<option value="${student.id}">${student.username}</option>`;
    });
    
    select.innerHTML = html;
}

async function sendMessage() {
    const studentSelect = document.getElementById('messageStudentId');
    const student_id = studentSelect ? studentSelect.value : '';
    const subjectInput = document.getElementById('messageSubject');
    const subject = subjectInput ? subjectInput.value.trim() : '';
    const contentInput = document.getElementById('messageContent');
    const content = contentInput ? contentInput.value.trim() : '';
    
    if (!student_id || student_id === 'No students available') {
        showMessage('messageResult', 'Please select a student', 'error');
        return;
    }
    
    if (!subject || !content) {
        showMessage('messageResult', 'Please enter both subject and message', 'error');
        return;
    }
    
    const result = await apiCall('/api/admin/message', 'POST', {
        student_id: parseInt(student_id),
        question_id: null,
        subject: subject,
        content: content
    });
    
    if (result.success) {
        showMessage('messageResult', '✅ Message sent successfully!', 'success');
        if (subjectInput) subjectInput.value = '';
        if (contentInput) contentInput.value = '';
    } else {
        showMessage('messageResult', '❌ Failed to send message', 'error');
    }
}

async function announceResults() {
    if (!confirm('WARNING: This will announce winners, clear all weekly answers, and start a new quiz week. Continue?')) {
        return;
    }
    
    const result = await apiCall('/api/admin/announce', 'POST');
    
    if (result.success && result.winners) {
        let winnersText = '🏆 WINNERS ANNOUNCED 🏆\n\n';
        result.winners.forEach((winner, idx) => {
            const medal = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : '🥉 3rd';
            winnersText += `${medal}: ${winner.username} (${winner.total_correct || 0} points)\n`;
        });
        
        alert(winnersText);
        showMessage('announceResult', '✅ Results announced and week reset!', 'success');
        loadWrongAnswers();
    } else {
        showMessage('announceResult', '❌ Failed to announce results', 'error');
    }
}

async function resetOverallProgress() {
    if (!confirm('⚠️ DANGER: This will delete ALL student answers and messages FOREVER. Student accounts will remain. This cannot be undone. Continue?')) {
        return;
    }
    
    const userInput = prompt('Type "RESET" to confirm:');
    if (userInput !== 'RESET') {
        showMessage('resetResult', 'Reset cancelled.', 'error');
        return;
    }
    
    const result = await apiCall('/api/admin/reset-overall', 'POST');
    
    if (result.success) {
        showMessage('resetResult', '✅ All progress has been reset successfully!', 'success');
        loadWrongAnswers();
    } else {
        showMessage('resetResult', '❌ Reset failed', 'error');
    }
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.className = `message-area ${type}`;
    
    setTimeout(() => {
        if (element) {
            element.textContent = '';
            element.className = 'message-area';
        }
    }, 5000);
}