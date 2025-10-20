// src/renderer.js

const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const updateBtn = document.getElementById("update-btn");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const logsContainer = document.getElementById("logs-container");
const statusBadge = document.getElementById("status-badge");
const themeSwitcher = document.getElementById("theme-switcher");
const remoteUrlInput = document.getElementById("remote-url-input");
const exePathInput = document.getElementById("exe-path-input");
const githubTokenInput = document.getElementById("github-token-input");

let isFirstLog = true;

function addLog(message) {
  if (isFirstLog) {
    logsContainer.innerHTML = "";
    isFirstLog = false;
  }
  const logEntry = document.createElement("p");
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logsContainer.appendChild(logEntry);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

async function loadSettingsIntoForm() {
  addLog("Carregando configurações do launcher...");
  const settings = await window.electronAPI.invoke("get-settings");
  if (settings) {
    remoteUrlInput.value = settings.remoteConfigUrl || "";
    exePathInput.value = settings.executablePath || "";
    githubTokenInput.value = settings.githubToken || "";
    addLog("Configurações carregadas.");
  } else {
    addLog(
      "Nenhuma configuração encontrada. Por favor, preencha e salve as configurações."
    );
  }
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-bs-theme", "dark");
    themeSwitcher.checked = true;
  } else {
    document.documentElement.removeAttribute("data-bs-theme");
    themeSwitcher.checked = false;
  }
}

themeSwitcher.addEventListener("change", () => {
  const theme = themeSwitcher.checked ? "dark" : "light";
  localStorage.setItem("theme", theme);
  applyTheme(theme);
});

startBtn.addEventListener("click", () => {
  addLog("Enviando comando para iniciar o SGP...");
  window.electronAPI.send("start-sgp");
});

stopBtn.addEventListener("click", () => {
  addLog("Enviando comando para parar o SGP...");
  window.electronAPI.send("stop-sgp");
});

updateBtn.addEventListener("click", () => {
  addLog("Enviando comando para verificar atualizações...");
  window.electronAPI.send("check-for-updates");
});

saveSettingsBtn.addEventListener("click", () => {
  addLog("Salvando novas configurações...");
  const newSettings = {
    remoteConfigUrl: remoteUrlInput.value,
    executablePath: exePathInput.value,
    githubToken: githubTokenInput.value,
  };
  window.electronAPI.send("save-settings", newSettings);

  const settingsModalEl = document.getElementById("settingsModal");
  const modal = bootstrap.Modal.getInstance(settingsModalEl);
  if (modal) {
    modal.hide();
  }
});

window.electronAPI.on("update-log", (message) => {
  addLog(message);
  if (message.includes("iniciado com sucesso")) {
    statusBadge.textContent = "Rodando";
    statusBadge.className = "badge bg-success";
  } else if (
    message.includes("Processos antigos encerrados") ||
    message.includes("Nenhum processo em execução")
  ) {
    statusBadge.textContent = "Parado";
    statusBadge.className = "badge bg-danger";
  } else if (message.includes("Iniciando o processo")) {
    statusBadge.textContent = "Iniciando...";
    statusBadge.className = "badge bg-warning";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);
  loadSettingsIntoForm();
});
