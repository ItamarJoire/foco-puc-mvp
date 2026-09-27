/* Cliente da API.
   Uma função por rota do back-end, e um registro de todas as chamadas
   para o painel "Chamadas à API". */

function ApiError(message, status) {
  this.message = message;
  this.status = status;
}

var ApiLog = {
  entries: [],
  listeners: [],

  add: function (entry) {
    entry.time = new Date();
    ApiLog.entries.unshift(entry);
    if (ApiLog.entries.length > CONFIG.MAX_LOG) {
      ApiLog.entries.pop();
    }
    ApiLog.notify();
  },

  clear: function () {
    ApiLog.entries = [];
    ApiLog.notify();
  },

  onChange: function (listener) {
    ApiLog.listeners.push(listener);
  },

  notify: function () {
    ApiLog.listeners.forEach(function (listener) {
      listener(ApiLog.entries);
    });
  }
};

var Api = {
  token: null,

  setToken: function (token) {
    Api.token = token;
  },

  /* Ponto único por onde passam todas as requisições: monta os headers,
     registra a chamada no painel e transforma erro da API em ApiError. */
  request: function (method, path, options) {
    options = options || {};

    var headers = {};
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.auth !== false && Api.token) {
      headers["Authorization"] = "Bearer " + Api.token;
    }

    var init = { method: method, headers: headers };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    return fetch(CONFIG.API_BASE_URL + path, init)
      .catch(function () {
        ApiLog.add({ method: method, path: path, status: 0 });
        throw new ApiError(
          "Não consegui falar com a API. Ela está rodando em " + CONFIG.API_BASE_URL + "?",
          0
        );
      })
      .then(function (response) {
        ApiLog.add({ method: method, path: path, status: response.status });

        if (response.status === 204) {
          return null;
        }

        return response.json()
          .catch(function () { return null; })
          .then(function (data) {
            if (!response.ok) {
              var message = (data && data.error) || "Erro inesperado na API.";
              throw new ApiError(message, response.status);
            }
            return data;
          });
      });
  },

  /* --- Rotas públicas --- */

  ping: function () {
    return Api.request("GET", "/ping", { auth: false });
  },

  register: function (username, password) {
    return Api.request("POST", "/auth/register", {
      auth: false,
      body: { username: username, password: password }
    });
  },

  login: function (username, password) {
    return Api.request("POST", "/auth/login", {
      auth: false,
      body: { username: username, password: password }
    });
  },

  /* --- Rotas protegidas --- */

  listTasks: function (filter) {
    var path = "/tasks";
    if (filter === "done") { path += "?done=true"; }
    if (filter === "pending") { path += "?done=false"; }
    return Api.request("GET", path);
  },

  getTask: function (id) {
    return Api.request("GET", "/tasks/" + id);
  },

  createTask: function (task) {
    return Api.request("POST", "/tasks", { body: task });
  },

  replaceTask: function (id, task) {
    return Api.request("PUT", "/tasks/" + id, { body: task });
  },

  updateTask: function (id, changes) {
    return Api.request("PATCH", "/tasks/" + id, { body: changes });
  },

  deleteTask: function (id) {
    return Api.request("DELETE", "/tasks/" + id);
  }
};
