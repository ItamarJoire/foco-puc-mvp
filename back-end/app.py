"""API de tarefas (to-do) — Flask + SQLite + JWT + Swagger."""

import os
from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from flasgger import Swagger
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

load_dotenv()  # lê o arquivo .env e joga as chaves em os.environ

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///todo.db"
app.config["SQLALCHEMY_ECHO"] = False  # True mostra no terminal o SQL gerado
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-nao-use-em-producao")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)

# O front-end é aberto direto do disco (file://), e o navegador trata essa origem
# como "null". Sem CORS liberado, toda chamada do front seria bloqueada.
CORS(app, resources={r"/*": {"origins": "*"}})

db = SQLAlchemy(app)
jwt = JWTManager(app)

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "To-Do API",
        "description": (
            "API de tarefas com autenticação JWT. "
            "Cada usuário só enxerga as próprias tarefas."
        ),
        "version": "1.0.0",
    },
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "Cole aqui: Bearer <seu_token>",
        }
    },
    "definitions": {
        "Credentials": {
            "type": "object",
            "required": ["username", "password"],
            "properties": {
                "username": {"type": "string", "example": "itamar"},
                "password": {
                    "type": "string",
                    "minLength": 8,
                    "example": "senha-forte-123",
                },
            },
        },
        "User": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "example": 1},
                "username": {"type": "string", "example": "itamar"},
            },
        },
        "Token": {
            "type": "object",
            "properties": {
                "access_token": {
                    "type": "string",
                    "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                }
            },
        },
        "TaskInput": {
            "type": "object",
            "required": ["title"],
            "properties": {
                "title": {
                    "type": "string",
                    "maxLength": 200,
                    "example": "Estudar Flask",
                },
                "description": {"type": "string", "example": "Revisar o passo de JWT"},
                "done": {"type": "boolean", "example": False},
                "due_date": {
                    "type": "string",
                    "format": "date",
                    "description": "Data de entrega no formato AAAA-MM-DD.",
                    "example": "2026-10-05",
                },
            },
        },
        "Task": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "example": 1},
                "title": {"type": "string", "example": "Estudar Flask"},
                "description": {"type": "string", "example": "Revisar o passo de JWT"},
                "done": {"type": "boolean", "example": False},
                "due_date": {
                    "type": "string",
                    "format": "date",
                    "example": "2026-10-05",
                },
                "overdue": {
                    "type": "boolean",
                    "description": "Calculado pela API: vencida e ainda não concluída.",
                    "example": False,
                },
                "created_at": {
                    "type": "string",
                    "format": "date-time",
                    "example": "2026-09-26T20:10:23",
                },
            },
        },
        "Error": {
            "type": "object",
            "properties": {
                "error": {"type": "string", "example": "Tarefa não encontrada."}
            },
        },
    },
}
swagger = Swagger(app, template=swagger_template)


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())

    tasks = db.relationship(
        "Task", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User id={self.id} username={self.username!r}>"


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    done = db.Column(db.Boolean, nullable=False, default=False)
    due_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    user = db.relationship("User", back_populates="tasks")

    @property
    def overdue(self):
        """Vencida = tem prazo, o prazo passou e a tarefa não foi concluída."""
        return bool(self.due_date and not self.done and self.due_date < date.today())

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "done": self.done,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "overdue": self.overdue,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Task id={self.id} title={self.title!r} done={self.done}>"


with app.app_context():
    db.create_all()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def body():
    """Retorna o JSON do corpo da requisição, ou {} se não vier nada."""
    return request.get_json(silent=True) or {}


def error(message, status):
    return jsonify({"error": message}), status


def validate_title(value):
    """Devolve (titulo_limpo, mensagem_de_erro)."""
    if not isinstance(value, str) or not value.strip():
        return None, "O campo 'title' é obrigatório."
    value = value.strip()
    if len(value) > 200:
        return None, "O campo 'title' deve ter no máximo 200 caracteres."
    return value, None


def parse_due_date(value):
    """Converte 'AAAA-MM-DD' em date. Devolve (data, mensagem_de_erro)."""
    if value in (None, ""):
        return None, None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date(), None
    except (TypeError, ValueError):
        return None, "O campo 'due_date' deve estar no formato AAAA-MM-DD."


def current_user_id():
    """O 'sub' do JWT volta como string; o banco usa inteiro."""
    return int(get_jwt_identity())


def get_owned_task(task_id):
    """Busca a tarefa garantindo que ela pertence a quem está logado."""
    return db.session.scalar(
        db.select(Task).filter_by(id=task_id, user_id=current_user_id())
    )


# ---------------------------------------------------------------------------
# Tratamento de erros (para a API responder sempre JSON)
# ---------------------------------------------------------------------------


@app.errorhandler(404)
def handle_404(err):
    return error("Recurso não encontrado.", 404)


@app.errorhandler(405)
def handle_405(err):
    return error("Método não permitido para esta rota.", 405)


@jwt.unauthorized_loader
def handle_missing_token(reason):
    return error("Token ausente. Envie o header Authorization: Bearer <token>.", 401)


@jwt.invalid_token_loader
def handle_invalid_token(reason):
    return error("Token inválido.", 401)


@jwt.expired_token_loader
def handle_expired_token(header, payload):
    return error("Token expirado. Faça login de novo.", 401)


# ---------------------------------------------------------------------------
# Rotas públicas
# ---------------------------------------------------------------------------


@app.get("/ping")
def ping():
    """Verifica se a API está de pé.
    ---
    tags:
      - Saúde
    responses:
      200:
        description: A API respondeu.
        examples:
          application/json: {"message": "pong"}
    """
    return {"message": "pong"}


@app.post("/auth/register")
def register():
    """Cria um usuário.
    Recebe username e senha, guarda a senha como hash e devolve o usuário criado.
    ---
    tags:
      - Autenticação
    parameters:
      - in: body
        name: body
        required: true
        schema:
          $ref: '#/definitions/Credentials'
    responses:
      201:
        description: Usuário criado.
        schema:
          $ref: '#/definitions/User'
      400:
        description: Dados inválidos (campo faltando ou senha curta).
        schema:
          $ref: '#/definitions/Error'
      409:
        description: Username já está em uso.
        schema:
          $ref: '#/definitions/Error'
    """
    data = body()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return error("Os campos 'username' e 'password' são obrigatórios.", 400)
    if len(password) < 8:
        return error("A senha deve ter no mínimo 8 caracteres.", 400)

    exists = db.session.scalar(db.select(User).filter_by(username=username))
    if exists:
        return error("Este username já está em uso.", 409)

    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"id": user.id, "username": user.username}), 201


