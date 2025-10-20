require("dotenv").config();

const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const axios = require("axios");
const find = require("find-process");
const { spawn } = require("child_process");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REMOTE_CONFIG_URL = process.env.REMOTE_CONFIG_URL;
const EXECUTABLE_PATH = process.env.EXECUTABLE_PATH;

if (!GITHUB_TOKEN || !REMOTE_CONFIG_URL || !EXECUTABLE_PATH) {
  console.error(
    "Faltam variáveis de ambiente no arquivo .env! Verifique GITHUB_TOKEN, REMOTE_CONFIG_URL e EXECUTABLE_PATH."
  );
  return;
}

async function downloadFile(url, destPath) {
  console.log(`Baixando arquivo de ${url}...`);
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
      console.log(`Arquivo salvo em: ${destPath}`);
      resolve();
    });
    writer.on("error", reject);
  });
}

async function stopSGPProcess(processName) {
  console.log(
    `Procurando por processos antigos '${processName}' para encerrar...`
  );
  const list = await find("name", processName);
  if (list.length) {
    list.forEach((proc) => {
      console.log(`Encerrando processo ${proc.name} (PID: ${proc.pid})...`);
      process.kill(proc.pid, "SIGTERM");
    });
    console.log("Processos antigos encerrados.");
  } else {
    console.log("Nenhum processo antigo encontrado.");
  }
}

function startSGPProcess(executablePath, envVars) {
  console.log(`Iniciando o processo: ${executablePath}`);
  try {
    const sgpProcess = spawn(executablePath, [], {
      detached: true,
      stdio: "ignore",
      shell: true,
      env: { ...process.env, ...envVars },
    });
    sgpProcess.unref();
    console.log("SGP iniciado com sucesso em segundo plano.");
  } catch (error) {
    console.error("Falha ao iniciar o SGP:", error.message);
  }
}

async function main() {
  console.log("Iniciando o launcher do SGP...");

  let remoteConfig;
  try {
    console.log("Buscando configuração remota...");
    const response = await axios.get(REMOTE_CONFIG_URL, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    remoteConfig = response.data;
    console.log(`Versão remota encontrada: ${remoteConfig.version}`);
  } catch (error) {
    console.error(
      "Erro ao buscar a configuração remota.",
      error.response?.status,
      error.message
    );
    return;
  }

  const exeFilename = path.basename(EXECUTABLE_PATH);

  let localConfig;
  const localConfigPath = path.join(
    path.dirname(EXECUTABLE_PATH),
    "local_config.json"
  );

  try {
    const localConfigFile = await fs.readFile(localConfigPath, "utf-8");
    localConfig = JSON.parse(localConfigFile);
    console.log(`Versão local encontrada: ${localConfig.version}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Nenhuma configuração local encontrada.");
      localConfig = { version: "0.0.0" };
    } else {
      console.error("Erro ao ler a configuração local:", error.message);
      return;
    }
  }

  if (remoteConfig.version !== localConfig.version) {
    console.log("Nova versão detectada! Iniciando processo de atualização...");
    try {
      await stopSGPProcess(exeFilename);
      await downloadFile(remoteConfig.executable.url, EXECUTABLE_PATH);
      await fs.writeFile(
        localConfigPath,
        JSON.stringify(remoteConfig, null, 2)
      );
      console.log("Atualização concluída com sucesso!");
    } catch (error) {
      console.error("FALHA NA ATUALIZAÇÃO:", error.message);
      return;
    }
  } else {
    console.log("Você já está com a versão mais recente.");
  }

  startSGPProcess(EXECUTABLE_PATH, remoteConfig.environment_variables);
  console.log("Launcher finalizado.");
}

main();
