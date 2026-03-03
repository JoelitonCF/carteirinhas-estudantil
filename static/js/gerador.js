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

    // Constantes do Layout (A4 = 210 x 297 mm)
    const CARD_WIDTH = 85;
    const CARD_HEIGHT = 55;
    const MARGIN_X = 15; // Margem da esquerda
    const MARGIN_Y = 15; // Margem do topo
    const GAP_X = 10;    // Espaço horizontal entre as colunas
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

            // 3. Desenhar no PDF
            gerarDocumentoPDF(alunosComImagens);

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
                const dataURL = canvas.toDataURL('image/jpeg');
                resolve(dataURL);
            };
            img.onerror = function () {
                reject(new Error('Erro ao carregar imagem'));
            };
            img.src = url;
        });
    }

    function gerarDocumentoPDF(alunos) {
        // Inicializa PDF = Retrato (p), milímetros (mm), A4 (a4)
        const doc = new jsPDF('p', 'mm', 'a4');

        let x = MARGIN_X;
        let y = MARGIN_Y;
        let contadorItemSheet = 0; // Quantos itens já foram desenhados na página atual (0 até 8)

        alunos.forEach((aluno, index) => {
            // Se já temos 8 (ou o grid máximo definido) na página, criar nova página
            if (contadorItemSheet > 0 && contadorItemSheet % 8 === 0) {
                doc.addPage();
                x = MARGIN_X;
                y = MARGIN_Y;
                contadorItemSheet = 0;
            }

            // Calculo da Posição (coluna e linha baseado no contador)
            const coluna = contadorItemSheet % 2; // 0 (esquerda) ou 1 (direita)
            const linha = Math.floor(contadorItemSheet / 2); // 0, 1, 2 ou 3

            x = MARGIN_X + (coluna * (CARD_WIDTH + GAP_X));
            y = MARGIN_Y + (linha * (CARD_HEIGHT + GAP_Y));

            desenharCarteirinha(doc, x, y, aluno);

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

    // A função principal onde acontece o DESENHO real da carteirinha
    function desenharCarteirinha(doc, startX, startY, aluno) {

        // 1. Fundo da Carteirinha (Retângulo com bordas arredondadas)
        doc.setDrawColor(200, 200, 200); // Cor da Borda
        doc.setFillColor(255, 255, 255); // Fundo Branco
        doc.roundedRect(startX, startY, CARD_WIDTH, CARD_HEIGHT, 3, 3, 'FD'); // Fill and Draw

        // 2. Cabeçalho Colorido (Retângulo Azul no Topo)
        // Como o roundedRect puro para só uma parte é chato, desenhamos um retângulo
        // normal e deixamos um pingo de espaço, ou melhor, usamos as cores diretas.
        doc.setFillColor(79, 70, 229); // Primary Indigo color
        // Top border bar
        doc.rect(startX, startY, CARD_WIDTH, 12, 'F');

        // Texto Cabeçalho
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("IDENTIFICAÇÃO ESTUDANTIL", startX + (CARD_WIDTH / 2), startY + 8, { align: 'center' });

        // 3. Inserir a Foto do Aluno à Esquerda
        const FOTO_X = startX + 5;
        const FOTO_Y = startY + 16;
        const FOTO_SIZE = 30; // 30x30mm quadrada

        // Draw Foto Placeholder/Border
        doc.setDrawColor(220, 220, 220);
        doc.rect(FOTO_X, FOTO_Y, FOTO_SIZE, FOTO_SIZE);

        if (aluno.imagemBase64) {
            // Adiciona a Imagem Real 
            // Parâmetros: Base64, Tipo, X, Y, Width, Height
            doc.addImage(aluno.imagemBase64, 'JPEG', FOTO_X, FOTO_Y, FOTO_SIZE, FOTO_SIZE);
        } else {
            // Fallback Text se não tem Imagem
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(8);
            doc.text("[Sem Foto]", FOTO_X + 5, FOTO_Y + 15);
        }

        // 4. Inserir Textos Informativos à Direita da Foto
        const TEXT_X = FOTO_X + FOTO_SIZE + 5;
        let currentY = FOTO_Y + 5;

        // Nome
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        // Usar splitTextToSize em caso de nomes enormes
        const splitNome = doc.splitTextToSize(aluno.nome.toUpperCase(), CARD_WIDTH - FOTO_SIZE - 12);
        doc.text(splitNome, TEXT_X, currentY);

        // Se o nome pulou a linha, ajuste o height
        currentY += (splitNome.length * 5);

        // Rótulos e Informações
        doc.setFontSize(8);

        // RA
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Matrícula (RA)", TEXT_X, currentY);
        currentY += 4;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(aluno.matricula, TEXT_X, currentY);
        currentY += 6;

        // Turma & Turno lado a lado
        // Turma
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Turma", TEXT_X, currentY);

        // Turno
        doc.text("Turno", TEXT_X + 20, currentY);
        currentY += 4;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(aluno.turma, TEXT_X, currentY);
        doc.text(aluno.turno, TEXT_X + 20, currentY);
        currentY += 6;

        // 5. Rodapé da Carteirinha
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text(`Válida até Dezembro de ${aluno.ano_letivo}`, startX + (CARD_WIDTH / 2), startY + CARD_HEIGHT - 3, { align: 'center' });
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
