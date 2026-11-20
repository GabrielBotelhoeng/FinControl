// Aplica o tema guardado antes do app carregar (sub-projeto 16, L1); o padrão é o claro.
// Fica fora do index.html porque a CSP (auditoria final) não aceita script embutido.
try {
  var t = localStorage.getItem('fincontrol-theme');
  if (t === 'system') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (t === 'dark') {
    document.documentElement.dataset.theme = 'dark';
    document.querySelector('meta[name="theme-color"]').content = '#0B0D09';
  }
} catch {
  // Sem acesso ao armazenamento: fica o tema claro.
}
