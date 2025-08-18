const repoApiUrl = 'https://api.github.com/repos/henrique2020/URI/contents';

/**
 * Busca a estrutura de pastas e arquivos de forma recursiva.
 * @param {string} url - A URL do diretório a ser explorado.
 * @returns {Promise<Array>} Uma promessa que resolve com a lista de metadados de arquivos.
 */
function fetchDirectoryStructureRecursive(url) {
    return $.ajax({ url: url, method: 'GET', dataType: 'json' }).then(items => {
        const filePromises = items.filter(item => item.type === 'file').map(file => Promise.resolve(file));
        const dirPromises = items.filter(item => item.type === 'dir').map(dir => fetchDirectoryStructureRecursive(dir.url));

        return Promise.all(dirPromises).then(subDirFilesArrays => {
            const allSubFiles = [].concat(...subDirFilesArrays);
            return Promise.all(filePromises).then(currentDirFiles => allSubFiles.concat(currentDirFiles));
        });
    });
}

/**
 * Função principal para buscar toda a estrutura do repositório.
 * @returns {Promise<Array>} Uma promessa que resolve com os dados de todas as pastas e arquivos.
 */
function fetchRepoStructure() {
    return $.ajax({
        url: repoApiUrl,
        method: 'GET',
        dataType: 'json'
    }).then(rootItems => {
        const languageDirs = rootItems.filter(item => item.type === 'dir' && !item.name.startsWith('.'));
        const promises = languageDirs.map(dir =>
            fetchDirectoryStructureRecursive(dir.url).then(files => ({
                name: dir.name,
                files: files
            }))
        );
        return Promise.all(promises);
    });
}

/**
 * Busca o conteúdo de um arquivo específico da API.
 * @param {string} filePath - O caminho do arquivo a ser buscado.
 * @returns {Promise<Object>} Uma promessa que resolve com os dados do arquivo (incluindo o conteúdo).
 */
function fetchFileContent(filePath) {
    const fileApiUrl = `${repoApiUrl}/${filePath}`;
    return $.ajax({
        url: fileApiUrl,
        method: 'GET',
        dataType: 'json'
    });
}