@app.post("/auth/login")
def login():
    """Faz login e devolve o token de acesso.
    O token vale 1 hora e deve ser enviado no header Authorization das rotas de tarefas.
    ---
    tags:
      - Autenticação
    parameters:
      - in: body
        name: body
        required: true
        schema:
          $ref: '#/definitions/Credentials'
    responses:
      200:
        description: Token gerado.
        schema:
          $ref: '#/definitions/Token'
      401:
        description: Usuário ou senha inválidos.
        schema:
          $ref: '#/definitions/Error'
    """
    data = body()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    user = db.session.scalar(db.select(User).filter_by(username=username))
    if user is None or not user.check_password(password):
        return error("Usuário ou senha inválidos.", 401)

    token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": token})


# ---------------------------------------------------------------------------
# CRUD de tarefas (protegido por JWT)
# ---------------------------------------------------------------------------


@app.get("/tasks")
@jwt_required()
def list_tasks():
    """Lista as tarefas do usuário logado.
    Aceita o filtro opcional ?done=true|false.
    ---
    tags:
      - Tarefas
    security:
      - Bearer: []
    parameters:
      - in: query
        name: done
        type: boolean
        required: false
        description: Filtra por concluídas (true) ou pendentes (false).
    responses:
      200:
        description: Lista de tarefas do usuário.
        schema:
          type: array
          items:
            $ref: '#/definitions/Task'
      401:
        description: Token ausente ou inválido.
        schema:
          $ref: '#/definitions/Error'
    """
    query = db.select(Task).filter_by(user_id=current_user_id())

    done_param = request.args.get("done")
    if done_param is not None:
        query = query.filter_by(done=done_param.lower() in ("true", "1"))

    tasks = db.session.scalars(query.order_by(Task.id)).all()
    return jsonify([task.to_dict() for task in tasks])


@app.post("/tasks")
@jwt_required()
def create_task():
    """Cria uma tarefa para o usuário logado.
    ---
    tags:
      - Tarefas
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          $ref: '#/definitions/TaskInput'
    responses:
      201:
        description: Tarefa criada.
        schema:
          $ref: '#/definitions/Task'
      400:
        description: Dados inválidos (título vazio ou data em formato errado).
        schema:
          $ref: '#/definitions/Error'
      401:
        description: Token ausente ou inválido.
        schema:
          $ref: '#/definitions/Error'
    """
    data = body()
    title, message = validate_title(data.get("title"))
    if message:
        return error(message, 400)

    due_date, message = parse_due_date(data.get("due_date"))
    if message:
        return error(message, 400)

    task = Task(
        title=title,
        description=data.get("description"),
        done=bool(data.get("done", False)),
        due_date=due_date,
        user_id=current_user_id(),
    )
    db.session.add(task)
    db.session.commit()

    return jsonify(task.to_dict()), 201


