// Aplica el tema antes de pintar, así no hay parpadeo: el que eligió la persona o, si no eligió, oscuro en
// la página pública. El panel, el portal y el presupuesto siguen al sistema (sin dataset.theme).
var tema = null;
try {
  tema = localStorage.getItem('estudio-tema');
} catch (e) {}
if (tema !== 'light' && tema !== 'dark') {
  tema = /\/(admin|portal|presupuesto)(\/|$)/.test(location.pathname) ? null : 'dark';
}
if (tema) document.documentElement.dataset.theme = tema;
