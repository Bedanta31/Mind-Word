// 📦 Firebase Modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  child,
  remove,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 🔧 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDqsWJgwX-vWIawPZt0XTnQHSE9AqwczkE",
  authDomain: "word-finder-346db.firebaseapp.com",
  databaseURL: "https://word-finder-346db-default-rtdb.firebaseio.com",
  projectId: "word-finder-346db",
  storageBucket: "word-finder-346db.appspot.com",
  messagingSenderId: "129230255125",
  appId: "1:129230255125:web:39632d82bb30c55c318a1c"
};

// 🔌 Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// 🌍 Global Variables
let currentUser = null;
let selectedDifficulty = "easy";
let gridSize = 10;
let timeLeft = 0;
let countdown = null;
let score = 0;
let userCash = 0;
let wordsToFind = [];
let selectedCells = [];
let foundWords = [];
let isDragging = false;
let dirR = null;
let dirC = null;
let cells = [];

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 🔐 Signup Function
window.signup = async function () {
  const username = document.getElementById("signupUsername").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();

  if (!username || !email || !password) {
    showError("Please fill all fields.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await sendEmailVerification(user);
    const userRef = ref(db, 'users/' + user.uid);
    await set(userRef, {
      username: username,
      email: email,
      cash: 0,
      upi: "",
      messages: [],
      avatar: "",
      deletedAt: null
    });

    showError("Signup successful! Verify your email before login.");
  } catch (error) {
    showError(error.message);
  }
};

// 🔐 Login Function
window.login = async function () {
  const email = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showError("Please enter both fields.");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      showError("Please verify your email before login.");
      return;
    }

    const userRef = ref(db, 'users/' + user.uid);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      showError("User data not found.");
      return;
    }

    currentUser = user.uid;
    const userData = snapshot.val();
    userCash = userData.cash || 0;

    document.getElementById("profile-username").textContent = userData.username;
    document.getElementById("profile-cash").textContent = userCash;
    document.getElementById("avatar-img").src = userData.avatar || "https://via.placeholder.com/100";

    showScreen("start-screen");
    document.getElementById("profile-btn").style.visibility = "visible";
    document.getElementById("profile-btn").style.opacity = 1;
  } catch (error) {
    showError(error.message);
  }
};

// 🔄 Auth State Listener (auto-login if already signed in)
onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {
    const userRef = ref(db, 'users/' + user.uid);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      currentUser = user.uid;
      const userData = snapshot.val();
      userCash = userData.cash || 0;
      document.getElementById("profile-username").textContent = userData.username;
      document.getElementById("profile-cash").textContent = userCash;
      document.getElementById("avatar-img").src = userData.avatar || "https://via.placeholder.com/100";
      showScreen("start-screen");
      document.getElementById("profile-btn").style.visibility = "visible";
      document.getElementById("profile-btn").style.opacity = 1;
    }
  }
});

// 💳 Save UPI
window.saveUPI = async function () {
  const upi = document.getElementById("upiInput").value.trim();
  if (!upi) {
    showError("Please enter your UPI ID.");
    return;
  }

  try {
    const userRef = ref(db, 'users/' + currentUser);
    await update(userRef, { upi });
    document.getElementById("upiPopup").style.display = "none";
    showError("✅ UPI Saved!");
  } catch (err) {
    console.error(err);
    showError("❌ Failed to save UPI.");
  }
};
// 🎯 Select Level
window.selectLevel = function (level) {
  selectedDifficulty = level;
  document.getElementById("selected-level").textContent = `Selected: ${level.toUpperCase()}`;
  document.getElementById("start-button").style.display = "inline-block";

  if (level === "easy") gridSize = 10;
  else if (level === "medium") gridSize = 12;
  else if (level === "hard") gridSize = 14;
};

// 🕹️ Start Game
window.startGame = function () {
  foundWords = [];
  selectedCells = [];

  score = 0;
  timeLeft = selectedDifficulty === "easy" ? 60 : selectedDifficulty === "medium" ? 45 : 30;

  document.getElementById("score").textContent = score;
  document.getElementById("timer").textContent = timeLeft;
  document.getElementById("words").textContent = "";

  showScreen("game-screen");
  generateGrid();
  startTimer();
};

// 🔄 Show Any Screen
window.showScreen = function (screenId) {
  const screens = document.querySelectorAll(".screen");
  screens.forEach(screen => screen.classList.remove("active"));

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
    target.classList.add("fade-in");
  }
};

// 🔁 Back to Start
window.goToLevelSelect = function () {
  showScreen("start-screen");
};

// 🚨 Show Error Popup
window.showError = function (msg) {
  const popup = document.getElementById("error-popup");
  popup.textContent = msg;
  popup.style.display = "block";

  setTimeout(() => {
    popup.style.display = "none";
  }, 3000);
};

