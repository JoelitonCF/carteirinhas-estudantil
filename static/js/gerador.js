document.addEventListener('DOMContentLoaded', () => {

    const { jsPDF } = window.jspdf;

    const btnGerar = document.getElementById('btn-gerar');
    const turmaSelect = document.getElementById('turma-select');
    const pendentesCheck = document.getElementById('apenas-pendentes');
    const previewContainer = document.getElementById('preview-container');
    const placeholder = document.getElementById('pdf-placeholder');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    // Carregar Turmas do Banco de Dados
    async function carregarTurmas() {
        try {
            const res = await fetch('/api/turmas');
            if (res.ok) {
                const turmas = await res.json();
                if (turmaSelect) {
                    const optionAll = turmaSelect.querySelector('option[value="ALL"]');
                    turmas.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.sigla || t.id || t.nome;
                        opt.textContent = t.nome || t.sigla || t.id;
                        if (optionAll) {
                            turmaSelect.insertBefore(opt, optionAll);
                        } else {
                            turmaSelect.appendChild(opt);
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Erro ao carregar turmas', e);
        }
    }
    carregarTurmas();

    // Constantes do Layout (A4 = 210 x 297 mm)
    // Layout dobrável: 170mm (L) x 55mm (A)
    const CARD_WIDTH = 170;
    const CARD_HEIGHT = 55;
    const MARGIN_X = 20; // Margem da esquerda (Centralizando: 210 - 170 = 40 / 2 = 20)
    const MARGIN_Y = 15; // Margem do topo
    const GAP_X = 0;    // Espaço horizontal nulo pois terá só 1 coluna
    const GAP_Y = 10;    // Espaço vertical entre as linhas

    btnGerar.addEventListener('click', async () => {
        const turma = turmaSelect.value;
        if (!turma) {
            showAlert('danger', 'Por favor, selecione uma turma primeiro.');
            return;
        }

        btnGerar.disabled = true;
        progressContainer.style.display = 'block';
        atualizarProgresso(5, 'Buscando dados...');

        try {
            // 1. Buscar Alunos
            let url = '/api/alunos';
            if (turma !== 'ALL') {
                url += `?turma=${turma}`;
            }

            const res = await fetch(url);
            let alunos = await res.json();

            if (!res.ok) throw new Error(alunos.erro || 'Erro ao buscar alunos');

            if (pendentesCheck.checked) {
                // Filtra para manter apenas onde impresso == 0 (Pendente)
                alunos = alunos.filter(a => a.impresso == 0 || a.impresso == false);
            }

            if (alunos.length === 0) {
                showAlert('warning', 'Nenhum aluno encontrado para os critérios selecionados.');
                btnGerar.disabled = false;
                progressContainer.style.display = 'none';
                return;
            }

            atualizarProgresso(20, `Processando fotos de ${alunos.length} alunos...`);

            // 2. Pré-carregar todas as imagens e convertê-las para Base64 para o jsPDF
            // Esta é a etapa mais demorada, pois precisamos carregar as imagens no canvas.
            const alunosComImagens = await Promise.all(alunos.map(async (aluno) => {
                try {
                    const imgB64 = await loadImageAsBase64(`/uploads/${aluno.foto}`);
                    aluno.imagemBase64 = imgB64;
                } catch (e) {
                    console.warn(`Erro ao carregar imagem para ${aluno.nome}, usando fallback.`);
                    aluno.imagemBase64 = null; // Vamos tratar fallback no desenho
                }
                return aluno;
            }));

            atualizarProgresso(60, 'Gerando o arquivo PDF...');

            // Pré-carregar o modelo de fundo (Photoshop)
            let templateBase64 = null;
            try {
                // Tenta carregar o template na pasta static.
                // O usuário deve salvar a imagem lá com o nome modelo_carteirinha.png
                templateBase64 = await loadImageAsBase64('/static/img/modelo_carteirinha.png');
            } catch (e) {
                console.warn('Modelo de fundo não encontrado em /static/img/modelo_carteirinha.png. Usando layout padrão.');
            }

            // 3. Desenhar no PDF
            gerarDocumentoPDF(alunosComImagens, templateBase64);

        } catch (e) {
            console.error(e);
            showAlert('danger', e.message || 'Ocorreu um erro inesperado.');
            btnGerar.disabled = false;
            progressContainer.style.display = 'none';
        }
    });

    function atualizarProgresso(porcentagem, texto) {
        progressBar.style.width = `${porcentagem}%`;
        progressText.textContent = texto;
    }

    // Utilitário para converter imagem de URL para Base64 (Necessário para o jsPDF)
    function loadImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                // Extrai a extensão pela URL simplificadamente
                const formato = url.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
                const dataURL = canvas.toDataURL(formato);
                resolve(dataURL);
            };
            img.onerror = function () {
                reject(new Error('Erro ao carregar imagem'));
            };
            img.src = url;
        });
    }

    function gerarDocumentoPDF(alunos, templateBase64) {
        // Inicializa PDF = Retrato (p), milímetros (mm), A4 (a4)
        const doc = new jsPDF('p', 'mm', 'a4');

        let x = MARGIN_X;
        let y = MARGIN_Y;
        let contadorItemSheet = 0; // Quantos itens já foram desenhados na página atual (0 até 4)

        alunos.forEach((aluno, index) => {
            // Cabem 4 carteirinhas por página (4 * 65 = 260mm + margem = 275mm)
            if (contadorItemSheet > 0 && contadorItemSheet % 4 === 0) {
                doc.addPage();
                x = MARGIN_X;
                y = MARGIN_Y;
                contadorItemSheet = 0;
            }

            // Apenas 1 coluna agora
            const coluna = 0;
            const linha = contadorItemSheet % 4; // 0, 1, 2 ou 3

            x = MARGIN_X + (coluna * (CARD_WIDTH + GAP_X));
            y = MARGIN_Y + (linha * (CARD_HEIGHT + GAP_Y));

            desenharCarteirinha(doc, x, y, aluno, templateBase64);

            contadorItemSheet++;
        });

        atualizarProgresso(90, 'Renderizando visualização...');

        // 4. Mostrar o PDF no Iframe
        try {
            // Isso cria uma string blob URL com os dados do PDF
            const pdfBlob = doc.output('bloburl');

            // Remove o placeholder se existir
            if (placeholder) placeholder.style.display = 'none';

            // Procura ou cria o iframe
            let iframe = document.getElementById('pdf-preview-frame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'pdf-preview-frame';
                previewContainer.appendChild(iframe);
            }

            iframe.src = pdfBlob;

            atualizarProgresso(100, 'Concluído!');
            setTimeout(() => { progressContainer.style.display = 'none'; }, 2000);

            showAlert('success', 'PDF gerado com sucesso! Salve ou Imprima o arquivo.');

            // Pergunta se deseja marcar os alunos como impressos
            if (confirm(`O PDF com ${alunos.length} carteirinhas foi gerado. Deseja marcar estes alunos como já impressos no sistema?`)) {
                marcarAlunosComoImpressos(alunos);
            }

        } catch (e) {
            console.error('Erro ao renderizar', e);
            showAlert('danger', 'Erro ao processar as fontes no PDF.');
        } finally {
            btnGerar.disabled = false;
        }
    }

    function formatarData(dataString) {
        if (!dataString) return "";
        // Se a data vier no formato ISO/GMT do banco
        const dataObj = new Date(dataString);
        if (!isNaN(dataObj.getTime())) {
            return dataObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
        return dataString;
    }

    // A função principal onde acontece o DESENHO real da carteirinha
    function desenharCarteirinha(doc, startX, startY, aluno, templateBase64) {

        if (templateBase64) {
            // Desenha a imagem de fundo ocupando 170x55
            const tipo = templateBase64.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(templateBase64, tipo, startX, startY, CARD_WIDTH, CARD_HEIGHT);

            doc.setDrawColor(200, 200, 200);
            doc.rect(startX, startY, CARD_WIDTH, CARD_HEIGHT);
        } else {
            // Fallback: Layout padrão
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(startX, startY, CARD_WIDTH, CARD_HEIGHT, 3, 3, 'FD');

            // Linha divisória da dobra (meio = 85mm)
            doc.setDrawColor(200, 200, 200);
            doc.setLineDashPattern([1, 1], 0); // linha pontilhada
            doc.line(startX + 85, startY, startX + 85, startY + CARD_HEIGHT);
            doc.setLineDashPattern([], 0); // reseta padrao solid

            // Cabeçalho Colorido (Retângulo Azul no Topo)
            doc.setFillColor(79, 70, 229);
            doc.rect(startX, startY, 85, 12, 'F'); // Frente
            doc.rect(startX + 85, startY, 85, 12, 'F'); // Verso

            // Texto Cabeçalho Frente
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text("IDENTIFICAÇÃO ESTUDANTIL", startX + (85 / 2), startY + 8, { align: 'center' });

            // Texto Cabeçalho Verso
            doc.text("INFORMAÇÕES ADICIONAIS", startX + 85 + (85 / 2), startY + 8, { align: 'center' });
        }

        /* ---------------------------------------------------------
         * FRENTE DA CARTEIRINHA (Esquerda: Área 0 a 85 relative X)
         * --------------------------------------------------------- */
        const FRENTE_X = startX;

        // Foto do Aluno à Esquerda
        const FOTO_X = FRENTE_X + 5;
        const FOTO_Y = startY + 16;
        const FOTO_WIDTH = 19;  // Largura foto
        const FOTO_HEIGHT = 25; // Altura foto

        doc.setDrawColor(220, 220, 220);
        doc.rect(FOTO_X, FOTO_Y, FOTO_WIDTH, FOTO_HEIGHT);

        if (aluno.imagemBase64) {
            doc.addImage(aluno.imagemBase64, 'JPEG', FOTO_X, FOTO_Y, FOTO_WIDTH, FOTO_HEIGHT);
        } else {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(8);
            doc.text("[Sem Foto]", FOTO_X + 2, FOTO_Y + 15);
        }

        // Textos da Frente
        const TEXT_X = FOTO_X + FOTO_WIDTH + 5;
        let currentY = FOTO_Y + 4;

        // Nome
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const splitNome = doc.splitTextToSize((aluno.nome || '').toUpperCase(), 85 - FOTO_WIDTH - 12);
        doc.text(splitNome, TEXT_X, currentY);

        currentY += (splitNome.length * 4) + 1;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);

        // Curso
        doc.text("Curso", TEXT_X, currentY);
        currentY += 3;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text((aluno.curso || 'ENSINO MÉDIO').toUpperCase(), TEXT_X, currentY);
        currentY += 5;

        // Turma e Turno
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Turma:", TEXT_X, currentY);
        doc.text("Turno:", TEXT_X + 20, currentY);
        currentY += 3;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(aluno.turma || '', TEXT_X, currentY);
        doc.text(aluno.turno || '', TEXT_X + 20, currentY);
        currentY += 5;

        // Código INEP
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Código INEP", TEXT_X, currentY);
        currentY += 3;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(aluno.codigo_inep || '', TEXT_X, currentY);

        /* ---------------------------------------------------------
         * VERSO DA CARTEIRINHA (Direita: Área 85 a 170 relative X)
         * --------------------------------------------------------- */
        const VERSO_X = startX + 85 + 5;
        let versoY = startY + 18;

        // Mãe
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Nome da Mãe", VERSO_X, versoY);
        versoY += 4;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        const splitMae = doc.splitTextToSize((aluno.nome_mae || 'NÃO INFORMADO').toUpperCase(), 75);
        doc.text(splitMae, VERSO_X, versoY);
        versoY += (splitMae.length * 4) + 2;

        // Data de Nascimento
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Data de Nascimento", VERSO_X, versoY);
        versoY += 4;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        const dtNascimento = formatarData(aluno.data_nascimento);
        doc.text(dtNascimento || '--/--/----', VERSO_X, versoY);
        versoY += 10;

        // Assinatura do Diretor
        doc.setDrawColor(150, 150, 150);
        doc.setLineDashPattern([], 0);
        doc.line(VERSO_X + 10, versoY, VERSO_X + 65, versoY); // Linha
        versoY += 4;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text("Diretor(a)", VERSO_X + 37.5, versoY, { align: 'center' });

        // Rodapé (nas duas metades)
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(255, 255, 255);
        // Rodapé Frente
        doc.text(`Válida até Dez. de ${aluno.ano_letivo || '2026'}`, FRENTE_X + (85 / 2), startY + CARD_HEIGHT - 3, { align: 'center' });
        // Rodapé Verso
        doc.text(`Uso Pessoal e Intransferível`, VERSO_X - 5 + (85 / 2), startY + CARD_HEIGHT - 3, { align: 'center' });
    }

    // Marca os lote dos alunos como impressos após a geração do PDF
    async function marcarAlunosComoImpressos(alunos) {
        let successCount = 0;

        for (const aluno of alunos) {
            if (aluno.impresso == 0) {
                try {
                    const formData = new FormData();
                    formData.append('impresso', '1');
                    const res = await fetch(`/api/alunos/${aluno.id}/impresso`, {
                        method: 'POST',
                        body: formData
                    });
                    if (res.ok) successCount++;
                } catch (e) {
                    console.error('Erro ao marcar impresso:', e);
                }
            }
        }

        if (successCount > 0) {
            showAlert('success', `${successCount} alunos foram marcados como impressos!`);
        }
    }
});
