/* Camada de tela: tudo que desenha ou mostra algo para o usuário. */

var UI = {

  el: function (id) {
    return document.getElementById(id);
  },

  /* --- Troca de telas --- */

  showAuth: function () {
    UI.el("view-auth").hidden = false;
    UI.el("view-board").hidden = true;
    UI.el("user-box").hidden = true;
  },

  showBoard: function (username) {
    UI.el("view-auth").hidden = true;
    UI.el("view-board").hidden = false;
    UI.el("user-box").hidden = false;
    UI.el("user-name").innerHTML = "conectado como <strong></strong>";
    UI.el("user-name").querySelector("strong").textContent = username;
  },

  /* --- Situação da API (GET /ping) --- */

  setApiStatus: function (online) {
    var box = UI.el("api-status");
    box.classList.remove("is-checking", "is-online", "is-offline");
    box.classList.add(online ? "is-online" : "is-offline");
    UI.el("api-status-text").textContent = online ? "API online" : "API offline";
  },

  /* --- Datas --- */

  formatDate: function (isoDate) {
    if (!isoDate) { return null; }
    var parts = isoDate.slice(0, 10).split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  },

  formatTime: function (date) {
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
  },

  /* --- Cards de tarefa --- */

  renderTasks: function (tasks, handlers) {
    var list = UI.el("task-list");
    list.innerHTML = "";
    UI.el("empty-state").hidden = tasks.length > 0;

    tasks.forEach(function (task) {
      list.appendChild(UI.buildCard(task, handlers));
    });
  },

  buildCard: function (task, handlers) {
    var card = document.createElement("article");
    card.className = "task-card";
    if (task.done) { card.classList.add("is-done"); }
    if (task.overdue) { card.classList.add("is-overdue"); }

    /* topo: marcar concluída (PATCH) + título */
    var top = document.createElement("div");
    top.className = "task-top";

    var check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = task.done;
    check.title = task.done ? "Marcar como pendente" : "Marcar como concluída";
    check.addEventListener("change", function () {
      handlers.onToggle(task, check.checked);
    });

    var title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    top.appendChild(check);
    top.appendChild(title);
    card.appendChild(top);

    if (task.description) {
      var desc = document.createElement("p");
      desc.className = "task-desc";
      desc.textContent = task.description;
      card.appendChild(desc);
    }

    /* etiquetas */
    var tags = document.createElement("div");
    tags.className = "task-tags";

    if (task.due_date) {
      var due = document.createElement("span");
      due.className = "tag" + (task.overdue ? " is-overdue" : "");
      due.textContent = (task.overdue ? "atrasada · " : "prazo ") + UI.formatDate(task.due_date);
      tags.appendChild(due);
    }

    var state = document.createElement("span");
    state.className = "tag" + (task.done ? " is-done" : "");
    state.textContent = task.done ? "concluída" : "pendente";
    tags.appendChild(state);

    var created = document.createElement("span");
    created.className = "tag";
    created.textContent = "criada em " + UI.formatDate(task.created_at);
    tags.appendChild(created);

    card.appendChild(tags);

    /* ações */
    var actions = document.createElement("div");
    actions.className = "task-actions";

    var detail = document.createElement("button");
    detail.type = "button";
    detail.className = "ghost-btn";
    detail.textContent = "Detalhes";
    detail.addEventListener("click", function () { handlers.onOpen(task.id); });

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost-btn";
    remove.textContent = "Excluir";
    remove.addEventListener("click", function () { handlers.onDelete(task); });

    actions.appendChild(detail);
    actions.appendChild(remove);
    card.appendChild(actions);

    return card;
  },

  /* --- Resumo --- */

  renderStats: function (tasks) {
    var done = tasks.filter(function (t) { return t.done; }).length;
    var overdue = tasks.filter(function (t) { return t.overdue; }).length;
    UI.el("stat-total").textContent = tasks.length;
    UI.el("stat-done").textContent = done;
    UI.el("stat-pending").textContent = tasks.length - done;
    UI.el("stat-overdue").textContent = overdue;
  },

  /* --- Modal de detalhe --- */

  openModal: function (task) {
    UI.el("edit-title").value = task.title;
    UI.el("edit-description").value = task.description || "";
    UI.el("edit-due").value = task.due_date || "";
    UI.el("edit-done").checked = task.done;
    UI.el("modal-meta").textContent =
      "Tarefa #" + task.id + " · criada em " + UI.formatDate(task.created_at) +
      (task.overdue ? " · prazo vencido" : "");
    UI.el("modal").hidden = false;
  },

  closeModal: function () {
    UI.el("modal").hidden = true;
  },

  readModal: function () {
    return {
      title: UI.el("edit-title").value.trim(),
      description: UI.el("edit-description").value.trim() || null,
      due_date: UI.el("edit-due").value || null,
      done: UI.el("edit-done").checked
    };
  },

  /* --- Painel de chamadas --- */

  renderLog: function (entries) {
    var list = UI.el("api-log");
    list.innerHTML = "";

    entries.forEach(function (entry) {
      var item = document.createElement("li");

      var method = document.createElement("span");
      method.className = "method " + entry.method.toLowerCase();
      method.textContent = entry.method;

      var path = document.createElement("span");
      path.className = "api-path";
      path.textContent = entry.path;
      path.title = UI.formatTime(entry.time) + " · " + entry.path;

      var status = document.createElement("span");
      status.className = "api-status-code" + (entry.status >= 400 || entry.status === 0 ? " is-error" : "");
      status.textContent = entry.status === 0 ? "erro" : entry.status;

      item.appendChild(method);
      item.appendChild(path);
      item.appendChild(status);
      list.appendChild(item);
    });
  },

  /* --- Avisos --- */

  toast: function (message, type) {
    var box = document.createElement("div");
    box.className = "toast" + (type ? " is-" + type : "");
    box.textContent = message;
    UI.el("toasts").appendChild(box);
    setTimeout(function () { box.remove(); }, 3600);
  }
};
