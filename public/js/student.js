// Student Dashboard Logic

let currentStudentId = null;
let allQuestions = [];
let currentCategory = 'physics';
let currentQuestionIndex = 0;
let currentQuestionData = null;
let answeredThisSession = false;
let categoryQuestions = {
    physics: [],
    chemistry: [],
    biology: [],
    mathematics: []
};
let categoryProgress = {
    physics: { answered: 0, correct: 0 },
    chemistry: { answered: 0, correct: 0 },
    biology: { answered: 0, correct: 0 },
    mathematics: { answered: 0, correct: 0 }
};

const categoryMap = {
    'physics': 'Physics',
    'chemistry': 'Chemistry',
    'biology': 'Biology',
    'mathematics': 'Mathematics'
};

const categoryList = ['physics', 'chemistry', 'biology', 'mathematics'];

document.addEventListener('DOMContentLoaded', async () => {
    const session = loadSession();
    if (!session || session.type !== 'student') {
        window.location.href = '/';
        return;
    }
    
    currentStudentId = session.id;
    document.getElementById('studentName').textContent = session.username;
    
    await loadQuestions();
    await loadLeaderboard();
    await loadMessages();
    await loadConfig();
    
    setupEventListeners();
    selectCategory('physics');
});

async function loadConfig() {
    const config = await apiCall('/api/config');
    if (config.due_date && new Date() > new Date(config.due_date)) {
        const banner = document.getElementById('expiryBanner');
        banner.textContent = '⚠️ Quiz has expired. New quiz coming Sunday.';
        banner.classList.add('show');
        document.getElementById('submitBtn').disabled = true;
    }
}

async function loadQuestions() {
    const data = await apiCall(`/api/student/${currentStudentId}/questions`);
    
    if (data.expired) {
        document.getElementById('expiryBanner').textContent = data.message;
        document.getElementById('expiryBanner').classList.add('show');
        document.getElementById('submitBtn').disabled = true;
    }
    
    allQuestions = data.questions;
    
    for (let cat of categoryList) {
        categoryQuestions[cat] = allQuestions.filter(q => q.category === cat);
        const answered = categoryQuestions[cat].filter(q => q.answered).length;
        const correct = categoryQuestions[cat].filter(q => q.is_correct === 1).length;
        categoryProgress[cat] = { answered, correct };
    }
    
    updateProgressBars();
}

function updateProgressBars() {
    for (let cat of categoryList) {
        const correct = categoryProgress[cat].correct;
        const percent = (correct / 10) * 100;
        const fillBar = document.getElementById(`${cat}Progress`);
        const textSpan = document.getElementById(`${cat}Text`);
        
        if (fillBar) {
            fillBar.style.width = `${percent}%`;
        }
        if (textSpan) {
            textSpan.textContent = `${correct}/10 correct`;
        }
    }
}

function selectCategory(category) {
    currentCategory = category;
    
    document.querySelectorAll('.cat-nav-btn').forEach(btn => {
        if (btn.dataset.cat === category) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.category-card').forEach(card => {
        if (card.dataset.category === category) {
            card.style.borderColor = '#1a3a6a';
            card.style.background = '#f8f9fc';
        } else {
            card.style.borderColor = '#ddd';
            card.style.background = 'white';
        }
    });
    
    const questions = categoryQuestions[category];
    let firstUnanswered = -1;
    
    for (let i = 0; i < questions.length; i++) {
        if (!questions[i].answered) {
            firstUnanswered = i;
            break;
        }
    }
    
    if (firstUnanswered === -1 && questions.length > 0) {
        currentQuestionIndex = questions.length - 1;
    } else if (firstUnanswered !== -1) {
        currentQuestionIndex = firstUnanswered;
    } else {
        currentQuestionIndex = 0;
    }
    
    displayQuestion();
}

