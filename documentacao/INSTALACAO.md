# Guia de Instalação — Sistema de Carteirinhas Estudantis

> **Sistema:** Flask + MySQL (Waitress como servidor de produção)  
> **Público-alvo:** Técnico responsável pela instalação em nova máquina Windows

---

## Pré-requisitos

Antes de começar, certifique-se de instalar os programas abaixo na nova máquina:

| Programa | Versão Recomendada | Link para Download |
|---|---|---|
| Python | 3.10 ou superior | https://www.python.org/downloads/ |
| MySQL | 8.0 ou superior | https://dev.mysql.com/downloads/installer/ |
| Git *(opcional)* | Qualquer versão | https://git-scm.com/download/win |

> **Atenção:** Durante a instalação do Python, marque a opção **"Add Python to PATH"**.

---

## PASSO 1 — Copiar os Arquivos do Sistema

**Opção A — Via pendrive/pasta compartilhada:**
1. Copie toda a pasta `carteira-estudantil` para a nova máquina.  
   Sugestão de destino: `C:\Sistemas\carteira-estudantil`

**Opção B — Via Git:**
```bash
git clone <URL_DO_REPOSITORIO> C:\Sistemas\carteira-estudantil
```

> **Importante:** A pasta `venv` (ambiente virtual) **não precisa ser copiada**. Ela será recriada na etapa 3.

---

## PASSO 2 — Configurar o Banco de Dados MySQL

1. Abra o **MySQL Workbench** ou o **MySQL Command Line Client**.

2. Execute o script de criação do banco de dados. Ele está em:
   ```
   C:\Sistemas\carteira-estudantil\banco.sql
   ```

3. No MySQL, execute o comando abaixo para rodar o script:
   ```sql
   SOURCE C:/Sistemas/carteira-estudantil/banco.sql;
   ```
   Ou abra o arquivo no **MySQL Workbench** e clique em **Execute (⚡)**.

4. Confirme que o banco `carteirinhas` foi criado com as tabelas `alunos` e `turmas`.

---

## PASSO 3 — Configurar o Ambiente Python

Abra o **Prompt de Comando (CMD)** como **Administrador** e execute os comandos abaixo:

```bash
# Entrar na pasta do sistema
cd C:\Sistemas\carteira-estudantil

# Criar o ambiente virtual
python -m venv venv

# Ativar o ambiente virtual
venv\Scripts\activate

# Instalar as dependências
pip install -r requirements.txt
```

> Ao final, você verá as bibliotecas sendo instaladas: Flask, Waitress, mysql-connector-python, etc.

---

## PASSO 4 — Configurar o Arquivo `.env`

O arquivo `.env` contém as configurações de conexão com o banco de dados.

1. Localize o arquivo `.env` na raiz do projeto:
   ```
   C:\Sistemas\carteira-estudantil\.env
   ```

