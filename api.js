/**
 * Módulo de comunicação com a API do GitHub
 * Responsável por buscar a estrutura do repositório e o conteúdo dos arquivos.
 */
const GitHubAPI = {
    repoApiUrl: 'https://api.github.com/repos/henrique2020/URI/contents',

    /**
     * Busca a estrutura de diretórios de forma recursiva.
     * @param {string} url - URL do diretório.
     * @returns {Promise<Array>} Lista de arquivos.
     */
    async fetchDirectoryStructureRecursive(url) {
        console.info(`[GitHubAPI] Explorando: ${url}`);
        try {
            const items = await $.ajax({ url: url, method: 'GET', dataType: 'json' });
            
            const filePromises = items
                .filter(item => item.type === 'file')
                .map(file => Promise.resolve(file));

            const dirPromises = items
                .filter(item => item.type === 'dir')
                .map(dir => this.fetchDirectoryStructureRecursive(dir.url));

            const subDirFilesArrays = await Promise.all(dirPromises);
            const currentDirFiles = await Promise.all(filePromises);
            
            return [].concat(...subDirFilesArrays, ...currentDirFiles);
        } catch (error) {
            console.error(`[GitHubAPI] Erro ao explorar diretório: ${url}`, error);
            throw error;
        }
    },

    /**
     * Busca toda a estrutura de pastas de linguagens e seus respectivos arquivos.
     * @returns {Promise<Array>} Estrutura completa agrupada por linguagem.
     */
    async fetchRepoStructure() {
        console.time("[GitHubAPI] Tempo de carregamento da estrutura");
        try {
            const rootItems = await $.ajax({ url: this.repoApiUrl, method: 'GET', dataType: 'json' });
            
            // Filtra apenas diretórios que não começam com ponto (ex: .github)
            const languageDirs = rootItems.filter(item => item.type === 'dir' && !item.name.startsWith('.'));
            
            const structure = await Promise.all(languageDirs.map(async (dir) => {
                const files = await this.fetchDirectoryStructureRecursive(dir.url);
                return {
                    name: dir.name,
                    files: files
                };
            }));

            console.timeEnd("[GitHubAPI] Tempo de carregamento da estrutura");
            return structure;
        } catch (error) {
            console.error("[GitHubAPI] Erro crítico ao carregar estrutura do repositório", error);
            throw error;
        }
    },

    /**
     * Busca o conteúdo bruto de um arquivo via API.
     * @param {string} filePath - Caminho do arquivo no repositório.
     */
    async fetchFileContent(filePath) {
        console.debug(`[GitHubAPI] Requisitando conteúdo: ${filePath}`);
        return $.ajax({
            url: `${this.repoApiUrl}/${filePath}`,
            method: 'GET',
            dataType: 'json'
        });
    }
};