function displayQuestion() {
    const questions = categoryQuestions[currentCategory];
    
    if (!questions.length || currentQuestionIndex >= questions.length) {
        document.getElementById('questionText').textContent = 'No questions available. Please wait for teacher to upload quiz.';
        document.getElementById('optionsContainer').innerHTML = '';
        return;
    }
    
    currentQuestionData = questions[currentQuestionIndex];
    const q = currentQuestionData;
    const qNum = currentQuestionIndex + 1;
    
    document.getElementById('categoryName').textContent = categoryMap[currentCategory];
    document.getElementById('questionCounter').textContent = `Question ${qNum} of 10`;
    document.getElementById('questionText').textContent = q.text;
    
    const optionsHtml = `
        <div class="option" data-opt="a">
            <input type="radio" name="option" value="a" id="opt_a" ${q.selected === 'a' ? 'checked' : ''} ${q.answered ? 'disabled' : ''}>
            <label for="opt_a">A) ${q.opt_a}</label>
        </div>
        <div class="option" data-opt="b">
            <input type="radio" name="option" value="b" id="opt_b" ${q.selected === 'b' ? 'checked' : ''} ${q.answered ? 'disabled' : ''}>
            <label for="opt_b">B) ${q.opt_b}</label>
        </div>
        <div class="option" data-opt="c">
            <input type="radio" name="option" value="c" id="opt_c" ${q.selected === 'c' ? 'checked' : ''} ${q.answered ? 'disabled' : ''}>
            <label for="opt_c">C) ${q.opt_c}</label>
        </div>
        <div class="option" data-opt="d">
            <input type="radio" name="option" value="d" id="opt_d" ${q.selected === 'd' ? 'checked' : ''} ${q.answered ? 'disabled' : ''}>
            <label for="opt_d">D) ${q.opt_d}</label>
        </div>
    `;
    
    document.getElementById('optionsContainer').innerHTML = optionsHtml;
    
    document.querySelectorAll('.option').forEach(optDiv => {
        optDiv.addEventListener('click', () => {
            if (currentQuestionData.answered) return;
            const radio = optDiv.querySelector('input');
            radio.checked = true;
            document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
            optDiv.classList.add('selected');
        });
    });
    
    const feedbackDiv = document.getElementById('feedback');
    const submitBtn = document.getElementById('submitBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (q.answered) {
        if (q.is_correct) {
            feedbackDiv.className = 'feedback show correct';
            feedbackDiv.innerHTML = `✅ Correct! The answer was ${q.correct.toUpperCase()}.`;
        } else {
            const correctLetter = q.correct;
            let correctText = '';
            switch(correctLetter) {
                case 'a': correctText = q.opt_a; break;
                case 'b': correctText = q.opt_b; break;
                case 'c': correctText = q.opt_c; break;
                case 'd': correctText = q.opt_d; break;
            }
            feedbackDiv.className = 'feedback show incorrect';
            feedbackDiv.innerHTML = `❌ Incorrect. Correct answer: ${correctLetter.toUpperCase()}) ${correctText}`;
        }
        submitBtn.style.display = 'none';
        nextBtn.style.display = 'inline-block';
        answeredThisSession = true;
    } else {
        feedbackDiv.classList.remove('show');
        submitBtn.style.display = 'inline-block';
        nextBtn.style.display = 'none';
        answeredThisSession = false;
    }
}

