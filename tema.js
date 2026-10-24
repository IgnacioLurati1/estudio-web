// Aplica el tema guardado antes de pintar, así no hay parpadeo.
try {
  var tema = localStorage.getItem('estudio-tema');
  if (tema === 'light' || tema === 'dark') document.documentElement.dataset.theme = tema;
} catch (e) {}
