/* Sessão do usuário.
   Guarda token e nome no navegador quando possível; se o armazenamento
   não estiver disponível (acontece em alguns navegadores com file://),
   a sessão continua valendo só enquanto a página estiver aberta. */

var Session = {
  current: null,

  load: function () {
    try {
      var raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) {
        Session.current = JSON.parse(raw);
        Api.setToken(Session.current.token);
      }
    } catch (e) {
      Session.current = null;
    }
    return Session.current;
  },

  save: function (username, token) {
    Session.current = { username: username, token: token };
    Api.setToken(token);
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(Session.current));
    } catch (e) {
      /* segue só em memória */
    }
  },

  clear: function () {
    Session.current = null;
    Api.setToken(null);
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
    } catch (e) {
      /* nada a fazer */
    }
  },

  isActive: function () {
    return Session.current !== null;
  }
};

var Theme = {
  apply: function (name) {
    document.documentElement.setAttribute("data-theme", name);
    try {
      localStorage.setItem(CONFIG.THEME_KEY, name);
    } catch (e) {
      /* tema só nesta visita */
    }
  },

  load: function () {
    var saved = null;
    try {
      saved = localStorage.getItem(CONFIG.THEME_KEY);
    } catch (e) {
      saved = null;
    }
    Theme.apply(saved || "dark");
  },

  toggle: function () {
    var atual = document.documentElement.getAttribute("data-theme");
    Theme.apply(atual === "dark" ? "light" : "dark");
  }
};
