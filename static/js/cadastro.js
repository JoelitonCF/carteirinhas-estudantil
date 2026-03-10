document.addEventListener('DOMContentLoaded', () => {
    // Carregar Turmas do Banco de Dados
    async function carregarTurmas() {
        try {
            const res = await fetch('/api/turmas');
            if (res.ok) {
                const turmas = await res.json();
                const selectTurma = document.getElementById('turma');
                if (selectTurma) {
                    turmas.forEach(t => {
                        const opt = document.createElement('option');
                        // Tenta usar sigla, ou id, ou nome como valor pro banco
                        opt.value = t.sigla || t.id || t.nome;
                        opt.textContent = t.nome || t.sigla || t.id;
                        selectTurma.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.error('Erro ao carregar turmas', e);
        }
    }
    carregarTurmas();

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes'
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }

    // Input de Foto e Drag/Drop
    const fotoInput = document.getElementById('foto');
    const dropZone = document.getElementById('drop-zone');
    const previewContainer = document.getElementById('file-preview');
    const previewImg = document.getElementById('preview-image');
    const previewName = document.getElementById('preview-name');
    const previewSize = document.getElementById('preview-size');

    // Drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.borderColor = 'var(--primary)';
            dropZone.style.backgroundColor = 'var(--primary-light)';
            if (document.documentElement.getAttribute('data-theme') === 'dark') {
                dropZone.style.backgroundColor = 'rgba(79, 70, 229, 0.05)';
            }
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.backgroundColor = 'var(--bg-color)';
        }, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        let dt = e.dataTransfer;
        let files = dt.files;
        fotoInput.files = files; // Assign files to input
        updatePreview();
    }

    fotoInput.addEventListener('change', updatePreview);

    function updatePreview() {
        const file = fotoInput.files[0];
        if (file) {
            // Verificar tipo de arquivo
            if (!file.type.match('image.*')) {
                showAlert('danger', 'Por favor, selecione apenas imagens JPG ou PNG.');
                fotoInput.value = '';
                previewContainer.style.display = 'none';
                return;
            }

            // Preview local
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewName.textContent = file.name;
                previewSize.textContent = formatBytes(file.size);
                previewContainer.style.display = 'flex';
                dropZone.querySelector('.upload-content').style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    }

    // Submit form handler
    const form = document.getElementById('form-cadastro');
    const btnSubmit = document.getElementById('btn-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset feedback
        const originalBtnHtml = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        btnSubmit.disabled = true;

        const formData = new FormData(form);

        try {
            const response = await fetch('/api/alunos', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showAlert('success', data.mensagem || 'Aluno cadastrado com sucesso!');
                form.reset();
                // Limpar preview
                previewContainer.style.display = 'none';
                dropZone.querySelector('.upload-content').style.display = 'block';
                previewImg.src = '';

                // Manter foco no nome para agilizar cadastro de múltiplos
                document.getElementById('nome').focus();
            } else {
                showAlert('danger', data.erro || 'Erro ao cadastrar aluno.');
            }
        } catch (error) {
            console.error('API Error:', error);
            showAlert('danger', 'Erro de conexão com o servidor da escola.');
        } finally {
            btnSubmit.innerHTML = originalBtnHtml;
            btnSubmit.disabled = false;
        }
    });
});
