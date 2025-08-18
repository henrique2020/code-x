// Objeto que funcionará como cache para armazenar o conteúdo dos arquivos
const fileCache = {};
let allFilesData = []; // Armazena a estrutura de todos os arquivos para a pesquisa

$(document).ready(function() {
    const navContainer = $('#language-navigation');
    navContainer.html('<p class="text-white">Carregando estrutura do repositório...</p>');

    // Chama a função da API para buscar a estrutura
    fetchRepoStructure()
        .then(directoriesData => {
            allFilesData = directoriesData; // Salva os dados para a pesquisa
            buildAccordionMenu(allFilesData); // Constrói o menu com os dados recebidos
        })
        .catch(handleError);

    // Evento para a barra de pesquisa
    $('#search-box').on('keyup', function() {
        const searchTerm = $(this).val().toLowerCase();
        filterExercises(searchTerm);
    });
});

/**
 * Constrói o menu sanfona (accordion) com a lógica de agrupamento.
 * @param {Array} directoriesData - Os dados das pastas e arquivos.
 */
function buildAccordionMenu(directoriesData) {
    const navContainer = $('#language-navigation');
    navContainer.empty(); // Limpa o menu antes de reconstruir

    directoriesData.forEach(dir => {
        if (dir.files.length === 0) return;

        // Extrai o número do nome do arquivo para ordenação numérica
        dir.files.forEach(file => {
            const match = file.name.match(/\d+/);
            file.number = match ? parseInt(match[0], 10) : 0;
        });
        dir.files.sort((a, b) => a.number - b.number);

        const fileCount = dir.files.length;
        let contentHtml;

        // Lógica de Agrupamento
        if (fileCount > 50) {
            contentHtml = createGroupedList(dir.files, 50, dir.name); // Grupos de 50
        } else if (fileCount >= 15) {
            contentHtml = createGroupedList(dir.files, 15, dir.name); // Grupos de 15
        } else {
            contentHtml = createDirectList(dir.files); // Lista direta
        }

        const accordionItemHtml = `
            <div class="accordion-item" data-language-name="${dir.name.toLowerCase()}">
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${dir.name}">${dir.name}</button>
                </h2>
                <div id="collapse-${dir.name}" class="accordion-collapse collapse" data-bs-parent="#language-navigation">
                    ${contentHtml}
                </div>
            </div>`;
        navContainer.append(accordionItemHtml);
    });
}

/**
 * Cria uma lista direta de arquivos.
 */
function createDirectList(files) {
    const fileListHtml = files.map(file => `
        <li class="list-group-item conversation-item" data-exercise-name="${file.name.toLowerCase()}" onclick="loadCodeFile('${file.path}')">
            ${file.name.replace(/\.[^/.]+$/, "")}
        </li>`).join('');
    return `<div class="accordion-body p-0"><ul class="list-group list-group-flush">${fileListHtml}</ul></div>`;
}

/**
 * Cria uma lista agrupada (sub-accordion).
 */
function createGroupedList(files, groupSize, parentName) {
    let subAccordionHtml = '<div class="accordion-body p-0"><div class="accordion" id="sub-accordion-' + parentName + '">';
    for (let i = 0; i < files.length; i += groupSize) {
        const chunk = files.slice(i, i + groupSize);
        const groupName = `${chunk[0].number} - ${chunk[chunk.length - 1].number}`;
        const chunkListHtml = createDirectList(chunk);

        subAccordionHtml += `
            <div class="accordion-item" data-group-container>
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-group-${parentName}-${i}">
                        ${groupName}
                    </button>
                </h2>
                <div id="collapse-group-${parentName}-${i}" class="accordion-collapse collapse" data-bs-parent="#sub-accordion-${parentName}">
                    ${chunkListHtml}
                </div>
            </div>`;
    }
    subAccordionHtml += '</div></div>';
    return subAccordionHtml;
}

