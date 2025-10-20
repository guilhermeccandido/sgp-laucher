const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const axios = require("axios");
const find = require("find-process");
const { spawn } = require("child_process");

let mainWindow;
let appSettings = {};
const settingsPath = path.join(app.getPath("userData"), "settings.json");

async function loadSettings() {
  try {
    const data = await fs.readFile(settingsPath, "utf-8");
    appSettings = JSON.parse(data);
  } catch (error) {
    appSettings = { remoteConfigUrl: "", executablePath: "", githubToken: "" };
  }
}

async function saveSettings(newSettings) {
  appSettings = newSettings;
  await fs.writeFile(settingsPath, JSON.stringify(appSettings, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadFile("src/index.html");
}

function logToUI(message) {
  console.log(message);
  if (mainWindow) {
    mainWindow.webContents.send("update-log", message);
  }
}

async function downloadFile(url, destPath) {
  logToUI(`Baixando arquivo de ${url}...`);
  const dir = path.dirname(destPath);
  await fs.mkdir(dir, { recursive: true });
  const writer = fsSync.createWriteStream(destPath);
  const response = await axios({
    method: "get",
    url: url,
    responseType: "stream",
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      logToUI(`Arquivo salvo em: ${destPath}`);
      resolve();
    });
    writer.on("error", reject);
  });
}

async function stopSGPProcess(processName) {
  logToUI(`Procurando por processos '${processName}' para encerrar...`);
  try {
    const list = await find("name", processName);
    if (list.length) {
      list.forEach((proc) => {
        logToUI(`Encerrando processo ${proc.name} (PID: ${proc.pid})...`);
        process.kill(proc.pid, "SIGTERM");
      });
      logToUI("Processos antigos encerrados.");
    } else {
      logToUI("Nenhum processo em execução encontrado.");
    }
  } catch (error) {
    logToUI(`Erro ao tentar encerrar o processo: ${error.message}`);
  }
}

function startSGPProcess(executablePath, envVars) {
  logToUI(`Iniciando o processo: ${executablePath}`);
  try {
    const sgpProcess = spawn(executablePath, [], {
      detached: true,
      stdio: "ignore",
      shell: true,
      env: { ...process.env, ...envVars },
    });
    sgpProcess.unref();
    logToUI("SGP iniciado com sucesso em segundo plano.");
  } catch (error) {
    logToUI(`Falha ao iniciar o SGP: ${error.message}`);
  }
}

app.whenReady().then(async () => {
  await loadSettings();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-settings", () => {
  return appSettings;
});

ipcMain.on("save-settings", (event, newSettings) => {
  saveSettings(newSettings);
  logToUI("Configurações do launcher salvas com sucesso!");
});

ipcMain.on("start-sgp", async () => {
  logToUI("Recebido comando para iniciar o SGP...");
  if (!appSettings.executablePath)
    return logToUI(
      "Erro: Caminho do executável não definido nas configurações."
    );

  try {
    logToUI(
      "Buscando configuração remota para obter as variáveis de ambiente..."
    );
    const response = await axios.get(appSettings.remoteConfigUrl, {
      headers: { Authorization: `token ${appSettings.githubToken}` },
    });
    const remoteConfig = response.data;

    if (remoteConfig && remoteConfig.environment_variables) {
      logToUI("Configuração encontrada. Iniciando o processo...");
      startSGPProcess(
        appSettings.executablePath,
        remoteConfig.environment_variables
      );
    } else {
      logToUI("Erro: Não foi possível obter as variáveis de ambiente.");
    }
  } catch (error) {
    logToUI(`Erro ao buscar configuração: ${error.message}`);
  }
});

ipcMain.on("stop-sgp", async () => {
  logToUI("Recebido comando para parar o SGP...");
  if (!appSettings.executablePath)
    return logToUI(
      "Erro: Caminho do executável não definido nas configurações."
    );
  const exeFilename = path.basename(appSettings.executablePath);
  await stopSGPProcess(exeFilename);
});

ipcMain.on("check-for-updates", async () => {
  logToUI("Recebido comando para verificar atualizações...");
  if (!appSettings.remoteConfigUrl || !appSettings.executablePath)
    return logToUI("Erro: Configurações do launcher incompletas.");

  let remoteConfig;
  try {
    logToUI("Buscando configuração remota...");
    const response = await axios.get(appSettings.remoteConfigUrl, {
      headers: { Authorization: `token ${appSettings.githubToken}` },
    });
    remoteConfig = response.data;
    logToUI(`Versão remota encontrada: ${remoteConfig.version}`);
  } catch (error) {
    logToUI(`Erro ao buscar configuração remota: ${error.message}`);
    return;
  }

  const exeFilename = path.basename(appSettings.executablePath);
  const localConfigPath = path.join(
    path.dirname(appSettings.executablePath),
    "local_config.json"
  );
  let localConfig;

  try {
    const localConfigFile = await fs.readFile(localConfigPath, "utf-8");
    localConfig = JSON.parse(localConfigFile);
    logToUI(`Versão local encontrada: ${localConfig.version}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      logToUI("Nenhuma configuração local encontrada.");
      localConfig = { version: "0.0.0" };
    } else {
      logToUI(`Erro ao ler a configuração local: ${error.message}`);
      return;
    }
  }

  if (remoteConfig.version !== localConfig.version) {
    logToUI("Nova versão detectada! Iniciando processo de atualização...");
    try {
      await stopSGPProcess(exeFilename);
      await downloadFile(
        remoteConfig.executable.url,
        appSettings.executablePath
      );
      await fs.writeFile(
        localConfigPath,
        JSON.stringify(remoteConfig, null, 2)
      );
      logToUI(
        "Atualização concluída! Reiniciando o SGP com a nova configuração..."
      );
      startSGPProcess(
        appSettings.executablePath,
        remoteConfig.environment_variables
      );
    } catch (error) {
      logToUI(`FALHA NA ATUALIZAÇÃO: ${error.message}`);
    }
  } else {
    logToUI("Você já está com a versão mais recente.");
  }
});
