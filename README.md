# SGP Launcher (CLI)

Script de linha de comando para automatizar a execução e atualização da aplicação SGP. Ideal para ambientes de servidor ou automação.

## Funcionalidades

- Verificação e download da versão mais recente do SGP.
- Encerramento do processo antigo antes de iniciar o novo.
- Injeção de variáveis de ambiente a partir de um arquivo de configuração remoto.

## Pré-requisitos

- [Node.js](https://nodejs.org/ ) (versão 18 ou superior) instalado.

## Instalação e Configuração

1.  Clone este repositório ou baixe os arquivos `launcher.js` e `package.json`.
2.  Na pasta do projeto, crie um arquivo chamado `.env`.
3.  Adicione as seguintes variáveis ao arquivo `.env`:

    ```env
    # URL "raw" do arquivo config.json no repositório privado
    REMOTE_CONFIG_URL=https://raw.githubusercontent.com/usuario/repo/main/config.json

    # Caminho completo onde o app.exe do SGP deve ser salvo
    EXECUTABLE_PATH=S:\prd\app\main\app.exe

    # Personal Access Token do GitHub com permissão de leitura
    GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
    ```
4.  Abra um terminal na pasta do projeto e rode `npm install` para baixar as dependências.

## Como Usar

Para executar o launcher, simplesmente rode o comando no terminal:

```bash
node launcher.js
