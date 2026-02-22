import './styles/global.css';
import './styles/variables.css';
import './styles/style.css';
import './styles/profile.css';
import './styles/auth.css';
import './styles/tabs.css';
import './styles/sidebar.css';
import './styles/chat.css';
import './styles/fitting.css';

const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://127.0.0.1:8000/api/v1"
  : "/api/v1";

window.userProfileState = {
  name: "",
  username: "",
  birthday: "",
  event_goal: "Повседневный",
  budget: "Средний",
  photo: null
};

// --- ИЗБРАННОЕ: localStorage ---
function getFavProducts() {
  try { return JSON.parse(localStorage.getItem('fav_products') || '[]'); } catch { return []; }
}
function setFavProducts(arr) { localStorage.setItem('fav_products', JSON.stringify(arr)); }
function getFavLooks() {
  try { return JSON.parse(localStorage.getItem('fav_looks') || '[]'); } catch { return []; }
}
function setFavLooks(arr) { localStorage.setItem('fav_looks', JSON.stringify(arr)); }

function toggleFavProduct(product) {
  let favs = getFavProducts();
  const idx = favs.findIndex(p => p.name === product.name && p.link === product.link);
  if (idx >= 0) { favs.splice(idx, 1); } else { favs.push(product); }
  setFavProducts(favs);
  return idx < 0; // true = добавлен
}

function isProductFaved(product) {
  return getFavProducts().some(p => p.name === product.name && p.link === product.link);
}

function addFavLook(look) {
  const favs = getFavLooks();
  favs.unshift(look);
  setFavLooks(favs);
}

function removeFavLook(index) {
  const favs = getFavLooks();
  favs.splice(index, 1);
  setFavLooks(favs);
}

function removeFavProduct(index) {
  const favs = getFavProducts();
  favs.splice(index, 1);
  setFavProducts(favs);
}

// --- РЕНДЕР ИЗБРАННОГО ---
function renderFavProducts() {
  const grid = document.getElementById('fav-products-grid');
  const empty = document.getElementById('fav-products-empty');
  if (!grid) return;
  grid.querySelectorAll('.fav-product-card').forEach(c => c.remove());
  const favs = getFavProducts();
  if (empty) empty.style.display = favs.length > 0 ? 'none' : 'block';
  favs.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'fav-product-card';
    card.innerHTML = `
      <button class="fav-remove-btn" data-idx="${i}">×</button>
      ${item.img ? `<a href="${item.link}" target="_blank"><img src="${item.img}" alt="${item.name}"></a>` : ''}
      <div class="fav-card-info">${item.name}</div>
      <a href="${item.link}" target="_blank" class="fav-card-link">Перейти на WB →</a>
    `;
    card.querySelector('.fav-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavProduct(i);
      renderFavProducts();
    });
    grid.appendChild(card);
  });
}

function renderFavLooks() {
  const grid = document.getElementById('fav-looks-grid');
  const empty = document.getElementById('fav-looks-empty');
  if (!grid) return;
  grid.querySelectorAll('.fav-look-card').forEach(c => c.remove());
  const favs = getFavLooks();
  if (empty) empty.style.display = favs.length > 0 ? 'none' : 'block';
  favs.forEach((look, i) => {
    const card = document.createElement('div');
    card.className = 'fav-look-card';
    let itemsHTML = (look.items || []).map(it => `
      <a href="${it.link}" target="_blank">
        ${it.img ? `<img src="${it.img}" alt="${it.name}">` : ''}
        <span class="fav-look-item-name">${it.name}</span>
      </a>
    `).join('');
    card.innerHTML = `
      <button class="fav-remove-btn" data-idx="${i}">×</button>
      <div class="fav-look-date">📅 ${look.date || 'Образ'}</div>
      <div class="fav-look-items">${itemsHTML}</div>
    `;
    card.querySelector('.fav-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavLook(i);
      renderFavLooks();
    });
    grid.appendChild(card);
  });
}

function renderFavorites() {
  renderFavProducts();
  renderFavLooks();
}

// Проверка заполненности профиля
function hasProfileData() {
  const s = window.userProfileState;
  return !!(s.hair_color && s.eye_color && s.height && s.weight);
}

