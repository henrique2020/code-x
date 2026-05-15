/**
 * Gerenciamento de Cache Local.
 */
const AppCache = {
    storage: {},
    allData: [],
    saveFile(path, data) { this.storage[path] = data; },
    getFile(path) { return this.storage[path]; }
};

/**
 * Utilitários e Processamento.
 */
const Utils = {
    normalizeKey(name) {
        if (!name) return '';
        const lower = name.toLowerCase().trim();
        if (lower === 'c++') return 'cpp';
        if (lower === 'c#') return 'csharp';
        return lower.replace(/[^\w]/g, '');
    },

    getPrismLanguage(filePath) {
        const parts = filePath.split('.');
        if (parts.length === 1) return 'plaintext';

        const ext = parts.pop().toLowerCase();
        const map = { 
            'js': 'javascript', 
            'py': 'python' 
        };
        
        return map[ext] || ext;
    },

    decodeBase64(base64) {
        const binaryString = atob(base64.replace(/\s/g, ''));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    }
};

/**
 * Controle da Interface (UI).
 */
const UI = {
    elements: {
        nav: $('#language-navigation'),
        search: $('#search-box'),
        codeArea: $('#code-content')
    },

    /**
     * Renderiza o menu principal.
     */
    renderMenu(data) {
        console.log("[UI] Renderizando menu lateral...");
        this.elements.nav.empty();

        data.forEach(dir => {
            if (dir.files.length === 0) return;

           // Ordenação numérica dos arquivos
            dir.files.forEach(f => {
                const match = f.name.match(/\d+/);
                f.number = match ? parseInt(match[0], 10) : 0;
            });
            dir.files.sort((a, b) => a.number - b.number);

            const count = dir.files.length;
            const key = Utils.normalizeKey(dir.name);
            const label = `${dir.name} (${count})`;

            let listContent = count > 50 ? this.createGroupedList(dir.files, 50, key) :
                              count >= 15 ? this.createGroupedList(dir.files, 15, key) :
                              this.createDirectList(dir.files);

            const html = `
                <div class="accordion-item" data-language-name="${key}">
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${key}">
                            ${label}
                        </button>
                    </h2>
                    <div id="collapse-${key}" class="accordion-collapse collapse" data-bs-parent="#language-navigation">
                        ${listContent}
                    </div>
                </div>`;
            this.elements.nav.append(html);
        });
    },

    createDirectList(files) {
        const items = files.map(f => `
            <li class="list-group-item conversation-item" data-exercise-name="${f.name.toLowerCase()}" onclick="App.loadCode('${f.path}')">
                ${f.name.replace(/\.[^/.]+$/, "")}
            </li>`).join('');
        return `<div class="accordion-body p-0"><ul class="list-group list-group-flush">${items}</ul></div>`;
    },

    createGroupedList(files, size, key) {
        let html = `<div class="accordion-body p-0"><div class="accordion" id="sub-${key}">`;
        for (let i = 0; i < files.length; i += size) {
            const chunk = files.slice(i, i + size);
            const groupLabel = `${chunk[0].number} - ${chunk[chunk.length - 1].number}`;
            html += `
                <div class="accordion-item" data-group-container>
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#group-${key}-${i}">
                            ${groupLabel}
                        </button>
                    </h2>
                    <div id="group-${key}-${i}" class="accordion-collapse collapse" data-bs-parent="#sub-${key}">
                        ${this.createDirectList(chunk)}
                    </div>
                </div>`;
        }
        return html + '</div></div>';
    },

    updateCode(content, lang) {
        this.elements.codeArea.text(content).attr('class', `language-${lang} line-numbers`);
        Prism.highlightElement(this.elements.codeArea[0]);
    }
};

/**
 * Orquestrador (App).
 */
const App = {
    async init() {
        console.info("[App] Inicializando sistema...");
        try {
            AppCache.allData = await GitHubAPI.fetchRepoStructure();
            UI.renderMenu(AppCache.allData);
            UI.elements.search.on('keyup', (e) => this.filter($(e.target).val().toLowerCase()));
        } catch (err) {
            UI.elements.nav.html('<p class="text-danger p-3">Erro de conexão.</p>');
        }
    },

    async loadCode(path) {
        const cached = AppCache.getFile(path);
        if (cached) {
            console.debug(`[App] Carregando do cache: ${path}`);
            UI.updateCode(cached.content, cached.lang);
            return;
        }

        UI.elements.codeArea.text('Carregando...');
        try {
            const data = await GitHubAPI.fetchFileContent(path);
            const decoded = Utils.decodeBase64(data.content);
            const lang = Utils.getPrismLanguage(data.path);
            
            AppCache.saveFile(path, { content: decoded, lang: lang });
            UI.updateCode(decoded, lang);
        } catch (err) {
            UI.updateCode('Erro ao carregar o arquivo.', 'plaintext');
        }
    },

    filter(term) {
        if (!term) {
            $('.accordion-item, .conversation-item, div[data-group-container]').show();
            $('.accordion-collapse').collapse('hide');
            return;
        }

        $('#language-navigation > .accordion-item[data-language-name]').each(function() {
            const container = $(this);
            let languageHasVisibleMatch = false;

            // 1. Filtragem nos subgrupos
            container.find('div[data-group-container]').each(function() {
                const group = $(this);
                let groupHasMatch = false;

                group.find('.conversation-item').each(function() {
                    const item = $(this);
                    const exerciseName = item.data('exercise-name');
                    const match = typeof exerciseName === 'string' && exerciseName.includes(term);
                    
                    item.toggle(match);
                    if (match) groupHasMatch = true;
                });

                group.toggle(groupHasMatch);
                if (groupHasMatch) languageHasVisibleMatch = true;
            });

            // 2. Filtragem em listas diretas (sem subgrupos)
            container.children('.accordion-collapse').children('.accordion-body').find('ul > .conversation-item').each(function() {
                const item = $(this);
                if (item.closest('div[data-group-container]').length === 0) {
                    const exerciseName = item.data('exercise-name');
                    const match = typeof exerciseName === 'string' && exerciseName.includes(term);
                    
                    item.toggle(match);
                    if (match) languageHasVisibleMatch = true;
                }
            });

            container.toggle(languageHasVisibleMatch);
        });

        $('.accordion-item:visible > .accordion-collapse').collapse('show');
    }
};

$(document).ready(() => App.init());