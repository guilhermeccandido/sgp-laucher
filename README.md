# SGP Launcher (GUI)

Ferramenta com interface gráfica para gerenciar, atualizar e executar a aplicação SGP.

## Funcionalidades

- Interface gráfica amigável para controle total do SGP.
- Verificação e aplicação automática de atualizações a partir de um repositório Git.
- Gerenciamento de variáveis de ambiente de forma centralizada.
- Painel de logs em tempo real.

## Instalação

1.  Baixe o arquivo `SGP-Launcher-Setup-X.X.X.exe`.
2.  Execute o instalador e siga as instruções. A aplicação será instalada e um atalho será criado.

## Configuração Inicial (Passo Obrigatório)

Após a instalação, a aplicação precisa ser configurada para se conectar ao seu ambiente.

1.  Abra o SGP Launcher.
2.  Clique no botão **"Configurações"** <i class="bi bi-gear-fill"></i>.
3.  Preencha os três campos:
    - **URL do config.json:** A URL "raw" do arquivo `config.json` no seu repositório privado do GitHub.
    - **Caminho do app.exe:** O caminho completo onde o `app.exe` do SGP deve ser salvo. Ex: `S:\prd\app\main\app.exe`.
    - **Token do GitHub:** Seu Personal Access Token com permissão de leitura para o repositório privado.
4.  Clique em **"Salvar Alterações"**.

## Como Usar

- **Verificar Atualização:** Use este botão para a primeira instalação ou para buscar novas versões. O launcher irá parar, baixar, atualizar e reiniciar o SGP automaticamente.
- **Iniciar SGP:** Inicia o SGP com a versão e configuração atuais.
- **Parar SGP:** Encerra o processo do SGP.

---

### Para Desenvolvedores

Para rodar em modo de desenvolvimento:

1. Clone o repositório.
2. Rode `npm install`.
3. Rode `npm start`.

Para gerar um novo instalador:

1. Rode `npm run dist`.