async function submitAnswer() {
    if (answeredThisSession || currentQuestionData.answered) {
        return;
    }
    
    const selectedRadio = document.querySelector('input[name="option"]:checked');
    if (!selectedRadio) {
        showToast('Please select an answer');
        return;
    }
    
    const selectedValue = selectedRadio.value;
    
    const result = await apiCall('/api/student/submit', 'POST', {
        student_id: currentStudentId,
        question_id: currentQuestionData.id,
        selected: selectedValue
    });
    
    if (result.success) {
        currentQuestionData.answered = true;
        currentQuestionData.selected = selectedValue;
        currentQuestionData.is_correct = result.is_correct ? 1 : 0;
        
        if (result.is_correct) {
            categoryProgress[currentCategory].correct++;
        }
        categoryProgress[currentCategory].answered++;
        
        updateProgressBars();
        
        const feedbackDiv = document.getElementById('feedback');
        if (result.is_correct) {
            feedbackDiv.className = 'feedback show correct';
            feedbackDiv.innerHTML = `✅ Correct! The answer was ${currentQuestionData.correct.toUpperCase()}.`;
        } else {
            const correctLetter = currentQuestionData.correct;
            let correctText = '';
            switch(correctLetter) {
                case 'a': correctText = currentQuestionData.opt_a; break;
                case 'b': correctText = currentQuestionData.opt_b; break;
                case 'c': correctText = currentQuestionData.opt_c; break;
                case 'd': correctText = currentQuestionData.opt_d; break;
            }
            feedbackDiv.className = 'feedback show incorrect';
            feedbackDiv.innerHTML = `❌ Incorrect. Correct answer: ${correctLetter.toUpperCase()}) ${correctText}`;
        }
        
        document.getElementById('submitBtn').style.display = 'none';
        document.getElementById('nextBtn').style.display = 'inline-block';
        answeredThisSession = true;
        
        loadLeaderboard();
    }
}

function nextQuestion() {
    const questions = categoryQuestions[currentCategory];
    
    if (currentQuestionIndex + 1 < questions.length) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        let nextCategory = null;
        
        for (let cat of categoryList) {
            if (cat !== currentCategory) {
                const catQuestions = categoryQuestions[cat];
                const hasUnanswered = catQuestions.some(q => !q.answered);
                if (hasUnanswered) {
                    nextCategory = cat;
                    break;
                }
            }
        }
        
        if (nextCategory) {
            selectCategory(nextCategory);
        } else {
            showToast('🎉 Congratulations! You have completed all questions!');
        }
    }
}

async function loadLeaderboard() {
    const data = await apiCall('/api/leaderboard');
    renderLeaderboard(data.currentWeek, 'current');
    
    document.getElementById('currentWeekLeaderBtn').onclick = () => {
        renderLeaderboard(data.currentWeek, 'current');
        document.getElementById('currentWeekLeaderBtn').classList.add('active');
        document.getElementById('overallLeaderBtn').classList.remove('active');
    };
    
    document.getElementById('overallLeaderBtn').onclick = () => {
        renderLeaderboard(data.overall, 'overall');
        document.getElementById('overallLeaderBtn').classList.add('active');
        document.getElementById('currentWeekLeaderBtn').classList.remove('active');
    };
}

function renderLeaderboard(students, type) {
    const container = document.getElementById('leaderboardList');
    
    if (!students || students.length === 0) {
        container.innerHTML = '<div class="loading">No data yet</div>';
        return;
    }
    
    let html = '';
    students.forEach((student, idx) => {
        const rank = idx + 1;
        let rankClass = '';
        if (rank === 1) rankClass = 'first';
        
        html += `
            <div class="leaderboard-item ${rankClass}">
                <div class="rank">#${rank}</div>
                <div class="name">${student.username}</div>
                <div class="score">${student.total_correct || 0} pts</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function loadMessages() {
    const messages = await apiCall(`/api/student/${currentStudentId}/messages`);
    const container = document.getElementById('messagesList');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="loading">No messages</div>';
        return;
    }
    
    let html = '';
    messages.forEach(msg => {
        const date = new Date(msg.sent_at).toLocaleString();
        html += `
            <div class="message-item">
                <div class="message-subject">📌 ${msg.subject}</div>
                <div class="message-date">${date}</div>
                <div class="message-content">${msg.content}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function setupEventListeners() {
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('submitBtn').onclick = submitAnswer;
    document.getElementById('nextBtn').onclick = nextQuestion;
    
    document.querySelectorAll('.cat-nav-btn').forEach(btn => {
        btn.onclick = () => selectCategory(btn.dataset.cat);
    });
    
    document.querySelectorAll('.category-card').forEach(card => {
        card.onclick = () => selectCategory(card.dataset.category);
    });
}