/**
 * Filtra os exercícios com base no termo de pesquisa.
 */
function filterExercises(searchTerm) {
    // Se a pesquisa estiver vazia, restaura a lista para o estado inicial.
    if (!searchTerm) {
        $('#language-navigation .accordion-item').show();
        $('#language-navigation .conversation-item').show();
        $('#language-navigation .accordion-collapse').collapse('hide');
        return;
    }

    // Itera por cada linguagem para decidir se deve ser visível
    $('#language-navigation > .accordion-item[data-language-name]').each(function() {
        const languageContainer = $(this);
        let languageHasVisibleMatch = false;

        // Lida com exercícios que estão dentro de subgrupos
        languageContainer.find('div[data-group-container]').each(function() {
            const subGroupContainer = $(this);
            let subGroupHasVisibleMatch = false;

            subGroupContainer.find('.conversation-item').each(function() {
                const exerciseItem = $(this);
                const exerciseName = exerciseItem.data('exercise-name');

                if (typeof exerciseName === 'string' && exerciseName.includes(searchTerm)) {
                    exerciseItem.show();
                    subGroupHasVisibleMatch = true;
                } else {
                    exerciseItem.hide();
                }
            });

            subGroupContainer.toggle(subGroupHasVisibleMatch);
            if (subGroupHasVisibleMatch) {
                languageHasVisibleMatch = true;
            }
        });

        // Lida com exercícios que estão em listas diretas (sem subgrupos)
        languageContainer.children('.accordion-collapse').children('.accordion-body').find('ul > .conversation-item').each(function() {
            const exerciseItem = $(this);
            if (exerciseItem.closest('div[data-group-container]').length === 0) {
                const exerciseName = exerciseItem.data('exercise-name');
                if (typeof exerciseName === 'string' && exerciseName.includes(searchTerm)) {
                    exerciseItem.show();
                    languageHasVisibleMatch = true;
                } else {
                    exerciseItem.hide();
                }
            }
        });
        
        languageContainer.toggle(languageHasVisibleMatch);
    });

    $('.accordion-item:visible > .accordion-collapse').collapse('show');
}

/**
 * Carrega o código de um arquivo.
 */
function loadCodeFile(filePath) {
    if (fileCache[filePath]) {
        const { language, content } = fileCache[filePath];
        displayCode(language, content);
        return;
    }

    const codeElement = document.getElementById('code-content');
    codeElement.textContent = 'Carregando código...';
    Prism.highlightElement(codeElement);
    
    // Chama a função da API para buscar o conteúdo do arquivo
    fetchFileContent(filePath)
        .done(fileData => {
            if (fileData.content) {
                const decodedContent = decodeBase64(fileData.content);
                const language = getLanguageFromPath(fileData.path);
                fileCache[filePath] = { language, content: decodedContent };
                displayCode(language, decodedContent);
            }
        })
        .fail(() => {
            displayCode('plaintext', `Erro ao carregar o arquivo: ${filePath}. Tente novamente.`);
        });
}

// --- Funções Utilitárias ---
function displayCode(language, codeContent) {
    const codeElement = document.getElementById('code-content');
    codeElement.textContent = codeContent;
    codeElement.className = `language-${language} line-numbers`;
    Prism.highlightElement(codeElement);
}

function copyToClipboard() {
    navigator.clipboard.writeText(document.getElementById('code-content').textContent);
}

function decodeBase64(base64) {
    const binaryString = atob(base64.replace(/\s/g, ''));
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

function getLanguageFromPath(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const map = { 'c': 'c', 'java': 'java', 'php': 'php', 'js': 'javascript', 'py': 'python', 'sql': 'sql' };
    return map[ext] || 'plaintext';
}

function handleError(error) {
    console.error("Ocorreu um erro:", error);
    $('#language-navigation').html('<p class="text-danger">Não foi possível carregar os dados do repositório.</p>');
}