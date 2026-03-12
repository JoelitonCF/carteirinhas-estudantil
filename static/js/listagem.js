document.addEventListener('DOMContentLoaded', () => {

    const tabelaAlunos = document.getElementById('tabela-alunos');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const filtroTurma = document.getElementById('filtro-turma');
    const filtroTurno = document.getElementById('filtro-turno');

    // Carregar Turmas do Banco de Dados
    async function carregarTurmas() {
        try {
            const res = await fetch('/api/turmas');
            if (res.ok) {
                const turmas = await res.json();

                turmas.forEach(t => {
                    const value = t.sigla || t.id || t.nome;
                    const text = t.nome || t.sigla || t.id;

                    if (filtroTurma) {
                        const opt = document.createElement('option');
                        opt.value = value;
                        opt.textContent = text;
                        filtroTurma.appendChild(opt);
                    }

                    const editTurma = document.getElementById('edit-turma');
                    if (editTurma) {
                        const opt = document.createElement('option');
                        opt.value = value;
                        opt.textContent = text;
                        editTurma.appendChild(opt);
                    }
                });
            }
        } catch (e) {
            console.error('Erro ao carregar turmas', e);
        }
    }
    carregarTurmas();

    // Carregar alunos ao abrir a página
    carregarAlunos();

    btnFiltrar.addEventListener('click', carregarAlunos);

    async function carregarAlunos() {
        try {
            const turma = filtroTurma.value;
            const turno = filtroTurno.value;

            let url = '/api/alunos';
            const params = new URLSearchParams();
            if (turma) params.append('turma', turma);
            if (turno) params.append('turno', turno);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const res = await fetch(url);
            const dados = await res.json();

            if (res.ok) {
                renderizarTabela(dados);
            } else {
                showAlert('danger', dados.erro || 'Erro ao carregar dados');
            }
        } catch (e) {
            console.error(e);
            showAlert('danger', 'Erro de conexão com o servidor');
        }
    }

    function renderizarTabela(alunos) {
        if (alunos.length === 0) {
            tabelaAlunos.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-secondary);">Nenhum aluno encontrado.</td></tr>`;
            return;
        }

        tabelaAlunos.innerHTML = alunos.map(aluno => `
            <tr>
                <td>
                    <img src="/uploads/${aluno.foto}" alt="Foto" class="table-foto" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=random'">
                </td>
                <td><strong>${aluno.matricula}</strong></td>
                <td>${aluno.nome}</td>
                <td>${aluno.turma}</td>
                <td>${aluno.turno}</td>
                <td>
                    <span class="status-badge ${aluno.impresso ? 'status-impresso' : 'status-pendente'}">
                        ${aluno.impresso ? '<i class="fa-solid fa-check"></i> Impresso' : '<i class="fa-solid fa-clock"></i> Pendente'}
                    </span>
                </td>
                <td class="actions-cell">
                <button class="btn btn-primary btn-sm" onclick="abrirModalEdicao(${aluno.id})" title="Editar Dados">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="toggleImpresso(${aluno.id}, ${aluno.impresso})" title="Marcar/Desmarcar Impressão">
                        <i class="fa-solid fa-print"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletarAluno(${aluno.id})" title="Excluir Registro">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Funcionalidades Globais Injetadas para os botões do HTML via onclick
    window.deletarAluno = async (id) => {
        if (confirm('Tem certeza que deseja excluir permanentemente este aluno?')) {
            try {
                const res = await fetch(`/api/alunos/${id}`, { method: 'DELETE' });
                const dados = await res.json();

                if (res.ok) {
                    showAlert('success', 'Aluno excluído com sucesso!');
                    carregarAlunos(); // Atualiza listagem
                } else {
                    showAlert('danger', dados.erro);
                }
            } catch (e) {
                showAlert('danger', 'Erro de conexão');
            }
        }
    };

    window.toggleImpresso = async (id, statusAtual) => {
        const novoStatus = !(statusAtual == 1 || statusAtual == true); // Inverte
        const requestStatus = novoStatus ? 1 : 0;

        try {
            const formData = new FormData();
            formData.append('impresso', requestStatus);

            const res = await fetch(`/api/alunos/${id}/impresso`, {
                method: 'POST', // Usando POST como fallback (compatibilidade da Rota)
                body: formData
            });

            if (res.ok) {
                carregarAlunos(); // Atualiza listagem pra refletir nova badge
            } else {
                showAlert('danger', 'Erro ao atualizar status');
            }
        } catch (e) {
            showAlert('danger', 'Erro de conexão');
        }
    };
    // === LÓGICA DO MODAL DE EDIÇÃO ===

    const modalEdicao = document.getElementById('modal-edicao');
    const formEdicao = document.getElementById('form-edicao');

    // Abre o modal e busca os dados do ALuno selecionado
    window.abrirModalEdicao = async (id) => {
        try {
            const res = await fetch(`/api/alunos/${id}`);
            const aluno = await res.json();

            if (res.ok) {
                // Preenche os campos do formulário
                document.getElementById('edit-id').value = aluno.id;
                document.getElementById('edit-nome').value = aluno.nome;
                document.getElementById('edit-matricula').value = aluno.matricula;
                document.getElementById('edit-nome_mae').value = aluno.nome_mae || '';

                // Formata a data (YYYY-MM-DD) se ela existir do banco vindo como DateString
                if (aluno.data_nascimento) {
                    const dataNasc = new Date(aluno.data_nascimento);
                    const formattedDate = dataNasc.toISOString().split('T')[0];
                    document.getElementById('edit-data_nascimento').value = formattedDate;
                } else {
                    document.getElementById('edit-data_nascimento').value = '';
                }

                document.getElementById('edit-curso').value = aluno.curso || 'ENSINO MÉDIO';
                document.getElementById('edit-turma').value = aluno.turma;
                document.getElementById('edit-turno').value = aluno.turno;
                document.getElementById('edit-foto').value = ''; // Limpa o input de arquivo

                modalEdicao.classList.add('active'); // Mostra o modal (A classe que fizemos no CSS)
            } else {
                showAlert('danger', 'Erro ao carregar dados do aluno.');
            }
        } catch (e) {
            showAlert('danger', 'Erro de conexão ao buscar dados.');
        }
    };

    window.fecharModalEdicao = () => {
        modalEdicao.classList.remove('active');
        formEdicao.reset();
    };

    // Submeter a edição para o Backend
    formEdicao.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSubmit = document.getElementById('btn-submit-edicao');
        const originalBtnHtml = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        btnSubmit.disabled = true;

        const formData = new FormData(formEdicao);
        const alunoId = document.getElementById('edit-id').value;

        try {
            const response = await fetch(`/api/alunos/${alunoId}`, {
                method: 'PUT', // Método de atualização
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showAlert('success', data.mensagem || 'Aluno atualizado com sucesso!');
                fecharModalEdicao();
                carregarAlunos(); // Recarrega a tabelinha atrás
            } else {
                showAlert('danger', data.erro || 'Erro ao atualizar aluno.');
            }
        } catch (error) {
            showAlert('danger', 'Erro de conexão com o servidor.');
        } finally {
            btnSubmit.innerHTML = originalBtnHtml;
            btnSubmit.disabled = false;
        }
    });

    // Fechar Modal cicando fora dele (Bônus de UI)
    modalEdicao.addEventListener('click', (e) => {
        if (e.target === modalEdicao) {
            fecharModalEdicao();
        }
    });

});
