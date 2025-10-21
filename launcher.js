require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const axios = require("axios");
const { exec, spawn } = require("child_process");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REMOTE_CONFIG_URL = process.env.REMOTE_CONFIG_URL;
const EXECUTABLE_PATH = process.env.EXECUTABLE_PATH;
const API_PORT = process.env.API_PORT || 3000;

const app = express();
let isUpdateRunning = false;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, destPath) {
  log(`Baixando arquivo de ${url}...`);
  try {
    const dir = path.dirname(destPath);
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    log(`Aviso: Não foi possível criar o diretório. Erro: ${error.message}`);
  }
  const writer = fsSync.createWriteStream(destPath);
  const response = await axios({ method: "get", url, responseType: "stream" });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      log(`Arquivo salvo em: ${destPath}`);
      resolve();
    });
    writer.on("error", reject);
  });
}

async function stopSGPProcess(processName) {
  log(`Procurando por processos '${processName}' para encerrar...`);
  return new Promise((resolve) => {
    exec(`taskkill /F /IM ${processName}`, (error, stdout, stderr) => {
      if (error && stderr.includes("não foi encontrado")) {
        log("Nenhum processo em execução encontrado.");
      } else if (error) {
        log(`Erro ao tentar encerrar o processo: ${stderr}`);
      } else {
        log("Processos antigos encerrados com sucesso.");
      }
      setTimeout(resolve, 1500);
    });
  });
}

function startSGPProcess(executablePath, envVars) {
  log(`Iniciando o processo: ${executablePath}`);
  try {
    const exeDir = path.dirname(executablePath);
    const sgpProcess = spawn(executablePath, [], {
      detached: true,
      stdio: "ignore",
      shell: true,
      env: { ...process.env, ...envVars },
      cwd: exeDir,
    });
    sgpProcess.unref();
    log(
      `SGP iniciado com sucesso em segundo plano com PID: ${sgpProcess.pid}.`
    );
  } catch (error) {
    log(`Falha ao iniciar o SGP: ${error.message}`);
  }
}

async function runUpdateFlow(force = false) {
  if (isUpdateRunning) {
    log("Aviso: Já existe um processo de atualização em andamento.");
    return;
  }
  isUpdateRunning = true;
  const flowType = force ? "forçada" : "padrão";
  log(`Iniciando fluxo de atualização ${flowType}...`);

  try {
    if (!REMOTE_CONFIG_URL || !EXECUTABLE_PATH)
      throw new Error("Configurações não definidas no .env");

    const urlWithCacheBuster = `${REMOTE_CONFIG_URL}?v=${Date.now()}`;
    const response = await axios.get(urlWithCacheBuster, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    const remoteConfig = response.data;
    log(`Versão remota encontrada: ${remoteConfig.version}`);

    let needsUpdate = force;
    if (!force) {
      const localConfigPath = path.join(
        path.dirname(EXECUTABLE_PATH),
        "local_config.json"
      );
      let localVersion = "0.0.0";
      if (await fileExists(localConfigPath)) {
        try {
          localVersion = JSON.parse(
            await fs.readFile(localConfigPath, "utf-8")
          ).version;
        } catch (e) {
          log(`Aviso: Falha ao ler JSON local. Erro: ${e.message}`);
        }
      }
      log(`Versão local encontrada: ${localVersion}`);
      if (
        remoteConfig.version !== localVersion ||
        !(await fileExists(EXECUTABLE_PATH))
      ) {
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      log("Iniciando processo de atualização...");
      await stopSGPProcess(path.basename(EXECUTABLE_PATH));
      await downloadFile(remoteConfig.executable.url, EXECUTABLE_PATH);
      await fs.writeFile(
        path.join(path.dirname(EXECUTABLE_PATH), "local_config.json"),
        JSON.stringify(remoteConfig, null, 2)
      );
      log("Atualização concluída! Reiniciando o SGP...");

      startSGPProcess(EXECUTABLE_PATH, remoteConfig.environment_variables);
    } else {
      log(
        "Nenhuma nova versão encontrada. O SGP será reiniciado por garantia."
      );
      await stopSGPProcess(path.basename(EXECUTABLE_PATH));
      startSGPProcess(EXECUTABLE_PATH, remoteConfig.environment_variables);
    }
  } catch (error) {
    log(`FALHA NO FLUXO DE ATUALIZAÇÃO: ${error.stack}`);
  } finally {
    isUpdateRunning = false;
    log("Fluxo de atualização finalizado.");
  }
}

app.get("/update", (req, res) => {
  runUpdateFlow(false);
  res.status(202).json({ message: "Processo de atualização padrão iniciado." });
});
app.get("/force-update", (req, res) => {
  runUpdateFlow(true);
  res
    .status(202)
    .json({ message: "Processo de atualização forçada iniciado." });
});
app.get("/status", (req, res) => {
  res.status(200).json({ status: "SGP Launcher API está online." });
});

app.listen(API_PORT, () => {
  log(`Servidor do SGP Launcher rodando na porta ${API_PORT}`);
  log(`Para atualizar, acesse http://localhost:${API_PORT}/update`);
  log(
    `Para forçar a atualização, acesse http://localhost:${API_PORT}/force-update`
  );
  log("Executando verificação inicial ao iniciar o serviço...");
  runUpdateFlow(false);
});