// 📦 Sample word list
const wordList = {
  easy: ["CAT", "DOG", "SUN", "CAR", "MAP"],
  medium: ["APPLE", "BRICK", "CHESS", "FRUIT", "LEMON"],
  hard: ["PYTHON", "OBJECT", "SCRIPT", "METHOD", "PUZZLE"]
};

// 🎲 Generate Grid
function generateGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;

  cells = [];

  for (let i = 0; i < gridSize; i++) {
    cells[i] = [];
    for (let j = 0; j < gridSize; j++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.textContent = letters[Math.floor(Math.random() * letters.length)];
      grid.appendChild(cell);
      cells[i][j] = cell;
    }
  }

  wordsToFind = [...wordList[selectedDifficulty]];
  document.getElementById("words").textContent = wordsToFind.join(", ");
  placeWords(wordsToFind);
}

// 📌 Place words in grid (horizontal/vertical only)
function placeWords(words) {
  for (let word of words) {
    let placed = false;

    for (let attempts = 0; attempts < 100 && !placed; attempts++) {
      const isVertical = Math.random() < 0.5;
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);
      const canPlace = isVertical
        ? row + word.length <= gridSize
        : col + word.length <= gridSize;

      if (!canPlace) continue;

      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const r = isVertical ? row + i : row;
        const c = isVertical ? col : col + i;
        const existingChar = cells[r][c].textContent;
        if (existingChar !== word[i] && existingChar !== "") {
          fits = false;
          break;
        }
      }

      if (fits) {
        for (let i = 0; i < word.length; i++) {
          const r = isVertical ? row + i : row;
          const c = isVertical ? col : col + i;
          cells[r][c].textContent = word[i];
        }
        placed = true;
      }
    }
  }
}

// 🧩 Cell Event Listeners
window.grid = document.getElementById("grid");

grid.addEventListener("mousedown", e => {
  if (e.target.classList.contains("cell")) {
    startSelection(e.target);
  }
});

grid.addEventListener("mouseover", e => {
  if (isDragging && e.target.classList.contains("cell")) {
    continueSelection(e.target);
  }
});

grid.addEventListener("mouseup", endSelection);
grid.addEventListener("mouseleave", endSelection);

// 👇 Start Word Selection
function startSelection(cell) {
  selectedCells = [cell];
  cell.classList.add("selected");

  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  dirR = dirC = null;

  isDragging = true;
}

// 👉 Drag Selection
function continueSelection(cell) {
  if (selectedCells.includes(cell)) return;

  const lastCell = selectedCells[selectedCells.length - 1];
  const r1 = parseInt(lastCell.dataset.row);
  const c1 = parseInt(lastCell.dataset.col);
  const r2 = parseInt(cell.dataset.row);
  const c2 = parseInt(cell.dataset.col);

  const dr = r2 - r1;
  const dc = c2 - c1;

  if (dirR === null && dirC === null && (dr === 0 || dc === 0)) {
    dirR = dr !== 0 ? dr / Math.abs(dr) : 0;
    dirC = dc !== 0 ? dc / Math.abs(dc) : 0;
  }

  if (dr === dirR && dc === dirC) {
    selectedCells.push(cell);
    cell.classList.add("selected");
  }
}

// 🏁 Finish Word Selection
function endSelection() {
  if (!isDragging) return;
  isDragging = false;

  const word = selectedCells.map(c => c.textContent).join("");
  const reversed = selectedCells.map(c => c.textContent).reverse().join("");

  if (wordsToFind.includes(word) || wordsToFind.includes(reversed)) {
    selectedCells.forEach(cell => {
      cell.classList.remove("selected");
      cell.classList.add("found");
    });

    if (!foundWords.includes(word)) {
      foundWords.push(word);
      score++;
      document.getElementById("score").textContent = score;

      // 🎉 Bonus Time for Hard Mode
      if (selectedDifficulty === "hard") {
        timeLeft += 3;
        document.getElementById("bonus-popup").style.display = "block";
        setTimeout(() => {
          document.getElementById("bonus-popup").style.display = "none";
        }, 1000);
      }

      // 🎊 Confetti for all words in Hard
      if (selectedDifficulty === "hard") {
        confetti({ particleCount: 80, spread: 60 });
      }

      // 🏁 Game Complete
      if (foundWords.length === wordsToFind.length) {
        setTimeout(endGame, 1000);
      }
    }
  } else {
    selectedCells.forEach(cell => cell.classList.remove("selected"));
  }

  selectedCells = [];
}
// ⏳ Start Timer
function startTimer() {
  if (countdown) clearInterval(countdown);

  countdown = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(countdown);
      endGame();
    }
  }, 1000);
}

