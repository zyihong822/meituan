from pathlib import Path
p = Path(__file__).resolve().parent
shared = p / 'prototype-components' / 'pagination'
css = (p / 'style.css').read_text() + '\n' + (shared / 'pagination.css').read_text()
js = '\n'.join((p / 'date-picker.js').read_text() if name == 'date-picker.js' else (shared / 'pagination.js').read_text() if name == 'pagination.js' else (p / 'app.js').read_text() for name in ['date-picker.js', 'pagination.js', 'app.js'])
(p / 'index.html').write_text((p / 'page.html').read_text().replace('/*STYLE*/', css).replace('/*SCRIPT*/', js))