@app.get("/tasks/<int:task_id>")
@jwt_required()
def get_task(task_id):
    """Busca uma tarefa do usuário logado pelo id.
    ---
    tags:
      - Tarefas
    security:
      - Bearer: []
    parameters:
      - in: path
        name: task_id
        type: integer
        required: true
        description: Id da tarefa.
    responses:
      200:
        description: A tarefa encontrada.
        schema:
          $ref: '#/definitions/Task'
      401:
        description: Token ausente ou inválido.
        schema:
          $ref: '#/definitions/Error'
      404:
        description: Tarefa não encontrada (ou é de outro usuário).
        schema:
          $ref: '#/definitions/Error'
    """
    task = get_owned_task(task_id)
    if task is None:
        return error("Tarefa não encontrada.", 404)
    return jsonify(task.to_dict())


@app.put("/tasks/<int:task_id>")
@jwt_required()
def replace_task(task_id):
    """Substitui uma tarefa inteira.
    Campos omitidos voltam ao valor padrão — é a semântica do PUT.
    ---
    tags:
      - Tarefas
    security:
      - Bearer: []
    parameters:
      - in: path
        name: task_id
        type: integer
        required: true
        description: Id da tarefa.
      - in: body
        name: body
        required: true
        schema:
          $ref: '#/definitions/TaskInput'
    responses:
      200:
        description: Tarefa substituída.
        schema:
          $ref: '#/definitions/Task'
      400:
        description: Dados inválidos.
        schema:
          $ref: '#/definitions/Error'
      401:
        description: Token ausente ou inválido.
        schema:
          $ref: '#/definitions/Error'
      404:
        description: Tarefa não encontrada (ou é de outro usuário).
        schema:
          $ref: '#/definitions/Error'
    """
    task = get_owned_task(task_id)
    if task is None:
        return error("Tarefa não encontrada.", 404)

    data = body()
    title, message = validate_title(data.get("title"))
    if message:
        return error(message, 400)

    due_date, message = parse_due_date(data.get("due_date"))
    if message:
        return error(message, 400)

    # PUT substitui o recurso: o que não veio no corpo volta ao padrão.
    task.title = title
    task.description = data.get("description")
    task.done = bool(data.get("done", False))
    task.due_date = due_date
    db.session.commit()

    return jsonify(task.to_dict())


@app.patch("/tasks/<int:task_id>")
@jwt_required()
def update_task(task_id):
    """Atualiza apenas os campos enviados.
    Útil para marcar uma tarefa como concluída sem reenviar o resto.
    ---
    tags:
      - Tarefas
    security:
      - Bearer: []
    parameters:
      - in: path
        name: task_id
        type: integer
        required: true
        description: Id da tarefa.
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            title:
              type: string
              example: Estudar Flask com calma
            description:
              type: string
              example: Revisar o passo de JWT
            done:
              type: boolean
              example: true
            due_date:
              type: string
              format: date
              example: '2026-10-05'
    responses:
      200:
        description: Tarefa atualizada.
        schema:
          $ref: '#/definitions/Task'
      400:
        description: Dados inválidos.
        schema:
          $ref: '#/definitions/Error'
      401:
        description: Token ausente ou inválido.
        schema:
          $ref: '#/definitions/Error'
      404:
        description: Tarefa não encontrada (ou é de outro usuário).
        schema:
          $ref: '#/definitions/Error'
    """
    task = get_owned_task(task_id)
    if task is None:
        return error("Tarefa não encontrada.", 404)

    data = body()
    if "title" in data:
        title, message = validate_title(data.get("title"))
        if message:
            return error(message, 400)
        task.title = title
    if "description" in data:
        task.description = data.get("description")
    if "done" in data:
        task.done = bool(data.get("done"))
    if "due_date" in data:
        due_date, message = parse_due_date(data.get("due_date"))
        if message:
            return error(message, 400)
        task.due_date = due_date

    db.session.commit()
    return jsonify(task.to_dict())


@app.delete("/tasks/<int:task_id>")
@jwt_required()
def delete_task(task_id):
    """Apaga uma tarefa do usuário logado.
    ---
    tags:
      - Tarefas
    security:
      - Bearer: []
    parameters:
      - in: path
        name: task_id
        type: integer
        required: true
        description: Id da tarefa.
    responses:
      204:
        description: Tarefa apagada (resposta sem corpo).
      401:
        description: Token ausente ou inválido.
        schema:
          $ref: '#/definitions/Error'
      404:
        description: Tarefa não encontrada (ou é de outro usuário).
        schema:
          $ref: '#/definitions/Error'
    """
    task = get_owned_task(task_id)
    if task is None:
        return error("Tarefa não encontrada.", 404)

    db.session.delete(task)
    db.session.commit()
    return "", 204


if __name__ == "__main__":
    app.run(debug=True)
