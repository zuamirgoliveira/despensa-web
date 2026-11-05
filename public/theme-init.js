// Aplica a escolha de tema antes da primeira pintura (sem flash). Sem escolha = Sistema (CSS puro).
// Arquivo estático, carregado no <head> (CSP script-src 'self'). Chave: despensa-tema = "claro" | "escuro".
(function () {
  try {
    var t = localStorage.getItem("despensa-tema");
    if (t === "claro" || t === "escuro") document.documentElement.setAttribute("data-tema", t);
  } catch (e) {
    /* armazenamento indisponível: segue o sistema */
  }
})();
