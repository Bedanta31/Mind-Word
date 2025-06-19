// ✅ Firebase v9 Modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDqsWJgwX-vWIawPZt0XTnQHSE9AqwczkE",
  authDomain: "word-finder-346db.firebaseapp.com",
  projectId: "word-finder-346db",
  storageBucket: "word-finder-346db.appspot.com",
  messagingSenderId: "129230255125",
  appId: "1:129230255125:web:39632d82bb30c55c318a1c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🔄 Global state
let currentUser = null;
let wordsToFind = [];
let selectedCells = [];
let foundWords = [];
let score = 0;
let timeLeft = 0;
let countdown = null;
let gridSize = 5;
let dirR = null;
let dirC = null;
let isDragging = false;
let currentLevel = "easy";
let cells = [];
let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 🔁 DOM Elements
const screens = document.querySelectorAll(".screen");
const authScreen = document.getElementById("auth-screen");
const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const endScreen = document.getElementById("end-screen");

const grid = document.getElementById("grid");
const timerDisplay = document.getElementById("timer");
const scoreDisplay = document.getElementById("score");
const finalScore = document.getElementById("final-score");
const wordList = document.getElementById("words");

// 🔐 Auth State Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await goToStartScreen();
  } else {
    showScreen(authScreen);
  }
});

// 📺 Utility to show any screen
function showScreen(screen) {
  screens.forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

// 🔴 Show error popup
function showError(msg) {
  const popup = document.getElementById("error-popup");
  popup.textContent = msg;
  popup.style.display = "block";
  popup.style.animation = "fadeUp 1s ease-out";
  setTimeout(() => {
    popup.style.display = "none";
  }, 1000);
}

// ✅ Sign up new user
window.signup = async function () {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  if (!email || !password) return showError("Fill both fields");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    await setDoc(doc(db, "users", uid), {
      email,
      scores: { easy: 0, medium: 0, hard: 0 },
      cash: 0,
      username: "New User",
      avatar: null
    });

    currentUser = cred.user;
    goToStartScreen();
  } catch (err) {
    showError(err.message);
  }
};

// ✅ Login
window.login = async function () {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;
    goToStartScreen();
  } catch (err) {
    showError("Login failed: " + err.message);
  }
};

// 🚪 Logout with confirmation popup
window.confirmLogout = function () {
  document.getElementById("logout-popup").style.display = "block";
};

window.logoutUser = function () {
  signOut(auth);
  document.getElementById("logout-popup").style.display = "none";
};

window.cancelLogout = function () {
  document.getElementById("logout-popup").style.display = "none";
};

// ✅ Load start screen with user data
async function goToStartScreen() {
  const uid = currentUser.uid;
  const docSnap = await getDoc(doc(db, "users", uid));
  const userData = docSnap.data();

  document.getElementById("profile-username").textContent = userData.username || "User";
  document.getElementById("profile-cash").textContent = userData.cash?.toFixed(2) || "0.00";

  showScreen(startScreen);
  showLeaderboard(currentLevel);
}
// 🎯 Select difficulty
window.selectLevel = function (level) {
  currentLevel = level;
  document.getElementById("selected-level").textContent = `Selected: ${level.toUpperCase()}`;
  gridSize = level === "easy" ? 5 : level === "medium" ? 7 : 9;
};

// 🧠 Show leaderboard
async function showLeaderboard(level) {
  const snapshot = await getDocs(collection(db, "users"));
  const users = [];
  snapshot.forEach(doc => {
    const user = doc.data();
    const score = user.scores?.[level] || 0;
    users.push({ username: user.username || "Anonymous", score, avatar: user.avatar });
  });

  users.sort((a, b) => b.score - a.score);
  const top3 = users.slice(0, 3);
  let html = `<h3>${level.toUpperCase()} Leaderboard</h3>`;
  if (top3.length === 0) {
    html += "<p>No scores yet.</p>";
  } else {
    html += "<ol>";
    top3.forEach((u, i) => {
      const icon = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      html += `<li><span>${icon}</span> ${u.username} — <strong>${u.score}</strong></li>`;
    });
    html += "</ol>";
  }

  document.getElementById("leaderboard").innerHTML = html;
}

// ▶️ Start the game
window.startGame = function () {
  timeLeft = currentLevel === "easy" ? 30 : currentLevel === "medium" ? 60 : 120;
  gridSize = currentLevel === "easy" ? 5 : currentLevel === "medium" ? 7 : 9;
  score = 0;
  selectedCells = [];
  foundWords = [];
  wordsToFind = [];
  timerDisplay.textContent = timeLeft;
  scoreDisplay.textContent = score;

  grid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  showScreen(gameScreen);

  generateWords();
  buildGrid();
  startTimer();
};

