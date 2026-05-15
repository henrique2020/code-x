/**
 * Gerenciamento de Cache de arquivos para evitar requisições repetidas.
 */
const AppCache = {
    storage: {},
    allData: [],
    saveFile(path, data) { this.storage[path] = data; },
    getFile(path) { return this.storage[path]; }
};

/**
 * Utilitários de processamento de texto e dados.
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
        const ext = filePath.split('.').pop().toLowerCase();
        const map = { 
            'js': 'javascript', 
            'py': 'python'
        };
        return map[ext] || ext || 'plaintext';
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
 * Controle da Interface do Usuário (DOM).
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

            const accordionHtml = `
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
            this.elements.nav.append(accordionHtml);
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
            const groupName = `${chunk[0].number} - ${chunk[chunk.length - 1].number}`;
            html += `
                <div class="accordion-item" data-group-container>
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#group-${key}-${i}">
                            ${groupName}
                        </button>
                    </h2>
                    <div id="group-${key}-${i}" class="accordion-collapse collapse" data-bs-parent="#sub-${key}">
                        ${this.createDirectList(chunk)}
                    </div>
                </div>`;
        }
        return html + '</div></div>';
    },

    updateCodeDisplay(content, lang) {
        this.elements.codeArea.text(content).attr('class', `language-${lang} line-numbers`);
        Prism.highlightElement(this.elements.codeArea[0]);
    }
};

/**
 * Orquestrador da Aplicação.
 */
const App = {
    async init() {
        console.info("[App] Inicializando sistema...");
        try {
            AppCache.allData = await GitHubAPI.fetchRepoStructure();
            UI.renderMenu(AppCache.allData);
            
            UI.elements.search.on('keyup', (e) => this.filter($(e.target).val().toLowerCase()));
        } catch (err) {
            UI.elements.nav.html('<p class="text-danger p-3">Erro ao conectar com o GitHub.</p>');
        }
    },

    async loadCode(path) {
        const cached = AppCache.getFile(path);
        if (cached) {
            console.debug(`[App] Carregando do cache: ${path}`);
            UI.updateCodeDisplay(cached.content, cached.lang);
            return;
        }

        UI.elements.codeArea.text('Buscando código...');
        try {
            const data = await GitHubAPI.fetchFileContent(path);
            const decoded = Utils.decodeBase64(data.content);
            const lang = Utils.getPrismLanguage(data.path);
            
            AppCache.saveFile(path, { content: decoded, lang: lang });
            UI.updateCodeDisplay(decoded, lang);
        } catch (err) {
            UI.updateCodeDisplay('Erro ao carregar o arquivo.', 'plaintext');
        }
    },

    filter(term) {
        if (!term) {
            $('.accordion-item, .conversation-item, div[data-group-container]').show();
            $('.accordion-collapse').collapse('hide');
            return;
        }

        $('#language-navigation > .accordion-item').each(function() {
            const container = $(this);
            let hasMatch = false;

            container.find('.conversation-item').each(function() {
                const item = $(this);
                const match = item.data('exercise-name').toString().includes(term);
                item.toggle(match);
                if (match) hasMatch = true;
            });

            // Ajusta visibilidade de subgrupos
            container.find('div[data-group-container]').each(function() {
                const group = $(this);
                const groupHasMatch = group.find('.conversation-item:visible').length > 0;
                group.toggle(groupHasMatch);
            });

            container.toggle(hasMatch);
            if (hasMatch) container.find('.accordion-collapse').collapse('show');
        });
    }
};

// Inicialização
$(document).ready(() => App.init());