2. Abra com o Bloco de Notas e ajuste as informações conforme o novo ambiente:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=carteirinhas
   DB_USER=root
   DB_PASSWORD=SUA_SENHA_AQUI
   FLASK_SECRET_KEY=uma-chave-secreta-forte-aqui
   ```

   | Variável | Descrição |
   |---|---|
   | `DB_HOST` | Endereço do MySQL (geralmente `localhost`) |
   | `DB_PORT` | Porta do MySQL (padrão: `3306`) |
   | `DB_USER` | Usuário do MySQL |
   | `DB_PASSWORD` | Senha do MySQL definida na instalação |
   | `FLASK_SECRET_KEY` | Qualquer texto longo e aleatório (ex: `escola2026@xyz!`) |

---

## PASSO 5 — Testar o Sistema

Com o ambiente configurado, teste se o sistema funciona corretamente:

```bash
# Na pasta do sistema, com o venv ativado:
cd C:\Sistemas\carteira-estudantil
venv\Scripts\activate
python run_waitress.py
```

Você verá a mensagem:
```
Servidor rodando em http://127.0.0.1:5000
```

Abra o navegador e acesse: **http://127.0.0.1:5000**

> Se a tela do sistema aparecer, a instalação está correta!

---

## PASSO 6 — Inicialização Automática com o Windows

Para que o sistema abra automaticamente toda vez que o computador for ligado, siga os passos abaixo:

### 6.1 — Criar um arquivo `.bat` de inicialização

1. Abra o **Bloco de Notas**.
2. Cole o seguinte conteúdo:
   ```bat
   @echo off
   cd /d C:\Sistemas\carteira-estudantil
   call venv\Scripts\activate
   python run_waitress.py
   ```
3. Salve o arquivo como `iniciar_carteirinha.bat` na pasta do sistema:
   ```
   C:\Sistemas\carteira-estudantil\iniciar_carteirinha.bat
   ```

### 6.2 — Adicionar ao Inicializar do Windows (Pasta Startup)

1. Pressione **Win + R** e digite:
   ```
   shell:startup
   ```
   Pressione **Enter**. A pasta de Inicialização do Windows será aberta.

2. Crie um **atalho** para o arquivo `.bat`:
   - Clique com o botão direito dentro da pasta de Inicialização
   - Selecione **Novo → Atalho**
   - No campo de localização, cole o caminho:
     ```
     C:\Sistemas\carteira-estudantil\iniciar_carteirinha.bat
     ```
   - Clique em **Avançar**, dê o nome `Carteirinha Estudantil` e clique em **Concluir**.

3. **Teste reiniciando o computador.** Após o login, o sistema deve iniciar automaticamente.

---

### 6.3 — (Opcional) Iniciar minimizado na bandeja do sistema

Se desejar que a janela do CMD não apareça ao iniciar, altere o arquivo `.bat` para rodar em segundo plano:

```bat
@echo off
cd /d C:\Sistemas\carteira-estudantil
call venv\Scripts\activate
start /B pythonw run_waitress.py
```

Ou crie um arquivo `iniciar_silencioso.vbs` com o conteúdo abaixo e coloque **ele** (não o .bat) na pasta de Inicialização:

```vbs
Set oShell = CreateObject("WScript.Shell")
oShell.Run "C:\Sistemas\carteira-estudantil\iniciar_carteirinha.bat", 0, False
```

---

## 🌐 Acesso pela Rede Local (outros computadores)

Se outros computadores da mesma rede precisarem acessar o sistema:

1. Descubra o IP da máquina onde o sistema está instalado:
   ```bash
   ipconfig
   ```
   Anote o **Endereço IPv4** (ex: `192.168.1.10`)

2. Nos outros computadores, acesse pelo navegador:
   ```
   http://192.168.1.10:5000
   ```

3. **Libere a porta 5000 no Firewall do Windows:**
   - Pesquise por **"Firewall do Windows Defender"** no menu Iniciar
   - Clique em **Regras de Entrada → Nova Regra**
   - Selecione **Porta → TCP → Porta específica: 5000**
   - Selecione **Permitir a conexão** e conclua o assistente

---

##  Solução de Problemas Comuns

| Problema | Causa Provável | Solução |
|---|---|---|
| `ModuleNotFoundError` | Dependências não instaladas | Execute `pip install -r requirements.txt` com o venv ativado |
| `Access denied for user` | Senha do MySQL incorreta | Verifique o `.env` — campo `DB_PASSWORD` |
| `Can't connect to MySQL server` | MySQL não está rodando | Inicie o serviço MySQL no Gerenciador de Serviços |
| Porta 5000 em uso | Outro programa ocupa a porta | Altere a porta em `run_waitress.py` (ex: `port=5001`) |
| Página não carrega na rede | Firewall bloqueando | Libere a porta 5000 no Firewall do Windows |

---

## Informações de Suporte

- **Arquivo de banco de dados:** `banco.sql`  
- **Dependências:** `requirements.txt`  
- **Servidor:** `run_waitress.py`  
- **Configurações:** `.env`

---

*Documento gerado em março de 2026.*