// 🔤 Word pool per difficulty
const wordBank = {
  easy: ["DOG", "CAT", "SUN", "BAT", "HEN"],
  medium: ["APPLE", "HOUSE", "MANGO", "ZEBRA", "PENCIL"],
  hard: ["ELEPHANT", "NOTEBOOK", "PYRAMID", "COMPUTER", "MICRO"]
};

// 🎲 Pick 5 random words
function generateWords() {
  const pool = wordBank[currentLevel];
  while (wordsToFind.length < 5) {
    const word = pool[Math.floor(Math.random() * pool.length)];
    if (!wordsToFind.includes(word)) wordsToFind.push(word);
  }

  wordList.innerHTML = wordsToFind.map(w => `<span>${w}</span>`).join(" ");
}

// 🧱 Build grid with random letters
function buildGrid() {
  grid.innerHTML = "";
  cells = [];

  for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = letters[Math.floor(Math.random() * letters.length)];
    cell.dataset.index = i;
    grid.appendChild(cell);
    cells.push(cell);
  }

  wordsToFind.forEach(placeWord);
}

// 🔠 Place word in grid
function placeWord(word) {
  const directions = [
    { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: -1, c: 1 }
  ];

  for (let tries = 0; tries < 100; tries++) {
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const row = Math.floor(Math.random() * gridSize);
    const col = Math.floor(Math.random() * gridSize);

    const indices = [];
    let canPlace = true;

    for (let i = 0; i < word.length; i++) {
      const r = row + dir.r * i;
      const c = col + dir.c * i;
      if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
        canPlace = false;
        break;
      }
      const idx = r * gridSize + c;
      if (cells[idx].dataset.locked && cells[idx].textContent !== word[i]) {
        canPlace = false;
        break;
      }
      indices.push(idx);
    }

    if (canPlace) {
      for (let i = 0; i < word.length; i++) {
        const idx = indices[i];
        cells[idx].textContent = word[i];
        cells[idx].dataset.locked = "true";
      }
      break;
    }
  }
}

// 🕒 Start timer countdown
function startTimer() {
  clearInterval(countdown);
  countdown = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(countdown);
      endGame(false);
    }
  }, 1000);
}

// 🧠 Handle cell selection
function clearSelection() {
  selectedCells.forEach(c => c.classList.remove("selected"));
  selectedCells = [];
  dirR = dirC = null;
}

function selectCell(cell) {
  if (!cell || selectedCells.includes(cell)) return;

  if (selectedCells.length === 0) {
    selectedCells.push(cell);
    cell.classList.add("selected");
  } else {
    const last = selectedCells[selectedCells.length - 1];
    const lastIdx = +last.dataset.index;
    const newIdx = +cell.dataset.index;

    const lastRow = Math.floor(lastIdx / gridSize);
    const lastCol = lastIdx % gridSize;
    const newRow = Math.floor(newIdx / gridSize);
    const newCol = newIdx % gridSize;

    const deltaR = newRow - lastRow;
    const deltaC = newCol - lastCol;

    if (selectedCells.length === 1) {
      dirR = deltaR;
      dirC = deltaC;
    }

    if (deltaR === dirR && deltaC === dirC) {
      selectedCells.push(cell);
      cell.classList.add("selected");
    }
  }
}

function checkWord() {
  const word = selectedCells.map(c => c.textContent).join("");

  if (wordsToFind.includes(word)) {
    selectedCells.forEach(c => {
      c.classList.remove("selected");
      c.classList.add("found");
    });

    const index = wordsToFind.indexOf(word);
    wordsToFind.splice(index, 1);
    wordList.innerHTML = wordsToFind.map(w => `<span>${w}</span>`).join(" ");

    // ⏱ Bonus time and score
    let bonus = currentLevel === "easy" ? 3 : currentLevel === "medium" ? 5 : 7;
    timeLeft += bonus;
    timerDisplay.textContent = timeLeft;
    score = (5 - wordsToFind.length) * 10 + timeLeft * 2;
    scoreDisplay.textContent = score;

    // 🎉 Visual
    const popup = document.getElementById("bonus-popup");
    if (popup) {
      popup.textContent = `+${bonus}s`;
      popup.style.display = "block";
      popup.style.animation = "fadeUp 1s ease-out";
      setTimeout(() => (popup.style.display = "none"), 1000);
    }

    if (wordsToFind.length === 0) {
      clearInterval(countdown);
      setTimeout(() => endGame(true), 500);
    }
  } else {
    clearSelection();
  }
}

