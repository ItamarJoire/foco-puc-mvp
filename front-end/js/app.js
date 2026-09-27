/* Orquestração: liga os eventos da tela às chamadas da API. */

var App = {
  filter: "all",
  tasks: [],
  editingId: null,

  init: function () {
    Theme.load();
    ApiLog.onChange(UI.renderLog);

    App.bindAuth();
    App.bindBoard();
    App.bindModal();

    /* GET /ping — mostra no cabeçalho se a API está no ar */
    Api.ping()
      .then(function () { UI.setApiStatus(true); })
      .catch(function () {
        UI.setApiStatus(false);
        UI.toast("A API não respondeu. Suba o back-end e recarregue a página.", "error");
      });

    /* sessão salva de uma visita anterior */
    if (Session.load()) {
      UI.showBoard(Session.current.username);
      App.loadTasks();
    } else {
      UI.showAuth();
    }
  },

  /* ---------------- Acesso ---------------- */

  bindAuth: function () {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        document.querySelectorAll(".auth-form").forEach(function (form) {
          form.hidden = form.dataset.panel !== tab.dataset.tab;
        });
      });
    });

    /* POST /auth/login */
    UI.el("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var username = UI.el("login-username").value.trim();
      var password = UI.el("login-password").value;

      Api.login(username, password)
        .then(function (data) {
          Session.save(username, data.access_token);
          UI.showBoard(username);
          UI.toast("Bem-vindo de volta, " + username + "!", "success");
          UI.el("login-form").reset();
          App.loadTasks();
        })
        .catch(function (err) { UI.toast(err.message, "error"); });
    });

    /* POST /auth/register seguido de POST /auth/login */
    UI.el("register-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var username = UI.el("register-username").value.trim();
      var password = UI.el("register-password").value;

      Api.register(username, password)
        .then(function () { return Api.login(username, password); })
        .then(function (data) {
          Session.save(username, data.access_token);
          UI.showBoard(username);
          UI.toast("Conta criada. Boas tarefas!", "success");
          UI.el("register-form").reset();
          App.loadTasks();
        })
        .catch(function (err) { UI.toast(err.message, "error"); });
    });

    UI.el("logout-btn").addEventListener("click", function () {
      Session.clear();
      App.tasks = [];
      UI.showAuth();
      UI.toast("Sessão encerrada.");
    });

    UI.el("theme-toggle").addEventListener("click", Theme.toggle);
  },

  /* ---------------- Quadro ---------------- */

  bindBoard: function () {
    /* POST /tasks */
    UI.el("task-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var nova = {
        title: UI.el("task-title").value.trim(),
        description: UI.el("task-description").value.trim() || null,
        due_date: UI.el("task-due").value || null
      };

      Api.createTask(nova)
        .then(function () {
          UI.el("task-form").reset();
          UI.toast("Tarefa criada.", "success");
          return App.loadTasks();
        })
        .catch(App.handleError);
    });

    /* GET /tasks e GET /tasks?done=true|false */
    document.querySelectorAll(".filter").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll(".filter").forEach(function (b) { b.classList.remove("is-active"); });
        button.classList.add("is-active");
        App.filter = button.dataset.filter;
        App.loadTasks();
      });
    });

    UI.el("reload-btn").addEventListener("click", function () { App.loadTasks(); });
    UI.el("clear-log").addEventListener("click", ApiLog.clear);
  },

  loadTasks: function () {
    return Api.listTasks(App.filter)
      .then(function (tasks) {
        App.tasks = tasks;
        UI.renderTasks(tasks, {
          onToggle: App.toggleTask,
          onOpen: App.openTask,
          onDelete: App.deleteTask
        });
        UI.renderStats(tasks);
      })
      .catch(App.handleError);
  },

  /* PATCH /tasks/<id> — muda só o campo "done" */
  toggleTask: function (task, done) {
    Api.updateTask(task.id, { done: done })
      .then(function () { return App.loadTasks(); })
      .catch(App.handleError);
  },

  /* GET /tasks/<id> — busca a versão mais recente antes de editar */
  openTask: function (id) {
    Api.getTask(id)
      .then(function (task) {
        App.editingId = task.id;
        UI.openModal(task);
      })
      .catch(App.handleError);
  },

  /* DELETE /tasks/<id> */
  deleteTask: function (task) {
    if (!confirm('Excluir a tarefa "' + task.title + '"?')) { return; }

    Api.deleteTask(task.id)
      .then(function () {
        UI.closeModal();
        UI.toast("Tarefa excluída.");
        return App.loadTasks();
      })
      .catch(App.handleError);
  },

  /* ---------------- Modal ---------------- */

  bindModal: function () {
    document.querySelectorAll('[data-close="true"]').forEach(function (element) {
      element.addEventListener("click", UI.closeModal);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { UI.closeModal(); }
    });

    /* PUT /tasks/<id> — envia o recurso inteiro */
    UI.el("edit-form").addEventListener("submit", function (event) {
      event.preventDefault();
      Api.replaceTask(App.editingId, UI.readModal())
        .then(function () {
          UI.closeModal();
          UI.toast("Tarefa atualizada.", "success");
          return App.loadTasks();
        })
        .catch(App.handleError);
    });

    UI.el("delete-btn").addEventListener("click", function () {
      var atual = App.tasks.filter(function (t) { return t.id === App.editingId; })[0];
      App.deleteTask(atual || { id: App.editingId, title: "selecionada" });
    });
  },

  /* ---------------- Erros ---------------- */

  handleError: function (err) {
    UI.toast(err.message, "error");
    if (err.status === 401) {
      Session.clear();
      UI.showAuth();
    }
  }
};

document.addEventListener("DOMContentLoaded", App.init);