// 🏁 End Game
function endGame() {
  clearInterval(countdown);

  document.getElementById("final-score").textContent = score;
  showScreen("end-screen");

  // 🎉 Big Confetti on Hard Win
  if (selectedDifficulty === "hard" && foundWords.length === wordsToFind.length) {
    confetti({
      particleCount: 300,
      spread: 120,
      origin: { y: 0.6 },
    });
  }

  // 💰 Reward user
  const reward = selectedDifficulty === "easy" ? 1 : selectedDifficulty === "medium" ? 2 : 3;
  userCash += reward;
  document.getElementById("profile-cash").textContent = userCash;

  // 💾 Update DB
  if (currentUser) {
    const userRef = ref(db, 'users/' + currentUser);
    update(userRef, { cash: userCash });
  }
}

// 💵 Request Withdrawal
window.requestWithdrawal = function () {
  document.getElementById("withdraw-available").textContent = `Available: ₹${userCash}`;
  document.getElementById("withdrawal-popup").style.display = "block";
};

window.closeWithdrawPopup = function () {
  document.getElementById("withdrawal-popup").style.display = "none";
};

window.submitWithdrawal = async function () {
  const amount = parseInt(document.getElementById("withdraw-amount").value);
  if (isNaN(amount) || amount <= 0 || amount > userCash) {
    showError("Enter valid amount.");
    return;
  }

  const userRef = ref(db, 'users/' + currentUser);
  await update(userRef, { cash: userCash - amount });

  showError("✅ Request submitted!");
  document.getElementById("withdrawal-popup").style.display = "none";
  userCash -= amount;
  document.getElementById("profile-cash").textContent = userCash;
};

// ❌ Confirm Delete Popup
window.confirmDeleteUser = function () {
  document.getElementById("delete-popup").style.display = "block";
};

window.cancelDeletePopup = function () {
  document.getElementById("delete-popup").style.display = "none";
};

// ⏳ Start Delete Countdown
window.startDeleteCountdown = async function () {
  const deleteTime = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  const userRef = ref(db, 'users/' + currentUser);
  await update(userRef, { deletedAt: deleteTime });

  document.getElementById("delete-popup").style.display = "none";
  document.getElementById("cancel-delete-button").style.display = "inline-block";
  document.getElementById("delete-timer-display").style.display = "block";
  startCountdownTimer(deleteTime);
};

// ⏹ Cancel Delete
window.cancelPendingDeletion = async function () {
  const userRef = ref(db, 'users/' + currentUser);
  await update(userRef, { deletedAt: null });

  document.getElementById("cancel-delete-button").style.display = "none";
  document.getElementById("delete-timer-display").style.display = "none";
};

// ⏲️ Countdown Clock
function startCountdownTimer(deleteTime) {
  const display = document.getElementById("countdown-text");
  const interval = setInterval(() => {
    const remaining = deleteTime - Date.now();
    if (remaining <= 0) {
      clearInterval(interval);
      display.textContent = "Deleted.";
    } else {
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      display.textContent = `${h}h ${m}m ${s}s`;
    }
  }, 1000);
}

// 🔐 Admin Reset Confirmation
window.showPasswordPrompt = function () {
  document.getElementById("confirm-reset-popup").style.display = "none";
  document.getElementById("password-prompt").style.display = "block";
};

window.cancelReset = function () {
  document.getElementById("confirm-reset-popup").style.display = "none";
};

// ✅ Reset All Users
window.checkResetPassword = async function () {
  const inputPass = document.getElementById("reset-password").value;
  const adminPassword = "admin123"; // change for security

  if (inputPass === adminPassword) {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        update(ref(db, 'users/' + child.key), {
          cash: 0,
          messages: [],
          deletedAt: null
        });
      });
    }
    showError("✅ All users reset.");
    document.getElementById("password-prompt").style.display = "none";
  } else {
    showError("❌ Wrong password");
  }
};

// 💌 Message System
window.showMessages = async function () {
  const userRef = ref(db, 'users/' + currentUser);
  const snapshot = await get(userRef);
  const messages = snapshot.val().messages || [];

  const list = document.getElementById("message-list");
  list.innerHTML = messages.length ? messages.map(m => `<p>${m}</p>`).join("") : "<p>No messages.</p>";

  showScreen("message-screen");
};

// 🚪 Logout
window.confirmLogout = function () {
  logoutUser();
};

window.logoutUser = function () {
  auth.signOut();
  currentUser = null;
  showScreen("auth-screen");
  document.getElementById("profile-btn").style.visibility = "hidden";
  document.getElementById("profile-btn").style.opacity = 0;
};