// ⏹ Game Over
async function endGame(didWin) {
  clearInterval(countdown);
  showScreen(endScreen);
  finalScore.textContent = score;

  const uid = currentUser.uid;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.data();

  if (didWin) {
    endScreen.querySelector("h1").textContent = "🎉 You Won!";
    if (currentLevel === "hard") {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    const old = data.scores?.[currentLevel] || 0;
    if (score > old) {
      data.scores[currentLevel] = score;
      await setDoc(ref, data);
    }

    let cashEarned = currentLevel === "easy" ? 0.05 : currentLevel === "medium" ? 0.07 : 0.1;
    data.cash = (data.cash || 0) + cashEarned;
    await setDoc(ref, data);
    document.getElementById("profile-cash").textContent = data.cash.toFixed(2);
    showError(`+₹${cashEarned.toFixed(2)} earned!`);
  } else {
    endScreen.querySelector("h1").textContent = "⏱ Time's Up!";
  }

  await showLeaderboard(currentLevel);
      }


// 📝 Change Name
window.changeName = async function () {
  const newName = prompt("Enter new name:");
  if (!newName) return;

  const uid = currentUser.uid;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  data.username = newName;
  await setDoc(ref, data);

  document.getElementById("profile-username").textContent = newName;
  showError("✅ Name updated!");
};

// 🖼 Change Avatar
window.changeAvatar = async function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 64, 64);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

        const ref = doc(db, "users", currentUser.uid);
        const snap = await getDoc(ref);
        const data = snap.data();
        data.avatar = dataUrl;
        await setDoc(ref, data);

        showError("✅ Avatar updated!");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

// 💸 Request Withdrawal
window.requestWithdrawal = async function () {
  const uid = currentUser.uid;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.data();

  const amount = parseFloat(prompt(`Enter amount to withdraw (Available ₹${data.cash.toFixed(2)}):`));
  if (isNaN(amount) || amount < 10 || amount > data.cash) {
    return showError("❌ Enter a valid amount (min ₹10)");
  }

  data.cash -= amount;
  await setDoc(ref, data);
  document.getElementById("profile-cash").textContent = data.cash.toFixed(2);
  showError(`✅ Withdrawal of ₹${amount.toFixed(2)} submitted!`);
};

// ❌ Delete Me
window.confirmDeleteUser = function () {
  if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
    deleteUserNow();
  }
};

async function deleteUserNow() {
  const uid = currentUser.uid;
  await setDoc(doc(db, "users", uid), {}); // clear user data
  await signOut(auth);
  showError("Account deleted.");
}

// 💬 Messages (Local Only)
window.showMessages = function () {
  const msgContainer = document.getElementById("message-list");
  const messages = JSON.parse(localStorage.getItem("messages") || "[]");

  if (messages.length === 0) {
    msgContainer.innerHTML = "<p>No messages yet.</p>";
  } else {
    msgContainer.innerHTML = messages.map((msg, i) =>
      `<div style="background:#f1f1f1;padding:10px;margin-bottom:10px;border-radius:8px;">
        <p>${msg}</p>
        <button onclick="deleteMessage(${i})">🗑 Delete</button>
      </div>`
    ).join("");
  }

  showScreen(document.getElementById("message-screen"));
};

window.deleteMessage = function (index) {
  let messages = JSON.parse(localStorage.getItem("messages") || "[]");
  messages.splice(index, 1);
  localStorage.setItem("messages", JSON.stringify(messages));
  showMessages();
};

// 🖱 Mouse Events
grid.addEventListener("mousedown", e => {
  if (e.target.classList.contains("cell")) {
    isDragging = true;
    clearSelection();
    selectCell(e.target);
  }
});

grid.addEventListener("mousemove", e => {
  if (isDragging && e.target.classList.contains("cell")) {
    selectCell(e.target);
  }
});

document.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    checkWord();
  }
});

// 🤳 Touch Events
grid.addEventListener("touchstart", e => {
  isDragging = true;
  const cell = getCellFromTouch(e);
  if (cell) {
    clearSelection();
    selectCell(cell);
  }
});

grid.addEventListener("touchmove", e => {
  const cell = getCellFromTouch(e);
  if (cell) {
    selectCell(cell);
  }
});

grid.addEventListener("touchend", () => {
  isDragging = false;
  checkWord();
});

// 📱 Helper to detect cell under finger
function getCellFromTouch(e) {
  const touch = e.touches[0];
  const elem = document.elementFromPoint(touch.clientX, touch.clientY);
  return elem && elem.classList.contains("cell") ? elem : null;
}

// 🔙 Back to level select
window.goToLevelSelect = function () {
  showScreen(startScreen);
  showLeaderboard(currentLevel);
};

// 🎉 Bonus popup (already styled in index.html)
document.body.insertAdjacentHTML("beforeend", `
  <div id="bonus-popup" style="display:none; position:fixed; top:50%; left:50%;
  transform:translate(-50%, -50%);
  background:#28a745; color:white; padding:10px 20px;
  border-radius:10px; font-size:24px; z-index:999;">+3s</div>
`);
