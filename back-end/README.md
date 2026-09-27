# Foco API | back-end do MVP

API REST de gerenciamento de tarefas construída em **Python + Flask**, com banco **SQLite**, autenticação por **JWT** e documentação **Swagger (OpenAPI)**.

Cada usuário se cadastra, faz login e passa a gerenciar apenas as próprias tarefas: a API nunca devolve tarefa de outra pessoa. O front-end da aplicação está em repositório separado.

## Funcionalidades

- Cadastro e login de usuários com senha armazenada em hash (scrypt).
- Autenticação com token JWT válido por 1 hora.
- CRUD completo de tarefas, com `PUT` (substituição) e `PATCH` (atualização parcial).
- Data de entrega (`due_date`) com validação de formato e cálculo automático de atraso (`overdue`).
- Filtro de listagem por situação (`?done=true`).
- Respostas de erro sempre em JSON, com os códigos de status adequados.
- Documentação interativa em Swagger UI.

## Pré-requisitos

- Python 3.10 ou superior
- pip

## Instalação

```bash
git clone <url-deste-repositorio>
cd back-end

# ambiente virtual
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
# Linux / macOS
source .venv/bin/activate

# dependências
pip install -r requirements.txt
```

### Variáveis de ambiente

Copie `.env.example` para `.env` e defina a chave que assina os tokens:

```
JWT_SECRET_KEY=uma-chave-aleatoria-longa
```

## Executando

```bash
python app.py
```

A API sobe em `http://127.0.0.1:5000`. O banco `instance/todo.db` é criado automaticamente na primeira execução.

| Endereço                             | O que é                                    |
| ------------------------------------ | ------------------------------------------ |
| http://127.0.0.1:5000/apidocs        | Swagger UI (documentação interativa)       |
| http://127.0.0.1:5000/apispec_1.json | Contrato OpenAPI em JSON                   |
| http://127.0.0.1:5000/ping           | Verificação rápida de que a API está no ar |

## Dependências

| Pacote             | Para quê                                                |
| ------------------ | ------------------------------------------------------- |
| Flask              | Framework web e roteamento                              |
| Flask-SQLAlchemy   | ORM e acesso ao SQLite                                  |
| Flask-JWT-Extended | Geração e validação dos tokens JWT                      |
| Flasgger           | Geração do Swagger/OpenAPI a partir do código           |
| Flask-Cors         | Libera o acesso do front-end aberto direto do navegador |
| python-dotenv      | Carrega as variáveis do arquivo `.env`                  |

## Rotas

| Método | Rota             | Autenticada | Descrição                                                  |
| ------ | ---------------- | ----------- | ---------------------------------------------------------- |
| GET    | `/ping`          | não         | Verifica se a API está no ar                               |
| POST   | `/auth/register` | não         | Cria um usuário                                            |
| POST   | `/auth/login`    | não         | Autentica e devolve o `access_token`                       |
| GET    | `/tasks`         | sim         | Lista as tarefas do usuário (filtro opcional `?done=true`) |
| POST   | `/tasks`         | sim         | Cria uma tarefa                                            |
| GET    | `/tasks/<id>`    | sim         | Busca uma tarefa pelo id                                   |
| PUT    | `/tasks/<id>`    | sim         | Substitui a tarefa inteira                                 |
| PATCH  | `/tasks/<id>`    | sim         | Atualiza apenas os campos enviados                         |
| DELETE | `/tasks/<id>`    | sim         | Remove a tarefa                                            |

Nas rotas autenticadas, envie o header:

```
Authorization: Bearer <access_token>
```

### Exemplo

```bash
# cadastro
curl -X POST http://127.0.0.1:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "itamar", "password": "senha-forte-123"}'

# login
curl -X POST http://127.0.0.1:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "itamar", "password": "senha-forte-123"}'

# criar tarefa
curl -X POST http://127.0.0.1:5000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"title": "Gravar o vídeo do MVP", "due_date": "2026-10-05"}'
```

## Modelo de dados

```
users                          tasks
-----                          -----
id            PK               id            PK
username      único            title         obrigatório (até 200)
password_hash                  description
created_at                     done          padrão false
                               due_date
   1 ────────── N              created_at
                               user_id       FK → users.id
```

A relação é 1:N (um usuário tem várias tarefas), com `cascade="all, delete-orphan"`: apagar o usuário apaga as tarefas dele.

## Estrutura do projeto

```
back-end/
├── app.py             # aplicação: configuração, modelos e rotas
├── api.http           # requisições prontas (extensão REST Client do VS Code)
├── requirements.txt   # dependências
├── .env.example       # modelo das variáveis de ambiente
├── .vscode/           # configuração de execução e depuração
└── instance/todo.db   # banco SQLite (criado na primeira execução)
```

## Testando

- **Swagger UI**: acesse `/apidocs`, use `POST /auth/login`, copie o `access_token`, clique em **Authorize** no topo, cole `Bearer <token>` e teste as rotas protegidas.
- **REST Client (VS Code)**: abra `api.http` e clique em _Send Request_. O token do login é reaproveitado automaticamente nas demais chamadas.

> Se você alterar o modelo de dados, apague `instance/todo.db` antes de rodar de novo: o `create_all()` cria as tabelas que faltam, mas não altera tabela existente.
