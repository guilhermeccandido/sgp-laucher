require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const axios = require("axios");
const find = require("find-process");
const { spawn } = require("child_process");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REMOTE_CONFIG_URL = process.env.REMOTE_CONFIG_URL;
const EXECUTABLE_PATH = process.env.EXECUTABLE_PATH;
const API_PORT = process.env.API_PORT || 3000;

const app = express();
let isUpdateRunning = false;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function downloadFile(url, destPath) {
  log(`Baixando arquivo de ${url}...`);
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
      log(`Arquivo salvo em: ${destPath}`);
      resolve();
    });
    writer.on("error", reject);
  });
}

async function stopSGPProcess(processName) {
  log(`Procurando por processos '${processName}' para encerrar...`);
  try {
    const list = await find("name", processName);
    if (list.length) {
      list.forEach((proc) => {
        log(`Encerrando processo ${proc.name} (PID: ${proc.pid})...`);
        process.kill(proc.pid, "SIGTERM");
      });
      log("Processos antigos encerrados.");
    } else {
      log("Nenhum processo em execução encontrado.");
    }
  } catch (error) {
    log(`Erro ao tentar encerrar o processo: ${error.message}`);
  }
}

function startSGPProcess(executablePath, envVars) {
  log(`Iniciando o processo: ${executablePath}`);
  try {
    const sgpProcess = spawn(executablePath, [], {
      detached: true,
      stdio: "ignore",
      shell: true,
      env: { ...process.env, ...envVars },
    });
    sgpProcess.unref();
    log("SGP iniciado com sucesso em segundo plano.");
  } catch (error) {
    log(`Falha ao iniciar o SGP: ${error.message}`);
  }
}

async function runUpdateFlow() {
  if (isUpdateRunning) {
    const message = "Aviso: Já existe um processo de atualização em andamento.";
    log(message);
    return { success: false, message };
  }

  isUpdateRunning = true;
  log("Iniciando fluxo de atualização via API...");

  try {
    if (!REMOTE_CONFIG_URL || !EXECUTABLE_PATH) {
      throw new Error("Configurações (URL ou Caminho) não definidas no .env");
    }

    log("Buscando configuração remota...");
    const response = await axios.get(REMOTE_CONFIG_URL, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    const remoteConfig = response.data;
    log(`Versão remota encontrada: ${remoteConfig.version}`);

    const exeFilename = path.basename(EXECUTABLE_PATH);
    const localConfigPath = path.join(
      path.dirname(EXECUTABLE_PATH),
      "local_config.json"
    );
    let localConfig = { version: "0.0.0" };

    try {
      const localConfigFile = await fs.readFile(localConfigPath, "utf-8");
      localConfig = JSON.parse(localConfigFile);
      log(`Versão local encontrada: ${localConfig.version}`);
    } catch (error) {
      if (error.code === "ENOENT")
        log("Nenhuma configuração local encontrada.");
      else throw error;
    }

    if (remoteConfig.version !== localConfig.version) {
      log("Nova versão detectada! Iniciando processo de atualização...");
      await stopSGPProcess(exeFilename);
      await downloadFile(remoteConfig.executable.url, EXECUTABLE_PATH);
      await fs.writeFile(
        localConfigPath,
        JSON.stringify(remoteConfig, null, 2)
      );
      log("Atualização concluída! Reiniciando o SGP...");
      startSGPProcess(EXECUTABLE_PATH, remoteConfig.environment_variables);
      return {
        success: true,
        message: "SGP atualizado e reiniciado com sucesso!",
      };
    } else {
      log(
        "Nenhuma nova versão encontrada. O SGP será reiniciado por garantia."
      );
      await stopSGPProcess(exeFilename);
      startSGPProcess(EXECUTABLE_PATH, remoteConfig.environment_variables);
      return {
        success: true,
        message:
          "Nenhuma nova versão. SGP reiniciado com a configuração atual.",
      };
    }
  } catch (error) {
    const errorMessage = `FALHA NO FLUXO DE ATUALIZAÇÃO: ${error.message}`;
    log(errorMessage);
    return { success: false, message: errorMessage };
  } finally {
    isUpdateRunning = false;
    log("Fluxo de atualização finalizado.");
  }
}

app.post("/update", async (req, res) => {
  log("Recebida requisição no endpoint /update");
  runUpdateFlow();
  res
    .status(202)
    .json({
      message:
        "Processo de atualização iniciado. Verifique os logs do servidor para o status.",
    });
});

app.get("/status", (req, res) => {
  res.status(200).json({ status: "SGP Launcher API está online." });
});

app.listen(API_PORT, () => {
  log(`Servidor do SGP Launcher rodando na porta ${API_PORT}`);
  log(
    `Para atualizar, envie uma requisição POST para http://localhost:${API_PORT}/update`
  );
  log(`Para verificar o status, acesse http://localhost:${API_PORT}/status`);
});