// Утилита: форматирование текста нейросети в красивый HTML
function formatAIText(raw) {
  let text = raw;

  // Убираем все markdown-символы
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');  // **жирный** → просто текст
  text = text.replace(/\*(.*?)\*/g, '$1');      // *курсив* → просто текст
  text = text.replace(/^#{1,6}\s*/gm, '');      // # заголовки → убираем
  text = text.replace(/^[-•]\s*/gm, '• ');      // - списки → аккуратная точка
  text = text.replace(/^\d+\.\s*/gm, '');       // 1. нумерованные → убираем номера

  // Разбиваем на абзацы по двойным переносам
  const paragraphs = text.split(/\n{2,}/);
  let html = paragraphs.map(p => {
    // Внутри абзаца: одинарные переносы → <br>
    const lines = p.trim().split('\n').map(l => l.trim()).filter(l => l);
    return `<p>${lines.join('<br>')}</p>`;
  }).filter(p => p !== '<p></p>').join('');

  return html;
}

document.addEventListener('DOMContentLoaded', () => {

  // --- АВТОРИЗАЦИЯ ---
  const authSection = document.getElementById('auth-section');
  const mainApp = document.getElementById('main-app');

  document.getElementById('btn-show-register').addEventListener('click', () => {
    document.getElementById('auth-choice').style.display = 'none';
    document.getElementById('auth-register').style.display = 'flex';
  });

  document.getElementById('btn-show-login').addEventListener('click', () => {
    document.getElementById('auth-choice').style.display = 'none';
    document.getElementById('auth-login').style.display = 'flex';
  });

  // Кнопки "Назад"
  document.getElementById('btn-back-register').addEventListener('click', () => {
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-choice').style.display = 'flex';
  });
  document.getElementById('btn-back-login').addEventListener('click', () => {
    document.getElementById('auth-login').style.display = 'none';
    document.getElementById('auth-choice').style.display = 'flex';
  });

  async function onAuthSuccess(name, username, userId) {
    window.userProfileState.name = name;
    window.userProfileState.username = username;
    window.userProfileState.user_id = userId;
    document.getElementById('ui-profile-name').textContent = name;
    document.getElementById('ui-profile-username').textContent = username;
    authSection.style.display = 'none';
    mainApp.style.display = 'flex';

    // Загружаем данные профиля из БД
    if (userId) {
      try {
        const profRes = await fetch(`${API_URL}/users/${userId}`);
        if (profRes.ok) {
          const profData = await profRes.json();
          const fields = ['hair_color', 'eye_color', 'skin_tone', 'undertone', 'height', 'weight', 'chest', 'waist', 'hips', 'body_type', 'color_type', 'contrast', 'birthday'];
          fields.forEach(f => { if (profData[f]) window.userProfileState[f] = String(profData[f]); });
          syncProfileUI();
        }
      } catch (e) { console.error('Ошибка загрузки профиля', e); }
    }
    startChatDialogue();
  }

  document.getElementById('btn-do-register').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value || "Пользователь";
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    if (!username || !password) { alert("Заполните логин и пароль!"); return; }
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password })
      });
      if (res.ok) {
        const regData = await res.json();
        onAuthSuccess(name, username, regData.user_id);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Ошибка регистрации! Возможно, логин уже занят.");
      }
    } catch (e) {
      console.error(e);
      alert("Сервер не отвечает. Убедись, что Python запущен!");
    }
  });

  document.getElementById('btn-do-login').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    if (!username || !password) { alert("Заполните логин и пароль!"); return; }
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        onAuthSuccess(data.name || data.username, data.username, data.user_id);
      } else {
        alert("Неверный логин или пароль!");
      }
    } catch (e) {
      console.error(e);
      alert("Сервер не отвечает.");
    }
  });


  // --- НАВИГАЦИЯ ---
  const navButtons = document.querySelectorAll('.top-bar .nav-btn');
  const chatArea = document.querySelector('.chat-area');
  const plusArea = document.querySelector('.plus-area');
  const heartArea = document.querySelector('.heart-area');
  const profileArea = document.querySelector('.profile-area');
  const fittingScreen = document.getElementById('fitting-screen');
  const inputContainer = document.getElementById('main-input-container');
  const inputField = document.getElementById('main-input-field');
  const sendBtn = document.getElementById('chat-send-btn');

  function hideAllScreens() {
    chatArea.style.display = 'none';
    plusArea.style.display = 'none';
    heartArea.style.display = 'none';
    profileArea.style.display = 'none';
    fittingScreen.style.display = 'none';
    inputContainer.style.display = 'none';
  }

  navButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      navButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      hideAllScreens();
      if (index === 0) {
        chatArea.style.display = 'flex';
        inputContainer.style.display = 'flex';
        inputField.placeholder = "Введите ответ...";
      }
      else if (index === 1) plusArea.style.display = 'flex';
      else if (index === 2) { heartArea.style.display = 'flex'; renderFavorites(); }
      else if (index === 3) { profileArea.style.display = 'flex'; syncProfileUI(); }
    });
  });

  // --- ВЫБОР СОЗДАНИЯ ОБРАЗА ---
  document.getElementById('btn-new-params').addEventListener('click', () => {
    navButtons.forEach(btn => btn.classList.remove('active'));
    navButtons[0].classList.add('active');
    hideAllScreens();
    chatArea.style.display = 'flex';
    inputContainer.style.display = 'flex';
    startChatDialogue();
  });

  document.getElementById('btn-saved-params').addEventListener('click', () => {
    if (!hasProfileData()) {
      alert('В профиле недостаточно данных. Пожалуйста, сначала пройдите анкету или заполните профиль.');
      return;
    }
    navButtons.forEach(btn => btn.classList.remove('active'));
    navButtons[0].classList.add('active');
    hideAllScreens();
    chatArea.style.display = 'flex';
    inputContainer.style.display = 'flex';
    chatContainer.innerHTML = '';
    currentStep = chatSteps.length; // пропускаем всю анкету
    renderBotMessage('✅ Использую сохранённые параметры из вашего профиля. Начинаю анализ...');
    runStyleAnalysis();
  });

  // --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ИЗБРАННОГО ---
  const favTabProducts = document.getElementById('fav-tab-products');
  const favTabLooks = document.getElementById('fav-tab-looks');
  const favProductsGrid = document.getElementById('fav-products-grid');
  const favLooksGrid = document.getElementById('fav-looks-grid');

  if (favTabProducts && favTabLooks) {
    favTabProducts.addEventListener('click', () => {
      favTabProducts.classList.add('active');
      favTabLooks.classList.remove('active');
      favProductsGrid.style.display = 'grid';
      favLooksGrid.style.display = 'none';
      renderFavProducts();
    });
    favTabLooks.addEventListener('click', () => {
      favTabLooks.classList.add('active');
      favTabProducts.classList.remove('active');
      favLooksGrid.style.display = 'grid';
      favProductsGrid.style.display = 'none';
      renderFavLooks();
    });
  }


  // --- АВАТАР ПРОФИЛЯ ---
  const profileAvatarDisplay = document.getElementById('profile-avatar-display');
  const profileAvatarUpload = document.getElementById('profile-avatar-upload');

  if (profileAvatarDisplay && profileAvatarUpload) {
    profileAvatarDisplay.addEventListener('click', () => profileAvatarUpload.click());
    profileAvatarUpload.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        window.userProfileState.photo = e.target.files[0];
        const objUrl = URL.createObjectURL(e.target.files[0]);
        profileAvatarDisplay.style.backgroundImage = `url(${objUrl})`;
        const hint = document.getElementById('avatar-hint');
        if (hint) hint.style.display = 'none';
      }
    });
  }

  // --- СИНХРОНИЗАЦИЯ ПРОФИЛЯ ---
  function syncProfileUI() {
    const s = window.userProfileState;
    document.getElementById('ui-profile-name').textContent = s.name || "Гость";

    // Обновляем выпадающие списки
    const colorSelect = document.getElementById('select-color-type');
    if (colorSelect && s.color_type) colorSelect.value = s.color_type;
    const bodySelect = document.getElementById('select-body-type');
    if (bodySelect && s.body_type) bodySelect.value = s.body_type;
    if (s.username) document.getElementById('ui-profile-username').textContent = s.username;
    document.querySelectorAll('.profile-field').forEach(el => {
      const field = el.getAttribute('data-field');
      if (s[field] && s[field] !== '') el.textContent = s[field];
    });
  }

  // Сохранение профиля в БД
  async function saveProfileToDB() {
    const uid = window.userProfileState.user_id;
    if (!uid) return;
    const s = window.userProfileState;
    try {
      await fetch(`${API_URL}/users/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hair_color: s.hair_color || null,
          eye_color: s.eye_color || null,
          skin_tone: s.skin_tone || null,
          undertone: s.undertone || null,
          height: s.height ? parseFloat(s.height) : null,
          weight: s.weight ? parseFloat(s.weight) : null,
          chest: s.chest ? parseFloat(s.chest) : null,
          waist: s.waist ? parseFloat(s.waist) : null,
          hips: s.hips ? parseFloat(s.hips) : null,
          body_type: s.body_type || null,
          color_type: s.color_type || null,
          contrast: s.contrast || null,
          birthday: s.birthday || null
        })
      });
    } catch (e) { console.error('Ошибка сохранения профиля', e); }
  }


  const chatSteps = [
    { text: "Здравствуйте! Я — ваш ИИ-стилист. Давайте познакомимся. Какой у вас рост (см)?", type: "text", key: "height", example: "165" },
    { text: "Какой у вас вес (кг)?", type: "text", key: "weight", example: "55" },
    { text: "Обхват груди (см)?", type: "text", key: "chest", example: "90" },
    { text: "Обхват талии (см)?", type: "text", key: "waist", example: "60" },
    { text: "Обхват бедер (см)?", type: "text", key: "hips", example: "90" },
    { text: "Какой у вас цвет волос?", type: "buttons", key: "hair_color", options: ["Брюнетка", "Блондинка", "Рыжая", "Русая", "Шатенка"] },
    { text: "А цвет глаз?", type: "buttons", key: "eye_color", options: ["Карие", "Голубые", "Зеленые", "Серые"] },
    { text: "Какой у вас оттенок кожи?", type: "buttons", key: "skin_tone", options: ["Светлая", "Оливковая", "Смуглая"] },
    { text: "А подтон кожи?", type: "buttons", key: "undertone", options: ["Холодный (розоватый)", "Теплый (желтоватый)", "Нейтральный"] },
    { text: "Для какого события собираем гардероб?", type: "buttons", key: "event_goal", options: ["На каждый день", "Офис", "Свидание", "Вечеринка", "Свадьба / Выпускной"] },
    { text: "Какой стиль вам ближе?", type: "buttons", key: "style_categories", options: ["Кэжуал", "Классика", "Спорт-шик", "Old Money", "Гранж"] },
    { text: "Как вы хотите себя чувствовать?", type: "buttons", key: "feeling_goal", options: ["Комфортно", "Уверенно", "Профессионально", "Сексуально"] },
    { text: "На какой бюджет ориентируемся?", type: "buttons", key: "budget", options: ["Эконом", "Средний", "Премиум"] },
    { text: "Особые пожелания? (например: 'не хочу юбки', 'скрыть живот')", type: "buttons", key: "requirements", options: ["Нет, доверяю стилисту"] },
    { text: "Хотите прикрепить своё фото? Это поможет точнее определить ваш цветотип и тип фигуры. Вы можете пропустить этот шаг.", type: "photo" },
    { text: "Все данные собраны. Нажмите кнопку, чтобы я проанализировал(а) вашу внешность и подобрал(а) стиль.", type: "final" }
  ];

  let currentStep = 0;
  const chatContainer = document.getElementById('chat-history-container');

  function renderBotMessage(text) {
    const div = document.createElement('div');
    div.className = 'bot-message-group';
    div.innerHTML = `
      <div class="message-row bot">
        <div class="avatar-circle"></div>
        <div class="message-content"><div class="message-bubble">${text}</div></div>
      </div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return div;
  }

  function renderBotMessageHTML(html) {
    const div = document.createElement('div');
    div.className = 'bot-message-group';
    div.innerHTML = `
      <div class="message-row bot">
        <div class="avatar-circle"></div>
        <div class="message-content"><div class="message-bubble ai-analysis-text">${html}</div></div>
      </div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return div;
  }

  function renderUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message-row user';
    div.innerHTML = `<div class="message-content"><div class="message-bubble user-bubble">${text}</div></div>`;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function renderOptions(stepData, parentDiv) {
    const optsDiv = document.createElement('div');
    optsDiv.className = 'chat-options scrollable';
    optsDiv.style.marginLeft = '52px';
    stepData.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'chat-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleUserAnswer(opt, stepData));
      optsDiv.appendChild(btn);
    });
    parentDiv.appendChild(optsDiv);
  }

  function renderFinalButton(parentDiv) {
    const btnDiv = document.createElement('div');
    btnDiv.className = 'chat-options-vertical';
    btnDiv.style.marginLeft = '52px';
    btnDiv.innerHTML = `<button class="chat-option active" id="go-to-fitting-btn" style="background-color: #007AFF; color: white; border: none; font-weight: bold; font-size: 16px; padding: 14px 24px; border-radius: 30px;">Подобрать образ</button>`;
    parentDiv.appendChild(btnDiv);
    document.getElementById('go-to-fitting-btn').addEventListener('click', runStyleAnalysis);
  }

  function showNextQuestion() {
    if (currentStep >= chatSteps.length) return;
    const stepData = chatSteps[currentStep];
    const botDiv = renderBotMessage(stepData.text);

    if (stepData.type === 'buttons') {
      renderOptions(stepData, botDiv);
      inputField.placeholder = "Или введите свой вариант...";
      inputField.disabled = false;
    } else if (stepData.type === 'text') {
      inputField.placeholder = stepData.example || "Введите ответ...";
      inputField.disabled = false;
    } else if (stepData.type === 'photo') {
      // Шаг загрузки фото
      const photoBtns = document.createElement('div');
      photoBtns.className = 'chat-options-vertical';
      photoBtns.style.marginLeft = '52px';
      photoBtns.innerHTML = `
        <label class="chat-option" style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; background: #007AFF; color: white; border: none; font-weight: bold; padding: 14px 24px; border-radius: 30px;">
          Загрузить фото
          <input type="file" accept="image/*" id="chat-photo-input" style="display: none;">
        </label>
        <button class="chat-option" id="skip-photo-btn" style="border: 1px solid #d1d1d6; padding: 12px 24px; border-radius: 30px;">Пропустить</button>
      `;
      botDiv.appendChild(photoBtns);

      document.getElementById('chat-photo-input').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          window.userProfileState.photo = e.target.files[0];
          handleUserAnswer("Фото прикреплено");
        }
      });
      document.getElementById('skip-photo-btn').addEventListener('click', () => {
        handleUserAnswer("Пропускаю, без фото");
      });
      inputField.placeholder = "Загрузите фото или пропустите";
      inputField.disabled = true;
    } else if (stepData.type === 'final') {
      renderFinalButton(botDiv);
      inputField.placeholder = "Нажмите кнопку выше ☝️";
      inputField.disabled = true;
    }
  }

  function handleUserAnswer(answerText, stepData) {
    if (!stepData) stepData = chatSteps[currentStep];
    renderUserMessage(answerText);

    // Сохраняем в state
    if (stepData.key) {
      window.userProfileState[stepData.key] = answerText;
    }

    const allBtns = chatContainer.querySelectorAll('.chat-option:not(#go-to-fitting-btn)');
    allBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.5'; b.style.pointerEvents = 'none'; });

    currentStep++;
    inputField.value = '';
    syncProfileUI();

    // Если это последний вопрос перед финалом — сохраняем в БД
    if (currentStep >= chatSteps.length - 1) {
      saveProfileToDB();
    }

    setTimeout(showNextQuestion, 400);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (inputField.value.trim() !== '' && !inputField.disabled) handleUserAnswer(inputField.value.trim());
    });
  }
  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && inputField.value.trim() !== '' && !inputField.disabled) handleUserAnswer(inputField.value.trim());
  });

  function startChatDialogue() {
    chatContainer.innerHTML = '';
    currentStep = 0;
    showNextQuestion();
  }


  // --- РЕДАКТИРОВАНИЕ ПРОФИЛЯ ---
  const editProfileBtn = document.getElementById('btn-edit-profile');
  let isEditingProfile = false;

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      const fields = document.querySelectorAll('.profile-field');
      if (!isEditingProfile) {
        fields.forEach(el => {
          const val = el.textContent;
          const fieldKey = el.getAttribute('data-field');
          const inputType = fieldKey === 'birthday' ? 'date' : 'text';
          el.innerHTML = `<input type="${inputType}" class="edit-input" data-key="${fieldKey}" value="${val === 'Неизвестно' || val === 'Не указана' ? '' : val}" style="width: 100%; text-align: right; border: 1px solid #007AFF; border-radius: 8px; padding: 6px 10px; font-size: 14px;">`;
        });
        editProfileBtn.textContent = 'Сохранить';
        editProfileBtn.style.backgroundColor = '#007AFF';
        editProfileBtn.style.color = '#fff';
        isEditingProfile = true;
      } else {
        const inputs = document.querySelectorAll('.edit-input');
        inputs.forEach(inp => {
          const key = inp.getAttribute('data-key');
          const val = inp.value || 'Неизвестно';
          window.userProfileState[key] = val;
          inp.parentElement.innerHTML = val;
        });
        editProfileBtn.textContent = 'Изменить';
        editProfileBtn.style.backgroundColor = '#e0e0e0';
        editProfileBtn.style.color = 'var(--text-main)';
        isEditingProfile = false;
        saveProfileToDB();
      }
    });
  }


  // === ШАГ 1: АНАЛИЗ СТИЛЯ (показать текст в чате) ===
  async function runStyleAnalysis() {
    // Блокируем кнопку
    const fittingBtn = document.getElementById('go-to-fitting-btn');
    if (fittingBtn) { fittingBtn.disabled = true; fittingBtn.style.opacity = '0.5'; fittingBtn.textContent = '⏳ Анализирую...'; }

    inputField.placeholder = "ИИ анализирует ваш стиль...";
    inputField.disabled = true;

    syncProfileUI();
    const state = window.userProfileState;

    const formData = new FormData();
    formData.append('name', state.name || "Гость");
    formData.append('hair_color', state.hair_color || "Не указан");
    formData.append('eye_color', state.eye_color || "Не указан");
    formData.append('skin_tone', state.skin_tone || "Светлая");
    formData.append('undertone', state.undertone || "Нет");
    formData.append('height', state.height || 165);
    formData.append('weight', state.weight || 55);
    formData.append('chest', state.chest || 90);
    formData.append('waist', state.waist || 60);
    formData.append('hips', state.hips || 90);
    formData.append('style_categories', state.style_categories || "Кэжуал");
    formData.append('event_goal', state.event_goal || "Повседневный");
    formData.append('feeling_goal', state.feeling_goal || "Свободно");
    formData.append('requirements', state.requirements || "");
    formData.append('budget', state.budget || "Средний");
    if (state.photo) formData.append('photo', state.photo);

    renderBotMessage("⏳ Анализирую ваши параметры и внешность...");

    try {
      const styleRes = await fetch(`${API_URL}/style`, { method: 'POST', body: formData });
      if (!styleRes.ok) throw new Error("Ошибка анализа стиля");
      const styleData = await styleRes.json();

      // Берём цветотип, тип фигуры и контрастность из ответа бэкенда
      if (styleData.color_type) window.userProfileState.color_type = styleData.color_type;
      if (styleData.body_type) window.userProfileState.body_type = styleData.body_type;
      if (styleData.contrast) window.userProfileState.contrast = styleData.contrast;

      // Обновляем профиль и сохраняем в БД
      syncProfileUI();
      saveProfileToDB();

      // Показываем красивый текст анализа в чате
      const formattedText = formatAIText(styleData.analysis_text);
      const botDiv = renderBotMessageHTML(formattedText);

      // Кнопка «Собрать капсулу»
      const capsuleBtnDiv = document.createElement('div');
      capsuleBtnDiv.className = 'chat-options-vertical';
      capsuleBtnDiv.style.marginLeft = '52px';
      capsuleBtnDiv.innerHTML = `<button class="chat-option active" id="btn-build-capsule" style="background-color: #34C759; color: white; border: none; font-weight: bold; font-size: 16px; padding: 14px 24px; border-radius: 30px;">👗 Собрать капсулу!</button>`;
      botDiv.appendChild(capsuleBtnDiv);

      document.getElementById('btn-build-capsule').addEventListener('click', () => {
        buildCapsule(styleData.analysis_text, state);
      });

      inputField.placeholder = "Нажмите «Собрать капсулу»";
      chatContainer.scrollTop = chatContainer.scrollHeight;

    } catch (err) {
      console.error(err);
      renderBotMessage("❌ Ошибка связи с сервером. Запущен ли Python?");
      inputField.placeholder = "Ошибка!";
      inputField.disabled = false;
    }
  }


  // === ШАГ 2: СБОРКА КАПСУЛЫ (товары) ===
  async function buildCapsule(analysisText, state) {
    const capsuleBtn = document.getElementById('btn-build-capsule');
    if (capsuleBtn) { capsuleBtn.disabled = true; capsuleBtn.style.opacity = '0.5'; capsuleBtn.textContent = '⏳ Собираю капсулу...'; }

    renderBotMessage("⏳ Генерирую капсульный гардероб и ищу товары на Wildberries...");

    try {
      const capRes = await fetch(`${API_URL}/capsules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_text: analysisText,
          event_goal: state.event_goal || "Повседневный",
          budget: state.budget || "Средний"
        })
      });
      if (!capRes.ok) throw new Error("Ошибка генерации капсулы");
      const capData = await capRes.json();

      // Показываем текст капсулы в чате
      const formattedCapsule = formatAIText(capData.capsule_text);
      renderBotMessageHTML(formattedCapsule);

      // Извлекаем ключевые слова для поиска товаров
      const keywordRegex = /([А-Яа-яA-Za-z\-]+(?: [А-Яа-яA-Za-z\-]+){0,2})\s*(?:—|-|–|:)/g;
      let matches = [];
      let match;
      while ((match = keywordRegex.exec(capData.capsule_text)) !== null) {
        let word = match[1].trim();
        if (word.length > 3 && !matches.includes(word)) matches.push(word);
      }
      if (matches.length === 0) matches = ["Футболка", "Джинсы", "Кроссовки", "Сумка"];

      const itemsToSearch = matches.slice(0, 6);
      const aiItems = [];

      for (const itemName of itemsToSearch) {
        try {
          const res = await fetch(`${API_URL}/link?query=${encodeURIComponent(itemName)}`);
          if (res.ok) {
            const data = await res.json();
            aiItems.push({
              name: data.title || itemName,
              img: data.image_url || "",
              link: data.shop_link || "#"
            });
          }
        } catch (e) {
          console.error(`Ошибка поиска ${itemName}:`, e);
        }
      }

      // Рисуем карточки товаров прямо в чате
      if (aiItems.length > 0) {
        renderBotMessage("🛍️ Вот что я нашёл(а) для вас на Wildberries:");

        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'chat-product-grid';
        cardsDiv.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-left: 52px; max-width: 85%;';

        aiItems.forEach(item => {
          const card = document.createElement('div');
          card.className = 'chat-product-card';
          card.style.cssText = 'position: relative; color: inherit; background: #fff; border-radius: 16px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; flex-direction: column; align-items: center;';

          const isFaved = isProductFaved(item);
          card.innerHTML = `
            <button class="fav-heart-btn ${isFaved ? 'liked' : ''}">${isFaved ? '❤️' : '🩶'}</button>
            <a href="${item.link}" target="_blank" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center; width: 100%;">
              ${item.img ? `<img src="${item.img}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 10px;" alt="${item.name}">` : ''}
              <div style="font-size: 12px; margin-top: 6px; text-align: center; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${item.name}</div>
              <div style="font-size: 11px; margin-top: 4px; color: #007AFF; font-weight: bold;">Перейти на WB →</div>
            </a>
          `;

          const heartBtn = card.querySelector('.fav-heart-btn');
          heartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const added = toggleFavProduct(item);
            heartBtn.textContent = added ? '❤️' : '🩶';
            heartBtn.classList.toggle('liked', added);
          });

          cardsDiv.appendChild(card);
        });

        chatContainer.appendChild(cardsDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Кнопка "Сохранить образ в избранное"
        const saveLookDiv = document.createElement('div');
        saveLookDiv.className = 'chat-options-vertical';
        saveLookDiv.style.marginLeft = '52px';
        saveLookDiv.innerHTML = `<button class="save-look-btn" id="btn-save-look">❤️ Сохранить образ в избранное</button>`;
        chatContainer.appendChild(saveLookDiv);
        document.getElementById('btn-save-look').addEventListener('click', function () {
          const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          addFavLook({ date: `Капсула от ${date}`, items: aiItems });
          this.disabled = true;
          this.textContent = '✅ Образ сохранён!';
        });

        // Сохраняем в plus-area (для "Создать новый образ")
        saveCapsuleToHistory(capData.capsule_text, aiItems);
      }

      renderBotMessage("✅ Ваша капсула готова! Вы можете найти её во вкладке «Создать новый образ» или начать заново.");
      inputField.placeholder = "Спросите у ИИ-стилиста...";
      inputField.disabled = false;

    } catch (err) {
      console.error(err);
      renderBotMessage("❌ Ошибка при сборке капсулы. Попробуйте ещё раз.");
      inputField.placeholder = "Ошибка!";
      inputField.disabled = false;
    }
  }


  // === СОХРАНЕНИЕ КАПСУЛЫ В "СОЗДАТЬ НОВЫЙ ОБРАЗ" ===
  function saveCapsuleToHistory(capsuleText, items) {
    const plusCapsules = document.getElementById('plus-capsules-container');
    if (!plusCapsules) return;

    const capsuleBlock = document.createElement('div');
    capsuleBlock.className = 'saved-capsule';
    capsuleBlock.style.cssText = 'width: 100%; padding: 16px; margin-top: 16px; background: #f9f9f9; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);';

    const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    let itemsHTML = items.map(i => `
      <a href="${i.link}" target="_blank" style="text-decoration: none; color: inherit; background: #fff; border-radius: 12px; padding: 8px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
        ${i.img ? `<img src="${i.img}" style="width: 100%; height: 70px; object-fit: cover; border-radius: 8px;">` : ''}
        <div style="font-size: 11px; margin-top: 4px; text-align: center;">${i.name}</div>
      </a>
    `).join('');

    capsuleBlock.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">📅 Капсула от ${date}</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">${itemsHTML}</div>
    `;

    plusCapsules.prepend(capsuleBlock);
  }


  // --- АККОРДЕОНЫ И БОКОВОЕ МЕНЮ ---
  document.querySelectorAll('.section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.nextElementSibling;
      if (content) content.style.display = content.style.display === 'none' ? 'flex' : 'none';
    });
  });

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  function closeSidebar() {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  }
  document.getElementById('open-sidebar-btn').addEventListener('click', () => {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
  });
  document.getElementById('close-sidebar-btn').addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Навигация по ссылкам в сайдбаре
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      const navIndex = parseInt(link.getAttribute('data-nav'));
      closeSidebar();
      navButtons[navIndex]?.click();
    });
  });

  // Кнопка выхода (общая логика)
  function doLogout() {
    window.userProfileState = { name: '', username: '', birthday: '', event_goal: 'Повседневный', budget: 'Средний', photo: null };
    mainApp.style.display = 'none';
    authSection.style.display = 'flex';
    document.getElementById('auth-choice').style.display = 'flex';
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-login').style.display = 'none';
    chatContainer.innerHTML = '';
  }

  document.getElementById('btn-logout').addEventListener('click', doLogout);

  // Кнопка выхода в сайдбаре
  document.getElementById('sidebar-logout-btn').addEventListener('click', () => {
    closeSidebar();
    doLogout();
  });

  // Выпадающие списки в профиле — синхронизация с состоянием и сохранение в БД
  const colorSelect = document.getElementById('select-color-type');
  if (colorSelect) {
    colorSelect.addEventListener('change', () => {
      window.userProfileState.color_type = colorSelect.value;
      saveProfileToDB();
    });
  }
  const bodySelect = document.getElementById('select-body-type');
  if (bodySelect) {
    bodySelect.addEventListener('change', () => {
      window.userProfileState.body_type = bodySelect.value;
      saveProfileToDB();
    });
  }

});