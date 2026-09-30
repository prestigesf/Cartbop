// Role toggle only. Both forms are plain Netlify HTML forms and work with JS disabled;
// without JS both are shown stacked. This script never submits or sends data.
(function () {
  var shell = document.getElementById("waitlist-forms");
  if (!shell) return;
  var toggle = shell.querySelector(".toggle");
  var buttons = Array.prototype.slice.call(shell.querySelectorAll("[data-role]"));
  var forms = {
    operator: document.getElementById("waitlist-operator"),
    runner: document.getElementById("waitlist-runner")
  };
  if (!toggle || !forms.operator || !forms.runner) return;

  function setRole(role) {
    var next = role === "runner" ? "runner" : "operator";
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-role") === next));
    });
    forms.operator.hidden = next !== "operator";
    forms.runner.hidden = next !== "runner";
  }

  function applyHash() {
    var hash = (window.location.hash || "").toLowerCase();
    var role = hash.indexOf("runner") !== -1 ? "runner" : hash.indexOf("operator") !== -1 ? "operator" : null;
    if (!role) return;
    setRole(role);
    if (hash === "#waitlist-" + role) forms[role].scrollIntoView();
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () { setRole(btn.getAttribute("data-role")); });
  });

  toggle.hidden = false;
  setRole("operator");
  applyHash();
  window.addEventListener("hashchange", applyHash);
})();
